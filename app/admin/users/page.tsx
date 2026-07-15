"use client"
import Navbar from "@/components/ui/navbar"
import { useState, useEffect, useMemo } from "react"
import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useAuthGuard } from "@/lib/useAuthGuard"

const ROLE_LABELS: Record<string, string> = {
  employee: "Nhân viên",
  manager: "Quản lý",
  hr: "HR",
  admin: "Admin",
}

const ROLE_COLORS: Record<string, string> = {
  employee: "bg-slate-100 text-slate-600",
  manager: "bg-blue-50 text-blue-700",
  hr: "bg-purple-50 text-purple-700",
  admin: "bg-emerald-50 text-emerald-700",
}

const LEVEL_OPTIONS = [
  { value: "ceo", label: "CEO", budget: 999999999, display: "CEO — Không giới hạn" },
  { value: "division_director", label: "COO/Division Lead/Director", budget: 5000, display: "COO/Division Lead/Director — 5,000 pts" },
  { value: "senior_manager", label: "Senior Manager", budget: 2500, display: "Senior Manager — 2,500 pts" },
  { value: "project_manager", label: "Project Manager", budget: 2000, display: "Project Manager — 2,000 pts" },
  { value: "assistant_pm", label: "Assistant Project Manager", budget: 1500, display: "Assistant Project Manager — 1,500 pts" },
  { value: "senior_team_leader", label: "Senior Team Leader", budget: 1250, display: "Senior Team Leader — 1,250 pts" },
  { value: "team_leader", label: "Team Leader", budget: 1000, display: "Team Leader — 1,000 pts" },
  { value: "senior_ba", label: "Senior BA", budget: 750, display: "Senior BA — 750 pts" },
  { value: "junior_ba", label: "Junior BA", budget: 500, display: "Junior BA — 500 pts" },
  { value: "intern", label: "Long term Intern / Part-time", budget: 200, display: "Long term Intern / Part-time — 200 pts" },
]

const LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  LEVEL_OPTIONS.map(l => [l.value, l.label])
)

function getBudgetByLevel(level: string) {
  return LEVEL_OPTIONS.find(l => l.value === level)?.budget ?? 500
}

function getCurrentHalfYearPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const isFirstHalf = now.getMonth() < 6

  return {
    periodStart: `${year}-${isFirstHalf ? "01" : "07"}-01`,
    periodEnd: `${year}-${isFirstHalf ? "06-30" : "12-31"}`,
  }
}

type Profile = {
  id: string
  full_name: string
  email: string
  role: string
  office: string
  department: string
  position?: string
  level?: string
  is_active: boolean
  points: number
  monthly_points: number
  budget_used?: number
  budget_carried?: number
  giving_budget_monthly?: number
}

const EMPTY_NEW_USER = {
  email: "",
  full_name: "",
  password: "Onevalue@2026",
  role: "employee",
  level: "junior_ba",
  office: "Vietnam",
  department: "",
  position: "",
}

function friendlyError(msg: string): string {
  if (msg.includes("already been registered") || msg.includes("already exists")) return "Email này đã được đăng ký trong hệ thống"
  if (msg.includes("invalid email")) return "Email không hợp lệ"
  if (msg.includes("password")) return "Mật khẩu không đủ mạnh (tối thiểu 8 ký tự)"
  if (msg.includes("office")) return "Văn phòng không hợp lệ, chọn Vietnam hoặc Japan"
  return msg
}

export default function AdminUsersPage() {
  useAuthGuard()
  const { currentUser, loadUser } = useStore()
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterRole, setFilterRole] = useState("all")

  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [editRole, setEditRole] = useState("")
  const [editLevel, setEditLevel] = useState("junior_ba")
  const [editBudget, setEditBudget] = useState<number | "">("")
  const [editActive, setEditActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({ ...EMPTY_NEW_USER })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState("")

  useEffect(() => { loadUser() }, [])

  useEffect(() => {
    if (!currentUser) return
    if (currentUser.role !== "admin") {
      router.replace("/dashboard")
      return
    }
    loadProfiles()
  }, [currentUser])

  async function loadProfiles() {
    setLoading(true)
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true })
    if (data) setProfiles(data as Profile[])
    setLoading(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  function openEdit(p: Profile) {
    setEditingProfile(p)
    setEditRole(p.role)
    setEditActive(p.is_active ?? true)
    setEditLevel(p.level || "junior_ba")
    setEditBudget(p.giving_budget_monthly ?? "")
  }

async function saveEdit() {
  if (!editingProfile) return

  const budget =
    editBudget === ""
      ? getBudgetByLevel(editLevel)
      : Number(editBudget)

  if (!Number.isFinite(budget) || budget < 0) {
    showToast("❌ Ngân sách không hợp lệ")
    return
  }

  const { periodStart, periodEnd } = getCurrentHalfYearPeriod()

  setEditSaving(true)

  try {
    // Cập nhật thông tin chính trong profiles
    const { data: updatedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({
        role: editRole,
        is_active: editActive,
        level: editLevel,
        giving_budget_monthly: budget,
        budget_period_start: periodStart,
        budget_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingProfile.id)
      .select("id, role, is_active, level, giving_budget_monthly")
      .single()

    if (profileError) {
      console.error("Update profile error:", profileError)
      throw new Error(profileError.message)
    }

    // Đồng bộ ngân sách của kỳ hiện tại
    const { error: budgetError } = await supabase
      .from("budget_periods")
      .upsert(
        {
          user_id: editingProfile.id,
          period_start: periodStart,
          period_end: periodEnd,
          budget_allocated: budget,
          budget_carried: 0,
          budget_used: editingProfile.budget_used ?? 0,
        },
        {
          onConflict: "user_id,period_start",
        }
      )

    if (budgetError) {
      console.error("Update budget period error:", budgetError)
      throw new Error(budgetError.message)
    }

    setProfiles(currentProfiles =>
      currentProfiles.map(profile =>
        profile.id === editingProfile.id
          ? {
              ...profile,
              role: updatedProfile.role,
              is_active: updatedProfile.is_active,
              level: updatedProfile.level,
              giving_budget_monthly:
                updatedProfile.giving_budget_monthly,
            }
          : profile
      )
    )

    setEditingProfile(null)
    showToast(`✅ Đã cập nhật ngân sách thành ${budget.toLocaleString()} pts`)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không thể cập nhật người dùng"

    showToast("❌ Lưu thất bại: " + message)
  } finally {
    setEditSaving(false)
  }
}
  async function sendPasswordReset(email: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: origin + "/reset-password",
    })
    setResetEmailSent(email)
    showToast("📧 Đã gửi email đặt lại mật khẩu tới " + email)
    setTimeout(() => setResetEmailSent(null), 5000)
  }

  async function createUser() {
    setCreateError("")
    if (!newUser.email || !newUser.full_name) {
      setCreateError("Vui lòng nhập email và họ tên")
      return
    }
    if (!newUser.office) {
      setCreateError("Vui lòng chọn văn phòng")
      return
    }

    const budget = getBudgetByLevel(newUser.level)
    const { periodStart, periodEnd } = getCurrentHalfYearPeriod()

    setCreating(true)

    try {
      const res = await supabase.functions.invoke("create-user", {
        body: {
          ...newUser,
          giving_budget_monthly: budget,
          budget_carried: 0,
          budget_given: 0,
          budget_period_start: periodStart,
          budget_period_end: periodEnd,
        },
      })

      if (res.error || res.data?.error) {
        const raw = res.data?.error || res.error?.message || "Tạo user thất bại"
        setCreateError(friendlyError(raw))
        setCreating(false)
        return
      }

      await supabase
        .from("profiles")
        .update({
          level: newUser.level,
          giving_budget_monthly: budget,
          budget_carried: 0,
          budget_given: 0,
          budget_period_start: periodStart,
          budget_period_end: periodEnd,
        })
        .eq("email", newUser.email)

      const { data: createdProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", newUser.email)
        .single()

      if (createdProfile?.id) {
        await supabase.from("budget_periods").upsert({
          user_id: createdProfile.id,
          period_start: periodStart,
          period_end: periodEnd,
          budget_allocated: budget,
          budget_carried: 0,
          budget_used: 0,
        })
      }

      showToast("✅ Đã tạo tài khoản " + newUser.full_name)
      setShowCreate(false)
      setNewUser({ ...EMPTY_NEW_USER })
      await loadProfiles()
    } catch (e: any) {
      setCreateError(friendlyError(e.message || "Lỗi không xác định"))
    }

    setCreating(false)
  }

  async function deleteUser() {
    if (!deletingProfile) return
    setDeleting(true)

    try {
      const res = await supabase.functions.invoke("delete-user", {
        body: { user_id: deletingProfile.id },
      })

      if (res.error || res.data?.error) {
        showToast("❌ Xóa thất bại: " + (res.data?.error || res.error?.message))
        setDeleting(false)
        setDeletingProfile(null)
        return
      }

      setProfiles(ps => ps.filter(p => p.id !== deletingProfile.id))
      showToast("🗑️ Đã xóa tài khoản " + deletingProfile.full_name)
      setDeletingProfile(null)
    } catch (e: any) {
      showToast("❌ Lỗi: " + e.message)
    }

    setDeleting(false)
  }

  const filtered = useMemo(() => profiles.filter(p => {
    if (filterRole !== "all" && p.role !== filterRole) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(p.full_name || "").toLowerCase().includes(q) &&
          !(p.email || "").toLowerCase().includes(q) &&
          !(p.department || "").toLowerCase().includes(q)) return false
    }
    return true
  }), [profiles, filterRole, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: profiles.length, employee: 0, manager: 0, hr: 0, admin: 0 }
    profiles.forEach(p => { if (c[p.role] !== undefined) c[p.role]++ })
    return c
  }, [profiles])

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        profiles
          .map(p => p.department)
          .filter((d): d is string => Boolean(d))
      )
    ).sort()
  }, [profiles])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#DBEAFE_0,#F8FAFC_34%,#FFFFFF_70%)] text-slate-900">
      <Navbar />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      {deletingProfile && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white p-7 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <span className="text-2xl">🗑️</span>
              </div>
              <h2 className="text-lg font-bold text-slate-950">Xóa tài khoản?</h2>
              <p className="mt-2 text-sm text-slate-500">
                Bạn chắc chắn muốn xóa tài khoản của{" "}
                <strong className="text-slate-800">{deletingProfile.full_name}</strong>?
              </p>
              <p className="mt-1 text-xs text-red-500">Hành động này không thể hoàn tác!</p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={deleteUser}
                disabled={deleting}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deleting ? "Đang xóa..." : "🗑️ Xóa"}
              </button>
              <button
                onClick={() => setDeletingProfile(null)}
                disabled={deleting}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-950">➕ Tạo tài khoản mới</h2>
                <p className="text-xs text-slate-400 mt-0.5">Điền thông tin để tạo user mới</p>
              </div>
              <button onClick={() => { setShowCreate(false); setCreateError("") }} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Họ tên *</label>
                  <input
                    value={newUser.full_name}
                    onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Email *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))}
                    placeholder="ten@onevalue.jp"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Mật khẩu mặc định</label>
                  <input
                    value={newUser.password}
                    onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Vai trò</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="employee">Nhân viên</option>
                    <option value="manager">Quản lý</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Cấp bậc</label>
                  <select
                    value={newUser.level}
                    onChange={e => setNewUser(u => ({ ...u, level: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {LEVEL_OPTIONS.map(level => (
                      <option key={level.value} value={level.value}>
                        {level.display}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Văn phòng *</label>
                  <select
                    value={newUser.office}
                    onChange={e => setNewUser(u => ({ ...u, office: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="Vietnam">Vietnam</option>
                    <option value="Japan">Japan</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Phòng ban</label>
                  <select
                    value={newUser.department}
                    onChange={e => setNewUser(u => ({ ...u, department: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Chọn phòng ban</option>
                    {departments.map(dep => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Chức vụ</label>
                  <input
                    value={newUser.position}
                    onChange={e => setNewUser(u => ({ ...u, position: e.target.value }))}
                    placeholder="Software Engineer / PM..."
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {createError && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                  ❌ {createError}
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={createUser}
                disabled={creating}
                className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {creating ? "Đang tạo..." : "✅ Tạo tài khoản"}
              </button>
              <button
                onClick={() => { setShowCreate(false); setCreateError("") }}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProfile && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-7 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-bold text-white">
                {(editingProfile.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-950">{editingProfile.full_name}</h2>
                <p className="text-xs text-slate-400">{editingProfile.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Vai trò</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="employee">Nhân viên</option>
                  <option value="manager">Quản lý</option>
                  <option value="hr">HR</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Cấp bậc (Level)</label>
                <select
                  value={editLevel}
                  onChange={e => setEditLevel(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {LEVEL_OPTIONS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.display}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Ngân sách tùy chỉnh{" "}
                  <span className="text-slate-400 normal-case font-normal">(để trống = dùng mặc định theo level)</span>
                </label>
                <input
                  type="number"
                  value={editBudget}
                  onChange={e => setEditBudget(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="VD: 500"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">Tài khoản hoạt động</span>
                <button
                  onClick={() => setEditActive(v => !v)}
                  className={"relative h-6 w-11 rounded-full transition-colors " + (editActive ? "bg-emerald-500" : "bg-slate-300")}
                >
                  <span className={"absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform " + (editActive ? "translate-x-5" : "translate-x-0.5")} />
                </button>
              </div>

              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-500 mb-2">Đặt lại mật khẩu — gửi link qua email</p>
                <button
                  onClick={() => sendPasswordReset(editingProfile.email)}
                  disabled={resetEmailSent === editingProfile.email}
                  className="rounded-full bg-amber-50 px-4 py-1.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-50 transition"
                >
                  {resetEmailSent === editingProfile.email ? "✅ Đã gửi" : "📧 Gửi email đặt lại MK"}
                </button>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editSaving ? "Đang lưu..." : "💾 Lưu thay đổi"}
              </button>
              <button
                onClick={() => setEditingProfile(null)}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <div className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-7 shadow-xl backdrop-blur-xl">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <span className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-purple-100">
                ⚙️ Quản trị hệ thống
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Quản lý người dùng</h1>
              <p className="mt-1 text-sm text-slate-500">{filtered.length} / {profiles.length} tài khoản</p>
            </div>
            <button
              onClick={() => { setShowCreate(true); setCreateError("") }}
              className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition flex items-center gap-2"
            >
              ➕ Tạo user mới
            </button>
          </div>
        </div>

        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["all", "employee", "manager", "hr", "admin"] as const).map(r => (
              <button key={r} onClick={() => setFilterRole(r)}
                className={"rounded-full px-4 py-1.5 text-xs font-bold transition " + (
                  filterRole === r
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                )}>
                {r === "all" ? "Tất cả" : ROLE_LABELS[r]}
                <span className={"ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] " + (filterRole === r ? "bg-white/30" : "bg-slate-100")}>
                  {counts[r] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, phòng ban..."
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[260px]"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">Đang tải...</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => (
              <div key={p.id} className="rounded-[2rem] border border-white/80 bg-white/85 px-5 py-4 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-bold text-white shrink-0">
                      {(p.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-950 flex items-center gap-2">
                        {p.full_name}
                        {!p.is_active && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-red-100">Đã vô hiệu</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{p.email}</div>
                      <div className="text-xs text-slate-400">{p.office} · {p.department}{p.position ? ` · ${p.position}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={"rounded-full px-3 py-1 text-xs font-bold " + (ROLE_COLORS[p.role] || "bg-slate-100 text-slate-600")}>
                      {ROLE_LABELS[p.role] || p.role}
                    </span>
                    {p.level && (
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                        {LEVEL_LABELS[p.level] || p.level}
                      </span>
                    )}
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {p.points} pts
                    </span>
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                    >
                      ✏️ Sửa
                    </button>
                    {p.id !== currentUser?.id && (
                      <button
                        onClick={() => setDeletingProfile(p)}
                        className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                      >
                        🗑️ Xóa
                      </button>
                    )}
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