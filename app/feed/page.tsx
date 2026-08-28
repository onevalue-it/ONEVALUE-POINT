"use client"
import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import Navbar from "@/components/ui/navbar"
import { useAuthGuard } from "@/lib/useAuthGuard"
import { useT } from "@/lib/useT"
import { useLangText } from "@/lib/useLangText"
import { supabase } from "@/lib/supabase"
import type { Post } from "@/lib/store"

const categoryColor: Record<string, string> = {
  "M&A Support":    "bg-blue-50 text-blue-700 ring-blue-100",
  "Translation":    "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "Creativity":     "bg-pink-50 text-pink-700 ring-pink-100",
  "Fast Support":   "bg-amber-50 text-amber-700 ring-amber-100",
  "M&A":            "bg-blue-50 text-blue-700 ring-blue-100",
  "Market Research":"bg-purple-50 text-purple-700 ring-purple-100",
  "Leadership":     "bg-indigo-50 text-indigo-700 ring-indigo-100",
  "Sales Support":  "bg-orange-50 text-orange-700 ring-orange-100",
  "Operations":     "bg-teal-50 text-teal-700 ring-teal-100",
}

const categoryBorder: Record<string, string> = {
  "M&A Support":    "border-l-blue-400",
  "Translation":    "border-l-emerald-400",
  "Creativity":     "border-l-pink-400",
  "Fast Support":   "border-l-amber-400",
  "M&A":            "border-l-blue-400",
  "Market Research":"border-l-purple-400",
  "Leadership":     "border-l-indigo-400",
  "Sales Support":  "border-l-orange-400",
  "Operations":     "border-l-teal-400",
}

const ALL_REACTIONS = ["👏", "🔥", "⭐", "❤️", "💪", "🎨"]

type PostComment = {
  id: number
  post_id: number
  user_id: string
  content: string
  created_at: string
}

const CATEGORY_JA: Record<string, string> = {
  "M&A Support": "M&Aサポート",
  "M&A": "M&A",
  "Translation": "翻訳",
  "Creativity": "創造性",
  "Fast Support": "迅速なサポート",
  "Market Research": "市場調査",
  "Leadership": "リーダーシップ",
  "Sales Support": "営業支援",
  "Operations": "業務支援",
}

function localizeTimeLabel(value: string, L: (vi: string, ja: string) => string): string {
  if (!value) return value
  if (value === "Just now") return L("Vừa xong", "たった今")
  if (value === "Yesterday") return L("Hôm qua", "昨日")
  let m = value.match(/^(\d+) min ago$/)
  if (m) return L(`${m[1]} phút trước`, `${m[1]}分前`)
  m = value.match(/^(\d+) hours ago$/)
  if (m) return L(`${m[1]} giờ trước`, `${m[1]}時間前`)
  m = value.match(/^(\d+) days ago$/)
  if (m) return L(`${m[1]} ngày trước`, `${m[1]}日前`)
  return value
}

function getInitials(name: string): string {
  return name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
}


function dbRowToTargetPost(row: any): Post {
  const created = row.created_at ? new Date(row.created_at) : new Date()
  const diff = Math.max(0, Math.floor((Date.now() - created.getTime()) / 1000))
  let time = "Just now"
  if (diff >= 86400) time = Math.floor(diff / 86400) + " days ago"
  else if (diff >= 3600) time = Math.floor(diff / 3600) + " hours ago"
  else if (diff >= 60) time = Math.floor(diff / 60) + " min ago"

  return {
    id: row.id,
    from: row.from_name || "",
    fromOffice: row.from_office || "",
    fromAvatar: row.from_avatar || getInitials(row.from_name || ""),
    fromColor: "from-blue-500 to-cyan-500",
    to: row.to_name || "",
    toOffice: row.to_office || "",
    points: Number(row.points || 0),
    category: row.category || "",
    companyValueId: row.company_value_id || undefined,
    time,
    title: row.title || "",
    message: row.message || "",
    reactions: row.reactions || {},
  }
}

export default function FeedPage() {
  useAuthGuard()
  const t = useT()
  const L = useLangText()
  const [targetPostId, setTargetPostId] = useState(0)
  const {
    posts, profiles, currentUser, addReaction, removeReaction,
    deletePost, editPost,
    loadUser, loadProfiles, loadPosts, loadMorePosts,
    postsHasMore, postsLoading,
    subscribeRealtime, unsubscribeRealtime,
    newPostsAvailable, dismissNewPosts,
    myReactions, loadMyReactions,
  } = useStore()

  function getProfileAvatar(name: string): string | undefined {
    return profiles.find(p => p.full_name === name)?.avatar ?? undefined
  }

  function getProfileByName(name: string) {
    return profiles.find(p => p.full_name === name)
  }
  const [showPicker, setShowPicker] = useState<number | null>(null)
  const [toast, setToast] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState("")
  const [poppingReaction, setPoppingReaction] = useState<string | null>(null)
  // Post edit/delete state
  const [postMenu, setPostMenu] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editMsg, setEditMsg] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [feedStats, setFeedStats] = useState({ totalPosts: 0, totalPts: 0, latestTime: "" })
  const [dbCategoryCounts, setDbCategoryCounts] = useState<Record<string, number>>({})
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({})
  const [commentOpen, setCommentOpen] = useState<Record<string, boolean>>({})
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [commentSubmitting, setCommentSubmitting] = useState<number | null>(null)
  const [commentDeleting, setCommentDeleting] = useState<number | null>(null)
  const [targetPost, setTargetPost] = useState<Post | null>(null)
  const [targetPostLoading, setTargetPostLoading] = useState(false)
  const [highlightPostId, setHighlightPostId] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const postId = Number(params.get("post") || 0)
    setTargetPostId(Number.isFinite(postId) ? postId : 0)
  }, [])

  useEffect(() => {
    // Fetch aggregate stats once on mount. Keep the dependency array stable so
    // React Fast Refresh never sees this hook change from [] to [posts.length].
    supabase.from("posts").select("points, category, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .then(({ data, count, error }) => {
        if (error) {
          console.error("Failed to load feed aggregate stats:", error)
          return
        }

        const rows = data || []
        const totalPts = rows.reduce((a: number, p: any) => a + (p.points || 0), 0)
        const latestCreatedAt = rows[0]?.created_at as string | undefined
        const latestTime = latestCreatedAt
          ? new Date(latestCreatedAt).toLocaleString(L("vi-VN", "ja-JP"), {
              year: "numeric", month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit",
            })
          : "-"

        setFeedStats({
          totalPosts: count ?? rows.length,
          totalPts,
          latestTime,
        })

        const cats: Record<string, number> = {}
        for (const p of rows) {
          if (p.category) cats[p.category] = (cats[p.category] || 0) + 1
        }
        setDbCategoryCounts(cats)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    Promise.all([loadUser(), loadProfiles(), loadPosts(true), loadMyReactions()]).finally(() => setIsLoading(false))
    subscribeRealtime()
    return () => unsubscribeRealtime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!targetPostId) {
      setTargetPost(null)
      setHighlightPostId(null)
      return
    }

    // Ensure a notification deep-link is never hidden by a category filter.
    setFilterCategory("")

    const alreadyLoaded = posts.some(p => p.id === targetPostId)
    if (alreadyLoaded) {
      setTargetPost(null)
      setHighlightPostId(targetPostId)
      return
    }

    let cancelled = false

    async function loadTargetPost() {
      setTargetPostLoading(true)
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", targetPostId)
        .single()

      if (cancelled) return

      setTargetPostLoading(false)

      if (error || !data) {
        console.error("Failed to load notification target post:", error)
        setToast(L("Không tìm thấy bài khen thưởng này.", "この称賛投稿が見つかりません。"))
        setTimeout(() => setToast(""), 3000)
        return
      }

      setTargetPost(dbRowToTargetPost(data))
      setHighlightPostId(targetPostId)
    }

    loadTargetPost()

    return () => {
      cancelled = true
    }
    // We intentionally react to target id and loaded post ids only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPostId, posts.map(p => p.id).join(",")])

  const displayPosts = targetPost && !posts.some(p => p.id === targetPost.id)
    ? [targetPost, ...posts]
    : posts

  useEffect(() => {
    if (!targetPostId || !displayPosts.some(p => p.id === targetPostId)) return

    const timer = window.setTimeout(() => {
      const el = document.getElementById(`post-${targetPostId}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        setHighlightPostId(targetPostId)
      }
    }, 120)

    const clearHighlight = window.setTimeout(() => {
      setHighlightPostId(current => current === targetPostId ? null : current)
    }, 4500)

    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(clearHighlight)
    }
  }, [targetPostId, displayPosts.length])

  const postIdsKey = displayPosts.map(p => p.id).join(",")

  useEffect(() => {
    if (!postIdsKey) {
      setCommentsByPost({})
      return
    }

    const postIds = postIdsKey.split(",").map(Number).filter(Boolean)
    supabase
      .from("post_comments")
      .select("id, post_id, user_id, content, created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          // This usually means the SQL migration for post_comments has not been run yet.
          console.error("Failed to load comments:", error)
          return
        }
        const grouped: Record<string, PostComment[]> = {}
        for (const row of (data || []) as PostComment[]) {
          const key = String(row.post_id)
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(row)
        }
        setCommentsByPost(grouped)
      })
  }, [postIdsKey])

  async function handleAddComment(postId: number) {
    const content = (commentDraft[String(postId)] || "").trim()
    if (!content) return
    if (content.length > 1000) {
      setToast(L("Bình luận tối đa 1000 ký tự.", "コメントは1000文字以内で入力してください。"))
      setTimeout(() => setToast(""), 2500)
      return
    }

    // RLS must be checked against Supabase Auth, not a cached profile object.
    const { data: authData, error: authError } = await supabase.auth.getUser()
    const authUser = authData?.user
    if (authError || !authUser) {
      console.error("Cannot resolve authenticated user before commenting:", authError)
      setToast(L("Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.", "ログインセッションが無効です。再ログインしてください。"))
      setTimeout(() => setToast(""), 3500)
      return
    }

    setCommentSubmitting(postId)
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, user_id: authUser.id, content })
      .select("id, post_id, user_id, content, created_at")
      .single()
    setCommentSubmitting(null)

    if (error || !data) {
      console.error("Failed to add comment:", error)
      const detail = error?.message || error?.details || error?.hint || "Unknown database error"
      setToast(L(`Không thể gửi bình luận: ${detail}`, `コメントを送信できません: ${detail}`))
      setTimeout(() => setToast(""), 6000)
      return
    }

    const key = String(postId)
    setCommentsByPost(prev => ({ ...prev, [key]: [...(prev[key] || []), data as PostComment] }))
    setCommentDraft(prev => ({ ...prev, [key]: "" }))
  }

  async function handleDeleteComment(comment: PostComment) {
    const { data: authData } = await supabase.auth.getUser()
    const authUser = authData?.user
    if (!authUser || comment.user_id !== authUser.id) return
    setCommentDeleting(comment.id)
    const { error } = await supabase.from("post_comments").delete().eq("id", comment.id)
    setCommentDeleting(null)
    if (error) {
      console.error("Failed to delete comment:", error)
      setToast(L("Không thể xóa bình luận.", "コメントを削除できません。"))
      setTimeout(() => setToast(""), 2500)
      return
    }
    const key = String(comment.post_id)
    setCommentsByPost(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter(c => c.id !== comment.id),
    }))
  }

  function handleReact(postId: number, emoji: string) {
    const key = String(postId)
    const already = myReactions[key] || []
    if (already.includes(emoji)) {
      removeReaction(postId, emoji)
    } else {
      addReaction(postId, emoji)
      setToast(t.feed_reaction_added)
      setTimeout(() => setToast(""), 2000)
    }
    setShowPicker(null)
    const popKey = `${postId}-${emoji}`
    setPoppingReaction(popKey)
    setTimeout(() => setPoppingReaction(null), 400)
  }

  // Sidebar: top 3 receivers by monthly_points from profiles (full data, not paginated)
  const top3Receivers = [...profiles]
    .filter(p => p.monthly_points > 0)
    .sort((a, b) => b.monthly_points - a.monthly_points)
    .slice(0, 3)
    .map(p => [p.full_name, { points: p.monthly_points, office: p.office }] as const)

  // Render-time fallback: while aggregate stats are loading (or if the aggregate
  // query fails), use the posts already loaded by the feed store without adding
  // another effect dependency on posts.length.
  const fallbackCategoryCounts: Record<string, number> = {}
  for (const p of posts) {
    if (p.category) fallbackCategoryCounts[p.category] = (fallbackCategoryCounts[p.category] || 0) + 1
  }
  const effectiveCategoryCounts = Object.keys(dbCategoryCounts).length > 0
    ? dbCategoryCounts
    : fallbackCategoryCounts
  const effectiveFeedStats = feedStats.totalPosts > 0 || posts.length === 0
    ? feedStats
    : {
        totalPosts: posts.length,
        totalPts: posts.reduce((sum, p) => sum + (p.points || 0), 0),
        latestTime: posts[0]?.time || "-",
      }

  // Sidebar: category breakdown (from DB — full data, not paginated)
  const topCategories = Object.entries(effectiveCategoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const maxCount = topCategories[0]?.[1] || 1

  // All unique categories for filter bar (from paginated posts for the filter UI)
  const allCategories = Array.from(new Set(displayPosts.map(p => p.category))).filter(Boolean).sort()

  // Filtered posts
  const filteredPosts = filterCategory ? displayPosts.filter(p => p.category === filterCategory) : displayPosts

  if (isLoading) {
    return (
      <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,#DBEAFE_0,#F8FAFC_34%,#FFFFFF_70%)]">
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
        <div className="absolute top-40 right-0 h-96 w-96 rounded-full bg-emerald-300/35 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute bottom-40 right-1/4 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#CBD5E1_1px,transparent_1px),linear-gradient(to_bottom,#CBD5E1_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.08]" />
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      <Navbar />

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-7 shadow-xl shadow-blue-100/50 backdrop-blur-xl">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-200/50 blur-2xl" />
          <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="flex-1">
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                {t.feed_label}
              </span>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                {t.feed_headline}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {posts.length} {t.feed_total_posts.toLowerCase()}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2.5 ring-1 ring-blue-100">
                  <span className="text-base">💌</span>
                  <div>
                    <div className="text-xs text-blue-500 font-medium">{t.feed_you_received}</div>
                    <div className="text-lg font-bold text-blue-700 leading-tight">
                      {posts.filter(p => p.to === currentUser?.full_name).reduce((a, p) => a + p.points, 0)} {t.feed_pts}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 ring-1 ring-emerald-100">
                  <span className="text-base">📤</span>
                  <div>
                    <div className="text-xs text-emerald-500 font-medium">{t.feed_you_sent}</div>
                    <div className="text-lg font-bold text-emerald-700 leading-tight">
                      {posts.filter(p => p.from === currentUser?.full_name).length} {t.feed_posts}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <a href="/post" className="inline-flex shrink-0 items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-[#27D6D8]/20 hover:bg-blue-700">
              {t.feed_add_post}
            </a>
          </div>
        </div>

        {/* Category filter bar */}
        {allCategories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCategory("")}
              className={"rounded-full px-4 py-2 text-xs font-bold ring-1 transition " + (
                filterCategory === ""
                  ? "bg-blue-600 text-white ring-blue-600"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              )}
            >
              {t.feed_all_filter} ({posts.length})
            </button>
            {allCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                className={"rounded-full px-4 py-2 text-xs font-bold ring-1 transition " + (
                  filterCategory === cat
                    ? "bg-blue-600 text-white ring-blue-600"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"
                )}
              >
                {L(cat, CATEGORY_JA[cat] || cat)} ({effectiveCategoryCounts[cat] || 0})
              </button>
            ))}
          </div>
        )}

        {/* Real-time new posts banner */}
        {newPostsAvailable && (
          <button
            onClick={() => { loadPosts(true); dismissNewPosts() }}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-[#27D6D8]/20 animate-fade-in-up hover:bg-blue-700 transition"
          >
            {t.feed_new_banner}
          </button>
        )}

        {targetPostLoading && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 ring-1 ring-amber-200">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
            {L("Đang mở bài khen thưởng từ thông báo...", "通知の称賛投稿を開いています...")}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Posts list */}
          <div className="space-y-5">
            {filteredPosts.length === 0 && (
              <div className="rounded-[2rem] border border-white/80 bg-white/85 p-12 text-center shadow-xl backdrop-blur-xl">
                <div className="text-4xl mb-4">🎉</div>
                <p className="text-slate-500 text-sm">
                  {filterCategory ? t.feed_empty_cat : t.feed_empty}
                </p>
                <a href="/post" className="mt-4 inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                  {t.feed_add_post}
                </a>
              </div>
            )}

            {filteredPosts.map((p) => {
              const myR = myReactions[String(p.id)] || []
              const comments = commentsByPost[String(p.id)] || []
              const isCommentsOpen = !!commentOpen[String(p.id)]
              const isForMe = p.to === currentUser?.full_name
              const toInitials = p.to.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
              const fromAvatarUrl = getProfileAvatar(p.from)
              const toAvatarUrl = getProfileAvatar(p.to)
              const fromProfile = getProfileByName(p.from)
              const toProfile = getProfileByName(p.to)
              const fromHref = fromProfile ? `/profile/${fromProfile.id}` : "#"
              const toHref = toProfile ? `/profile/${toProfile.id}` : "#"
              return (
                <article
                  key={p.id}
                  id={`post-${p.id}`}
                  className={
                    "animate-fade-in-up relative rounded-[2rem] border-l-4 border border-white/80 bg-white/90 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-2xl " +
                    (categoryBorder[p.category] || "border-l-slate-300") +
                    (isForMe ? " ring-2 ring-blue-200 shadow-blue-100/60" : "") +
                    (highlightPostId === p.id ? " ring-4 ring-amber-300 shadow-amber-200/70" : "")
                  }
                  style={{ animationDelay: `${filteredPosts.indexOf(p) * 60}ms` }}
                >
                  {/* Background blob — wrapped to avoid leaking outside card */}
                  <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
                    <div className={"absolute -right-20 -top-20 h-52 w-52 rounded-full blur-3xl " + (isForMe ? "bg-blue-200/50" : "bg-slate-100/80")} />
                  </div>

                  {/* Top: points badge strip */}
                  <div className={"flex items-center justify-between px-6 pt-5 pb-4 " + (isForMe ? "bg-gradient-to-r from-blue-50/60 to-transparent" : "")}>
                    <div className="flex items-center gap-3">
                      {/* From avatar */}
                      {fromAvatarUrl ? (
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full shadow-md">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fromAvatarUrl} alt={p.from} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-md " + p.fromColor}>
                          {p.fromAvatar}
                        </div>
                      )}
                      {/* Arrow + to avatar */}
                      <div className="flex items-center gap-2">
                        <div>
                          <a href={fromHref} className="text-sm font-bold text-slate-900 leading-tight hover:text-blue-700 hover:underline">{p.from}</a>
                          <div className="text-xs text-slate-400">{p.fromOffice}</div>
                        </div>
                        <span className="text-slate-300 text-lg mx-1">→</span>
                        {toAvatarUrl ? (
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full shadow-md">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={toAvatarUrl} alt={p.to} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md " + (isForMe ? "bg-gradient-to-br from-blue-500 to-indigo-500" : "bg-gradient-to-br from-slate-400 to-slate-500")}>
                            {toInitials}
                          </div>
                        )}
                        <div>
                          <a href={toHref} className={"text-sm font-bold leading-tight hover:underline " + (isForMe ? "text-blue-700" : "text-slate-900 hover:text-blue-700")}>{p.to}</a>
                          <div className="text-xs text-slate-400">{p.toOffice}</div>
                        </div>
                      </div>
                    </div>
                    {/* Points + For you badge */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className="rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-1.5 text-sm font-bold text-white shadow-md shadow-amber-100">
                        +{p.points} pts
                      </div>
                      {isForMe && (
                        <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">{t.feed_for_you}</span>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="relative px-6 pb-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold tracking-tight text-slate-950">{p.title}</h3>
                      {/* ⋯ Menu for own posts */}
                      {p.from === currentUser?.full_name && editingId !== p.id && deleteConfirmId !== p.id && (
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setPostMenu(postMenu === p.id ? null : p.id)}
                            className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition text-base leading-none"
                          >⋯</button>
                          {postMenu === p.id && (
                            <div className="absolute right-0 top-8 z-30 w-32 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
                              <button
                                onClick={() => { setEditingId(p.id); setEditTitle(p.title); setEditMsg(p.message); setPostMenu(null) }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                              >{L("Sửa", "編集")}</button>
                              <button
                                onClick={() => { setDeleteConfirmId(p.id); setPostMenu(null) }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                              >{L("Xóa", "削除")}</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Inline edit form */}
                    {editingId === p.id ? (
                      <div className="mt-3 space-y-2">
                        <input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="w-full rounded-xl border border-blue-200 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder={L("Tiêu đề", "タイトル")}
                        />
                        <textarea
                          value={editMsg}
                          onChange={e => setEditMsg(e.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-blue-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder={L("Nội dung", "内容")}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={async () => { setEditSaving(true); await editPost(p.id, editTitle, editMsg); setEditSaving(false); setEditingId(null) }}
                            disabled={editSaving}
                            className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                          >{editSaving ? L("Đang lưu...", "保存中...") : L("💾 Lưu", "💾 保存")}</button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >{L("Huỷ", "キャンセル")}</button>
                        </div>
                      </div>
                    ) : deleteConfirmId === p.id ? (
                      <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 ring-1 ring-red-100">
                        <p className="text-sm font-semibold text-red-700">{L("Xóa bài này? Hành động không thể hoàn tác.", "この投稿を削除しますか？この操作は元に戻せません。")}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={async () => { await deletePost(p.id); setDeleteConfirmId(null) }}
                            className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-600"
                          >{L("Xóa", "削除")}</button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >{L("Huỷ", "キャンセル")}</button>
                        </div>
                      </div>
                    ) : (
                      /* Message as quote */
                      <blockquote className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                        <p className="text-sm leading-6 text-slate-600 before:content-['\201C'] before:text-slate-300 before:text-lg before:font-serif after:content-['\201D'] after:text-slate-300 after:text-lg after:font-serif">
                          {p.message}
                        </p>
                      </blockquote>
                    )}

                    {/* Tags row */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className={"rounded-full px-3 py-1 text-xs font-bold ring-1 " + (categoryColor[p.category] || "bg-slate-50 text-slate-600 ring-slate-200")}>
                        {L(p.category, CATEGORY_JA[p.category] || p.category)}
                      </span>
                      {p.companyValueTitle && (
                        <span className="rounded-full bg-gradient-to-r from-purple-50 to-violet-50 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-purple-200">
                          {p.companyValueTitle}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-slate-400">{localizeTimeLabel(p.time, L)}</span>
                    </div>

                    {/* Reactions */}
                    <div className="relative mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      {Object.entries(p.reactions).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          onClick={() => handleReact(p.id, emoji)}
                          className={"flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition " + (myR.includes(emoji) ? "bg-blue-100 text-blue-700 ring-blue-200" : "bg-white text-slate-600 ring-slate-200 hover:bg-blue-50") + (poppingReaction === `${p.id}-${emoji}` ? " animate-reaction-pop" : "")}
                        >
                          <span>{emoji}</span>
                          <span>{count}</span>
                        </button>
                      ))}
                      <div className="relative">
                        <button
                          onClick={() => setShowPicker(showPicker === p.id ? null : p.id)}
                          className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 hover:bg-white hover:text-slate-700"
                        >
                          {t.feed_react}
                        </button>
                        {showPicker === p.id && (
                          <div className="absolute bottom-10 left-0 z-30 flex gap-1 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl">
                            {ALL_REACTIONS.map(e => (
                              <button key={e} onClick={() => handleReact(p.id, e)} className="rounded-xl p-2 text-lg hover:bg-slate-100 transition">
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setCommentOpen(prev => ({ ...prev, [String(p.id)]: !prev[String(p.id)] }))}
                        className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 transition hover:bg-white hover:text-blue-700 hover:ring-blue-200"
                      >
                        <span>💬</span>
                        <span>{L("Bình luận", "コメント")}</span>
                        {comments.length > 0 && <span className="font-bold text-blue-600">{comments.length}</span>}
                      </button>
                    </div>

                    {isCommentsOpen && (
                      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <div className="space-y-3">
                          {comments.length === 0 && (
                            <p className="py-1 text-center text-xs text-slate-400">
                              {L("Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.", "まだコメントはありません。最初のコメントを投稿しましょう。")}
                            </p>
                          )}
                          {comments.map(comment => {
                            const author = profiles.find(profile => profile.id === comment.user_id)
                            const authorName = author?.full_name || L("Thành viên", "メンバー")
                            const authorAvatar = author?.avatar
                            return (
                              <div key={comment.id} className="flex gap-2.5">
                                {authorAvatar ? (
                                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={authorAvatar} alt={authorName} className="h-full w-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-[10px] font-bold text-white">
                                    {getInitials(authorName)}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-100">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-xs font-bold text-slate-800">{authorName}</span>
                                    <span className="text-[10px] text-slate-400">
                                      {new Date(comment.created_at).toLocaleString(L("vi-VN", "ja-JP"), { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    {comment.user_id === currentUser?.id && (
                                      <button
                                        onClick={() => handleDeleteComment(comment)}
                                        disabled={commentDeleting === comment.id}
                                        className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-red-500 disabled:opacity-50"
                                      >
                                        {commentDeleting === comment.id ? L("Đang xóa...", "削除中...") : L("Xóa", "削除")}
                                      </button>
                                    )}
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-600">{comment.content}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="mt-3 flex items-end gap-2 border-t border-slate-100 pt-3">
                          <textarea
                            value={commentDraft[String(p.id)] || ""}
                            onChange={e => setCommentDraft(prev => ({ ...prev, [String(p.id)]: e.target.value }))}
                            onKeyDown={e => {
                              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                e.preventDefault()
                                handleAddComment(p.id)
                              }
                            }}
                            rows={2}
                            maxLength={1000}
                            placeholder={L("Viết bình luận...", "コメントを入力...")}
                            className="min-h-10 flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          />
                          <button
                            onClick={() => handleAddComment(p.id)}
                            disabled={commentSubmitting === p.id || !(commentDraft[String(p.id)] || "").trim()}
                            className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {commentSubmitting === p.id ? L("Đang gửi...", "送信中...") : L("Gửi", "送信")}
                          </button>
                        </div>
                        <p className="mt-1.5 text-right text-[10px] text-slate-400">Ctrl/⌘ + Enter</p>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
            {/* Load more button */}
            {postsHasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={loadMorePosts}
                  disabled={postsLoading}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 disabled:opacity-50"
                >
                  {postsLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                      {t.feed_loading}
                    </>
                  ) : (
                    <>{t.feed_load_more}</>
                  )}
                </button>
              </div>
            )}

            {!postsHasMore && posts.length > 0 && (
              <p className="pt-2 text-center text-xs text-slate-400">
                {posts.length} {t.feed_all_loaded}
              </p>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Feed Summary */}
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl backdrop-blur-xl">
              <h2 className="text-base font-bold text-slate-950">{t.feed_summary}</h2>
              <p className="mt-1 text-sm text-slate-500">{t.feed_summary_sub}</p>
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                  <span className="text-sm font-semibold text-blue-700">{t.feed_total_posts}</span>
                  <span className="text-lg font-bold text-blue-700">{effectiveFeedStats.totalPosts}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                  <span className="text-sm font-semibold text-emerald-700">{t.feed_pts_given}</span>
                  <span className="text-lg font-bold text-emerald-700">{effectiveFeedStats.totalPts}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                  <span className="text-sm font-semibold text-amber-700">{t.feed_latest}</span>
                  <span className="text-sm font-bold text-amber-700">{effectiveFeedStats.latestTime}</span>
                </div>
              </div>
            </div>

            {/* Top 3 Receivers */}
            {top3Receivers.length > 0 && (
              <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl backdrop-blur-xl">
                <h2 className="text-base font-bold text-slate-950">{t.feed_top_receivers}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.feed_receivers_sub}</p>
                <div className="mt-4 space-y-3">
                  {top3Receivers.map(([name, data], i) => (
                    <div key={name} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-xs font-bold text-white">
                        {getInitials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 truncate">{name}</span>
                          <span className="ml-2 shrink-0 text-xs font-bold text-amber-600">+{data.points}pts</span>
                        </div>
                        <div className="text-xs text-slate-400">{data.office}</div>
                      </div>
                      <div className="shrink-0 text-base">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            {topCategories.length > 0 && (
              <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl backdrop-blur-xl">
                <h2 className="text-base font-bold text-slate-950">{t.feed_top_cats}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.feed_cats_sub}</p>
                <div className="mt-4 space-y-3">
                  {topCategories.map(([cat, count]) => (
                    <div key={cat}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <button
                          onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                          className={"font-semibold transition hover:text-blue-700 " + (filterCategory === cat ? "text-blue-600" : "text-slate-700")}
                        >
                          {L(cat, CATEGORY_JA[cat] || cat)}
                        </button>
                        <span className="text-slate-400">{count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full bg-blue-400 transition-all"
                          style={{ width: (count / maxCount) * 100 + "%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}
