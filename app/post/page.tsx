"use client"
import Navbar from "@/components/ui/navbar"
import { useState, useEffect, useRef, useMemo } from "react"
import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { useAuthGuard } from "@/lib/useAuthGuard"
import { ConfettiTrigger } from "@/components/ui/confetti"
import { useT } from "@/lib/useT"

const categories = [
  "M&A", "Market Research", "Fast Support", "Translation",
  "Leadership", "Creativity", "Sales Support", "Operations"
]
const pointOptions = [10, 20, 30, 50, 100]

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

type Recipient = {
  id: string
  full_name: string
  office: string
  department: string
  email: string
  points: number
  avatar?: string
}

export default function PostPage() {
  useAuthGuard()
  const t = useT()
  const { profiles, loadProfiles, loadUser, addPost, currentUser, companyValues, loadCompanyValues } = useStore()
  const router = useRouter()

  // Budget
  const level = (currentUser as any)?.level || "staff"
  const LEVEL_BUDGETS: Record<string, number> = {
    ceo: Infinity, director: 2500, manager: 2000,
    pm: 1200, senior: 700, staff: 400, intern: 200,
  }
  const baseBudget = (currentUser as any)?.giving_budget_monthly ?? LEVEL_BUDGETS[level] ?? 400
  const carriedOver = (currentUser as any)?.budget_carried || 0
  const totalBudget = baseBudget === Infinity ? Infinity : baseBudget + carriedOver
  const budgetUsed = currentUser?.budget_used || 0
  const remaining = totalBudget === Infinity ? Infinity : totalBudget - budgetUsed

  // Recipients (multi-select)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [pointsPerPerson, setPointsPerPerson] = useState(30)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState("M&A")
  const [selectedValueId, setSelectedValueId] = useState("")
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadUser()
    loadProfiles()
    loadCompanyValues()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const otherProfiles = useMemo(() =>
    profiles.filter(p => p.id !== currentUser?.id),
    [profiles, currentUser]
  )

  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return otherProfiles.slice(0, 8)
    const q = searchQuery.toLowerCase()
    return otherProfiles.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q) ||
      p.office?.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [otherProfiles, searchQuery])

  function addRecipient(p: Recipient) {
    if (recipients.find(r => r.id === p.id)) return
    setRecipients(prev => [...prev, p])
    setSearchQuery("")
    searchRef.current?.focus()
  }

  function removeRecipient(id: string) {
    setRecipients(prev => prev.filter(r => r.id !== id))
  }

  const totalPoints = pointsPerPerson * recipients.length
  const canSend = remaining === Infinity || totalPoints <= remaining

  async function handleSubmit() {
    setError("")
    if (recipients.length === 0) { setError("Vui lòng chọn ít nhất 1 người nhận"); return }
    if (!title) { setError(t.post_err_title); return }
    if (!message) { setError(t.post_err_msg); return }
    if (!canSend) {
      setError(`Không đủ ngân sách. Cần ${totalPoints} pts nhưng chỉ còn ${remaining} pts`)
      return
    }

    setLoading(true)

    // Send to each recipient
    for (const receiver of recipients) {
      await addPost({
        from: currentUser?.full_name || "",
        fromOffice: currentUser?.office || "",
        fromAvatar: getInitials(currentUser?.full_name || "?"),
        fromColor: "from-sky-500 to-blue-500",
        to: receiver.full_name,
        toOffice: receiver.office,
        points: pointsPerPerson,
        category,
        title,
        message,
        companyValueId: selectedValueId || undefined,
      })
    }

    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-50 px-6">
        <ConfettiTrigger active={submitted} />
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-28 left-10 h-80 w-80 rounded-full bg-blue-300/50 blur-3xl" />
          <div className="absolute top-40 right-0 h-96 w-96 rounded-full bg-emerald-300/35 blur-3xl" />
        </div>
        <div className="animate-fade-in-up relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-blue-100 text-5xl shadow-inner">
            🎉
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{t.post_success}</h2>
          <div className="mt-4 space-y-2">
            {recipients.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-2 text-sm">
                <span className="font-semibold text-slate-800">{r.full_name}</span>
                <span className="font-bold text-emerald-600">+{pointsPerPerson} pts</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">Tổng: {totalPoints} pts đã trao cho {recipients.length} người</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button onClick={() => router.push("/feed")}
              className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700">
              {t.post_view_feed}
            </button>
            <button onClick={() => router.push("/leaderboard")}
              className="rounded-full bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100">
              {t.post_see_lb}
            </button>
            <button
              onClick={() => { setSubmitted(false); setRecipients([]); setTitle(""); setMessage(""); setPointsPerPerson(30); setSelectedValueId("") }}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              {t.post_send_another}
            </button>
          </div>
        </div>
      </div>
    )
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
          <div className="relative">
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">{t.post_tag}</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{t.post_title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {t.post_sending_as}: <span className="font-bold">{currentUser?.full_name}</span> · {currentUser?.office}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100">
                {t.post_remaining}: {remaining === Infinity ? "∞" : remaining} / {totalBudget === Infinity ? "∞" : totalBudget} pts
              </div>
              {carriedOver > 0 && (
                <div className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
                  ✨ Carry từ kỳ trước: +{carriedOver} pts
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-xl backdrop-blur-xl">
            <div className="relative space-y-5">

              {/* Multi-select recipients */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Gửi đến <span className="text-slate-400 font-normal">(có thể chọn nhiều người)</span>
                </label>

                {/* Selected recipients chips */}
                {recipients.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {recipients.map(r => (
                      <div key={r.id} className="flex items-center gap-2 rounded-full bg-blue-50 pl-1 pr-3 py-1 ring-1 ring-blue-200">
                        {r.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.avatar} alt={r.full_name} className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-[10px] font-bold text-white">
                            {getInitials(r.full_name)}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-blue-700">{r.full_name}</span>
                        <button onClick={() => removeRecipient(r.id)} className="text-blue-400 hover:text-red-500 transition text-sm leading-none">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="🔍 Tìm theo tên, email, phòng ban..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />

                  {/* Dropdown */}
                  {showDropdown && filteredProfiles.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-20 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
                    >
                      {filteredProfiles.map(p => {
                        const already = recipients.find(r => r.id === p.id)
                        return (
                          <button
                            key={p.id}
                            onClick={() => { if (!already) addRecipient(p as Recipient) }}
                            disabled={!!already}
                            className={"w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-slate-50 last:border-0 " + (
                              already ? "opacity-40 cursor-not-allowed bg-slate-50" : "hover:bg-blue-50"
                            )}
                          >
                            {p.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.avatar} alt={p.full_name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-xs font-bold text-white">
                                {getInitials(p.full_name)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-900">{p.full_name}</div>
                              <div className="text-xs text-slate-500 truncate">{p.office} · {p.department}</div>
                            </div>
                            {already && <span className="text-xs text-emerald-600 font-bold shrink-0">✓ Đã chọn</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Summary */}
                {recipients.length > 1 && (
                  <div className="mt-2 rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700 ring-1 ring-amber-100">
                    💡 Mỗi người sẽ nhận <strong>{pointsPerPerson} pts</strong> riêng biệt · Tổng: <strong>{totalPoints} pts</strong>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">{t.post_title_label}</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder={t.post_title_ph}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              </div>

              {/* Message */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">{t.post_msg}</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder={t.post_msg_ph} rows={5}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              </div>

              {/* Category */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">{t.post_category}</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Company Value */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  {t.post_value} <span className="text-slate-400 font-normal">{t.post_optional}</span>
                </label>
                <select value={selectedValueId} onChange={e => setSelectedValueId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                  <option value="">{t.post_value_ph}</option>
                  {companyValues.map(v => (
                    <option key={v.id} value={v.id}>{v.icon} {v.title}</option>
                  ))}
                </select>
              </div>

              {/* Points per person */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  {t.post_points}
                  {recipients.length > 1 && (
                    <span className="ml-2 font-normal text-slate-500 text-xs">· mỗi người nhận {pointsPerPerson} pts</span>
                  )}
                </label>
                <div className="flex flex-wrap gap-2">
                  {pointOptions.map(p => {
                    const total = p * Math.max(recipients.length, 1)
                    const disabled = remaining !== Infinity && total > remaining
                    return (
                      <button key={p} onClick={() => setPointsPerPerson(p)} disabled={disabled}
                        className={"rounded-full px-4 py-2 text-sm font-bold ring-1 transition " + (
                          pointsPerPerson === p ? "bg-blue-600 text-white ring-blue-600 shadow-md" :
                          disabled ? "opacity-40 cursor-not-allowed bg-white text-slate-400 ring-slate-200" :
                          "bg-white text-slate-600 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"
                        )}>
                        {p} pts
                        {recipients.length > 1 && !disabled && (
                          <span className="ml-1 text-[10px] opacity-70">×{recipients.length}</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Total cost preview */}
                {recipients.length > 0 && (
                  <div className={"mt-3 rounded-xl px-4 py-2.5 text-sm ring-1 " + (canSend ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-red-50 text-red-600 ring-red-100")}>
                    {canSend ? "✅" : "❌"}{" "}
                    <strong>{recipients.length} người</strong> × <strong>{pointsPerPerson} pts</strong> = <strong>{totalPoints} pts</strong>
                    {remaining !== Infinity && (
                      <span className="ml-2 text-xs opacity-70">(còn lại: {remaining} pts)</span>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 ring-1 ring-red-100">{error}</div>
              )}

              <button onClick={handleSubmit} disabled={loading || recipients.length === 0}
                className="w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-60">
                {loading
                  ? (recipients.length > 1 ? `Đang gửi ${recipients.length} khen thưởng...` : t.post_submitting)
                  : recipients.length > 1
                    ? `🎉 Gửi ${recipients.length} khen thưởng · ${totalPoints} pts`
                    : `${t.post_submit}${pointsPerPerson} pts`
                }
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            {/* Company Values */}
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl backdrop-blur-xl">
              <h2 className="text-base font-bold text-slate-950">{t.post_values_title}</h2>
              <p className="mt-1 text-xs text-slate-400">{t.post_values_sub}</p>
              <div className="mt-4 space-y-2">
                {companyValues.map(v => (
                  <button key={v.id} onClick={() => setSelectedValueId(selectedValueId === v.id ? "" : v.id)}
                    className={"w-full flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition ring-1 " + (
                      selectedValueId === v.id
                        ? "bg-blue-50 text-blue-700 ring-blue-200 font-semibold"
                        : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"
                    )}>
                    <span className="text-base">{v.icon}</span>
                    <span>{v.title}</span>
                    {selectedValueId === v.id && <span className="ml-auto text-blue-500">✔</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Point guide */}
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl backdrop-blur-xl">
              <h2 className="text-base font-bold text-slate-950">{t.post_guide}</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between rounded-2xl bg-blue-50 px-4 py-3 text-blue-700 ring-1 ring-blue-100">
                  <span className="font-semibold">{t.post_small}</span><span className="font-bold">10–20 pts</span>
                </div>
                <div className="flex justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700 ring-1 ring-emerald-100">
                  <span className="font-semibold">{t.post_strong}</span><span className="font-bold">30–50 pts</span>
                </div>
                <div className="flex justify-between rounded-2xl bg-amber-50 px-4 py-3 text-amber-700 ring-1 ring-amber-100">
                  <span className="font-semibold">{t.post_beyond}</span><span className="font-bold">100 pts</span>
                </div>
              </div>
            </div>

            {/* Budget */}
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl backdrop-blur-xl">
              <h2 className="text-base font-bold text-slate-950">{t.post_budget}</h2>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">{t.post_used}</span>
                  <span className="font-bold text-slate-700">{budgetUsed} / {totalBudget === Infinity ? "∞" : totalBudget} pts</span>
                </div>
                {totalBudget !== Infinity && (
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: Math.min((budgetUsed / (totalBudget as number)) * 100, 100) + "%" }} />
                  </div>
                )}
                <div className="mt-2 text-xs text-slate-400 text-right">
                  {remaining === Infinity ? "Không giới hạn" : `${remaining} pts còn lại`}
                </div>
                {carriedOver > 0 && (
                  <div className="mt-2 text-xs text-blue-600">✨ Bao gồm {carriedOver} pts carry từ kỳ trước</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}