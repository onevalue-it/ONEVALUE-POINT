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
    .select("id, role")
    .eq("id", user.id)
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
      return NextResponse.json(
        { error: "Thiếu user_id" },
        { status: 400 }
      )
    }

    if (userId === callerId) {
      return NextResponse.json(
        { error: "Admin không thể tự xóa tài khoản của mình" },
        { status: 400 }
      )
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle()

    if (targetError) {
      return NextResponse.json(
        { error: targetError.message },
        { status: 500 }
      )
    }

    const { error: managerError } = await supabaseAdmin
      .from("profiles")
      .update({ manager_id: null })
      .eq("manager_id", userId)

    if (managerError) {
      return NextResponse.json(
        { error: "Không thể gỡ vai trò quản lý: " + managerError.message },
        { status: 500 }
      )
    }

    const deleteOperations = [
      supabaseAdmin.from("budget_periods").delete().eq("user_id", userId),
      supabaseAdmin.from("notifications").delete().eq("user_id", userId),
      supabaseAdmin.from("feedback").delete().eq("to_user_id", userId),
      supabaseAdmin
        .from("evaluations")
        .delete()
        .or(`employee_id.eq.${userId},evaluator_id.eq.${userId}`),
      supabaseAdmin
        .from("point_transactions")
        .delete()
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
    ]

    const results = await Promise.all(deleteOperations)

    const dependentError = results.find(result => result.error)?.error

    if (dependentError) {
      return NextResponse.json(
        { error: "Không thể xóa dữ liệu liên quan: " + dependentError.message },
        { status: 500 }
      )
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId)

    if (profileDeleteError) {
      return NextResponse.json(
        { error: "Không thể xóa profile: " + profileDeleteError.message },
        { status: 500 }
      )
    }

    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(userId)

    if (
      authDeleteError &&
      authDeleteError.status !== 404 &&
      !authDeleteError.message.toLowerCase().includes("not found")
    ) {
      return NextResponse.json(
        {
          error:
            "Profile đã xóa nhưng không thể xóa tài khoản đăng nhập: " +
            authDeleteError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted_user: {
        id: userId,
        full_name: targetProfile?.full_name ?? null,
        email: targetProfile?.email ?? null,
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
