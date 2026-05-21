"use client"
import Navbar from "@/components/ui/navbar"
import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useAuthGuard } from "@/lib/useAuthGuard"

const SKILLS_A_LABELS = [
  "Tư duy Logic", "Giải quyết vấn đề", "Chất lượng output",
  "Tuân thủ deadline", "Horenso", "Tốc độ phản hồi",
  "Kỹ năng thuyết trình", "Hợp tác nhóm", "Kiến thức ngành", "Tự phát triển",
]

const ATTITUDES_LABELS = [
  "Tuân thủ quy định & văn hóa công ty",
  "Đi làm đúng giờ",
  "Ý thức gắn bó & đóng góp cho công ty",
]

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

function ScoreBar({ score, max = 5 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const color = score >= 4 ? "bg-emerald-500" : score >= 3 ? "bg-blue-500" : score >= 2 ? "bg-amber-500" : "bg-red-400"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={"h-1.5 rounded-full transition-all " + color} style={{ width: pct + "%" }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-6 text-right">{score}</span>
    </div>
  )
}

function ScoreInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={"h-7 w-7 rounded-full text-xs font-bold transition border " + (
            value >= n
              ? "bg-blue-500 text-white border-blue-500"
              : "bg-white text-slate-400 border-slate-200 hover:border-blue-300"
          )}
        >{n}</button>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-white/80 bg-white/85 p-6 shadow-lg backdrop-blur-xl">
      <h2 className="text-base font-bold text-slate-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function EvaluationDetailPage() {
  useAuthGuard()
  const { currentUser, loadUser, profiles, loadProfiles } = useStore()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [ev, setEv] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showRejectInput, setShowRejectInput] = useState(false)

  // Self-evaluation edit state
  const [selfEditMode, setSelfEditMode] = useState(false)
  const [selfSaving, setSelfSaving] = useState(false)
  const [selfData, setSelfData] = useState<Record<string, any>>({})

  useEffect(() => { loadUser(); loadProfiles() }, [])

  useEffect(() => {
    if (!id) return
    supabase.from("evaluations").select("*").eq("id", id).single().then(({ data }) => {
      setEv(data)
      setLoading(false)
    })
  }, [id])

  function enterSelfEdit() {
    if (!ev) return
    const d: Record<string, any> = {}
    for (let i = 1; i <= 6; i++) {
      d[`goal_${i}_self_score`] = ev[`goal_${i}_self_score`] || 0
      d[`goal_${i}_result`] = ev[`goal_${i}_result`] || ""
    }
    for (let i = 1; i <= 10; i++) {
      d[`skill_${i}_self`] = ev[`skill_${i}_self`] || 0
      d[`skill_${i}_comment`] = ev[`skill_${i}_comment`] || ""
    }
    for (let i = 1; i <= 3; i++) {
      d[`attitude_${i}_self`] = ev[`attitude_${i}_self`] || 0
      d[`attitude_${i}_comment`] = ev[`attitude_${i}_comment`] || ""
    }
    d.self_strengths = ev.self_strengths || ""
    d.self_improvements = ev.self_improvements || ""
    d.self_ideas = ev.self_ideas || ""
    d.self_expectations = ev.self_expectations || ""
    d.self_satisfaction = ev.self_satisfaction || 0
    setSelfData(d)
    setSelfEditMode(true)
  }

  async function saveSelfEval() {
    if (!ev) return
    setSelfSaving(true)
    await supabase.from("evaluations").update(selfData).eq("id", ev.id)
    setEv({ ...ev, ...selfData })
    setSelfSaving(false)
    setSelfEditMode(false)
  }

  async function handleStatusChange(newStatus: string) {
    if (!ev) return
    setActioning(true)
    await supabase.from("evaluations").update({
      status: newStatus,
      ...(newStatus === "rejected" && rejectReason ? { reject_reason: rejectReason } : {}),
    }).eq("id", ev.id)
    setEv({ ...ev, status: newStatus })
    setShowRejectInput(false)
    setRejectReason("")
    setActioning(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#DBEAFE_0,#F8FAFC_34%,#FFFFFF_70%)]">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      </div>
    )
  }

  if (!ev) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#DBEAFE_0,#F8FAFC_34%,#FFFFFF_70%)]">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-40 text-slate-400">
          <p className="text-lg font-semibold">Không tìm thấy phiếu đánh giá</p>
          <button onClick={() => router.push("/evaluation")} className="mt-4 text-sm text-blue-600 hover:underline">← Quay lại danh sách</button>
        </div>
      </div>
    )
  }

  const employee = profiles.find(p => p.id === ev.employee_id)
  const evaluator = profiles.find(p => p.id === ev.evaluator_id)
  const canApprove = currentUser?.role === "hr" || currentUser?.role === "admin"
  const canSubmit = (currentUser?.role === "manager" || currentUser?.role === "hr" || currentUser?.role === "admin") && ev.status === "draft"
  const isEmployee = currentUser?.id === ev.employee_id
  const canSelfEdit = isEmployee && ev.status === "draft"

  // Helper to get/set selfData field
  const sf = (key: string) => selfData[key] ?? ""
  const setSf = (key: string, val: any) => setSelfData(d => ({ ...d, [key]: val }))

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#DBEAFE_0,#F8FAFC_34%,#FFFFFF_70%)] text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-5">

        {/* Header */}
        <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
          <button onClick={() => router.push("/evaluation")} className="mb-4 text-sm text-slate-400 hover:text-blue-600 transition">← Quay lại danh sách</button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-base font-bold text-white shadow">
                {(employee?.full_name || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-950">{employee?.full_name || "Unknown"}</h1>
                <p className="text-sm text-slate-500">{employee?.department} · {employee?.office}</p>
                <p className="text-xs text-slate-400 mt-0.5">Đánh giá bởi: <span className="font-semibold">{evaluator?.full_name || "Unknown"}</span></p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{ev.evaluation_period}</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">{EVAL_TYPE_LABELS[ev.evaluation_type] || ev.evaluation_type}</span>
              <span className={"rounded-full px-3 py-1 text-xs font-bold " + (STATUS_COLORS[ev.status] || "bg-slate-100 text-slate-600")}>
                {STATUS_VI[ev.status] || ev.status}
              </span>
              <span className="text-xs text-slate-400">{new Date(ev.created_at).toLocaleDateString("vi-VN")}</span>
            </div>
          </div>

          {/* Score summary */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Mục tiêu (70%)", val: ev.total_goal_score, color: "bg-blue-50 text-blue-700 ring-blue-100" },
              { label: "Kỹ năng", val: ev.total_skill_a_score, color: "bg-purple-50 text-purple-700 ring-purple-100" },
              { label: "Thái độ", val: ev.total_attitude_score, color: "bg-amber-50 text-amber-700 ring-amber-100" },
              { label: "Điểm tổng", val: ev.final_score, color: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
            ].map(s => (
              <div key={s.label} className={"rounded-2xl px-3 py-2.5 text-center ring-1 " + s.color}>
                <div className="text-xl font-bold">{(s.val || 0).toFixed(2)}</div>
                <div className="text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Workflow buttons */}
          {ev.status !== "approved" && (
            <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              {canSelfEdit && !selfEditMode && (
                <button onClick={enterSelfEdit}
                  className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition">
                  ✏️ Điền tự đánh giá
                </button>
              )}
              {canSubmit && !selfEditMode && (
                <button onClick={() => handleStatusChange("submitted")} disabled={actioning}
                  className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition">
                  📤 Nộp phê duyệt
                </button>
              )}
              {canApprove && ev.status === "submitted" && (
                <>
                  <button onClick={() => handleStatusChange("approved")} disabled={actioning}
                    className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
                    ✓ Phê duyệt
                  </button>
                  <button onClick={() => setShowRejectInput(!showRejectInput)} disabled={actioning}
                    className="rounded-full bg-red-50 px-5 py-2 text-sm font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition">
                    ✕ Từ chối
                  </button>
                </>
              )}
              {ev.status === "rejected" && (
                <button onClick={() => handleStatusChange("draft")} disabled={actioning}
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition">
                  ↩ Trả về nháp
                </button>
              )}
            </div>
          )}
          {showRejectInput && (
            <div className="mt-3 flex gap-2">
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Lý do từ chối (tuỳ chọn)"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              <button onClick={() => handleStatusChange("rejected")} disabled={actioning}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
                Xác nhận từ chối
              </button>
            </div>
          )}
          {ev.reject_reason && (
            <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
              <span className="font-semibold">Lý do từ chối:</span> {ev.reject_reason}
            </div>
          )}
        </div>

        {/* Self-eval edit banner */}
        {selfEditMode && (
          <div className="rounded-[1.5rem] border border-indigo-200 bg-indigo-50 px-5 py-4 shadow-md flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-bold text-indigo-700">✏️ Chế độ tự đánh giá</p>
              <p className="text-xs text-indigo-500 mt-0.5">Điền điểm tự đánh giá và nhận xét, sau đó lưu lại.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveSelfEval} disabled={selfSaving}
                className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                {selfSaving ? "Đang lưu..." : "💾 Lưu tự đánh giá"}
              </button>
              <button onClick={() => setSelfEditMode(false)}
                className="rounded-full border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100">
                Huỷ
              </button>
            </div>
          </div>
        )}

        {/* Goals */}
        <Section title="I. Mục tiêu công việc (70%)">
          <div className="space-y-4">
            {Array.from({ length: 6 }, (_, i) => i + 1).map(i => {
              const name = ev[`goal_${i}_name`]
              if (!name) return null
              return (
                <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-blue-700">Mục tiêu {i}</span>
                    <span className="text-xs text-slate-400">Tỷ trọng: {((ev[`goal_${i}_weight`] || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{name}</p>
                  {selfEditMode ? (
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Kết quả thực hiện</p>
                        <textarea
                          value={sf(`goal_${i}_result`)}
                          onChange={e => setSf(`goal_${i}_result`, e.target.value)}
                          rows={2}
                          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          placeholder="Mô tả kết quả..."
                        />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Điểm tự đánh giá</p>
                        <ScoreInput value={sf(`goal_${i}_self_score`) || 0} onChange={v => setSf(`goal_${i}_self_score`, v)} />
                      </div>
                    </div>
                  ) : (
                    <>
                      {ev[`goal_${i}_result`] && (
                        <p className="mt-1 text-xs text-slate-500 italic">"{ev[`goal_${i}_result`]}"</p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Tự đánh giá</p>
                          <ScoreBar score={ev[`goal_${i}_self_score`] || 0} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Quản lý</p>
                          <ScoreBar score={ev[`goal_${i}_mgr_score`] || 0} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        {/* Skills */}
        <Section title="II.A. Kỹ năng làm việc">
          <div className="space-y-3">
            {SKILLS_A_LABELS.map((label, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-sm font-semibold text-slate-800">{i + 1}. {label}</span>
                {selfEditMode ? (
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Điểm tự đánh giá</p>
                      <ScoreInput value={sf(`skill_${i + 1}_self`) || 0} onChange={v => setSf(`skill_${i + 1}_self`, v)} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Nhận xét</p>
                      <input
                        value={sf(`skill_${i + 1}_comment`)}
                        onChange={e => setSf(`skill_${i + 1}_comment`, e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="Nhận xét ngắn gọn..."
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {ev[`skill_${i + 1}_comment`] && (
                      <p className="text-xs text-slate-500 italic mt-1 mb-2">"{ev[`skill_${i + 1}_comment`]}"</p>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Tự đánh giá</p>
                        <ScoreBar score={ev[`skill_${i + 1}_self`] || 0} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Quản lý</p>
                        <ScoreBar score={ev[`skill_${i + 1}_mgr`] || 0} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Attitudes */}
        <Section title="III. Thái độ làm việc">
          <div className="space-y-3">
            {ATTITUDES_LABELS.map((label, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-sm font-semibold text-slate-800">{i + 1}. {label}</span>
                {selfEditMode ? (
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Điểm tự đánh giá</p>
                      <ScoreInput value={sf(`attitude_${i + 1}_self`) || 0} onChange={v => setSf(`attitude_${i + 1}_self`, v)} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Nhận xét</p>
                      <input
                        value={sf(`attitude_${i + 1}_comment`)}
                        onChange={e => setSf(`attitude_${i + 1}_comment`, e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="Nhận xét ngắn gọn..."
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {ev[`attitude_${i + 1}_comment`] && (
                      <p className="text-xs text-slate-500 italic mt-1">"{ev[`attitude_${i + 1}_comment`]}"</p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Tự đánh giá</p>
                        <ScoreBar score={ev[`attitude_${i + 1}_self`] || 0} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Quản lý</p>
                        <ScoreBar score={ev[`attitude_${i + 1}_mgr`] || 0} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Comments */}
        <Section title="Nhận xét tổng hợp">
          {selfEditMode ? (
            <div className="space-y-4">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Tự nhận xét của bạn</p>
              {[
                { key: "self_strengths", label: "Điểm mạnh" },
                { key: "self_improvements", label: "Điểm cần cải thiện" },
                { key: "self_ideas", label: "Ý tưởng & đề xuất" },
                { key: "self_expectations", label: "Kỳ vọng từ cấp trên" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-slate-600">{f.label}</label>
                  <textarea
                    value={sf(f.key)}
                    onChange={e => setSf(f.key, e.target.value)}
                    rows={3}
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder={f.label + "..."}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-slate-600">Mức độ hài lòng với công việc</label>
                <div className="mt-2">
                  <ScoreInput value={sf("self_satisfaction") || 0} onChange={v => setSf("self_satisfaction", v)} />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Người được đánh giá</p>
                {[
                  { label: "Điểm mạnh", val: ev.self_strengths },
                  { label: "Điểm cần cải thiện", val: ev.self_improvements },
                  { label: "Ý tưởng & đề xuất", val: ev.self_ideas },
                  { label: "Kỳ vọng từ cấp trên", val: ev.self_expectations },
                ].map(f => f.val ? (
                  <div key={f.label} className="mb-3">
                    <p className="text-xs font-semibold text-slate-500">{f.label}</p>
                    <p className="mt-1 text-sm text-slate-700 rounded-xl bg-slate-50 px-3 py-2">{f.val}</p>
                  </div>
                ) : null)}
                {ev.self_satisfaction > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-slate-500">Mức độ hài lòng với công việc</p>
                    <div className="mt-1">
                      <ScoreBar score={ev.self_satisfaction} />
                    </div>
                  </div>
                )}
                {!ev.self_strengths && !ev.self_improvements && !ev.self_ideas && !ev.self_expectations && ev.self_satisfaction <= 0 && (
                  <p className="text-sm text-slate-400 italic">
                    {canSelfEdit ? "Chưa có tự nhận xét. Nhấn \"✏️ Điền tự đánh giá\" để bắt đầu." : "Chưa có tự nhận xét."}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-3">Cấp trên trực tiếp</p>
                {[
                  { label: "Rủi ro khi phân công", val: ev.manager_risk_comment },
                  { label: "Tiếp tục làm việc", val: ev.manager_continue_working },
                  { label: "Định hướng phát triển kỹ năng", val: ev.manager_develop_skills },
                  { label: "Kế hoạch phát triển", val: ev.manager_plan },
                ].map(f => f.val ? (
                  <div key={f.label} className="mb-3">
                    <p className="text-xs font-semibold text-slate-500">{f.label}</p>
                    <p className="mt-1 text-sm text-slate-700 rounded-xl bg-slate-50 px-3 py-2">{f.val}</p>
                  </div>
                ) : null)}
              </div>
            </div>
          )}
        </Section>
      </main>
    </div>
  )
}
