"use client"
import Navbar from "@/components/ui/navbar"
import { useStore } from "@/lib/store"
import { useEffect, useRef, useState } from "react"
import { useAuthGuard } from "@/lib/useAuthGuard"
import { useCountUp } from "@/lib/useCountUp"
import { useT } from "@/lib/useT"
import { supabase } from "@/lib/supabase"
import { useSearchParams } from "next/navigation"
type Feedback = {
  id: number
  to_user_id: string
  to_name: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

const BADGES = [
  { name: "Bronze",   min: 0,    max: 400,  color: "bg-orange-100 text-orange-700 ring-orange-200" },
  { name: "Silver",   min: 400,  max: 1000, color: "bg-slate-100 text-slate-600 ring-slate-300" },
  { name: "Gold",     min: 1000, max: 2000, color: "bg-amber-100 text-amber-700 ring-amber-200" },
  { name: "Platinum", min: 2000, max: 5000, color: "bg-blue-100 text-blue-700 ring-blue-200" },
  { name: "Legend",   min: 5000, max: Infinity, color: "bg-purple-100 text-purple-700 ring-purple-200" },
]

const LEVEL_BUDGETS: Record<string, { label: string; budget: number; unlimited: boolean }> = {
  ceo:      { label: "CEO",                    budget: 0,    unlimited: true  },
  director: { label: "Director/Head",          budget: 2500, unlimited: false },
  manager:  { label: "Manager",                budget: 2000, unlimited: false },
  pm:       { label: "PM/Team Leader",         budget: 1200, unlimited: false },
  senior:   { label: "Senior",                 budget: 700,  unlimited: false },
  staff:    { label: "Staff/Junior",           budget: 400,  unlimited: false },
  intern:   { label: "Intern/Part-time",       budget: 200,  unlimited: false },
}

function getCurrentPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const isFirstHalf = month < 6
  return {
    start: isFirstHalf ? `${year}-01-01` : `${year}-07-01`,
    end:   isFirstHalf ? `${year}-06-30` : `${year}-12-31`,
    label: isFirstHalf ? `H1 ${year}` : `H2 ${year}`,
  }
}

function getBadgeInfo(points: number) {
  const current = [...BADGES].reverse().find(b => points >= b.min) || BADGES[0]
  const next = BADGES.find(b => b.min > points)
  const progress = next ? ((points - current.min) / (next.min - current.min)) * 100 : 100
  return { current, next, progress }
}

function getInitials(name: string): string {
  return name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
}

function getColor(index: number): string {
  const colors = [
    "from-purple-500 to-indigo-500", "from-blue-500 to-cyan-500",
    "from-sky-500 to-blue-500", "from-teal-500 to-emerald-500",
    "from-orange-400 to-amber-500", "from-pink-500 to-rose-500",
  ]
  return colors[index % colors.length]
}

// ─── Feedback Mailbox ──────────────────────────────────────────────────────
function FeedbackMailbox() {
  const { currentUser } = useStore()

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [selected, setSelected] = useState<Feedback | null>(null)
  const [loading, setLoading] = useState(true)

  const searchParams = useSearchParams()
  const targetFeedbackId = searchParams.get("feedbackId")

  async function loadFeedbacks() {
    if (!currentUser?.full_name) return

    setLoading(true)

    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("to_name", currentUser.full_name)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("load feedback error:", error)
      setFeedbacks([])
    } else {
      setFeedbacks((data || []) as Feedback[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadFeedbacks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.full_name])

  useEffect(() => {
    if (!targetFeedbackId || feedbacks.length === 0) return

    const target = feedbacks.find(
      fb => String(fb.id) === String(targetFeedbackId)
    )

    if (target && selected?.id !== target.id) {
      handleSelect(target)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetFeedbackId, feedbacks.length])

  async function handleSelect(fb: Feedback) {
    setSelected({ ...fb, is_read: true })

    if (!fb.is_read) {
      await supabase
        .from("feedback")
        .update({ is_read: true })
        .eq("id", fb.id)

      setFeedbacks(prev =>
        prev.map(item =>
          item.id === fb.id
            ? { ...item, is_read: true }
            : item
        )
      )
    }
  }

  const feedbackUnread = feedbacks.filter(
    fb => !fb.is_read
  ).length

  return (
    <div className="animate-fade-in-up relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">💌</span>

          <div>
            <h2 className="text-base font-bold text-slate-950">
              Góp ý cải thiện
            </h2>

            <p className="text-xs text-slate-400">
              Ẩn danh — bạn không biết ai đã gửi
            </p>
          </div>
        </div>

        {feedbackUnread > 0 && (
          <span className="rounded-full bg-violet-500 px-3 py-1 text-xs font-bold text-white">
            {feedbackUnread} chưa đọc
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-slate-400">
          Đang tải góp ý...
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <span className="mb-3 text-4xl opacity-30">
            💌
          </span>

          <p className="text-sm">
            Chưa có góp ý nào
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr]">
          <div className="max-h-[520px] overflow-y-auto border-b border-slate-100 lg:border-b-0 lg:border-r">
            {feedbacks.map(fb => (
              <button
                key={fb.id}
                onClick={() => handleSelect(fb)}
                className={
                  "w-full border-b border-slate-50 px-4 py-4 text-left transition hover:bg-slate-50 " +
                  (
                    selected?.id === fb.id
                      ? "border-l-2 border-l-violet-400 bg-violet-50/60"
                      : ""
                  )
                }
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-500 text-sm">
                    💌
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={"truncate text-sm " + (
                        !fb.is_read
                          ? "font-bold text-slate-900"
                          : "font-medium text-slate-700"
                      )}>
                        {fb.title}
                      </p>

                      {!fb.is_read && (
                        <div className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {fb.message}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      {new Date(fb.created_at).toLocaleDateString(
                        "vi-VN",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="min-h-[300px] p-6">
            {selected ? (
              <div className="animate-fade-in-up">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {selected.title}
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(selected.created_at).toLocaleDateString(
                        "vi-VN",
                        {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-100">
                    🔒 Ẩn danh
                  </div>
                </div>

                <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-700">
                  {selected.message}
                </div>

                <p className="mt-4 text-xs italic text-slate-400">
                  * Danh tính người gửi được bảo mật hoàn toàn.
                </p>
              </div>
            ) : (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-slate-300">
                <span className="mb-2 text-4xl">
                  💌
                </span>

                <p className="text-sm">
                  Chọn một góp ý để đọc
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function DashboardPage() {
  useAuthGuard()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "feedback" ? "feedback" : "overview"

  const { currentUser, profiles, loadUser, loadProfiles, updateAvatar } = useStore()
  const [activeTab, setActiveTab] = useState<"overview" | "feedback">(initialTab as "overview" | "feedback")
  const [isLoading, setIsLoading] = useState(true)
  const [barsMounted, setBarsMounted] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const t = useT()

  const [postsReceived, setPostsReceived] = useState<any[]>([])
  const [postsSent, setPostsSent] = useState<any[]>([])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError(t.dash_photo_too_big)
      return
    }
    setAvatarUploading(true)
    setAvatarError("")
    const { error } = await updateAvatar(file)
    setAvatarUploading(false)
    if (error) setAvatarError(error)
    e.target.value = ""
  }

  useEffect(() => {
    Promise.all([loadUser(), loadProfiles()]).finally(() => {
      setIsLoading(false)
      setTimeout(() => setBarsMounted(true), 100)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!currentUser?.full_name) return
    supabase.from("posts").select("*").eq("to_name", currentUser.full_name)
      .order("created_at", { ascending: false })
      .then(({ data }) => setPostsReceived(data || []))
    supabase.from("posts").select("*").eq("from_name", currentUser.full_name)
      .order("created_at", { ascending: false })
      .then(({ data }) => setPostsSent(data || []))
  }, [currentUser?.full_name])

  const level = currentUser?.level || "staff"
  const levelInfo = LEVEL_BUDGETS[level] || LEVEL_BUDGETS.staff
  const period = getCurrentPeriod()
  const baseBudget = currentUser?.giving_budget_monthly ?? levelInfo.budget
  const carriedOver = currentUser?.budget_carried || 0
  const totalBudget = levelInfo.unlimited ? Infinity : baseBudget + carriedOver
  const budgetUsed = currentUser?.budget_used || 0
  const budgetLeft = levelInfo.unlimited ? Infinity : totalBudget - budgetUsed
  const budgetPercent = levelInfo.unlimited ? 0 : Math.min((budgetUsed / totalBudget) * 100, 100)

  const myRank = [...profiles].sort((a, b) => b.points - a.points).findIndex(p => p.id === currentUser?.id) + 1
  const { current: badge, next: nextBadge, progress: badgeProgress } = getBadgeInfo(currentUser?.points || 0)

  const animatedPoints = useCountUp(isLoading ? 0 : (currentUser?.points || 0))
  const animatedMonthly = useCountUp(isLoading ? 0 : (currentUser?.monthly_points || 0))
  const animatedBudgetLeft = useCountUp(isLoading ? 0 : (levelInfo.unlimited ? 0 : budgetLeft))
  const animatedCarried = useCountUp(isLoading ? 0 : carriedOver)

  if (isLoading) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-28 left-10 h-80 w-80 rounded-full bg-blue-300/50 blur-3xl" />
        <div className="absolute top-32 right-0 h-96 w-96 rounded-full bg-emerald-300/35 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute bottom-40 right-10 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#CBD5E1_1px,transparent_1px),linear-gradient(to_bottom,#CBD5E1_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.08]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8">

        {/* Hero */}
        <div className="animate-fade-in-up relative mb-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-7 shadow-xl shadow-blue-100/50 backdrop-blur-xl">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-300/40 blur-2xl" />
          <div className="relative flex items-center gap-6">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative h-20 w-20 shrink-0 rounded-full focus:outline-none" title={t.dash_change_photo}>
              {currentUser?.avatar ? (
                <div className="h-20 w-20 overflow-hidden rounded-full shadow-lg ring-2 ring-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentUser.avatar} alt={currentUser.full_name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className={"flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br text-2xl font-bold text-white shadow-lg " + getColor(myRank)}>
                  {getInitials(currentUser?.full_name || "?")}
                </div>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                {avatarUploading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span className="text-lg">📷</span>
                    <span className="mt-0.5 text-[10px] font-bold text-white">{t.nav_change_photo}</span>
                  </>
                )}
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">{currentUser?.full_name}</h1>
                <span className={"inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 " + (
                  currentUser?.role === "admin" ? "bg-purple-50 text-purple-700 ring-purple-100" :
                  currentUser?.role === "hr" ? "bg-pink-50 text-pink-700 ring-pink-100" :
                  currentUser?.role === "manager" ? "bg-amber-50 text-amber-700 ring-amber-100" :
                  "bg-blue-50 text-blue-700 ring-blue-100"
                )}>{{
                  admin: "Admin", hr: "HR", manager: "Quản lý", employee: "Nhân viên",
                }[currentUser?.role || "employee"] || currentUser?.role}</span>
                <span className={"inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 " + badge.color}>{badge.name}</span>
                {levelInfo && (
                  <span className="inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 bg-slate-50 text-slate-600 ring-slate-200">
                    {levelInfo.label}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {currentUser?.office} Office · {currentUser?.department}
                {currentUser?.position && <> · {currentUser.position}</>}
              </p>
              <p className="mt-1 text-sm text-slate-400">{currentUser?.email}</p>
              {avatarError && <p className="mt-2 text-xs font-semibold text-red-500">{avatarError}</p>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={"rounded-full px-5 py-2 text-sm font-bold transition ring-1 " + (
              activeTab === "overview"
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white/80 text-slate-600 ring-slate-200 hover:bg-slate-50"
            )}
          >
            📊 Tổng quan
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={"flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition ring-1 " + (
              activeTab === "feedback"
                ? "bg-violet-600 text-white ring-violet-600"
                : "bg-white/80 text-slate-600 ring-slate-200 hover:bg-violet-50 hover:text-violet-700"
            )}
          >
            💌 Thư Góp ý
            {/* feedbackUnread badge — accessed via store directly */}
            <FeedbackUnreadBadge active={activeTab === "feedback"} />
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "feedback" ? (
          <FeedbackMailbox />
        ) : (
          <>
            {/* Stats */}
            <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="animate-fade-in-up rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl" style={{ animationDelay: "60ms" }}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 px-3 py-2 text-lg ring-1 ring-blue-100">📊</div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">{t.dash_live}</span>
                </div>
                <div className="text-sm font-medium text-slate-500">{t.dash_monthly_pts}</div>
                <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{animatedMonthly.toLocaleString()}</div>
                <div className="mt-2 text-sm font-semibold text-slate-400">{t.dash_total}: {animatedPoints.toLocaleString()} pts</div>
              </div>

              <div className="animate-fade-in-up rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl" style={{ animationDelay: "120ms" }}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 px-3 py-2 text-lg ring-1 ring-blue-100">🏅</div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">{t.dash_live}</span>
                </div>
                <div className="text-sm font-medium text-slate-500">{t.dash_rank}</div>
                <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{myRank > 0 ? "#" + myRank : "-"}</div>
                <div className="mt-2 text-sm font-semibold text-slate-400">{t.dash_among} {profiles.length} {t.dash_members}</div>
              </div>

              <div className="animate-fade-in-up rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl" style={{ animationDelay: "180ms" }}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 px-3 py-2 text-lg ring-1 ring-blue-100">🎖</div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">{t.dash_live}</span>
                </div>
                <div className="text-sm font-medium text-slate-500">{t.dash_received}</div>
                <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{postsReceived.length}</div>
                <div className="mt-2 text-sm font-semibold text-slate-400">{t.dash_sent_count} {postsSent.length} {t.dash_appreciations}</div>
              </div>

              <div className="animate-fade-in-up rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl" style={{ animationDelay: "240ms" }}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 px-3 py-2 text-lg ring-1 ring-blue-100">💰</div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">{period.label}</span>
                </div>
                <div className="text-sm font-medium text-slate-500">Ngân sách còn lại</div>
                <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                  {levelInfo.unlimited ? "∞" : animatedBudgetLeft.toLocaleString()}
                  {!levelInfo.unlimited && <span className="text-base font-medium text-slate-400"> / {totalBudget.toLocaleString()}</span>}
                </div>
                {!levelInfo.unlimited && (
                  <>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-blue-500 transition-[width] duration-1000 ease-out" style={{ width: (barsMounted ? budgetPercent : 0) + "%" }} />
                    </div>
                    <div className="mt-1.5 text-xs text-slate-400">{budgetUsed} pts đã trao</div>
                  </>
                )}
                {levelInfo.unlimited && <div className="mt-2 text-xs text-slate-400">Không giới hạn ngân sách</div>}
              </div>
            </div>

            {/* Budget Detail */}
            <div className="animate-fade-in-up mb-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-lg backdrop-blur-xl" style={{ animationDelay: "260ms" }}>
              <h2 className="text-sm font-bold text-slate-950 mb-4">💼 Chi tiết ngân sách — {period.label}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4 text-center">
                  <div className="text-xs font-medium text-slate-500 mb-1">Ngân sách kỳ này</div>
                  <div className="text-2xl font-bold text-slate-900">{levelInfo.unlimited ? "∞" : baseBudget.toLocaleString()}</div>
                  <div className="text-xs text-slate-400 mt-1">{levelInfo.label}</div>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 text-center">
                  <div className="text-xs font-medium text-emerald-700 mb-1">Carry từ kỳ trước</div>
                  <div className="text-2xl font-bold text-emerald-700">+{animatedCarried.toLocaleString()}</div>
                  <div className="text-xs text-emerald-500 mt-1">Chưa dùng hết → chuyển sang</div>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 text-center">
                  <div className="text-xs font-medium text-amber-700 mb-1">Đã trao</div>
                  <div className="text-2xl font-bold text-amber-700">{budgetUsed.toLocaleString()}</div>
                  <div className="text-xs text-amber-500 mt-1">pts trong kỳ này</div>
                </div>
                <div className="rounded-2xl bg-blue-50 p-4 text-center">
                  <div className="text-xs font-medium text-blue-700 mb-1">Còn lại</div>
                  <div className="text-2xl font-bold text-blue-700">{levelInfo.unlimited ? "∞" : (totalBudget - budgetUsed).toLocaleString()}</div>
                  <div className="text-xs text-blue-500 mt-1">pts có thể trao</div>
                </div>
              </div>
              {!levelInfo.unlimited && carriedOver > 0 && (
                <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-xs text-emerald-700">
                  ✨ Bạn có <strong>{carriedOver} pts</strong> được carry từ kỳ trước. Tổng ngân sách kỳ này: <strong>{totalBudget} pts</strong>.
                </div>
              )}
            </div>

            {/* Badge Progress */}
            <div className="animate-fade-in-up mb-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl" style={{ animationDelay: "280ms" }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-950">{t.dash_badge}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {nextBadge ? `${nextBadge.min - (currentUser?.points || 0)} pts ${t.dash_badge_to} ${nextBadge.name}` : t.dash_badge_max}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={"rounded-full px-3 py-1 text-xs font-bold ring-1 " + badge.color}>{badge.name}</span>
                  {nextBadge && (
                    <>
                      <span className="text-slate-300 text-sm">→</span>
                      <span className={"rounded-full px-3 py-1 text-xs font-bold ring-1 opacity-50 " + (BADGES.find(b => b.name === nextBadge.name)?.color || "")}>{nextBadge.name}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width] duration-1000 ease-out" style={{ width: (barsMounted ? badgeProgress : 0) + "%" }} />
              </div>
              <div className="mt-1.5 text-xs text-slate-400 text-right">{Math.round(badgeProgress)}%</div>
            </div>

            {/* Appreciation Received + Sent */}
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="animate-fade-in-up relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-xl backdrop-blur-xl" style={{ animationDelay: "320ms" }}>
                <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-amber-200/60 blur-3xl" />
                <div className="relative">
                  <div className="mb-5">
                    <h2 className="text-lg font-bold text-slate-950">{t.dash_appreciation_received}</h2>
                    <p className="text-sm text-slate-500">{postsReceived.length} {t.dash_posts_to_you}</p>
                  </div>
                  <div className="space-y-3">
                    {postsReceived.length === 0 && <div className="py-8 text-center text-sm text-slate-400">{t.dash_no_received}</div>}
                    {postsReceived.map((p) => (
                      <a key={p.id} href={`/feed#post-${p.id}`} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm transition hover:shadow-md hover:border-blue-200 hover:bg-blue-50/50 group">
                        {p.from_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.from_avatar} alt={p.from_name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-xs font-bold text-white">
                            {getInitials(p.from_name || "?")}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-950 group-hover:text-blue-700 transition-colors">{p.from_name}</div>
                          <div className="text-xs text-slate-500 truncate">{p.title}</div>
                          <div className="mt-0.5 text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString("vi-VN")}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">+{p.points}pts</div>
                          <span className="text-slate-300 group-hover:text-blue-400 transition-colors text-sm">→</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </section>

              <section className="animate-fade-in-up relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-xl backdrop-blur-xl" style={{ animationDelay: "380ms" }}>
                <div className="absolute -right-24 bottom-0 h-60 w-60 rounded-full bg-emerald-200/60 blur-3xl" />
                <div className="relative">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">{t.dash_appreciation_sent}</h2>
                      <p className="text-sm text-slate-500">{postsSent.length} {t.dash_posts_by_you}</p>
                    </div>
                    <a href="/post" className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition">
                      {t.dash_send_btn}
                    </a>
                  </div>
                  <div className="space-y-3">
                    {postsSent.length === 0 && <div className="py-8 text-center text-sm text-slate-400">{t.dash_no_sent}</div>}
                    {postsSent.map((p) => (
                      <a key={p.id} href={`/feed#post-${p.id}`} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm transition hover:shadow-md hover:border-emerald-200 hover:bg-emerald-50/50 group">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-bold text-white">
                          {getInitials(p.to_name || "?")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-950 group-hover:text-emerald-700 transition-colors">{p.to_name}</div>
                          <div className="text-xs text-slate-500 truncate">{p.title}</div>
                          <div className="mt-0.5 text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString("vi-VN")}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">+{p.points}pts</div>
                          <span className="text-slate-300 group-hover:text-emerald-400 transition-colors text-sm">→</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// Small helper component để lấy feedbackUnread từ store
function FeedbackUnreadBadge({ active }: { active: boolean }) {
  const { feedbackUnread } = useStore()
  if (!feedbackUnread) return null
  return (
    <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + (active ? "bg-white/30 text-white" : "bg-violet-500 text-white")}>
      {feedbackUnread}
    </span>
  )
}