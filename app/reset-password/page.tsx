"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Supabase puts the token in the URL hash — getSession picks it up automatically
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session)
    })
  }, [])

  async function handleReset() {
    setError("")
    if (password.length < 8) { setError("Mật khẩu phải ít nhất 8 ký tự."); return }
    if (password !== confirm) { setError("Mật khẩu xác nhận không khớp."); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess(true)
    setTimeout(() => router.push("/login"), 3000)
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6"
      style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 50%, #e0fafa 100%)" }}>
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-28 left-10 h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: "rgba(39,214,216,0.12)" }} />
        <div className="absolute top-40 right-0 h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: "rgba(36,36,63,0.06)" }} />
      </div>

      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white p-8 shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-[2rem]"
          style={{ background: "linear-gradient(to right, #24243F, #27D6D8)" }} />

        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg" style={{ backgroundColor: "#24243F" }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <polygon points="26,6 38,6 38,18" fill="#27D6D8"/>
              <text x="5" y="30" fontSize="20" fontWeight="800" fill="white" fontFamily="sans-serif">OV</text>
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: "#24243F" }}>Đặt lại mật khẩu</h1>
          <p className="mt-1 text-sm font-semibold text-slate-400">My OneValue</p>
        </div>

        {success ? (
          <div className="rounded-2xl bg-emerald-50 px-4 py-5 text-center ring-1 ring-emerald-100">
            <div className="text-2xl mb-2">✅</div>
            <p className="text-sm font-bold text-emerald-700">Đổi mật khẩu thành công!</p>
            <p className="mt-1 text-xs text-emerald-600">Đang chuyển về trang đăng nhập...</p>
          </div>
        ) : !validSession ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-5 text-center ring-1 ring-amber-100">
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-sm font-bold text-amber-700">Link không hợp lệ hoặc đã hết hạn.</p>
            <button onClick={() => router.push("/login")}
              className="mt-3 text-sm font-semibold text-blue-600 hover:underline">
              Quay lại đăng nhập
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Mật khẩu mới</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Xác nhận mật khẩu mới</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </div>
            {error && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 ring-1 ring-red-100">{error}</div>
            )}
            <button onClick={handleReset} disabled={loading}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #24243F 0%, #27D6D8 100%)" }}>
              {loading ? "Đang lưu..." : "Lưu mật khẩu mới"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
