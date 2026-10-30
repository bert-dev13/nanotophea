import Link from "next/link"
import type { ReactNode } from "react"
import { ENTER_HREF } from "@/components/landing/content"

export function EnterLink({
  children,
  variant = "primary",
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "quiet"
}) {
  return (
    <Link href={ENTER_HREF} className={`lp-btn lp-btn--${variant}`}>
      {children}
    </Link>
  )
}
