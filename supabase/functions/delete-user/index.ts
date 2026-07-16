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
    return jsonResponse(
      { error: "Method không được hỗ trợ" },
      405,
    )
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Thiếu cấu hình Supabase cho Edge Function" },
        500,
      )
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    /*
     * Kiểm tra tài khoản đang gọi function.
     * Frontend gửi JWT trong Authorization header.
     */
    const authorization = req.headers.get("Authorization")

    if (!authorization) {
      return jsonResponse(
        { error: "Bạn chưa đăng nhập" },
        401,
      )
    }

    const token = authorization.replace("Bearer ", "").trim()

    const {
      data: callerData,
      error: callerError,
    } = await supabaseAdmin.auth.getUser(token)

    if (callerError || !callerData.user) {
      console.error("Caller auth error:", callerError)

      return jsonResponse(
        { error: "Phiên đăng nhập không hợp lệ" },
        401,
      )
    }

    const callerId = callerData.user.id

    const {
      data: callerProfile,
      error: callerProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", callerId)
      .single()

    if (
      callerProfileError ||
      !callerProfile ||
      callerProfile.role !== "admin"
    ) {
      return jsonResponse(
        { error: "Chỉ Admin mới được xóa tài khoản" },
        403,
      )
    }

    const body = await req.json()
    const userId = String(body?.user_id || "").trim()

    if (!userId) {
      return jsonResponse(
        { error: "Thiếu user_id" },
        400,
      )
    }

    if (userId === callerId) {
      return jsonResponse(
        { error: "Admin không thể tự xóa tài khoản của mình" },
        400,
      )
    }

    /*
     * Kiểm tra profile mục tiêu.
     */
    const {
      data: targetProfile,
      error: targetProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle()

    if (targetProfileError) {
      console.error(
        "Target profile lookup error:",
        targetProfileError,
      )

      return jsonResponse(
        { error: targetProfileError.message },
        500,
      )
    }

    /*
     * Kiểm tra Auth user trước khi xóa.
     * Việc này giúp log rõ user có tồn tại hay không.
     */
    const {
      data: authLookup,
      error: authLookupError,
    } = await supabaseAdmin.auth.admin.getUserById(userId)

    console.log("Delete user request:", {
      userId,
      profileFound: Boolean(targetProfile),
      authFound: Boolean(authLookup?.user),
      authLookupError: authLookupError?.message,
      authLookupStatus: authLookupError?.status,
    })

    /*
     * Gỡ user khỏi vai trò manager của các nhân viên khác,
     * tránh foreign key profiles.manager_id chặn xóa.
     */
    const { error: managerError } = await supabaseAdmin
      .from("profiles")
      .update({ manager_id: null })
      .eq("manager_id", userId)

    if (managerError) {
      console.error("Clear manager error:", managerError)

      return jsonResponse(
        {
          error:
            "Không thể gỡ người dùng khỏi vai trò quản lý: " +
            managerError.message,
        },
        500,
      )
    }

    /*
     * Xóa dữ liệu phụ thuộc.
     * Thứ tự này tránh lỗi foreign key.
     */
    const dependentDeletes = [
      supabaseAdmin
        .from("budget_periods")
        .delete()
        .eq("user_id", userId),

      supabaseAdmin
        .from("notifications")
        .delete()
        .eq("user_id", userId),

      supabaseAdmin
        .from("feedback")
        .delete()
        .eq("to_user_id", userId),

      supabaseAdmin
        .from("evaluations")
        .delete()
        .or(
          `employee_id.eq.${userId},evaluator_id.eq.${userId}`,
        ),

      supabaseAdmin
        .from("point_transactions")
        .delete()
        .or(
          `from_user_id.eq.${userId},to_user_id.eq.${userId}`,
        ),
    ]

    const deleteResults = await Promise.all(
      dependentDeletes,
    )

    for (const result of deleteResults) {
      if (result.error) {
        console.error(
          "Dependent record delete error:",
          result.error,
        )

        return jsonResponse(
          {
            error:
              "Không thể xóa dữ liệu liên quan: " +
              result.error.message,
          },
          500,
        )
      }
    }

    /*
     * Xóa profile.
     */
    const { error: profileDeleteError } =
      await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", userId)

    if (profileDeleteError) {
      console.error(
        "Delete profile error:",
        profileDeleteError,
      )

      return jsonResponse(
        {
          error:
            "Không thể xóa profile: " +
            profileDeleteError.message,
        },
        500,
      )
    }

    /*
     * Xóa tài khoản Auth.
     *
     * Nếu Auth API trả 404 thì vẫn xem là thành công,
     * vì profile và dữ liệu ứng dụng đã được dọn.
     */
    if (authLookup?.user) {
      const {
        error: authDeleteError,
      } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (
        authDeleteError &&
        authDeleteError.status !== 404 &&
        !authDeleteError.message
          .toLowerCase()
          .includes("not found")
      ) {
        console.error(
          "Delete Auth user error:",
          authDeleteError,
        )

        return jsonResponse(
          {
            error:
              "Profile đã xóa nhưng không thể xóa Auth user: " +
              authDeleteError.message,
            user_id: userId,
          },
          500,
        )
      }
    }

    return jsonResponse({
      success: true,
      message: "Đã xóa tài khoản thành công",
      deleted_user: {
        id: userId,
        full_name: targetProfile?.full_name || null,
        email: targetProfile?.email || null,
      },
    })
  } catch (error) {
    console.error("Unexpected delete-user error:", error)

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500,
    )
  }
})