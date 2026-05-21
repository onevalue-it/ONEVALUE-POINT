/**
 * AvatarImg — shows a photo if `src` is set, otherwise falls back to initials.
 * className is applied to the outer wrapper div.
 */
type Props = {
  src?: string | null
  initials: string
  gradientClass?: string   // e.g. "from-blue-500 to-cyan-500"
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeMap = {
  sm:  "h-7 w-7 text-[10px]",
  md:  "h-10 w-10 text-xs",
  lg:  "h-11 w-11 text-sm",
  xl:  "h-20 w-20 text-2xl",
}

export function AvatarImg({ src, initials, gradientClass = "from-blue-500 to-cyan-500", size = "md", className = "" }: Props) {
  const sizeClass = sizeMap[size]
  if (src) {
    return (
      <div className={`${sizeClass} shrink-0 overflow-hidden rounded-full shadow-md ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={initials} className="h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`${sizeClass} shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br ${gradientClass} font-bold text-white shadow-md ${className}`}>
      {initials}
    </div>
  )
}
