"use client"
import Navbar from "@/components/ui/navbar"
import { useState, useEffect, useMemo } from "react"
import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useAuthGuard } from "@/lib/useAuthGuard"

type Evaluation = {
  id: string
  employee_id: string
  evaluator_id: string
  evaluation_period: string
  evaluation_type: string
  status: string
  final_score: number
  total_goal_score: number
  total_skill_a_score: number
  total_attitude_score: number
  created_at: string
  employee?: { full_name: string; office: string; department: string }
  evaluator?: { full_name: string }
}

const EVAL_TYPE_LABELS: Record<string, string> = {
  periodic: "Định kỳ 6 tháng",
  probation: "Thử việc",
  contract_change: "Thay đổi HĐ",
  salary_review: "Tăng lương",
}

const STATUS_VI: Record<string, string> = {
  draft: "Nháp",
  submitted: "Chờ phê duyệt",
  approved: "Đã phê duyệt",
  rejected: "Từ chối",
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
}

const STATUS_FILTER_STYLES: Record<string, string> = {
  all:       "bg-slate-800 text-white",
  draft:     "bg-slate-100 text-slate-700",
  submitted: "bg-blue-600 text-white",
  approved:  "bg-emerald-600 text-white",
  rejected:  "bg-red-500 text-white",
}

function ScoreBadge({ score, lang }: { score: number; lang: "vi" | "ja" }) {
  const color = score >= 4 ? "text-emerald-700 bg-emerald-50 ring-emerald-100"
    : score >= 3 ? "text-blue-700 bg-blue-50 ring-blue-100"
    : score >= 2 ? "text-amber-700 bg-amber-50 ring-amber-100"
    : "text-red-700 bg-red-50 ring-red-100"
  const label = lang === "ja"
    ? (score >= 4.5 ? "非常に優秀" : score >= 4 ? "良い" : score >= 3 ? "標準" : score >= 2 ? "要改善" : "不十分")
    : (score >= 4.5 ? "Xuất sắc" : score >= 4 ? "Tốt" : score >= 3 ? "Khá" : score >= 2 ? "Trung bình" : "Yếu")
  return (
    <span className={"rounded-full px-2.5 py-1 text-xs font-bold ring-1 " + color}>
      {score.toFixed(2)} — {label}
    </span>
  )
}

export default function EvaluationListPage() {
  useAuthGuard()
  const { currentUser, loadUser, profiles, loadProfiles, lang } = useStore()
  const L = (vi: string, ja: string) => lang === "ja" ? ja : vi
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPeriod, setFilterPeriod] = useState("all")
  const [search, setSearch] = useState("")

  useEffect(() => { loadUser(); loadProfiles() }, [])

  useEffect(() => {
    if (!currentUser) return
    if (!["manager", "hr", "admin"].includes(currentUser.role)) {
      router.replace("/dashboard"); return
    }
    loadEvaluations()
  }, [currentUser])

  async function loadEvaluations() {
    setLoading(true)
    const { data } = await supabase
      .from("evaluations").select("*").order("created_at", { ascending: false })
    if (data) {
      setEvaluations(data.map(ev => ({
        ...ev,
        employee: profiles.find(p => p.id === ev.employee_id),
        evaluator: profiles.find(p => p.id === ev.evaluator_id),
      })))
    }
    setLoading(false)
  }

  // Unique periods for filter
  const periods = useMemo(() => {
    const set = new Set(evaluations.map(e => e.evaluation_period).filter(Boolean))
    return Array.from(set).sort().reverse()
  }, [evaluations])

  // Apply filters
  const filtered = useMemo(() => evaluations.filter(ev => {
    if (filterStatus !== "all" && ev.status !== filterStatus) return false
    if (filterPeriod !== "all" && ev.evaluation_period !== filterPeriod) return false
    if (search) {
      const q = search.toLowerCase()
      const name = (ev.employee?.full_name || "").toLowerCase()
      if (!name.includes(q)) return false
    }
    return true
  }), [evaluations, filterStatus, filterPeriod, search])

  const canCreate = currentUser?.role === "manager" || currentUser?.role === "hr" || currentUser?.role === "admin"

  // Status counts for filter badges
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: evaluations.length, draft: 0, submitted: 0, approved: 0, rejected: 0 }
    evaluations.forEach(e => { if (c[e.status] !== undefined) c[e.status]++ })
    return c
  }, [evaluations])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#DBEAFE_0,#F8FAFC_34%,#FFFFFF_70%)] text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">

        {/* Header */}
        <div className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-7 shadow-xl backdrop-blur-xl">
          <div className="relative flex items-end justify-between gap-4 flex-wrap">
            <div>
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                {L("Đánh giá hiệu suất — OVVN", "人事評価 — OVVN")}
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{L("Danh sách đánh giá", "評価一覧")}</h1>
              <p className="mt-1 text-sm text-slate-500">{filtered.length} / {evaluations.length} {L("phiếu", "件")}</p>
            </div>
            {canCreate && (
              <button onClick={() => router.push("/evaluation/new")}
                className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition">
                {L("+ Tạo đánh giá mới", "+ 新しい評価を作成")}
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 space-y-3">
          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2">
            {(["all", "draft", "submitted", "approved", "rejected"] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={"rounded-full px-4 py-1.5 text-xs font-bold transition " + (
                  filterStatus === s
                    ? STATUS_FILTER_STYLES[s]
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                )}>
                {s === "all" ? L("Tất cả", "すべて") : (lang === "ja" ? ({draft:"下書き",submitted:"承認待ち",approved:"承認済み",rejected:"却下"} as Record<string,string>)[s] : STATUS_VI[s])}
                <span className={"ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] " + (filterStatus === s ? "bg-white/30" : "bg-slate-100")}>
                  {counts[s]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Period filter */}
            {periods.length > 0 && (
              <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="all">{L("Tất cả kỳ", "すべての期間")}</option>
                {periods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            {/* Search by name */}
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={L("Tìm theo tên nhân viên...", "社員名で検索...")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[200px]" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">{L("Đang tải...", "読み込み中...")}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-[2rem] border border-white/80 bg-white/85 shadow-xl backdrop-blur-xl">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-500 text-sm">
              {evaluations.length === 0 ? L("Chưa có đánh giá nào", "評価はまだありません") : L("Không có kết quả phù hợp", "該当する結果がありません")}
            </p>
            {canCreate && evaluations.length === 0 && (
              <button onClick={() => router.push("/evaluation/new")}
                className="mt-4 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                {L("Tạo đánh giá đầu tiên", "最初の評価を作成")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(ev => (
              <div key={ev.id} className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-bold text-white">
                      {(ev.employee?.full_name || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-950">{ev.employee?.full_name || "Unknown"}</div>
                      <div className="text-xs text-slate-500">{ev.employee?.office} · {ev.employee?.department}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{L("Đánh giá bởi", "評価者")}: {ev.evaluator?.full_name || "Unknown"}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{ev.evaluation_period}</span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">{lang === "ja" ? ({periodic:"6か月定期評価",probation:"試用期間",contract_change:"契約変更",salary_review:"昇給評価"} as Record<string,string>)[ev.evaluation_type] || ev.evaluation_type : EVAL_TYPE_LABELS[ev.evaluation_type] || ev.evaluation_type}</span>
                    <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (STATUS_COLORS[ev.status] || "bg-slate-100 text-slate-600")}>{lang === "ja" ? ({draft:"下書き",submitted:"承認待ち",approved:"承認済み",rejected:"却下"} as Record<string,string>)[ev.status] || ev.status : STATUS_VI[ev.status] || ev.status}</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: L("Mục tiêu (70%)", "目標 (70%)"), val: ev.total_goal_score, c: "bg-blue-50 text-blue-700" },
                    { label: L("Kỹ năng", "スキル"), val: ev.total_skill_a_score, c: "bg-purple-50 text-purple-700" },
                    { label: L("Thái độ", "勤務態度"), val: ev.total_attitude_score, c: "bg-amber-50 text-amber-700" },
                    { label: L("Điểm tổng", "総合点"), val: ev.final_score, c: "bg-emerald-50 text-emerald-700" },
                  ].map(s => (
                    <div key={s.label} className={"rounded-2xl px-3 py-2 text-center ring-1 " + s.c.replace("text-", "ring-").replace("-700", "-100") + " " + s.c}>
                      <div className="text-lg font-bold">{(s.val || 0).toFixed(2)}</div>
                      <div className="text-xs">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <ScoreBadge score={ev.final_score || 0} lang={lang} />
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{new Date(ev.created_at).toLocaleDateString(lang === "ja" ? "ja-JP" : "vi-VN")}</span>
                    <button onClick={() => router.push(`/evaluation/${ev.id}`)}
                      className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition">
                      {L("Xem chi tiết →", "詳細を見る →")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
