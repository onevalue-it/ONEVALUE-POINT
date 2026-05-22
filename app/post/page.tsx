"use client"
import Navbar from "@/components/ui/navbar"
import { useState, useEffect, useRef, useMemo } from "react"
import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { useAuthGuard } from "@/lib/useAuthGuard"
import { ConfettiTrigger } from "@/components/ui/confetti"
import { useT } from "@/lib/useT"
import type { Profile } from "@/lib/store"

const categories = [
  "M&A", "Market Research", "Fast Support", "Translation",
  "Leadership", "Creativity", "Sales Support", "Operations"
]
const pointOptions = [10, 20, 30, 50, 100]

const COMPANY_VALUES = [
  {
    id: "referral",
    icon: "👥",
    title: "Referral",
    desc: "Giới thiệu ứng viên vào công ty",
  },
  {
    id: "branding",
    icon: "📣",
    title: "Branding",
    desc: "Có hành động tích cực quảng bá hình ảnh của công ty với khách hàng và người lao động, người xung quanh (Kiểm chứng được)",
  },
  {
    id: "engagement",
    icon: "🤝",
    title: "Engagement",
    desc: "Tham gia đóng góp vào hoạt động, sự kiện của công ty ngoài giờ làm việc/ ngày cuối tuần.",
  },
  {
    id: "innovation",
    icon: "💡",
    title: "Innovation",
    desc: "Đưa ra ý tưởng cải thiện giúp công ty phát triển và ý tưởng này được triển khai thành công trong thời gian đánh giá để kiểm chứng được",
  },
  {
    id: "cost-saving",
    icon: "💰",
    title: "Cost Saving",
    desc: "Có hành động/ phương án tiết kiệm tiền cho công ty ở mọi hình thức (Giấy in, tiền taxi, phát hiện và ngăn chặn chi phi lãng phí...) - Nội dung này không xét cho HCNS và Kế toán vì làm nghiệp vụ chính của phòng ban.",
  },
  {
    id: "workplace-care",
    icon: "🧹",
    title: "Workplace Care",
    desc: "Có hành động dọn dẹp vệ sinh, giữ gìn môi trường làm việc, bảo vệ trang thiết bị của công ty ngoài phạm mình vi phụ trách",
  },
  {
    id: "ownership",
    icon: "🧭",
    title: "Ownership",
    desc: "Là tấm gương cho các thành viên khác về NDA làm việc tại công ty với tinh thần: Không nói không - không nói khó. Ownership - tinh thần chủ sở hữu với công việc của mình làm. Nhận và tích cực làm tốt nghiệp vụ và công việc được giao dù không có kinh nghiệm hoặc kĩ năng liên quan trong thời gian đánh giá",
  },
  {
    id: "retention-support",
    icon: "🛡️",
    title: "Retention Support",
    desc: "Hành động giúp công ty ổn định nhân sự, giữ nười tốt cho tổ chức. (Biết có nhân sự có ý định hoặc trăn trở nghỉ việc thì người được đánh giá chủ động nắm bắt vấn đề trăn trở, giúp tháo gỡ khúc mắc dẫn tới nghỉ việc, báo cáo nhân sự và ng có thẩm quyền để công ty trao đổi song phương và tháo gỡ khó khăn -> Giúp công ty giữ người)",
  },
  {
    id: "onboarding-support",
    icon: "🌱",
    title: "Onboarding Support",
    desc: "Giúp đỡ nhân sự mới vào công ty nhanh chóng hòa nhập và được nhân sự đó cám ơn chính thức có báo với HCNS (Nhân sự được giúp đỡ là người ngoài team & không thuộc trách nhiệm của người được đánh giá)",
  },
  {
    id: "efficiency",
    icon: "⚡",
    title: "Efficiency",
    desc: "Có hành động sáng tạo giúp dự án kết thúc nhanh hơn dự kiến, công việc được giải quyết nhanh hơn kế hoạch (Kiểm chứng được trong dự án)",
  },
]


const POINT_GUIDE = [
  {
    label: "Hỗ trợ nhỏ",
    range: "10–20 pts",
    color: "bg-blue-50 text-blue-700 ring-blue-100",
    desc: "Hỗ trợ nhanh, phạm vi nhỏ, giúp công việc thuận lợi hơn.",
    example: "Check giúp thông tin, hướng dẫn thao tác, gửi tài liệu, hỗ trợ liên hệ nhanh",
  },
  {
    label: "Hỗ trợ lớn",
    range: "30–50 pts",
    color: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    desc: "Hỗ trợ có đầu tư thời gian/công sức, ảnh hưởng rõ đến tiến độ hoặc chất lượng công việc.",
    example: "Review tài liệu quan trọng, hỗ trợ xử lý deadline, tham gia gỡ vướng cho team khác",
  },
  {
    label: "Vượt trội",
    range: "100 pts",
    color: "bg-amber-50 text-amber-700 ring-amber-100",
    desc: "Đóng góp vượt ngoài phạm vi thông thường, có tác động lớn đến khách hàng, dự án, doanh thu, chất lượng hoặc văn hóa công ty.",
    example: "Cứu deadline quan trọng, xử lý issue lớn, tạo tool/quy trình dùng lại được, hỗ trợ thành công một case khó",
  },
]

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

type Recipient = {
  profile: Profile
  points: number
}

export default function PostPage() {
  useAuthGuard()
  const t = useT()
  const { profiles, loadProfiles, loadUser, addPost, currentUser, myBudget } = useStore()
  const router = useRouter()

  const remaining = myBudget - (currentUser?.budget_used || 0)

  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState("M&A")
  const [selectedValueId, setSelectedValueId] = useState("")
  const [expandedValueId, setExpandedValueId] = useState<string | null>(null)
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [search, setSearch] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadUser()
    loadProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const otherProfiles = profiles.filter(p => p.id !== currentUser?.id && p.is_active !== false)

  const searchResults = useMemo(() => {
    if (!search.trim()) return otherProfiles.slice(0, 8)
    const q = search.toLowerCase()
    return otherProfiles.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.department || "").toLowerCase().includes(q) ||
      (p.office || "").toLowerCase().includes(q)
    ).slice(0, 8)
  }, [search, otherProfiles])

  function addRecipient(p: Profile) {
    if (!recipients.find(r => r.profile.id === p.id)) {
      setRecipients(prev => [...prev, { profile: p, points: 30 }])
    }
    setSearch("")
    setShowDropdown(false)
    searchRef.current?.focus()
  }

  function removeRecipient(id: string) {
    setRecipients(prev => prev.filter(r => r.profile.id !== id))
  }

  function setRecipientPoints(id: string, pts: number) {
    setRecipients(prev => prev.map(r => r.profile.id === id ? { ...r, points: pts } : r))
  }

  const totalPoints = recipients.reduce((sum, r) => sum + r.points, 0)
  const budgetAfter = remaining - totalPoints

  async function handleSubmit() {
    setError("")
    if (recipients.length === 0) { setError("Vui lòng chọn ít nhất một người nhận"); return }
    if (!title) { setError(t.post_err_title); return }
    if (!message) { setError(t.post_err_msg); return }
    if (totalPoints > remaining) {
      setError(`Không đủ ngân sách. Cần ${totalPoints} pts nhưng chỉ còn ${remaining} pts`)
      return
    }
    setLoading(true)
    try {
      for (const r of recipients) {
        await addPost({
          from: currentUser?.full_name || "",
          fromOffice: currentUser?.office || "",
          fromAvatar: currentUser?.avatar || "",
          fromColor: "from-sky-500 to-blue-500",
          to: r.profile.full_name,
          toOffice: r.profile.office,
          points: r.points,
          category,
          title,
          message,
          companyValueId: selectedValueId || undefined,
        })
      }
      setSubmitted(true)
    } catch {
      setError("Có lỗi xảy ra, vui lòng thử lại")
    }
    setLoading(false)
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
              <div key={r.profile.id} className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-2.5 ring-1 ring-amber-100">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-800">
                    {getInitials(r.profile.full_name)}
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{r.profile.full_name}</span>
                </div>
                <span className="text-sm font-bold text-amber-600">+{r.points} pts</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Tổng: <span className="font-bold text-blue-600">{totalPoints} pts</span> đã trao cho {recipients.length} người
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button onClick={() => router.push("/feed")} className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700">
              {t.post_view_feed}
            </button>
            <button onClick={() => router.push("/leaderboard")} className="rounded-full bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100">
              {t.post_see_lb}
            </button>
            <button
              onClick={() => { setSubmitted(false); setRecipients([]); setTitle(""); setMessage(""); setSelectedValueId(""); setExpandedValueId(null) }}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
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
            <p className="mt-3 text-sm text-slate-600">
              {t.post_sending_as}: <span className="font-bold">{currentUser?.full_name}</span> · {currentUser?.office}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100">
                {t.post_remaining}: {remaining} / {myBudget} pts
              </div>
              {recipients.length > 0 && (
                <div className={"inline-flex rounded-full px-4 py-2 text-sm font-bold ring-1 " + (budgetAfter < 0 ? "bg-red-50 text-red-600 ring-red-100" : "bg-blue-50 text-blue-700 ring-blue-100")}>
                  Sẽ dùng: {totalPoints} pts → Còn lại: {budgetAfter} pts
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-xl backdrop-blur-xl">
            <div className="relative space-y-5">

              {/* Recipients */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Gửi đến
                  {recipients.length > 0 && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                      {recipients.length} người · {totalPoints} pts tổng
                    </span>
                  )}
                </label>

                {/* Each recipient row with individual point selector */}
                {recipients.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {recipients.map(r => (
                      <div key={r.profile.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-3 mb-2.5">
                          {/* Avatar */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-[10px] font-bold text-white">
                            {getInitials(r.profile.full_name)}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">{r.profile.full_name}</div>
                            <div className="text-xs text-slate-500">{r.profile.office} · {r.profile.department}</div>
                          </div>
                          {/* Points badge */}
                          <div className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                            +{r.points} pts
                          </div>
                          {/* Remove */}
                          <button
                            onClick={() => removeRecipient(r.profile.id)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-600 transition text-xs"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Point selector row */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400 shrink-0">Điểm trao:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {pointOptions.map(p => {
                              const wouldExceed = (totalPoints - r.points + p) > remaining
                              const isSelected = r.points === p
                              return (
                                <button
                                  key={p}
                                  onClick={() => setRecipientPoints(r.profile.id, p)}
                                  disabled={wouldExceed && !isSelected}
                                  className={"rounded-full px-3 py-1 text-xs font-bold transition ring-1 " + (
                                    isSelected
                                      ? "bg-blue-600 text-white ring-blue-600 shadow-sm"
                                      : wouldExceed
                                      ? "opacity-30 cursor-not-allowed bg-white text-slate-400 ring-slate-200"
                                      : "bg-white text-slate-600 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"
                                  )}
                                >
                                  {p} pts
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Total summary */}
                    <div className={`flex items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-bold ring-1 ${budgetAfter < 0 ? "bg-red-50 text-red-600 ring-red-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100"}`}>
                      <span>Tổng điểm sẽ trao</span>
                      <span>
                        {totalPoints} pts
                        {budgetAfter >= 0 ? ` · còn lại ${budgetAfter} pts` : ` · ⚠️ vượt ${-budgetAfter} pts`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Search input */}
                <div className="relative" ref={dropdownRef}>
                  <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
                    <span className="mr-2 text-slate-400">🔍</span>
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Tìm theo tên, email, phòng ban..."
                      className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">✕</button>
                    )}
                  </div>

                  {showDropdown && (
                    <div className="absolute z-20 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                      {searchResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400">Không tìm thấy</div>
                      ) : (
                        searchResults.map(p => {
                          const already = recipients.some(r => r.profile.id === p.id)
                          return (
                            <button
                              key={p.id}
                              onClick={() => !already && addRecipient(p)}
                              disabled={already}
                              className={"w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-slate-50 last:border-0 " + (
                                already ? "opacity-40 cursor-not-allowed bg-slate-50" : "hover:bg-blue-50"
                              )}
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-xs font-bold text-white">
                                {getInitials(p.full_name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-900 truncate">{p.full_name}</div>
                                <div className="text-xs text-slate-500 truncate">{p.office} · {p.department}</div>
                              </div>
                              {already
                                ? <span className="text-xs text-slate-400 shrink-0">Đã chọn ✔</span>
                                : <span className="text-xs text-blue-500 shrink-0">+ Thêm</span>
                              }
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">{t.post_title_label}</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t.post_title_ph}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* Message */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">{t.post_msg}</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t.post_msg_ph}
                  rows={5}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">{t.post_category}</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Company Value */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  {t.post_value} <span className="text-slate-400 font-normal">{t.post_optional}</span>
                </label>
                <select
                  value={selectedValueId}
                  onChange={e => setSelectedValueId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">{t.post_value_ph}</option>
                  {COMPANY_VALUES.map(v => (
                    <option key={v.id} value={v.id}>{v.icon} {v.title}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 ring-1 ring-red-100">
                  ❌ {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || recipients.length === 0 || budgetAfter < 0}
                className="w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading
                  ? "Đang gửi..."
                  : recipients.length === 0
                  ? "Chọn người nhận để gửi"
                  : budgetAfter < 0
                  ? `⚠️ Vượt ngân sách ${-budgetAfter} pts`
                  : recipients.length === 1
                  ? `🎉 Gửi ${totalPoints} pts → ${recipients[0].profile.full_name}`
                  : `🎉 Gửi ${recipients.length} khen thưởng · ${totalPoints} pts tổng`
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
                {COMPANY_VALUES.map(v => {
                  const selected = selectedValueId === v.id
                  const expanded = expandedValueId === v.id

                  return (
                    <div key={v.id} className="space-y-2">
                      <button
                        onClick={() => {
                          setSelectedValueId(selected ? "" : v.id)
                          setExpandedValueId(expanded ? null : v.id)
                        }}
                        className={"w-full flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition ring-1 text-left " + (
                          selected
                            ? "bg-blue-50 text-blue-700 ring-blue-200 font-semibold"
                            : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"
                        )}
                      >
                        <span className="text-base">{v.icon}</span>
                        <span className="flex-1">{v.title}</span>
                        {selected && <span className="text-blue-500">✔</span>}
                        <span className={"text-xs text-slate-400 transition-transform " + (expanded ? "rotate-180" : "")}>⌄</span>
                      </button>

                      {expanded && (
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
                          {v.desc}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Point guide với mô tả đầy đủ */}
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl backdrop-blur-xl">
              <h2 className="text-base font-bold text-slate-950">{t.post_guide}</h2>
              <div className="mt-4 space-y-3">
                {POINT_GUIDE.map(g => {
                  const expanded = expandedGuideId === g.label

                  return (
                    <div key={g.label} className={"rounded-2xl ring-1 overflow-hidden " + g.color}>
                      <button
                        onClick={() => setExpandedGuideId(expanded ? null : g.label)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <span className="text-sm font-bold">{g.label}</span>

                        <span className="ml-auto text-sm font-bold">{g.range}</span>

                        <span className={"text-xs opacity-60 transition-transform " + (expanded ? "rotate-180" : "")}>
                          ⌄
                        </span>
                      </button>

                      {expanded && (
                        <div className="border-t border-current/10 px-4 pb-4 pt-1">
                          <p className="text-xs leading-relaxed opacity-80">{g.desc}</p>
                          <p className="mt-1.5 text-xs leading-relaxed opacity-60">
                            <span className="font-semibold">VD:</span> {g.example}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Budget */}
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl backdrop-blur-xl">
              <h2 className="text-base font-bold text-slate-950">{t.post_budget}</h2>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">{t.post_used}</span>
                  <span className="font-bold text-slate-700">{currentUser?.budget_used || 0} / {myBudget} pts</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: Math.min(((currentUser?.budget_used || 0) / myBudget) * 100, 100) + "%" }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-400 text-right">{remaining} {t.post_left}</div>
                {recipients.length > 0 && totalPoints > 0 && budgetAfter >= 0 && (
                  <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-100">
                    Sau khi gửi còn lại: <strong>{budgetAfter} pts</strong>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}