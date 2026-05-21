"use client"
import Navbar from "@/components/ui/navbar"
import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useAuthGuard } from "@/lib/useAuthGuard"

const STEPS = ["Thông tin", "Mục tiêu", "Kỹ năng", "Thái độ", "Nhận xét"]

const SKILLS_A = [
  { id: "skill_1", label: "Tư duy Logic", weight: 2 },
  { id: "skill_2", label: "Giải quyết vấn đề", weight: 1 },
  { id: "skill_3", label: "Chất lượng output", weight: 2 },
  { id: "skill_4", label: "Tuân thủ deadline", weight: 2 },
  { id: "skill_5", label: "Horenso", weight: 2 },
  { id: "skill_6", label: "Tốc độ phản hồi", weight: 2 },
  { id: "skill_7", label: "Kỹ năng thuyết trình", weight: 1 },
  { id: "skill_8", label: "Hợp tác nhóm", weight: 1 },
  { id: "skill_9", label: "Kiến thức ngành", weight: 1 },
  { id: "skill_10", label: "Tự phát triển", weight: 1 },
]

const ATTITUDES = [
  { id: "attitude_1", label: "Tuân thủ quy định & văn hóa công ty", weight: 2 },
  { id: "attitude_2", label: "Đi làm đúng giờ", weight: 1 },
  { id: "attitude_3", label: "Ý thức gắn bó & đóng góp cho công ty", weight: 7 },
]

export default function NewEvaluationPage() {
  useAuthGuard()
  const { currentUser, loadUser, profiles, loadProfiles } = useStore()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 1 - Info
  const [employeeId, setEmployeeId] = useState("")
  const [period, setPeriod] = useState("01-06/2026")
  const [evalType, setEvalType] = useState("periodic")
  const [hasSubordinates, setHasSubordinates] = useState(false)
  const [evalDate, setEvalDate] = useState(new Date().toISOString().split("T")[0])

  // Step 2 - Goals (6 goals)
  const [goals, setGoals] = useState(Array(6).fill(null).map((_, i) => ({
    name: "", weight: [0.2, 0.45, 0.1, 0.1, 0.05, 0.1][i],
    result: "", self_score: 0, mgr_score: 0
  })))

  // Step 3 - Skills A
  const [skillsA, setSkillsA] = useState(
    SKILLS_A.map(s => ({ ...s, comment: "", self_score: 0, mgr_score: 0 }))
  )

  // Step 4 - Attitudes
  const [attitudes, setAttitudes] = useState(
    ATTITUDES.map(a => ({ ...a, comment: "", self_score: 0, mgr_score: 0 }))
  )

  // Step 5 - Comments
  const [selfStrengths, setSelfStrengths] = useState("")
  const [selfImprovements, setSelfImprovements] = useState("")
  const [selfSatisfaction, setSelfSatisfaction] = useState(0)
  const [selfIdeas, setSelfIdeas] = useState("")
  const [selfExpectations, setSelfExpectations] = useState("")
  const [mgrRisk, setMgrRisk] = useState("")
  const [mgrContinue, setMgrContinue] = useState("")
  const [mgrDevelop, setMgrDevelop] = useState("")
  const [mgrPlan, setMgrPlan] = useState("")

  useEffect(() => { loadUser(); loadProfiles() }, [])

  // Block non-HR/manager/admin at route level
  useEffect(() => {
    if (!currentUser) return
    const allowed = ["manager", "hr", "admin"]
    if (!allowed.includes(currentUser.role)) router.replace("/dashboard")
  }, [currentUser])

  const employees = profiles.filter(p => p.role === "employee" || p.role === "manager")

  async function handleSubmit() {
    if (!employeeId || !currentUser) return
    setSaving(true)

    const goalScore = goals.reduce((sum, g) => sum + g.weight * g.mgr_score, 0)
    const skillScore = skillsA.reduce((sum, s) => sum + s.weight * s.mgr_score, 0) / 15
    const attScore = attitudes.reduce((sum, a) => sum + a.weight * a.mgr_score, 0) / 10
    const finalScore = goalScore * 0.7 + (skillScore + attScore) * 0.3 * 5

    const payload: Record<string, unknown> = {
      employee_id: employeeId,
      evaluator_id: currentUser.id,
      evaluation_period: period,
      evaluation_type: evalType,
      status: "draft",
      total_goal_score: goalScore,
      total_skill_a_score: skillScore * 5,
      total_attitude_score: attScore * 5,
      final_score: finalScore,
      self_strengths: selfStrengths,
      self_improvements: selfImprovements,
      self_satisfaction: selfSatisfaction,
      self_ideas: selfIdeas,
      self_expectations: selfExpectations,
      manager_risk_comment: mgrRisk,
      manager_continue_working: mgrContinue,
      manager_develop_skills: mgrDevelop,
      manager_plan: mgrPlan,
    }

    goals.forEach((g, i) => {
      payload[`goal_${i + 1}_name`] = g.name
      payload[`goal_${i + 1}_weight`] = g.weight
      payload[`goal_${i + 1}_result`] = g.result
      payload[`goal_${i + 1}_self_score`] = g.self_score
      payload[`goal_${i + 1}_mgr_score`] = g.mgr_score
    })

    skillsA.forEach((s, i) => {
      payload[`skill_${i + 1}_self`] = s.self_score
      payload[`skill_${i + 1}_mgr`] = s.mgr_score
      payload[`skill_${i + 1}_comment`] = s.comment
    })

    attitudes.forEach((a, i) => {
      payload[`attitude_${i + 1}_self`] = a.self_score
      payload[`attitude_${i + 1}_mgr`] = a.mgr_score
      payload[`attitude_${i + 1}_comment`] = a.comment
    })

    const { error } = await supabase.from("evaluations").insert(payload)
    setSaving(false)
    if (!error) router.push("/evaluation")
    else alert("Lỗi khi lưu: " + error.message)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#DBEAFE_0,#F8FAFC_34%,#FFFFFF_70%)] text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold
                ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`ml-1.5 text-xs hidden sm:block ${i === step ? "font-bold text-blue-600" : "text-slate-400"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`mx-2 h-0.5 w-8 ${i < step ? "bg-emerald-400" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur-xl">

          {/* STEP 0 - Thông tin */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-slate-900">Thông tin đánh giá</h2>
              <div>
                <label className="text-sm font-semibold text-slate-700">Nhân viên được đánh giá *</label>
                <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">-- Chọn nhân viên --</option>
                  {employees.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} — {p.department}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Kỳ đánh giá</label>
                  <input value={period} onChange={e => setPeriod(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Ngày đánh giá</label>
                  <input type="date" value={evalDate} onChange={e => setEvalDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Loại đánh giá</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { v: "periodic", l: "Định kỳ 6 tháng" },
                    { v: "probation", l: "Thử việc" },
                    { v: "contract_change", l: "Thay đổi hợp đồng" },
                    { v: "salary_review", l: "Tăng lương không định kỳ" },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => setEvalType(opt.v)}
                      className={`rounded-xl px-3 py-2 text-sm font-medium border transition
                        ${evalType === opt.v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="hasSub" checked={hasSubordinates} onChange={e => setHasSubordinates(e.target.checked)}
                  className="h-4 w-4 rounded" />
                <label htmlFor="hasSub" className="text-sm text-slate-700">Có quản lý cấp dưới (Senior BA trở lên)?</label>
              </div>
            </div>
          )}

          {/* STEP 1 - Mục tiêu */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-slate-900">I. Mục tiêu công việc (70%)</h2>
              <p className="text-xs text-slate-500">Điền tối đa 6 mục tiêu. Tổng tỷ trọng = 1.0</p>
              {goals.map((g, i) => (
                <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-700">Mục tiêu {i + 1}</span>
                    <span className="text-xs text-slate-400">Tỷ trọng: {(g.weight * 100).toFixed(0)}%</span>
                  </div>
                  <input placeholder="Tên mục tiêu" value={g.name}
                    onChange={e => setGoals(goals.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <textarea placeholder="Kết quả thực tế" value={g.result} rows={2}
                    onChange={e => setGoals(goals.map((x, j) => j === i ? { ...x, result: e.target.value } : x))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500">Tự đánh giá (1-5)</label>
                      <select value={g.self_score}
                        onChange={e => setGoals(goals.map((x, j) => j === i ? { ...x, self_score: Number(e.target.value) } : x))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? "-- Chọn --" : n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Quản lý đánh giá (1-5)</label>
                      <select value={g.mgr_score}
                        onChange={e => setGoals(goals.map((x, j) => j === i ? { ...x, mgr_score: Number(e.target.value) } : x))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? "-- Chọn --" : n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 2 - Kỹ năng */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">II.A. Kỹ năng làm việc</h2>
              {skillsA.map((s, i) => (
                <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-slate-800">{i + 1}. {s.label}</span>
                    <span className="text-xs text-slate-400">Hệ số: {s.weight}</span>
                  </div>
                  <textarea placeholder="Nhận xét của quản lý" value={s.comment} rows={2}
                    onChange={e => setSkillsA(skillsA.map((x, j) => j === i ? { ...x, comment: e.target.value } : x))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500">Tự đánh giá (1-5)</label>
                      <select value={s.self_score}
                        onChange={e => setSkillsA(skillsA.map((x, j) => j === i ? { ...x, self_score: Number(e.target.value) } : x))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? "-- Chọn --" : n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Quản lý đánh giá (1-5)</label>
                      <select value={s.mgr_score}
                        onChange={e => setSkillsA(skillsA.map((x, j) => j === i ? { ...x, mgr_score: Number(e.target.value) } : x))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? "-- Chọn --" : n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 3 - Thái độ */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">III. Thái độ làm việc</h2>
              {attitudes.map((a, i) => (
                <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-slate-800">{i + 1}. {a.label}</span>
                    <span className="text-xs text-slate-400">Hệ số: {a.weight}</span>
                  </div>
                  <textarea placeholder="Nhận xét" value={a.comment} rows={2}
                    onChange={e => setAttitudes(attitudes.map((x, j) => j === i ? { ...x, comment: e.target.value } : x))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500">Tự đánh giá (1-5)</label>
                      <select value={a.self_score}
                        onChange={e => setAttitudes(attitudes.map((x, j) => j === i ? { ...x, self_score: Number(e.target.value) } : x))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? "-- Chọn --" : n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Quản lý đánh giá (1-5)</label>
                      <select value={a.mgr_score}
                        onChange={e => setAttitudes(attitudes.map((x, j) => j === i ? { ...x, mgr_score: Number(e.target.value) } : x))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? "-- Chọn --" : n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 4 - Nhận xét */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-slate-900">Nhận xét tổng hợp</h2>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Người được đánh giá tự ghi</p>
              {[
                { label: "1. Điểm mạnh có thể phát huy", val: selfStrengths, set: setSelfStrengths },
                { label: "2. Điểm cần cải thiện và điểm yếu", val: selfImprovements, set: setSelfImprovements },
                { label: "4. Ý tưởng và đề xuất cải thiện công ty", val: selfIdeas, set: setSelfIdeas },
                { label: "5. Kỳ vọng và cần hướng dẫn từ cấp trên", val: selfExpectations, set: setSelfExpectations },
              ].map((f, i) => (
                <div key={i}>
                  <label className="text-sm font-semibold text-slate-700">{f.label}</label>
                  <textarea value={f.val} onChange={e => f.set(e.target.value)} rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              ))}
              <div>
                <label className="text-sm font-semibold text-slate-700">3. Mức độ hài lòng với công việc (1-5)</label>
                <select value={selfSatisfaction} onChange={e => setSelfSatisfaction(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? "-- Chọn --" : n}</option>)}
                </select>
              </div>

              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mt-4">Cấp trên trực tiếp ghi</p>
              {[
                { label: "1. Rủi ro về chất lượng khi phân công nhiệm vụ?", val: mgrRisk, set: setMgrRisk },
                { label: "2. Có muốn tiếp tục làm việc với thành viên này? (Yes/No + lý do)", val: mgrContinue, set: setMgrContinue },
                { label: "3. Muốn thành viên này phát triển kỹ năng gì?", val: mgrDevelop, set: setMgrDevelop },
                { label: "4. Kế hoạch phát triển cho thành viên này", val: mgrPlan, set: setMgrPlan },
              ].map((f, i) => (
                <div key={i}>
                  <label className="text-sm font-semibold text-slate-700">{f.label}</label>
                  <textarea value={f.val} onChange={e => f.set(e.target.value)} rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              ))}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between">
            <button onClick={() => step > 0 ? setStep(step - 1) : router.push("/evaluation")}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              {step === 0 ? "Hủy" : "← Quay lại"}
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)}
                disabled={step === 0 && !employeeId}
                className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">
                Tiếp theo →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving}
                className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                {saving ? "Đang lưu..." : "✓ Lưu đánh giá"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}