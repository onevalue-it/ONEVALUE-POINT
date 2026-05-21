import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@onevalue.jp"
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "My OneValue"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  // If no API key configured, silently succeed (don't block post creation)
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not set" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  }

  try {
    const { to_email, to_name, from_name, points, title, message } = await req.json()

    if (!to_email) {
      return new Response(JSON.stringify({ error: "to_email is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bạn vừa nhận được Kudos!</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
          <!-- Header gradient -->
          <tr>
            <td height="4" style="background:linear-gradient(to right,#24243F,#27D6D8)"></td>
          </tr>
          <!-- Logo -->
          <tr>
            <td align="center" style="padding:32px 40px 0">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#24243F;border-radius:12px;padding:10px 16px">
                    <span style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:-0.5px">My <span style="color:#27D6D8">OneValue</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Hero -->
          <tr>
            <td align="center" style="padding:28px 40px 0">
              <div style="font-size:48px;line-height:1">🎉</div>
              <h1 style="margin:12px 0 4px;font-size:22px;font-weight:800;color:#0f172a">
                Xin chào, ${to_name}!
              </h1>
              <p style="margin:0;font-size:15px;color:#64748b">
                <strong style="color:#24243F">${from_name}</strong> vừa gửi cho bạn lời khen ngợi
              </p>
            </td>
          </tr>
          <!-- Points badge -->
          <tr>
            <td align="center" style="padding:20px 40px 0">
              <div style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#f97316);border-radius:100px;padding:10px 28px">
                <span style="color:#ffffff;font-size:24px;font-weight:900">+${points} pts</span>
              </div>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="padding:20px 40px 0">
              <div style="background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0;padding:20px">
                <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#24243F">${title}</p>
                <p style="margin:0;font-size:14px;color:#475569;line-height:1.6">"${message}"</p>
              </div>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td align="center" style="padding:28px 40px">
              <a href="${Deno.env.get("SITE_URL") ?? "https://kudoslink.vercel.app"}/feed"
                style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:100px;padding:12px 32px">
                Xem trên My OneValue →
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:0 40px 28px">
              <p style="margin:0;font-size:12px;color:#94a3b8">
                Đây là email tự động từ hệ thống My OneValue – OVVN.<br/>
                Vui lòng không trả lời email này.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to_email],
        subject: `🎉 ${from_name} đã gửi cho bạn +${points} điểm kudos!`,
        html,
      }),
    })

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: res.ok ? 200 : 500,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
