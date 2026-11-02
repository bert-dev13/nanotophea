"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

interface NanoparticleModalPortalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel: string
  cardClassName?: string
}

export function NanoparticleModalPortal({
  isOpen,
  onClose,
  children,
  ariaLabel,
  cardClassName,
}: NanoparticleModalPortalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!mounted || !isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {/* Full-viewport Backdrop covering the ENTIRE browser window */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Modal Card */}
      <div
        className={`relative z-10 w-[calc(100%-24px)] sm:w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border bg-slate-900 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200 overflow-hidden ${
          cardClassName || "border-slate-700"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
