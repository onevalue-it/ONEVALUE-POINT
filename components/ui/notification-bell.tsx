"use client"
import { useEffect, useRef, useState } from "react"
import { useStore } from "@/lib/store"
import { useT } from "@/lib/useT"

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "vừa xong"
  if (diff < 3600) return Math.floor(diff / 60) + " phút trước"
  if (diff < 86400) return Math.floor(diff / 3600) + " giờ trước"
  return Math.floor(diff / 86400) + " ngày trước"
}

export function NotificationBell() {
  const t = useT()
  const { notifications, unreadCount, loadNotifications, markAllRead, markRead } = useStore()
  const [open, setOpen] = useState(false)
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default")
  const [permAsked, setPermAsked] = useState(false)
  const [showGranted, setShowGranted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadNotifications()
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionState(Notification.permission)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleEnableNotifications() {
    if (!("Notification" in window)) return
    setPermAsked(true)
    const result = await Notification.requestPermission()
    setPermissionState(result)
    if (result === "granted") {
      setShowGranted(true)
      setTimeout(() => setShowGranted(false), 3000)
    }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        title={t.notif_title}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up">
          {/* Permission banner */}
          {permissionState === "default" && !permAsked && (
            <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
              <span className="text-base">🔔</span>
              <p className="flex-1 text-xs text-amber-800">Bật thông báo desktop để không bỏ lỡ lời khen</p>
              <button
                onClick={handleEnableNotifications}
                className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600 transition"
              >
                Bật
              </button>
            </div>
          )}
          {permissionState === "default" && permAsked && (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-800">Trình duyệt đang chặn popup quyền.</p>
              <p className="mt-1 text-xs text-amber-700">
                Nhìn lên thanh địa chỉ, bấm vào icon 🔒 hoặc 🔔 → chọn <strong>Cho phép thông báo</strong> → tải lại trang.
              </p>
            </div>
          )}
          {permissionState === "granted" && showGranted && (
            <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-2.5">
              <span className="text-base">✅</span>
              <p className="text-xs font-semibold text-emerald-700">Thông báo desktop đã được bật!</p>
            </div>
          )}
          {permissionState === "denied" && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold text-red-700">🚫 Thông báo desktop đang bị chặn</p>
              <p className="mt-1 text-xs text-red-600">
                Bấm vào icon 🔒 trên thanh địa chỉ → <strong>Cài đặt trang web</strong> → bật lại Thông báo → tải lại trang.
              </p>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">{t.notif_title}</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                {t.notif_mark_read}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-10 w-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p className="text-sm">{t.notif_empty}</p>
              </div>
            ) : (
              notifications.map(n => {
                const isFeedback = n.type === "feedback"
                return (
                  <a
                    key={n.id}
                    href={
                     isFeedback
                        ? `/dashboard?tab=feedback&feedbackId=${n.feedback_id || ""}`
                         : `/feed#post-${n.post_id}`
                              }
                    onClick={() => { markRead(n.id); setOpen(false) }}
                    className={"flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50 border-b border-slate-50 last:border-0 " + (!n.is_read ? "bg-blue-50/60" : "")}
                  >
                    {/* Icon/avatar */}
                    <div className="mt-0.5 shrink-0">
                      {isFeedback ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-500 text-lg shadow-sm">
                          💌
                        </div>
                      ) : n.from_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.from_avatar} alt={n.from_name} className="h-10 w-10 rounded-full object-cover shadow-sm" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-xs font-bold text-white shadow-sm">
                          {n.from_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isFeedback ? (
                        <>
                          <p className="text-sm leading-snug text-slate-800">
                            <span className="font-bold">Góp ý ẩn danh</span> — bạn vừa nhận được một góp ý mới
                          </p>
                          {n.title && (
                            <p className="mt-0.5 truncate text-xs text-slate-500">"{n.title}"</p>
                          )}
                          <p className="mt-1 text-[11px] text-violet-500 font-semibold">Xem trong Dashboard → Góp ý</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm leading-snug text-slate-800">
                            <span className="font-bold">{n.from_name}</span>
                            {" "}{t.notif_sent_you}{" "}
                            <span className="font-bold text-amber-600">+{n.points} {t.notif_pts}</span>
                          </p>
                          {n.title && (
                            <p className="mt-0.5 truncate text-xs text-slate-500">"{n.title}"</p>
                          )}
                        </>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.created_at)}</p>
                    </div>

                    {/* Unread dot */}
                    {!n.is_read && (
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </a>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
