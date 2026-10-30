"use client"

import { useTheme } from "@/components/theme/ThemeProvider"

interface ThemeToggleProps {
  className?: string
  compact?: boolean
  showLabel?: boolean
}

export function ThemeToggle({ className = "", compact = false, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme, setTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`lp-theme-toggle group relative inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
        isDark
          ? "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-slate-100 hover:bg-slate-800/80 shadow-inner"
          : "border-slate-300 bg-white/90 text-slate-700 hover:border-emerald-400 hover:text-slate-900 hover:bg-slate-50 shadow-sm"
      } ${className}`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={!isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        {/* Sun Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 transition-all duration-300 ${
            isDark
              ? "scale-0 opacity-0 absolute rotate-90 text-amber-400"
              : "scale-100 opacity-100 rotate-0 text-amber-500"
          }`}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>

        {/* Moon Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 transition-all duration-300 ${
            isDark
              ? "scale-100 opacity-100 rotate-0 text-emerald-400"
              : "scale-0 opacity-0 absolute -rotate-90 text-slate-400"
          }`}
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </span>

      {showLabel && (
        <span className="text-[11px] font-semibold tracking-wide uppercase select-none">
          {isDark ? "Dark" : "Light"}
        </span>
      )}

      {/* Pill indicator for compact mode */}
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
          isDark ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]"
        }`}
        aria-hidden="true"
      />
    </button>
  )
}
