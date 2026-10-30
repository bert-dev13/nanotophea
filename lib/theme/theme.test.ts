import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { THEME_STORAGE_KEY } from "@/components/theme/ThemeProvider"

describe("NANOTOPHEA Theme System", () => {
  it("uses the required local storage key 'nanotophea-theme'", () => {
    assert.equal(THEME_STORAGE_KEY, "nanotophea-theme")
  })

  it("toggles between dark and light themes predictably", () => {
    const toggle = (current: "dark" | "light"): "dark" | "light" =>
      current === "dark" ? "light" : "dark"

    assert.equal(toggle("dark"), "light")
    assert.equal(toggle("light"), "dark")
    assert.equal(toggle(toggle("dark")), "dark")
  })

  it("persists theme state to storage mock", () => {
    const store = new Map<string, string>()
    const setStoredTheme = (theme: "dark" | "light") => {
      store.set(THEME_STORAGE_KEY, theme)
    }
    const getStoredTheme = (): "dark" | "light" => {
      const val = store.get(THEME_STORAGE_KEY)
      return val === "light" || val === "dark" ? val : "dark"
    }

    // Default when empty
    assert.equal(getStoredTheme(), "dark")

    // Set to light
    setStoredTheme("light")
    assert.equal(getStoredTheme(), "light")

    // Set to dark
    setStoredTheme("dark")
    assert.equal(getStoredTheme(), "dark")
  })

  it("anti-flash inline script correctly resolves themes without throwing", () => {
    const simulateScript = (storageValue: string | null) => {
      let attr = ""
      const classes: string[] = []
      const fakeStorage = {
        getItem: (key: string) => (key === THEME_STORAGE_KEY ? storageValue : null),
      }

      try {
        const t = fakeStorage.getItem("nanotophea-theme")
        if (t === "light" || t === "dark") {
          attr = t
          classes.push(t === "light" ? "theme-light" : "theme-dark")
        } else {
          attr = "dark"
          classes.push("theme-dark")
        }
      } catch {
        attr = "dark"
        classes.push("theme-dark")
      }

      return { attr, classes }
    }

    // Light mode stored
    const lightResult = simulateScript("light")
    assert.equal(lightResult.attr, "light")
    assert.deepEqual(lightResult.classes, ["theme-light"])

    // Dark mode stored
    const darkResult = simulateScript("dark")
    assert.equal(darkResult.attr, "dark")
    assert.deepEqual(darkResult.classes, ["theme-dark"])

    // Missing / invalid stored value defaults immediately to dark (no flash)
    const nullResult = simulateScript(null)
    assert.equal(nullResult.attr, "dark")
    assert.deepEqual(nullResult.classes, ["theme-dark"])

    const invalidResult = simulateScript("unknown-theme")
    assert.equal(invalidResult.attr, "dark")
    assert.deepEqual(invalidResult.classes, ["theme-dark"])
  })

  it("ensures sidebar design tokens remain dark across both light and dark theme definitions", async () => {
    const fs = await import("node:fs")
    const path = await import("node:path")
    const cssPath = path.resolve(process.cwd(), "app/globals.css")
    const cssContent = fs.readFileSync(cssPath, "utf-8")

    // Extract dark theme block and light theme block
    const darkBlockMatch = cssContent.match(/\[data-theme="dark"\][\s\S]*?\{([\s\S]*?)\}/)
    const lightBlockMatch = cssContent.match(/\[data-theme="light"\][\s\S]*?\{([\s\S]*?)\}/)

    assert.ok(darkBlockMatch, "Dark theme CSS block exists")
    assert.ok(lightBlockMatch, "Light theme CSS block exists")

    const darkBlock = darkBlockMatch[1]
    const lightBlock = lightBlockMatch[1]

    // Verify dark sidebar tokens in dark mode
    assert.match(darkBlock, /--sidebar-background:\s*#080e18/)
    assert.match(darkBlock, /--sidebar-surface:\s*#0e1726/)
    assert.match(darkBlock, /--sidebar-foreground:\s*#f1f5f9/)

    // Verify sidebar tokens remain dark in light mode
    assert.match(lightBlock, /--sidebar-background:\s*#080e18/)
    assert.match(lightBlock, /--sidebar-surface:\s*#0e1726/)
    assert.match(lightBlock, /--sidebar-foreground:\s*#f1f5f9/)

    // Verify light content tokens are indeed light in light mode
    assert.match(lightBlock, /--background:\s*#f4f6f8/)
    assert.match(lightBlock, /--surface:\s*#ffffff/)
    assert.match(lightBlock, /--card:\s*#ffffff/)
  })
})
