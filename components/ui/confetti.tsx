"use client"
import { useEffect } from "react"
import confetti from "canvas-confetti"

export function triggerConfetti() {
  const count = 220
  const defaults = { origin: { y: 0.6 }, zIndex: 9999 }

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) })
  }

  fire(0.25, { spread: 26, startVelocity: 55, colors: ["#3B82F6", "#06B6D4"] })
  fire(0.2,  { spread: 60, colors: ["#10B981", "#34D399"] })
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ["#F59E0B", "#FBBF24"] })
  fire(0.1,  { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, colors: ["#8B5CF6", "#EC4899"] })
  fire(0.1,  { spread: 120, startVelocity: 45, colors: ["#EF4444", "#F97316"] })
}

export function ConfettiTrigger({ active }: { active: boolean }) {
  useEffect(() => {
    if (active) triggerConfetti()
  }, [active])

  return null
}
