import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

type DeleteUserBody = {
  user_id?: string
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Bạn chưa đăng nhập")
  }

  const token = authorization.slice("Bearer ".length).trim()
  const supabaseAdmin = getAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    throw new Error("Phiên đăng nhập không hợp lệ")
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, is_active, deleted_at")
    .eq("id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single()

  if (profileError || !profile || profile.role !== "admin") {
    throw new Error("Chỉ Admin mới được xóa tài khoản")
  }

  return {
    supabaseAdmin,
    callerId: user.id,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabaseAdmin, callerId } = await requireAdmin(request)
    const body = (await request.json()) as DeleteUserBody
    const userId = String(body.user_id || "").trim()

    if (!userId) {
      return NextResponse.json({ error: "Thiếu user_id" }, { status: 400 })
    }

    if (userId === callerId) {
      return NextResponse.json(
        { error: "Admin không thể tự xóa tài khoản của mình" },
        { status: 400 }
      )
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, is_active, deleted_at")
      .eq("id", userId)
      .maybeSingle()

    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 500 })
    }

    if (!targetProfile) {
      return NextResponse.json(
        { error: "Không tìm thấy profile cần xóa" },
        { status: 404 }
      )
    }

    // Nếu profile đã soft-delete thì coi như thao tác đã hoàn tất.
    if (targetProfile.deleted_at) {
      return NextResponse.json({
        success: true,
        already_deleted: true,
        deleted_user: {
          id: userId,
          full_name: targetProfile.full_name ?? null,
          email: targetProfile.email ?? null,
        },
      })
    }

    /*
     * QUAN TRỌNG:
     * Không hard-delete profile và không xóa point_transactions/posts.
     * Các bảng này là dữ liệu lịch sử/audit của hệ thống Point.
     *
     * Thay vào đó:
     * 1) Ban tài khoản Auth để user không đăng nhập lại.
     * 2) Soft-delete profile bằng is_active=false + deleted_at.
     * 3) Gỡ user khỏi vai trò manager của người khác.
     */

    let authWasBanned = false

    const { data: authLookup, error: authLookupError } =
      await supabaseAdmin.auth.admin.getUserById(userId)

    if (
      authLookupError &&
      authLookupError.status !== 404 &&
      !authLookupError.message.toLowerCase().includes("not found")
    ) {
      return NextResponse.json(
        { error: "Không thể kiểm tra tài khoản đăng nhập: " + authLookupError.message },
        { status: 500 }
      )
    }

    if (authLookup?.user) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: "876000h" }
      )

      if (banError) {
        return NextResponse.json(
          { error: "Không thể khóa tài khoản đăng nhập: " + banError.message },
          { status: 500 }
        )
      }

      authWasBanned = true
    }

    const { error: managerError } = await supabaseAdmin
      .from("profiles")
      .update({ manager_id: null })
      .eq("manager_id", userId)

    if (managerError) {
      if (authWasBanned) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        })
      }

      return NextResponse.json(
        { error: "Không thể gỡ vai trò quản lý: " + managerError.message },
        { status: 500 }
      )
    }

    const deletedAt = new Date().toISOString()

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_active: false,
        deleted_at: deletedAt,
      })
      .eq("id", userId)

    if (profileUpdateError) {
      if (authWasBanned) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        })
      }

      return NextResponse.json(
        { error: "Không thể xóa tài khoản: " + profileUpdateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      soft_deleted: true,
      deleted_at: deletedAt,
      deleted_user: {
        id: userId,
        full_name: targetProfile.full_name ?? null,
        email: targetProfile.email ?? null,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lỗi không xác định"

    const status =
      message === "Bạn chưa đăng nhập" ||
      message === "Phiên đăng nhập không hợp lệ"
        ? 401
        : message === "Chỉ Admin mới được xóa tài khoản"
          ? 403
          : 500

    return NextResponse.json({ error: message }, { status })
  }
}
