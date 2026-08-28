import { create } from "zustand"
import { supabase } from "./supabase"
import { avatarColor } from "./utils"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { Lang } from "./i18n"

export type Post = {
  id: number
  from: string
  fromOffice: string
  fromAvatar: string
  fromColor: string
  to: string
  toOffice: string
  points: number
  category: string
  companyValueId?: string
  companyValueTitle?: string
  time: string
  title: string
  message: string
  reactions: Record<string, number>
}

export type Profile = {
  id: string
  full_name: string
  email: string
  role: "employee" | "manager" | "hr" | "admin"
  office: string
  department: string
  position?: string
  level?: string
  manager_id?: string
  is_active?: boolean
  points: number
  monthly_points: number
  budget_used: number
  budget_carried: number
  budget_given: number
  budget_period_start?: string
  budget_period_end?: string
  giving_budget_monthly?: number
  avatar?: string
}

export type Notification = {
  id: number
  user_id: string
  post_id: number
  from_name: string
  from_avatar?: string
  points: number
  title: string
  is_read: boolean
  created_at: string
}

export type CompanyValue = {
  id: string
  title: string
  description: string
  icon: string
  sort_order: number
  is_active: boolean
}

const PAGE_SIZE = 20

type Store = {
  currentUser: Profile | null
  isLoggedIn: boolean
  loadUser: () => Promise<void>
  logout: () => Promise<void>

  profiles: Profile[]
  loadProfiles: () => Promise<void>

  posts: Post[]
  postsHasMore: boolean
  postsLoading: boolean
  loadPosts: (reset?: boolean) => Promise<void>
  loadMorePosts: () => Promise<void>
  addPost: (post: Omit<Post, "id" | "time" | "reactions">) => Promise<void>
  deletePost: (postId: number) => Promise<void>
  editPost: (postId: number, title: string, message: string) => Promise<void>
  addReaction: (postId: number, emoji: string) => Promise<void>
  removeReaction: (postId: number, emoji: string) => Promise<void>

  // Per-user reactions from DB: postId → emoji[]
  myReactions: Record<string, string[]>
  loadMyReactions: () => Promise<void>

  companyValues: CompanyValue[]
  loadCompanyValues: () => Promise<void>

  myBudget: number

  updateAvatar: (file: File) => Promise<{ error?: string }>

  // Notifications
  notifications: Notification[]
  unreadCount: number
  loadNotifications: () => Promise<void>
  markAllRead: () => Promise<void>
  markRead: (id: number) => Promise<void>

  // Language
  lang: Lang
  setLang: (lang: Lang) => void

  // Real-time
  realtimeChannel: RealtimeChannel | null
  newPostsAvailable: boolean
  subscribeRealtime: () => void
  unsubscribeRealtime: () => void
  dismissNewPosts: () => void
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return "Just now"
  if (diff < 3600) return Math.floor(diff / 60) + " min ago"
  if (diff < 86400) return Math.floor(diff / 3600) + " hours ago"
  if (diff < 172800) return "Yesterday"
  return Math.floor(diff / 86400) + " days ago"
}

function dbToPost(row: any, values: CompanyValue[]): Post {
  const value = values.find(v => v.id === row.company_value_id)
  return {
    id: row.id,
    from: row.from_name,
    fromOffice: row.from_office,
    fromAvatar: row.from_avatar,
    fromColor: avatarColor(row.from_name),
    to: row.to_name,
    toOffice: row.to_office,
    points: row.points,
    category: row.category,
    companyValueId: row.company_value_id,
    companyValueTitle: value ? value.icon + " " + value.title : undefined,
    time: timeAgo(row.created_at),
    title: row.title,
    message: row.message,
    reactions: row.reactions || {},
  }
}

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "vi"
  return (localStorage.getItem("ov_lang") as Lang) || "vi"
}

export const useStore = create<Store>()((set, get) => ({
  currentUser: null,
  isLoggedIn: false,

  loadUser: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      set({ currentUser: null, isLoggedIn: false })
      return
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (profile) {
      const baseBudget = Number(profile.giving_budget_monthly || 0)
      const carriedBudget = Number(profile.budget_carried || 0)

      set({
        currentUser: profile,
        isLoggedIn: true,
        myBudget: baseBudget + carriedBudget,
      })
      // Load notifications and reactions in background
      get().loadNotifications()
      get().loadMyReactions()
    }
  },

  logout: async () => {
    get().unsubscribeRealtime()
    await supabase.auth.signOut()
    set({ currentUser: null, isLoggedIn: false })
  },

  profiles: [],

  loadProfiles: async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("points", { ascending: false })

    if (data) set({ profiles: data })
  },

  posts: [],
  postsHasMore: true,
  postsLoading: false,

  loadPosts: async (reset = true) => {
    if (get().companyValues.length === 0) await get().loadCompanyValues()
    const { companyValues } = get()

    const from = reset ? 0 : get().posts.length
    const to = from + PAGE_SIZE - 1

    set({ postsLoading: true })

    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to)

    set({ postsLoading: false })

    if (data) {
      const newPosts = data.map(row => dbToPost(row, companyValues))
      set({
        posts: reset ? newPosts : [...get().posts, ...newPosts],
        postsHasMore: data.length === PAGE_SIZE,
      })
    }
  },

  loadMorePosts: async () => {
    if (get().postsLoading || !get().postsHasMore) return
    await get().loadPosts(false)
  },

  addPost: async (postData) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error("Bạn chưa đăng nhập")
    }

    const receiverProfile = get().profiles.find(
      p => p.full_name === postData.to
    )

    if (!receiverProfile) {
      throw new Error("Không tìm thấy người nhận")
    }

    const { data: postId, error: rpcError } = await supabase.rpc(
      "give_points",
      {
        p_to_user_id: receiverProfile.id,
        p_points: postData.points,
        p_category: postData.category,
        p_title: postData.title,
        p_message: postData.message,
        p_company_value_id: postData.companyValueId || null,
      }
    )

    if (rpcError) {
      console.error("give_points RPC error:", rpcError)
      throw new Error(rpcError.message || "Không thể gửi khen thưởng")
    }

    await Promise.all([
      get().loadPosts(true),
      get().loadUser(),
      get().loadProfiles(),
      get().loadNotifications(),
    ])

    const freshUser = get().currentUser

    if (receiverProfile.email && freshUser) {
      supabase.functions.invoke("notify-kudos", {
        body: {
          to_email: receiverProfile.email,
          to_name: receiverProfile.full_name,
          from_name: freshUser.full_name,
          points: postData.points,
          title: postData.title,
          message: postData.message,
          post_id: postId,
        },
      }).catch(() => {})
    }
  },

  deletePost: async (postId) => {
    await supabase.from("posts").delete().eq("id", postId)
    set({ posts: get().posts.filter(p => p.id !== postId) })
  },

  editPost: async (postId, title, message) => {
    await supabase.from("posts").update({ title, message }).eq("id", postId)
    set({ posts: get().posts.map(p => p.id === postId ? { ...p, title, message } : p) })
  },

  myReactions: {},

  loadMyReactions: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("post_reactions")
      .select("post_id, emoji")
      .eq("user_id", user.id)
    if (data) {
      const map: Record<string, string[]> = {}
      for (const r of data) {
        const key = String(r.post_id)
        if (!map[key]) map[key] = []
        map[key].push(r.emoji)
      }
      set({ myReactions: map })
    }
  },

  addReaction: async (postId, emoji) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const post = get().posts.find(p => p.id === postId)
    if (!post) return

    // Insert into post_reactions (ignore if duplicate)
    await supabase.from("post_reactions").upsert(
      { post_id: postId, user_id: user.id, emoji },
      { onConflict: "post_id,user_id,emoji", ignoreDuplicates: true }
    )

    // Update aggregated count on posts table
    const newReactions = { ...post.reactions, [emoji]: (post.reactions[emoji] || 0) + 1 }
    await supabase.from("posts").update({ reactions: newReactions }).eq("id", postId)

    // Update local state
    const key = String(postId)
    const prevMine = get().myReactions[key] || []
    set({
      posts: get().posts.map(p => p.id === postId ? { ...p, reactions: newReactions } : p),
      myReactions: { ...get().myReactions, [key]: [...prevMine, emoji] },
    })
  },

  removeReaction: async (postId, emoji) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const post = get().posts.find(p => p.id === postId)
    if (!post) return

    // Delete from post_reactions
    await supabase.from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .eq("emoji", emoji)

    // Update aggregated count
    const newReactions = { ...post.reactions }
    newReactions[emoji] = Math.max(0, (newReactions[emoji] || 0) - 1)
    if (newReactions[emoji] === 0) delete newReactions[emoji]
    await supabase.from("posts").update({ reactions: newReactions }).eq("id", postId)

    // Update local state
    const key = String(postId)
    const prevMine = get().myReactions[key] || []
    set({
      posts: get().posts.map(p => p.id === postId ? { ...p, reactions: newReactions } : p),
      myReactions: { ...get().myReactions, [key]: prevMine.filter(e => e !== emoji) },
    })
  },

  companyValues: [],

  loadCompanyValues: async () => {
    const { data } = await supabase
      .from("company_values")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
    if (data) set({ companyValues: data })
  },

  myBudget: 0,

  // ─── Notifications ────────────────────────────────────────────────────────
  notifications: [],
  unreadCount: 0,

  loadNotifications: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
    if (data) {
      set({
        notifications: data as Notification[],
        unreadCount: data.filter((n: Notification) => !n.is_read).length,
      })
    }
  },

  markAllRead: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, is_read: true })),
      unreadCount: 0,
    }))
  },

  markRead: async (id: number) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
  },

  // ─── Language ─────────────────────────────────────────────────────────────
  lang: getInitialLang(),
  setLang: (lang) => {
    if (typeof window !== "undefined") localStorage.setItem("ov_lang", lang)
    set({ lang })
  },

  // ─── Avatar upload ────────────────────────────────────────────────────────
  updateAvatar: async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not logged in" }

    const ext = file.name.split(".").pop() || "jpg"
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) return { error: uploadError.message }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(path)

    // Add cache-busting so browser picks up the new image immediately
    const urlWithBust = publicUrl + "?t=" + Date.now()

    await supabase.from("profiles").update({ avatar: urlWithBust }).eq("id", user.id)
    await get().loadUser()
    await get().loadProfiles()
    return {}
  },

  // ─── Real-time ────────────────────────────────────────────────────────────
  realtimeChannel: null,
  newPostsAvailable: false,

  subscribeRealtime: () => {
    // Avoid duplicate subscriptions
    if (get().realtimeChannel) return

    const channel = supabase
      .channel("feed-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const { companyValues, currentUser, posts } = get()
          if (companyValues.length === 0) await get().loadCompanyValues()

          const newPost = dbToPost(payload.new, get().companyValues)

          // If it's my own post — already added optimistically, skip
          if (newPost.from === currentUser?.full_name) return

          // If this post is already visible at top of feed — show banner
          const alreadyLoaded = posts.some(p => p.id === newPost.id)
          if (!alreadyLoaded) {
            set({ newPostsAvailable: true })
          }

          // Also refresh profiles so leaderboard stays accurate
          get().loadProfiles()
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => {
          get().loadProfiles()
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        async (payload) => {
          const { currentUser } = get()
          if (!currentUser) return
          if (payload.new.user_id !== currentUser.id) return
          const notif = payload.new as Notification

          // Update in-app state
          set(s => ({
            notifications: [notif, ...s.notifications].slice(0, 30),
            unreadCount: s.unreadCount + 1,
          }))

          // Desktop push notification
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            const lang = (localStorage.getItem("ov_lang") || "vi") as Lang
            const body = lang === "ja"
              ? `${notif.from_name} があなたに +${notif.points}ポイントを贈りました\n「${notif.title}」`
              : `${notif.from_name} đã tặng cho bạn +${notif.points} điểm\n"${notif.title}"`

            const desktop = new window.Notification("🔔 My OneValue", {
              body,
              icon: "/favicon.ico",
              tag: `ov-notif-${notif.id}`,
              requireInteraction: false,
            })

            desktop.onclick = () => {
              window.focus()
              window.location.href = `/feed#post-${notif.post_id}`
              desktop.close()
            }
          }
        }
      )
      .subscribe()

    set({ realtimeChannel: channel })
  },

  unsubscribeRealtime: () => {
    const ch = get().realtimeChannel
    if (ch) {
      supabase.removeChannel(ch)
      set({ realtimeChannel: null })
    }
  },

  dismissNewPosts: () => set({ newPostsAvailable: false }),
}))
