import type { Metadata } from "next"
import { Outfit, Source_Sans_3 } from "next/font/google"
import { AppShell } from "@/components/layout/AppShell"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import "./globals.css"
import "./landing.css"

const display = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: "NANOTOPHEA · NanoHepatoTea Research Platform",
  description:
    "Research-aligned bioinformatics platform separating computational predictions, laboratory results, and researcher interpretation for NanoHepatoTea.",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/nano-logo.png", type: "image/png" }],
    apple: [{ url: "/nano-logo.png" }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("nanotophea-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);document.documentElement.classList.add(t==="light"?"theme-light":"theme-dark");}else{document.documentElement.setAttribute("data-theme","dark");document.documentElement.classList.add("theme-dark");}}catch(e){document.documentElement.setAttribute("data-theme","dark");document.documentElement.classList.add("theme-dark");}})();`,
          }}
        />
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}


