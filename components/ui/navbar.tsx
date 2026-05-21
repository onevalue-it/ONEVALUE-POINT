"use client"
import { useEffect, useRef, useState } from "react"
import { useStore } from "@/lib/store"
import { usePathname } from "next/navigation"
import { useT } from "@/lib/useT"
import { NotificationBell } from "@/components/ui/notification-bell"
import { supabase } from "@/lib/supabase"

export default function Navbar() {
  const { currentUser, logout, loadUser, updateAvatar, lang, setLang } = useStore()
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

  // Password change (shared state, used in both dropdown and mobile menu)
  const [showPwForm, setShowPwForm] = useState(false)
  const [pwNew, setPwNew] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    if (!currentUser) loadUser()
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
    if (pwNew.length < 8) { setPwError("Mật khẩu mới phải ít nhất 8 ký tự."); return }
    if (pwNew !== pwConfirm) { setPwError("Mật khẩu xác nhận không khớp."); return }
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

  // Reusable password form block
  const PwForm = (
    <div className="mt-2 space-y-2">
      <input
        type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
        placeholder="Mật khẩu mới (≥8 ký tự)"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <input
        type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
        placeholder="Xác nhận mật khẩu mới"
        onKeyDown={e => e.key === "Enter" && handlePasswordChange()}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {pwError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-red-100">{pwError}</p>}
      {pwSuccess && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">✓ Đổi mật khẩu thành công!</p>}
      <div className="flex gap-2">
        <button onClick={handlePasswordChange} disabled={pwLoading}
          className="flex-1 rounded-full bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
          {pwLoading ? "Đang lưu..." : "Lưu"}
        </button>
        <button onClick={() => { setShowPwForm(false); setPwNew(""); setPwConfirm(""); setPwError("") }}
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Huỷ
        </button>
      </div>
    </div>
  )

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200/80 bg-white shadow-sm">
      {/* Brand accent line */}
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: "linear-gradient(to right, #24243F, #27D6D8)" }} />

      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">

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
        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
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

          {currentUser && <NotificationBell />}

          <a href="/post"
            className="ml-1 flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg">
            {t.nav_addpost}
          </a>

          {/* ── User Dropdown ── */}
          {currentUser && (
            <div className="relative ml-2 border-l border-slate-200 pl-3" ref={userDropRef}>
              {/* Trigger: avatar + name */}
              <button
                onClick={() => { setUserDropOpen(v => !v); if (userDropOpen) setShowPwForm(false) }}
                className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-slate-100 transition"
              >
                {/* Avatar */}
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

                {/* Name + dept */}
                <div className="text-left leading-none">
                  <div className="text-xs font-bold text-slate-800">{currentUser.full_name}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {currentUser.office}{currentUser.department ? ` | ${currentUser.department}` : ""}
                  </div>
                </div>

                {/* Chevron */}
                <svg className={"h-3.5 w-3.5 text-slate-400 transition-transform " + (userDropOpen ? "rotate-180" : "")} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Dropdown panel */}
              {userDropOpen && (
                <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  {/* User info header */}
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 bg-slate-50">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="group relative h-10 w-10 shrink-0 rounded-full focus:outline-none" title="Đổi ảnh đại diện">
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

                  {/* Actions */}
                  <div className="px-3 py-2">
                    {/* Change photo */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-sm">📷</span>
                      Đổi ảnh đại diện
                    </button>

                    {/* Change password */}
                    <button
                      onClick={() => { setShowPwForm(v => !v); setPwError(""); setPwSuccess(false) }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-sm">🔒</span>
                      Đổi mật khẩu
                      <svg className={"ml-auto h-3.5 w-3.5 text-slate-400 transition-transform " + (showPwForm ? "rotate-180" : "")} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {showPwForm && (
                      <div className="px-3 pb-2">{PwForm}</div>
                    )}
                  </div>

                  {/* Language + Logout */}
                  <div className="border-t border-slate-100 px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between px-3">
                      <span className="text-xs font-semibold text-slate-500">Ngôn ngữ</span>
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
              {/* User info */}
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

              {/* Nav links */}
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
              </div>

              {/* Bottom: language + password + logout */}
              {currentUser && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Ngôn ngữ</span>
                    <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-1">
                      <button onClick={() => setLang("vi")}
                        className={"rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition " + (lang === "vi" ? "bg-white shadow-sm text-slate-800" : "text-slate-400")}>VN</button>
                      <button onClick={() => setLang("ja")}
                        className={"rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition " + (lang === "ja" ? "bg-white shadow-sm text-slate-800" : "text-slate-400")}>JP</button>
                    </div>
                  </div>

                  {/* Change password toggle */}
                  <button
                    onClick={() => { setShowPwForm(v => !v); setPwError(""); setPwSuccess(false) }}
                    className="flex w-full items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    🔒 Đổi mật khẩu
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

      {/* Shared file input */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
    </nav>
  )
}
