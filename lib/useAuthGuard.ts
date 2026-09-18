"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "./supabase"

export function useAuthGuard() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function guard() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (cancelled) return

      if (!session?.user) {
        router.replace("/login")
        return
      }

      // Tài khoản đã bị soft-delete / vô hiệu hóa không được tiếp tục sử dụng app.
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, is_active, deleted_at")
        .eq("id", session.user.id)
        .maybeSingle()

      if (cancelled) return

      if (!profile || profile.is_active === false || profile.deleted_at) {
        await supabase.auth.signOut()
        if (!cancelled) router.replace("/login")
      }
    }

    guard()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
