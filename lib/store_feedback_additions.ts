// Thêm vào lib/store.ts — phần types và store

// 1. Thêm type Feedback (sau type Notification):
export type Feedback = {
  id: number
  to_user_id: string
  to_name: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

// 2. Thêm vào type Notification (sửa type hiện có):
// type field: 'kudos' | 'feedback'
// feedback_id?: number

// 3. Thêm vào type Store (sau notifications):
//   feedbacks: Feedback[]
//   feedbackUnread: number
//   loadFeedbacks: () => Promise<void>
//   markFeedbackRead: (id: number) => Promise<void>

// 4. Thêm vào create<Store>()(...) (sau markRead):

/*
  feedbacks: [],
  feedbackUnread: 0,

  loadFeedbacks: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("feedback")
      .select("*")
      .eq("to_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
    if (data) {
      set({
        feedbacks: data as Feedback[],
        feedbackUnread: data.filter((f: Feedback) => !f.is_read).length,
      })
    }
  },

  markFeedbackRead: async (id: number) => {
    await supabase.from("feedback").update({ is_read: true }).eq("id", id)
    set(s => ({
      feedbacks: s.feedbacks.map(f => f.id === id ? { ...f, is_read: true } : f),
      feedbackUnread: Math.max(0, s.feedbackUnread - 1),
    }))
  },
*/

// 5. Trong loadUser(), sau get().loadNotifications() thêm:
//   get().loadFeedbacks()

// 6. Trong subscribeRealtime(), trong channel subscribe thêm:
/*
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "feedback" },
    async (payload) => {
      const { currentUser } = get()
      if (!currentUser) return
      if (payload.new.to_user_id !== currentUser.id) return
      const fb = payload.new as Feedback
      set(s => ({
        feedbacks: [fb, ...s.feedbacks].slice(0, 50),
        feedbackUnread: s.feedbackUnread + 1,
      }))
    }
  )
*/
