"use client"

import { useEffect, useState, type RefObject } from "react"

/**
 * Activates once when the element intersects the viewport (or is already visible).
 * Used to start molecular structure fetches without blocking off-screen content.
 */
export function useVisibilityOnce(
  ref: RefObject<Element | null>,
  options?: {
    rootMargin?: string
    threshold?: number | number[]
    /** If true, activate immediately (e.g. SSR/hydration fallback after mount). */
    activateImmediately?: boolean
  },
): boolean {
  const [visible, setVisible] = useState(Boolean(options?.activateImmediately))

  useEffect(() => {
    if (visible) return
    const node = ref.current
    if (!node) return

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      {
        root: null,
        rootMargin: options?.rootMargin ?? "160px 0px",
        threshold: options?.threshold ?? 0.05,
      },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, visible, options?.rootMargin, options?.threshold])

  return visible
}
