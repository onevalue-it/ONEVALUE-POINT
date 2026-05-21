"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "./supabase"

export function useAuthGuard() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
