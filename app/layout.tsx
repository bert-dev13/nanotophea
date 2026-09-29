import type { Metadata } from "next"
import { Outfit, Source_Sans_3 } from "next/font/google"
import { AppShell } from "@/components/layout/AppShell"
import "./globals.css"

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
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
