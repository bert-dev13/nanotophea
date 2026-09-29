"use client"

import Image from "next/image"
import Link from "next/link"

export const NANO_LOGO_SRC = "/nano-logo.png"
export const NANO_LOGO_ALT = "NANOTOPHEA — Natural Products Research Platform"

type BrandLogoSize = "sm" | "md" | "lg" | "hero"

const SIZE: Record<BrandLogoSize, { w: number; h: number; className: string }> = {
  sm: { w: 36, h: 36, className: "h-9 w-9" },
  md: { w: 48, h: 48, className: "h-12 w-12" },
  lg: { w: 72, h: 72, className: "h-[4.5rem] w-[4.5rem]" },
  hero: { w: 220, h: 220, className: "h-40 w-40 sm:h-48 sm:w-48" },
}

/**
 * Official NANOTOPHEA mark from /public/nano-logo.png.
 */
export function BrandLogo({
  size = "md",
  priority = false,
  className = "",
}: {
  size?: BrandLogoSize
  priority?: boolean
  className?: string
}) {
  const s = SIZE[size]
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${s.className} ${className}`}>
      <Image
        src={NANO_LOGO_SRC}
        alt={NANO_LOGO_ALT}
        width={s.w}
        height={s.h}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </span>
  )
}

/** Header / nav wordmark: logo mark + title */
export function BrandLockup({
  href = "/",
  subtitle,
  size = "md",
}: {
  href?: string
  subtitle?: string
  size?: "sm" | "md"
}) {
  const titleClass = size === "sm" ? "text-base" : "text-lg"
  const content = (
    <span className="flex items-center gap-3 min-w-0">
      <BrandLogo size={size} priority={size === "md"} />
      <span className="flex-1 min-w-0 text-left">
        <span
          className={`block font-black tracking-tight leading-tight ${titleClass}`}
          style={{ color: "#0d1f3c", letterSpacing: "-0.01em" }}
        >
          NANOTOPHEA
        </span>
        {subtitle ? (
          <span className="block text-xs font-medium truncate" style={{ color: "#546e8a" }}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  )

  if (!href) return content
  return (
    <Link href={href} className="min-w-0 hover:opacity-90 transition-opacity">
      {content}
    </Link>
  )
}
