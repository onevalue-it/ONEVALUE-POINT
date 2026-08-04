"use client"
import Navbar from "@/components/ui/navbar"
import { useStore } from "@/lib/store"
import { useEffect, useState, useMemo } from "react"
import { useAuthGuard } from "@/lib/useAuthGuard"
import { useT } from "@/lib/useT"
import { supabase } from "@/lib/supabase"

const badgeColor: Record<string, string> = {
  Legend:   "text-purple-700 bg-purple-50 ring-purple-100",
  Platinum: "text-blue-700 bg-blue-50 ring-blue-100",
  Gold:     "text-amber-700 bg-amber-50 ring-amber-100",
  Silver:   "text-slate-600 bg-slate-100 ring-slate-200",
  Bronze:   "text-orange-700 bg-orange-50 ring-orange-100",
}

const LEVEL_LABELS: Record<string, string> = {
  ceo: "CEO",
  division_director: "COO/Division Lead/Director",
  senior_manager: "Senior Manager",
  project_manager: "Project Manager",
  assistant_pm: "Assistant Project Manager",
  senior_team_leader: "Senior Team Leader",
  team_leader: "Team Leader",
  senior_ba: "Senior BA",
  junior_ba: "Junior BA",

  // Giữ tương thích với dữ liệu level cũ trong profiles
  director: "Director/Head",
  manager: "Manager",
  pm: "PM/Team Leader",
  senior: "Senior",
  staff: "Staff/Junior",
  intern: "Long term Intern / Part-time",
}

function getBadge(points: number): string {
  if (points >= 5000) return "Legend"
  if (points >= 2000) return "Platinum"
  if (points >= 1000) return "Gold"
  if (points >= 400)  return "Silver"
  return "Bronze"
}

function getInitials(name: string): string {
  return name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
}

function getColor(index: number): string {
  const colors = [
    "from-purple-500 to-indigo-500", "from-blue-500 to-cyan-500",
    "from-sky-500 to-blue-500",      "from-teal-500 to-emerald-500",
    "from-orange-400 to-amber-500",  "from-pink-500 to-rose-500",
    "from-green-500 to-emerald-500", "from-yellow-400 to-amber-500",
  ]
  return colors[index % colors.length]
}

function getCurrentHalf() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return m < 6
    ? { start: new Date(y, 0, 1), end: new Date(y, 5, 30, 23, 59, 59), label: `H1 ${y}` }
    : { start: new Date(y, 6, 1), end: new Date(y, 11, 31, 23, 59, 59), label: `H2 ${y}` }
}

function getMonthOptions() {
  const now = new Date()
  const opts = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("vi-VN", { month: "long", year: "numeric" }),
    })
  }
  return opts
}

type TimeMode = "total" | "month" | "half" | "year"
type OfficeFilter = "All" | "Japan" | "Vietnam"

export default function LeaderboardPage() {
  useAuthGuard()
  const t = useT()
  const { profiles, loadProfiles, posts, loadPosts, currentUser, loadUser } = useStore()

  // Filters
  const [timeMode, setTimeMode] = useState<TimeMode>("total")
  const [selectedMonth, setSelectedMonth] = useState(getMonthOptions()[0].value)
  const [filterOffice, setFilterOffice] = useState<OfficeFilter>("All")
  const [filterDept, setFilterDept] = useState("All")
  const [filterLevel, setFilterLevel] = useState("All")

  // Points by user from point_transactions (for time-filtered view)
  const [txPoints, setTxPoints] = useState<Record<string, number>>({})
  const [txLoading, setTxLoading] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportError, setExportError] = useState("")

  const monthOptions = getMonthOptions()
  const half = getCurrentHalf()

  useEffect(() => {
    Promise.all([loadUser(), loadProfiles(), loadPosts()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load point_transactions when time filter changes
  useEffect(() => {
    if (timeMode === "total") { setTxPoints({}); return }
    loadTxPoints()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeMode, selectedMonth])

  async function loadTxPoints() {
    setTxLoading(true)
    let start: Date, end: Date

    if (timeMode === "month") {
      const [y, m] = selectedMonth.split("-").map(Number)
      start = new Date(y, m - 1, 1)
      end = new Date(y, m, 0, 23, 59, 59)
    } else if (timeMode === "half") {
      start = half.start
      end = half.end
    } else {
      const y = new Date().getFullYear()
      start = new Date(y, 0, 1)
      end = new Date(y, 11, 31, 23, 59, 59)
    }

    const { data } = await supabase
      .from("point_transactions")
      .select("to_user_id, points")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())

    if (data) {
      const map: Record<string, number> = {}
      data.forEach(row => {
        map[row.to_user_id] = (map[row.to_user_id] || 0) + row.points
      })
      setTxPoints(map)
    }
    setTxLoading(false)
  }

  // Departments list
  const departments = useMemo(() => {
    const set = new Set(profiles.map(p => p.department).filter(Boolean))
    return ["All", ...Array.from(set).sort()]
  }, [profiles])

  // Levels list
  const levels = useMemo(() => {
    const set = new Set(profiles.map((p: any) => p.level).filter(Boolean))
    return ["All", ...Array.from(set)]
  }, [profiles])

  // Compute points per user based on timeMode
  function getPoints(p: any): number {
    if (timeMode === "total") return p.points
    return txPoints[p.id] || 0
  }

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = [...profiles]
    if (filterOffice !== "All") list = list.filter(p => p.office === filterOffice)
    if (filterDept !== "All")   list = list.filter(p => p.department === filterDept)
    if (filterLevel !== "All")  list = list.filter((p: any) => p.level === filterLevel)
    return list.sort((a, b) => getPoints(b) - getPoints(a))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, filterOffice, filterDept, filterLevel, timeMode, txPoints])

  const top3 = filtered.slice(0, 3)
  const totalPts = filtered.reduce((a, p) => a + getPoints(p), 0)
  const totalPosts = posts.length

  // Time label
  const timeLabel = useMemo(() => {
    if (timeMode === "total") return "Tất cả thời gian"
    if (timeMode === "month") return monthOptions.find(o => o.value === selectedMonth)?.label || ""
    if (timeMode === "half") return half.label
    return `Năm ${new Date().getFullYear()}`
  }, [timeMode, selectedMonth])

  async function handleExportExcel() {
    try {
      setExportingExcel(true)
      setExportError("")

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error("Phiên đăng nhập không hợp lệ")
      }

      const params = new URLSearchParams({
        month: selectedMonth,
        office: filterOffice === "All" ? "all" : filterOffice,
        department: filterDept === "All" ? "all" : filterDept,
        level: filterLevel === "All" ? "all" : filterLevel,
      })

      const response = await fetch(
        `/api/admin/export-rewards?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        const result = await response.json().catch(() => ({
          error: "Không thể đọc phản hồi từ máy chủ",
        }))

        throw new Error(result.error || "Không thể xuất Excel")
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get("Content-Disposition")
      const fileNameMatch = contentDisposition?.match(/filename="([^"]+)"/)
      const fileName =
        fileNameMatch?.[1] ||
        `OVPOINT_KhenThuong_${selectedMonth}.xlsx`

      const downloadUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = downloadUrl
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Không thể xuất Excel"
      )
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-28 left-10 h-80 w-80 rounded-full bg-blue-300/50 blur-3xl" />
        <div className="absolute top-40 right-0 h-96 w-96 rounded-full bg-emerald-300/35 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-amber-300/35 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#CBD5E1_1px,transparent_1px),linear-gradient(to_bottom,#CBD5E1_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.08]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8">

        {/* Header */}
        <div className="relative mb-8 overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-7 shadow-xl backdrop-blur-xl">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-200/50 blur-2xl" />
          <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="flex-1">
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                {t.lb_company_tag}
              </span>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{t.lb_title}</h1>
              <p className="mt-2 text-sm text-slate-500">{t.lb_subtitle}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2 ring-1 ring-blue-100">
                  <span>👥</span>
                  <div>
                    <div className="text-xs text-blue-500">{t.lb_members}</div>
                    <div className="text-lg font-bold text-blue-700">{filtered.length}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 ring-1 ring-emerald-100">
                  <span>✨</span>
                  <div>
                    <div className="text-xs text-emerald-500">{t.lb_pts_dist}</div>
                    <div className="text-lg font-bold text-emerald-700">{totalPts.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 ring-1 ring-amber-100">
                  <span>🎖</span>
                  <div>
                    <div className="text-xs text-amber-500">{t.lb_appreciations}</div>
                    <div className="text-lg font-bold text-amber-700">{totalPosts}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
                  📅 {timeLabel}
                </span>

                {["admin", "hr"].includes(currentUser?.role || "") && (
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={exportingExcel || timeMode !== "month"}
                    title={
                      timeMode !== "month"
                        ? "Chọn chế độ Theo tháng để xuất Excel"
                        : "Xuất báo cáo Excel theo tháng đang chọn"
                    }
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>⬇</span>
                    <span>
                      {exportingExcel ? "Đang xuất..." : "Export Excel"}
                    </span>
                  </button>
                )}
              </div>

              {exportError && (
                <div className="max-w-md rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-100">
                  ❌ {exportError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== BỘ LỌC ===== */}
        <div className="mb-8 rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-4">🔍 Bộ lọc</h3>
          <div className="flex flex-wrap gap-4">

            {/* Time mode */}
            <div className="flex-1 min-w-[200px]">
              <div className="text-xs font-semibold text-slate-500 mb-2">Thời gian</div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: "total", label: "Tất cả" },
                  { value: "month", label: "Theo tháng" },
                  { value: "half",  label: half.label },
                  { value: "year",  label: `Năm ${new Date().getFullYear()}` },
                ] as { value: TimeMode; label: string }[]).map(opt => (
                  <button key={opt.value} onClick={() => setTimeMode(opt.value)}
                    className={"rounded-full px-3 py-1.5 text-xs font-bold transition " + (
                      timeMode === opt.value
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {timeMode === "month" && (
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {monthOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Office */}
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2">Văn phòng</div>
              <div className="flex gap-1.5">
                {(["All", "Vietnam", "Japan"] as OfficeFilter[]).map(o => (
                  <button key={o} onClick={() => setFilterOffice(o)}
                    className={"rounded-full px-3 py-1.5 text-xs font-bold transition " + (
                      filterOffice === o
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                    )}>
                    {o === "All" ? "Tất cả" : o}
                  </button>
                ))}
              </div>
            </div>

            {/* Department */}
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2">Phòng ban</div>
              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {departments.map(d => (
                  <option key={d} value={d}>{d === "All" ? "Tất cả phòng ban" : d}</option>
                ))}
              </select>
            </div>

            {/* Level */}
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2">Cấp bậc</div>
              <select
                value={filterLevel}
                onChange={e => setFilterLevel(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="All">Tất cả cấp bậc</option>
                {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Podium top 3 */}
        {!txLoading && top3.length >= 1 && (
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {[top3[1], top3[0], top3[2]].map((e, i) => e && (
              <a key={e.id} href={`/profile/${e.id}`} className={"relative block overflow-hidden rounded-[2rem] border bg-white/85 p-6 text-center shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-2xl " + (i === 1 ? "border-amber-200 shadow-amber-100" : "border-white/80")}>
                <div className={"absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl " + (i === 1 ? "bg-amber-200/60" : "bg-blue-200/40")} />
                <div className="relative">
                  {e.avatar ? (
                    <div className="mx-auto mb-4 h-16 w-16 overflow-hidden rounded-full shadow-lg ring-2 ring-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.avatar} alt={e.full_name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className={"mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold text-white shadow-lg " + getColor(i)}>
                      {getInitials(e.full_name)}
                    </div>
                  )}
                  <div className="mb-2 text-3xl">{i === 1 ? "🥇" : i === 0 ? "🥈" : "🥉"}</div>
                  <div className="text-lg font-bold text-slate-950">{e.full_name}</div>
                  <div className="mt-1 text-xs text-slate-500">{e.office} · {e.department}</div>
                  <div className="mt-4 text-3xl font-bold text-blue-700">{getPoints(e).toLocaleString()}</div>
                  <div className="text-xs text-slate-400">pts · {timeLabel}</div>
                  <span className={"mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 " + badgeColor[getBadge(e.points)]}>
                    {getBadge(e.points)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        {txLoading && (
          <div className="mb-8 flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        )}

        {/* Full Ranking Table */}
        <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-xl backdrop-blur-xl">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-950">Bảng xếp hạng đầy đủ</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filtered.length} thành viên · {timeLabel}
              {filterOffice !== "All" && ` · ${filterOffice}`}
              {filterDept !== "All" && ` · ${filterDept}`}
              {filterLevel !== "All" && ` · ${LEVEL_LABELS[filterLevel]}`}
            </p>
          </div>

          <div className="relative overflow-x-auto">
            <div className="grid min-w-[680px] grid-cols-7 border-b border-slate-100 px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              <div>Rank</div>
              <div className="col-span-2">Nhân viên</div>
              <div>Văn phòng</div>
              <div>Cấp bậc</div>
              <div>Badge</div>
              <div>{timeMode === "total" ? "Tổng pts" : timeLabel}</div>
            </div>

            {filtered.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-slate-400">Không có dữ liệu</div>
            )}

            {filtered.map((e, index) => {
              const isMe = e.id === currentUser?.id
              const pts = getPoints(e)
              return (
                <a
                  key={e.id}
                  href={`/profile/${e.id}`}
                  className={"grid min-w-[680px] grid-cols-7 items-center border-b border-slate-100 px-6 py-4 transition last:border-0 " + (
                    isMe ? "bg-blue-50/70 hover:bg-blue-50" : "hover:bg-blue-50/40"
                  )}
                >
                  <div className={"text-sm font-bold " + (
                    index === 0 ? "text-amber-500" :
                    index === 1 ? "text-slate-400" :
                    index === 2 ? "text-orange-500" : "text-slate-300"
                  )}>
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    {e.avatar ? (
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={e.avatar} alt={e.full_name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white " + getColor(index)}>
                        {getInitials(e.full_name)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-950">{e.full_name}</span>
                        {isMe && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">Bạn</span>}
                      </div>
                      <div className="text-xs text-slate-500">{e.department}</div>
                    </div>
                  </div>
                  <div>
                    <span className={"rounded-full px-2.5 py-1 text-xs font-bold ring-1 " + (e.office === "Japan" ? "bg-red-50 text-red-700 ring-red-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100")}>
                      {e.office}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {LEVEL_LABELS[(e as any).level] || "-"}
                  </div>
                  <div>
                    <span className={"rounded-full px-2.5 py-1 text-xs font-bold ring-1 " + badgeColor[getBadge(e.points)]}>
                      {getBadge(e.points)}
                    </span>
                  </div>
                  <div className="font-bold text-blue-700">{pts.toLocaleString()} pts</div>
                </a>
              )
            })}
          </div>
        </section>

      </main>
    </div>
  )
}