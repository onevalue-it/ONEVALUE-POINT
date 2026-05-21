"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useStore } from "@/lib/store"
import { useT } from "@/lib/useT"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const router = useRouter()
  const { lang, setLang } = useStore()
  const t = useT()

  async function handleLogin() {
    setError("")
    if (!email) { setError(t.login_err_email); return }
    if (!password) { setError(t.login_err_pw); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(t.login_err_bad); setLoading(false); return }
    router.push("/dashboard")
  }

  async function handleForgotPassword() {
    if (!forgotEmail) return
    setForgotLoading(true)
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setForgotLoading(false)
    setForgotSent(true)
  }

  const Logo = () => (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg" style={{ backgroundColor: "#24243F" }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <polygon points="26,6 38,6 38,18" fill="#27D6D8"/>
          <text x="5" y="30" fontSize="20" fontWeight="800" fill="white" fontFamily="sans-serif">OV</text>
        </svg>
      </div>
      <h1 className="text-2xl font-black tracking-tight" style={{ color: "#24243F" }}>My OneValue</h1>
      <p className="mt-1 text-sm font-semibold text-slate-400">{t.login_subtitle}</p>
      <div className="mt-3 flex justify-center">
        <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-100 p-1">
          <button onClick={() => setLang("vi")}
            className={"rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition " + (lang === "vi" ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-600")}>VN</button>
          <button onClick={() => setLang("ja")}
            className={"rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition " + (lang === "ja" ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-600")}>JP</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6" style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 50%, #e0fafa 100%)" }}>
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-28 left-10 h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: "rgba(39,214,216,0.12)" }} />
        <div className="absolute top-40 right-0 h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: "rgba(36,36,63,0.06)" }} />
        <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: "rgba(39,214,216,0.08)" }} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#CBD5E1_1px,transparent_1px),linear-gradient(to_bottom,#CBD5E1_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.05]" />
      </div>

      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white p-8 shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-[2rem]" style={{ background: "linear-gradient(to right, #24243F, #27D6D8)" }} />

        <div className="relative">
          <Logo />

          {!showForgot ? (
            /* ── Login form ── */
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">{t.login_email}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder="you@onevalue.jp"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700">{t.login_password}</label>
                  <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email) }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition">
                    Quên mật khẩu?
                  </button>
                </div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 ring-1 ring-red-100">{error}</div>
              )}

              <button onClick={handleLogin} disabled={loading}
                className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #24243F 0%, #27D6D8 100%)" }}>
                {loading ? t.login_loading : t.login_signin}
              </button>
            </div>
          ) : (
            /* ── Forgot password form ── */
            <div className="space-y-4">
              {!forgotSent ? (
                <>
                  <p className="text-sm text-slate-600">Nhập email công ty của bạn. Chúng tôi sẽ gửi link đặt lại mật khẩu.</p>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Email</label>
                    <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
                      placeholder="you@onevalue.jp"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                  </div>
                  <button onClick={handleForgotPassword} disabled={forgotLoading || !forgotEmail}
                    className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #24243F 0%, #27D6D8 100%)" }}>
                    {forgotLoading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
                  </button>
                </>
              ) : (
                <div className="rounded-2xl bg-emerald-50 px-4 py-5 text-center ring-1 ring-emerald-100">
                  <div className="text-2xl mb-2">📧</div>
                  <p className="text-sm font-bold text-emerald-700">Đã gửi email!</p>
                  <p className="mt-1 text-xs text-emerald-600">Kiểm tra hộp thư <strong>{forgotEmail}</strong> và nhấn vào link đặt lại mật khẩu.</p>
                </div>
              )}
              <button type="button" onClick={() => { setShowForgot(false); setForgotSent(false) }}
                className="w-full text-center text-sm font-semibold text-slate-400 hover:text-slate-600 transition">
                ← Quay lại đăng nhập
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
