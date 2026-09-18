import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method không được hỗ trợ" }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Thiếu cấu hình Supabase cho Edge Function" },
        500,
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const authorization = req.headers.get("Authorization")

    if (!authorization) {
      return jsonResponse({ error: "Bạn chưa đăng nhập" }, 401)
    }

    const token = authorization.replace("Bearer ", "").trim()

    const {
      data: callerData,
      error: callerError,
    } = await supabaseAdmin.auth.getUser(token)

    if (callerError || !callerData.user) {
      return jsonResponse({ error: "Phiên đăng nhập không hợp lệ" }, 401)
    }

    const callerId = callerData.user.id

    const {
      data: callerProfile,
      error: callerProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, role, is_active, deleted_at")
      .eq("id", callerId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .single()

    if (
      callerProfileError ||
      !callerProfile ||
      callerProfile.role !== "admin"
    ) {
      return jsonResponse({ error: "Chỉ Admin mới được xóa tài khoản" }, 403)
    }

    const body = await req.json()
    const userId = String(body?.user_id || "").trim()

    if (!userId) {
      return jsonResponse({ error: "Thiếu user_id" }, 400)
    }

    if (userId === callerId) {
      return jsonResponse(
        { error: "Admin không thể tự xóa tài khoản của mình" },
        400,
      )
    }

    const {
      data: targetProfile,
      error: targetProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, is_active, deleted_at")
      .eq("id", userId)
      .maybeSingle()

    if (targetProfileError) {
      return jsonResponse({ error: targetProfileError.message }, 500)
    }

    if (!targetProfile) {
      return jsonResponse({ error: "Không tìm thấy profile cần xóa" }, 404)
    }

    if (targetProfile.deleted_at) {
      return jsonResponse({
        success: true,
        already_deleted: true,
        deleted_user: {
          id: userId,
          full_name: targetProfile.full_name || null,
          email: targetProfile.email || null,
        },
      })
    }

    /*
     * Soft delete: KHÔNG xóa posts, point_transactions hay profile vật lý.
     * Nhờ đó toàn bộ lịch sử trao/nhận điểm vẫn còn nguyên.
     */
    let authWasBanned = false

    const {
      data: authLookup,
      error: authLookupError,
    } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (
      authLookupError &&
      authLookupError.status !== 404 &&
      !authLookupError.message.toLowerCase().includes("not found")
    ) {
      return jsonResponse(
        {
          error:
            "Không thể kiểm tra tài khoản đăng nhập: " +
            authLookupError.message,
        },
        500,
      )
    }

    if (authLookup?.user) {
      const { error: banError } =
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
        })

      if (banError) {
        return jsonResponse(
          { error: "Không thể khóa tài khoản đăng nhập: " + banError.message },
          500,
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

      return jsonResponse(
        {
          error:
            "Không thể gỡ người dùng khỏi vai trò quản lý: " +
            managerError.message,
        },
        500,
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

      return jsonResponse(
        { error: "Không thể xóa tài khoản: " + profileUpdateError.message },
        500,
      )
    }

    return jsonResponse({
      success: true,
      soft_deleted: true,
      deleted_at: deletedAt,
      message: "Đã xóa tài khoản thành công",
      deleted_user: {
        id: userId,
        full_name: targetProfile.full_name || null,
        email: targetProfile.email || null,
      },
    })
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})
