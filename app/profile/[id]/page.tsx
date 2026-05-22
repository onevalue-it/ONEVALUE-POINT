"use client"

import Navbar from "@/components/ui/navbar"
import { useStore } from "@/lib/store"
import { supabase } from "@/lib/supabase"
import { useAuthGuard } from "@/lib/useAuthGuard"
import { useCountUp } from "@/lib/useCountUp"
import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

type PublicProfile = {
  id: string
  user_id?: string
  full_name: string
  email?: string
  role?: string
  office?: string
  department?: string
  position?: string
  level?: string
  points: number
  monthly_points: number
  budget_used?: number
  budget_carried?: number
  giving_budget_monthly?: number
  avatar?: string
}

const BADGES = [
  { name: "Bronze", min: 0, max: 400, color: "bg-orange-100 text-orange-700 ring-orange-200" },
  { name: "Silver", min: 400, max: 1000, color: "bg-slate-100 text-slate-600 ring-slate-300" },
  { name: "Gold", min: 1000, max: 2000, color: "bg-amber-100 text-amber-700 ring-amber-200" },
  { name: "Platinum", min: 2000, max: 5000, color: "bg-blue-100 text-blue-700 ring-blue-200" },
  { name: "Legend", min: 5000, max: Infinity, color: "bg-purple-100 text-purple-700 ring-purple-200" },
]

const LEVEL_BUDGETS: Record<string, { label: string; budget: number; unlimited: boolean }> = {
  ceo: { label: "CEO", budget: 0, unlimited: true },
  director: { label: "Director/Head", budget: 2500, unlimited: false },
  manager: { label: "Manager", budget: 2000, unlimited: false },
  pm: { label: "PM/Team Leader", budget: 1200, unlimited: false },
  senior: { label: "Senior", budget: 700, unlimited: false },
  staff: { label: "Staff/Junior", budget: 400, unlimited: false },
  intern: { label: "Intern/Part-time", budget: 200, unlimited: false },
}

function getCurrentPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  return { label: now.getMonth() < 6 ? `H1 ${year}` : `H2 ${year}` }
}

function getBadgeInfo(points: number) {
  const current = [...BADGES].reverse().find(b => points >= b.min) || BADGES[0]
  const next = BADGES.find(b => b.min > points)
  const progress = next ? ((points - current.min) / (next.min - current.min)) * 100 : 100
  return { current, next, progress }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function getColor(index: number): string {
  const colors = [
    "from-purple-500 to-indigo-500",
    "from-blue-500 to-cyan-500",
    "from-sky-500 to-blue-500",
    "from-teal-500 to-emerald-500",
    "from-orange-400 to-amber-500",
    "from-pink-500 to-rose-500",
  ]

  return colors[Math.max(index, 0) % colors.length]
}

export default function ProfilePage() {
  useAuthGuard()

  const pathname = usePathname()
  const profileId = decodeURIComponent(pathname.split("/").pop() || "")

  const { profiles, loadProfiles, loadUser } = useStore()

  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [barsMounted, setBarsMounted] = useState(false)
  const [postsReceived, setPostsReceived] = useState<any[]>([])
  const [postsSent, setPostsSent] = useState<any[]>([])

  useEffect(() => {
    if (!profileId) return

    Promise.all([loadUser(), loadProfiles()])
    loadProfile(profileId)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  async function loadProfile(id: string) {
    setLoading(true)
    setProfile(null)
    setPostsReceived([])
    setPostsSent([])

    let profileData: any = null

    // Project hiện tại thường dùng profiles.id = auth user uuid
    const byId = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (byId.data) {
      profileData = byId.data
    }

    // Fallback nếu DB có cột user_id
    if (!profileData) {
      const byUserId = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", id)
        .maybeSingle()

      if (byUserId.data) {
        profileData = byUserId.data
      }
    }

    if (!profileData) {
      console.error("profile not found:", { id, byIdError: byId.error })
      setLoading(false)
      return
    }

    setProfile(profileData as PublicProfile)

    const received = await supabase
      .from("posts")
      .select("*")
      .eq("to_name", profileData.full_name)
      .order("created_at", { ascending: false })

    const sent = await supabase
      .from("posts")
      .select("*")
      .eq("from_name", profileData.full_name)
      .order("created_at", { ascending: false })

    if (received.error) {
      console.error("load received posts error:", received.error)
    }

    if (sent.error) {
      console.error("load sent posts error:", sent.error)
    }

    setPostsReceived(received.data || [])
    setPostsSent(sent.data || [])

    setLoading(false)
    setTimeout(() => setBarsMounted(true), 100)
  }

  const level = profile?.level || "staff"
  const levelInfo = LEVEL_BUDGETS[level] || LEVEL_BUDGETS.staff
  const period = getCurrentPeriod()

  const baseBudget = profile
    ? profile.giving_budget_monthly ?? levelInfo.budget
    : levelInfo.budget

  const carriedOver = profile?.budget_carried || 0
  const totalBudget = levelInfo.unlimited ? Infinity : baseBudget + carriedOver
  const budgetUsed = profile?.budget_used || 0
  const budgetLeft = levelInfo.unlimited ? Infinity : totalBudget - budgetUsed
  const budgetPercent = levelInfo.unlimited ? 0 : Math.min((budgetUsed / totalBudget) * 100, 100)

  const myRank = useMemo(() => {
    if (!profile) return 0
    return [...profiles]
      .sort((a, b) => b.points - a.points)
      .findIndex(p => p.id === profile.id) + 1
  }, [profiles, profile])

  const badgeInfo = getBadgeInfo(profile?.points || 0)

  // Hooks luôn được gọi trước mọi return để tránh lỗi "change in order of Hooks"
  const animatedPoints = useCountUp(profile?.points || 0)
  const animatedMonthly = useCountUp(profile?.monthly_points || 0)
  const animatedBudgetLeft = useCountUp(levelInfo.unlimited ? 0 : budgetLeft)
  const animatedCarried = useCountUp(carriedOver)

  if (loading) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <Navbar />

        <div className="flex items-center justify-center py-40">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <Navbar />

        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <div className="rounded-[2rem] border border-white/80 bg-white/85 p-10 shadow-xl">
            <h1 className="text-xl font-bold text-slate-900">
              Không tìm thấy user
            </h1>

            <a
              href="/leaderboard"
              className="mt-4 inline-flex rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white"
            >
              Quay lại bảng điểm
            </a>
          </div>
        </div>
      </div>
    )
  }

  const badge = badgeInfo.current
  const nextBadge = badgeInfo.next
  const badgeProgress = badgeInfo.progress

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
        <div className="animate-fade-in-up relative mb-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-7 shadow-xl shadow-blue-100/50 backdrop-blur-xl">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-300/40 blur-2xl" />

          <div className="relative flex items-center gap-6">
            {profile.avatar ? (
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full shadow-lg ring-2 ring-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.avatar}
                  alt={profile.full_name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className={"flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-2xl font-bold text-white shadow-lg " + getColor(myRank)}>
                {getInitials(profile.full_name || "?")}
              </div>
            )}

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                  {profile.full_name}
                </h1>

                <span className={"inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 " + (
                  profile.role === "admin" ? "bg-purple-50 text-purple-700 ring-purple-100" :
                  profile.role === "hr" ? "bg-pink-50 text-pink-700 ring-pink-100" :
                  profile.role === "manager" ? "bg-amber-50 text-amber-700 ring-amber-100" :
                  "bg-blue-50 text-blue-700 ring-blue-100"
                )}>
                  {{
                    admin: "Admin",
                    hr: "HR",
                    manager: "Quản lý",
                    employee: "Nhân viên",
                  }[profile.role || "employee"] || profile.role}
                </span>

                <span className={"inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 " + badge.color}>
                  {badge.name}
                </span>

                <span className="inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                  {levelInfo.label}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {profile.office} Office · {profile.department}
                {profile.position && <> · {profile.position}</>}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                {profile.email}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          <span className="rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white ring-1 ring-slate-900">
            📊 Tổng quan
          </span>

          <a
            href="/leaderboard"
            className="rounded-full bg-white/80 px-5 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            ← Bảng điểm
          </a>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="animate-fade-in-up rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 px-3 py-2 text-lg ring-1 ring-blue-100">
                📊
              </div>

              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                Trực tiếp
              </span>
            </div>

            <div className="text-sm font-medium text-slate-500">
              Điểm tháng này
            </div>

            <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              {animatedMonthly.toLocaleString()}
            </div>

            <div className="mt-2 text-sm font-semibold text-slate-400">
              Tổng: {animatedPoints.toLocaleString()} pts
            </div>
          </div>

          <div className="animate-fade-in-up rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 px-3 py-2 text-lg ring-1 ring-blue-100">
                🏅
              </div>

              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                Trực tiếp
              </span>
            </div>

            <div className="text-sm font-medium text-slate-500">
              Xếp hạng
            </div>

            <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              {myRank > 0 ? "#" + myRank : "-"}
            </div>

            <div className="mt-2 text-sm font-semibold text-slate-400">
              trong số {profiles.length} thành viên
            </div>
          </div>

          <div className="animate-fade-in-up rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 px-3 py-2 text-lg ring-1 ring-blue-100">
                🎖
              </div>

              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                Trực tiếp
              </span>
            </div>

            <div className="text-sm font-medium text-slate-500">
              Đã nhận
            </div>

            <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              {postsReceived.length}
            </div>

            <div className="mt-2 text-sm font-semibold text-slate-400">
              Đã gửi {postsSent.length} lời khen
            </div>
          </div>

          <div className="animate-fade-in-up rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 px-3 py-2 text-lg ring-1 ring-blue-100">
                💰
              </div>

              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                {period.label}
              </span>
            </div>

            <div className="text-sm font-medium text-slate-500">
              Ngân sách còn lại
            </div>

            <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              {levelInfo.unlimited ? "∞" : animatedBudgetLeft.toLocaleString()}
              {!levelInfo.unlimited && (
                <span className="text-base font-medium text-slate-400">
                  {" "} / {totalBudget.toLocaleString()}
                </span>
              )}
            </div>

            {!levelInfo.unlimited && (
              <>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-[width] duration-1000 ease-out"
                    style={{ width: (barsMounted ? budgetPercent : 0) + "%" }}
                  />
                </div>

                <div className="mt-1.5 text-xs text-slate-400">
                  {budgetUsed} pts đã trao
                </div>
              </>
            )}

            {levelInfo.unlimited && (
              <div className="mt-2 text-xs text-slate-400">
                Không giới hạn ngân sách
              </div>
            )}
          </div>
        </div>

        <div className="animate-fade-in-up mb-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-lg backdrop-blur-xl">
          <h2 className="mb-4 text-sm font-bold text-slate-950">
            💼 Chi tiết ngân sách — {period.label}
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <div className="mb-1 text-xs font-medium text-slate-500">
                Ngân sách kỳ này
              </div>

              <div className="text-2xl font-bold text-slate-900">
                {levelInfo.unlimited ? "∞" : baseBudget.toLocaleString()}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                {levelInfo.label}
              </div>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4 text-center">
              <div className="mb-1 text-xs font-medium text-emerald-700">
                Carry từ kỳ trước
              </div>

              <div className="text-2xl font-bold text-emerald-700">
                +{animatedCarried.toLocaleString()}
              </div>

              <div className="mt-1 text-xs text-emerald-500">
                Chưa dùng hết → chuyển sang
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 p-4 text-center">
              <div className="mb-1 text-xs font-medium text-amber-700">
                Đã trao
              </div>

              <div className="text-2xl font-bold text-amber-700">
                {budgetUsed.toLocaleString()}
              </div>

              <div className="mt-1 text-xs text-amber-500">
                pts trong kỳ này
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50 p-4 text-center">
              <div className="mb-1 text-xs font-medium text-blue-700">
                Còn lại
              </div>

              <div className="text-2xl font-bold text-blue-700">
                {levelInfo.unlimited ? "∞" : (totalBudget - budgetUsed).toLocaleString()}
              </div>

              <div className="mt-1 text-xs text-blue-500">
                pts có thể trao
              </div>
            </div>
          </div>
        </div>

        <div className="animate-fade-in-up mb-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-950">
                Tiến trình huy hiệu
              </h2>

              <p className="mt-0.5 text-xs text-slate-400">
                {nextBadge
                  ? `${nextBadge.min - (profile.points || 0)} pts điểm nữa đến ${nextBadge.name}`
                  : "Đã đạt huy hiệu cao nhất"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={"rounded-full px-3 py-1 text-xs font-bold ring-1 " + badge.color}>
                {badge.name}
              </span>

              {nextBadge && (
                <>
                  <span className="text-sm text-slate-300">→</span>

                  <span className={"rounded-full px-3 py-1 text-xs font-bold ring-1 opacity-50 " + (BADGES.find(b => b.name === nextBadge.name)?.color || "")}>
                    {nextBadge.name}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width] duration-1000 ease-out"
              style={{ width: (barsMounted ? badgeProgress : 0) + "%" }}
            />
          </div>

          <div className="mt-1.5 text-right text-xs text-slate-400">
            {Math.round(badgeProgress)}%
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-xl backdrop-blur-xl">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-950">
                Lời khen đã nhận
              </h2>

              <p className="text-sm text-slate-500">
                {postsReceived.length} bài gửi tới user này
              </p>
            </div>

            <div className="space-y-3">
              {postsReceived.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">
                  Chưa nhận lời khen nào
                </div>
              )}

              {postsReceived.map((p) => (
                <a
                  key={p.id}
                  href={`/feed#post-${p.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-xs font-bold text-white">
                    {getInitials(p.from_name || "?")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-950 transition-colors group-hover:text-blue-700">
                      {p.from_name}
                    </div>

                    <div className="truncate text-xs text-slate-500">
                      {p.title}
                    </div>

                    <div className="mt-0.5 text-xs text-slate-400">
                      {new Date(p.created_at).toLocaleDateString("vi-VN")}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                      +{p.points}pts
                    </div>

                    <span className="text-sm text-slate-300 transition-colors group-hover:text-blue-400">
                      →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-xl backdrop-blur-xl">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-950">
                Lời khen đã gửi
              </h2>

              <p className="text-sm text-slate-500">
                {postsSent.length} bài do user này gửi
              </p>
            </div>

            <div className="space-y-3">
              {postsSent.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">
                  Chưa gửi lời khen nào
                </div>
              )}

              {postsSent.map((p) => (
                <a
                  key={p.id}
                  href={`/feed#post-${p.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-bold text-white">
                    {getInitials(p.to_name || "?")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-950 transition-colors group-hover:text-emerald-700">
                      {p.to_name}
                    </div>

                    <div className="truncate text-xs text-slate-500">
                      {p.title}
                    </div>

                    <div className="mt-0.5 text-xs text-slate-400">
                      {new Date(p.created_at).toLocaleDateString("vi-VN")}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                      +{p.points}pts
                    </div>

                    <span className="text-sm text-slate-300 transition-colors group-hover:text-emerald-400">
                      →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
