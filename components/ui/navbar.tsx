"use client"
import { useEffect, useRef, useState } from "react"
import { useStore } from "@/lib/store"
import { usePathname } from "next/navigation"
import { useT } from "@/lib/useT"
import { NotificationBell } from "@/components/ui/notification-bell"
import { supabase } from "@/lib/supabase"

// ─── Feedback Modal ────────────────────────────────────────────────────────
function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { profiles, currentUser, lang } = useStore()
  const L = (vi: string, ja: string) => lang === "ja" ? ja : vi
  const [toUserId, setToUserId] = useState("")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const otherProfiles = profiles.filter(p => p.id !== currentUser?.id && p.is_active !== false)

async function handleSubmit() {
  setError("")

  if (!toUserId) {
    setError(L("Vui lòng chọn người nhận", "受取人を選択してください"))
    return
  }

  if (!title.trim()) {
    setError(L("Vui lòng nhập tiêu đề", "タイトルを入力してください"))
    return
  }

  if (!message.trim()) {
    setError(L("Vui lòng nhập nội dung góp ý", "フィードバック内容を入力してください"))
    return
  }

  setLoading(true)

  try {
    const recipient = profiles.find(p => p.id === toUserId)

    if (!recipient) {
      setError(L("Không tìm thấy người nhận", "受取人が見つかりません"))
      setLoading(false)
      return
    }

    // 1) Insert feedback và lấy id để link notification tới đúng góp ý
    const { data: fb, error: fbErr } = await supabase
      .from("feedback")
      .insert({
        to_user_id: toUserId,
        to_name: recipient.full_name,
        title: title.trim(),
        message: message.trim(),
        is_read: false,
      })
      .select("id")
      .single()

    if (fbErr || !fb) {
      console.error("feedback insert error:", fbErr)
      setError(fbErr?.message || L("Có lỗi xảy ra khi gửi góp ý", "フィードバックの送信中にエラーが発生しました"))
      setLoading(false)
      return
    }

    // 2) Nếu DB trigger đã tự tạo notification thì không tạo thêm.
    // Nếu chưa có trigger thì tạo notification bằng code.
    const { data: existingNoti, error: checkNotiErr } = await supabase
      .from("notifications")
      .select("id")
      .eq("type", "feedback")
      .eq("feedback_id", fb.id)
      .maybeSingle()

    if (checkNotiErr) {
      console.error("check notification error:", checkNotiErr)
    }

    if (!existingNoti) {
      const { error: notiErr } = await supabase
        .from("notifications")
        .insert({
          user_id: toUserId,
          post_id: null,
          feedback_id: fb.id,
          from_name: L("Ẩn danh", "匿名"),
          from_avatar: null,
          points: 0,
          title: title.trim(),
          type: "feedback",
        })

      if (notiErr) {
        console.error("notification insert error:", notiErr)
        // Không chặn flow gửi feedback nếu notification lỗi
      }
    }

    setTitle("")
    setMessage("")
    setToUserId("")
    setSuccess(true)
  } catch (err: any) {
    console.error(err)
    setError(err.message || L("Có lỗi xảy ra", "エラーが発生しました"))
  }

  setLoading(false)
}

  // Đóng khi click ngoài
  const bgRef = useRef<HTMLDivElement>(null)
  function handleBgClick(e: React.MouseEvent) {
    if (e.target === bgRef.current) onClose()
  }

  if (success) {
    return (
      <div ref={bgRef} onClick={handleBgClick}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-8 shadow-2xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-4xl">💌</div>
          <h3 className="text-lg font-bold text-slate-900">{L("Đã gửi góp ý!", "フィードバックを送信しました！")}</h3>
          <p className="mt-2 text-sm text-slate-500">
            {L("Người nhận sẽ nhận được thông báo và đọc góp ý của bạn. Danh tính của bạn được bảo mật hoàn toàn.", "受取人に通知が届き、フィードバックを確認できます。あなたの身元は完全に匿名です。")}
          </p>
          <button onClick={onClose}
            className="mt-6 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition">
            {L("Đóng", "閉じる")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={bgRef} onClick={handleBgClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">💌 {L("Góp ý cải thiện", "改善フィードバック")}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <span>🔒</span> {L("Ẩn danh — người nhận không biết bạn là ai", "匿名 — 受取人には送信者が表示されません")}
            </p>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition text-lg">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">{L("Gửi đến", "送信先")}</label>
            <select
              value={toUserId}
              onChange={e => setToUserId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">{L("Chọn người nhận...", "受取人を選択...")}</option>
              {otherProfiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}{p.department ? ` — ${p.department}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">{L("Tiêu đề", "タイトル")}</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={L("Tóm tắt góp ý của bạn...", "フィードバックの要約...")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">{L("Nội dung", "内容")}</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={L("Mô tả cụ thể để người nhận có thể hiểu và cải thiện...", "相手が理解し改善できるよう、具体的に記入してください...")}
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 ring-1 ring-red-100">
              ❌ {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
              {L("Hủy", "キャンセル")}
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition">
              {loading ? L("Đang gửi...", "送信中...") : L("🔒 Gửi ẩn danh", "🔒 匿名で送信")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Navbar ────────────────────────────────────────────────────────────────
export default function Navbar() {
  const { currentUser, logout, loadUser, updateAvatar, lang, setLang, profiles, loadProfiles } = useStore()
  const t = useT()
  const pathname = usePathname()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Mobile hamburger
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileRef = useRef<HTMLDivElement>(null)

  // User dropdown (desktop)
  const [userDropOpen, setUserDropOpen] = useState(false)
  const userDropRef = useRef<HTMLDivElement>(null)

  // Feedback modal
  const [showFeedback, setShowFeedback] = useState(false)

  // Password change
  const [showPwForm, setShowPwForm] = useState(false)
  const [pwNew, setPwNew] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    if (!currentUser) loadUser()
    if (profiles.length === 0) loadProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close mobile menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) setMobileOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Close user dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userDropRef.current && !userDropRef.current.contains(e.target as Node)) {
        setUserDropOpen(false)
        setShowPwForm(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false)
    setUserDropOpen(false)
    setShowPwForm(false)
  }, [pathname])

  async function handleLogout() {
    await logout()
    window.location.href = "/login"
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    await updateAvatar(file)
    setUploading(false)
    e.target.value = ""
  }

  async function handlePasswordChange() {
    setPwError("")
    if (pwNew.length < 8) { setPwError(lang === "ja" ? "新しいパスワードは8文字以上で入力してください。" : "Mật khẩu mới phải ít nhất 8 ký tự."); return }
    if (pwNew !== pwConfirm) { setPwError(lang === "ja" ? "確認用パスワードが一致しません。" : "Mật khẩu xác nhận không khớp."); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwLoading(false)
    if (error) { setPwError(error.message); return }
    setPwSuccess(true)
    setPwNew(""); setPwConfirm("")
    setTimeout(() => { setPwSuccess(false); setShowPwForm(false) }, 2500)
  }

  const navLinks = [
    { href: "/feed",        label: t.nav_feed },
    { href: "/leaderboard", label: t.nav_dashboard },
    { href: "/dashboard",   label: t.nav_mypage },
    { href: "/evaluation",  label: t.nav_evaluation, roles: ["manager", "hr", "admin"] },
    { href: "/admin/users", label: t.nav_admin,       roles: ["admin"] },
  ]

  const visibleNavLinks = navLinks.filter(l =>
    !l.roles || (currentUser && l.roles.includes(currentUser.role))
  )

  const initials = currentUser?.full_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() ?? ""

  const PwForm = (
    <div className="mt-2 space-y-3">
      <div>
        <label htmlFor="new-password" className="mb-1 block text-xs font-semibold text-slate-600">
          {lang === "ja" ? "新しいパスワード" : "Mật khẩu mới"}
        </label>
        <input
          id="new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          value={pwNew}
          onChange={e => { setPwNew(e.target.value); setPwError("") }}
          placeholder={lang === "ja" ? "8文字以上" : "Tối thiểu 8 ký tự"}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div>
        <label htmlFor="confirm-new-password" className="mb-1 block text-xs font-semibold text-slate-600">
          {lang === "ja" ? "新しいパスワード（確認）" : "Xác nhận mật khẩu mới"}
        </label>
        <input
          id="confirm-new-password"
          name="confirm-new-password"
          type="password"
          autoComplete="new-password"
          value={pwConfirm}
          onChange={e => { setPwConfirm(e.target.value); setPwError("") }}
          placeholder={lang === "ja" ? "同じパスワードを再入力" : "Nhập lại đúng mật khẩu phía trên"}
          onKeyDown={e => e.key === "Enter" && handlePasswordChange()}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {pwError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-red-100">{pwError}</p>}
      {pwSuccess && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">✓ {lang === "ja" ? "パスワードを変更しました！" : "Đổi mật khẩu thành công!"}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePasswordChange}
          disabled={pwLoading || !pwNew || !pwConfirm}
          className="flex-1 rounded-full bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pwLoading ? (lang === "ja" ? "保存中..." : "Đang lưu...") : (lang === "ja" ? "保存" : "Lưu")}
        </button>
        <button
          type="button"
          onClick={() => { setShowPwForm(false); setPwNew(""); setPwConfirm(""); setPwError(""); setPwSuccess(false) }}
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {lang === "ja" ? "キャンセル" : "Hủy"}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <nav className="sticky top-0 z-20 border-b border-slate-200/80 bg-white shadow-sm">
        {/* Brand accent line */}
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: "linear-gradient(to right, #24243F, #27D6D8)" }} />

        <div className="mx-auto flex w-full max-w-[1280px] items-center gap-4 px-4 py-3 md:px-6">

          {/* Logo */}
          <a href="/leaderboard" className="group flex items-center gap-3">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#24243F"/>
              <polygon points="22,8 34,8 34,20" fill="#27D6D8"/>
              <text x="6" y="26" fontSize="18" fontWeight="800" fill="white" fontFamily="sans-serif">OV</text>
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-base font-black tracking-tight" style={{ color: "#24243F" }}>My OneValue</span>
              <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Vietnam × Japan</span>
            </div>
          </a>

          {/* ── Desktop Nav ── */}
        <div className="hidden md:flex flex-1 items-center justify-end gap-1 text-sm font-medium whitespace-nowrap">
            {visibleNavLinks.map(({ href, label }) => {
              const isActive = pathname === href
              return (
                <a key={href} href={href}
                  className={"rounded-full px-4 py-2 transition-all duration-150 font-semibold " + (
                    isActive ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  )}>
                  {label}
                </a>
              )
            })}

            {/* Nút Góp ý cải thiện — desktop */}
            {currentUser && (
              <button
                onClick={() => setShowFeedback(true)}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
              >
                <span>💌</span>
                <span>{lang === "ja" ? "フィードバック" : "Góp ý"}</span>
              </button>
            )}

            {currentUser && <NotificationBell />}

            <a href="/post"
              className="ml-1 flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg">
              {t.nav_addpost}
            </a>

            {/* ── User Dropdown ── */}
            {currentUser && (
              <div className="relative ml-2 border-l border-slate-200 pl-3" ref={userDropRef}>
                <button
                  onClick={() => { setUserDropOpen(v => !v); if (userDropOpen) setShowPwForm(false) }}
                  className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-slate-100 transition"
                >
                  <div className="relative h-8 w-8 shrink-0 cursor-pointer" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
                    {currentUser.avatar ? (
                      <div className="h-8 w-8 overflow-hidden rounded-full shadow-sm ring-2 ring-blue-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={currentUser.avatar} alt={currentUser.full_name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
                        {initials}
                      </div>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      </div>
                    )}
                  </div>

                  <div className="text-left leading-none">
                    <div className="text-xs font-bold text-slate-800">{currentUser.full_name}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {currentUser.office}{currentUser.department ? ` | ${currentUser.department}` : ""}
                    </div>
                  </div>

                  <svg className={"h-3.5 w-3.5 text-slate-400 transition-transform " + (userDropOpen ? "rotate-180" : "")} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {userDropOpen && (
                  <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 bg-slate-50">
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="group relative h-10 w-10 shrink-0 rounded-full focus:outline-none" title={lang === "ja" ? "プロフィール画像を変更" : "Đổi ảnh đại diện"}>
                        {currentUser.avatar ? (
                          <div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-blue-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={currentUser.avatar} alt={currentUser.full_name} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                            {initials}
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="text-xs">📷</span>
                        </div>
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{currentUser.full_name}</div>
                        <div className="text-xs text-slate-400 truncate">{currentUser.office}{currentUser.department ? ` | ${currentUser.department}` : ""}</div>
                      </div>
                    </div>

                    <div className="px-3 py-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-sm">📷</span>
                        {lang === "ja" ? "プロフィール画像を変更" : "Đổi ảnh đại diện"}
                      </button>

                      {/* Góp ý trong dropdown */}
                      <button
                        onClick={() => { setUserDropOpen(false); setShowFeedback(true) }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 text-sm">💌</span>
                        {lang === "ja" ? "改善フィードバック" : "Góp ý cải thiện"}
                      </button>

                      <button
                        onClick={() => { setShowPwForm(v => !v); setPwError(""); setPwSuccess(false) }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-sm">🔒</span>
                        {lang === "ja" ? "パスワード変更" : "Đổi mật khẩu"}
                        <svg className={"ml-auto h-3.5 w-3.5 text-slate-400 transition-transform " + (showPwForm ? "rotate-180" : "")} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {showPwForm && <div className="px-3 pb-2">{PwForm}</div>}
                    </div>

                    <div className="border-t border-slate-100 px-3 py-3 space-y-2">
                      <div className="flex items-center justify-between px-3">
                        <span className="text-xs font-semibold text-slate-500">{lang === "ja" ? "言語" : "Ngôn ngữ"}</span>
                        <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-1">
                          <button onClick={() => setLang("vi")}
                            className={"rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide transition " + (lang === "vi" ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-600")}>VN</button>
                          <button onClick={() => setLang("ja")}
                            className={"rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide transition " + (lang === "ja" ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-600")}>JP</button>
                        </div>
                      </div>

                      <button onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-sm">🚪</span>
                        {t.nav_logout}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Mobile right side ── */}
          <div className="flex md:hidden items-center gap-2" ref={mobileRef}>
            {currentUser && <NotificationBell />}

            <button
              onClick={() => setMobileOpen(o => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 transition"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Mobile dropdown */}
            {mobileOpen && (
              <div className="absolute right-4 top-16 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {currentUser && (
                  <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <button type="button" onClick={() => { fileInputRef.current?.click(); setMobileOpen(false) }}
                      className="group relative h-10 w-10 shrink-0 rounded-full focus:outline-none">
                      {currentUser.avatar ? (
                        <div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-blue-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={currentUser.avatar} alt={currentUser.full_name} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                          {initials}
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="text-xs">📷</span>
                      </div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{currentUser.full_name}</div>
                      <div className="text-xs text-slate-400 truncate">{currentUser.office}{currentUser.department ? ` | ${currentUser.department}` : ""}</div>
                    </div>
                  </div>
                )}

                <div className="py-1">
                  {visibleNavLinks.map(({ href, label }) => {
                    const isActive = pathname === href
                    return (
                      <a key={href} href={href}
                        className={"flex items-center px-4 py-2.5 text-sm font-semibold transition " + (
                          isActive ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                        )}>
                        {label}
                      </a>
                    )
                  })}
                  <a href="/post"
                    className="flex items-center px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition">
                    + {t.nav_addpost}
                  </a>

                  {/* Góp ý — mobile menu */}
                  {currentUser && (
                    <button
                      onClick={() => { setMobileOpen(false); setShowFeedback(true) }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 transition"
                    >
                      💌 {lang === "ja" ? "改善フィードバック" : "Góp ý cải thiện"}
                    </button>
                  )}
                </div>

                {currentUser && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">{lang === "ja" ? "言語" : "Ngôn ngữ"}</span>
                      <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-1">
                        <button onClick={() => setLang("vi")}
                          className={"rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition " + (lang === "vi" ? "bg-white shadow-sm text-slate-800" : "text-slate-400")}>VN</button>
                        <button onClick={() => setLang("ja")}
                          className={"rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition " + (lang === "ja" ? "bg-white shadow-sm text-slate-800" : "text-slate-400")}>JP</button>
                      </div>
                    </div>

                    <button
                      onClick={() => { setShowPwForm(v => !v); setPwError(""); setPwSuccess(false) }}
                      className="flex w-full items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      🔒 {lang === "ja" ? "パスワード変更" : "Đổi mật khẩu"}
                      <svg className={"ml-auto h-3.5 w-3.5 text-slate-400 transition-transform " + (showPwForm ? "rotate-180" : "")} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {showPwForm && <div>{PwForm}</div>}

                    <button onClick={handleLogout}
                      className="w-full rounded-full bg-red-50 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition">
                      🚪 {t.nav_logout}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
      </nav>

      {/* Feedback Modal — render ngoài nav để không bị z-index clip */}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </>
  )
}