"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export const THEME_STORAGE_KEY = "nanotophea-theme"

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.setAttribute("data-theme", theme)
  if (theme === "light") {
    root.classList.add("theme-light")
    root.classList.remove("theme-dark")
  } else {
    root.classList.add("theme-dark")
    root.classList.remove("theme-light")
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored === "light" || stored === "dark") {
        setThemeState(stored)
        applyTheme(stored)
      } else {
        applyTheme("dark")
      }
    } catch {
      applyTheme("dark")
    }
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    } catch {
      /* ignore */
    }
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      theme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    }
  }
  return context
}
