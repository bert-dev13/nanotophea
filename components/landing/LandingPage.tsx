"use client"

import { useEffect, useRef } from "react"
import { FinalCTA } from "@/components/landing/FinalCTA"
import { HeroSection } from "@/components/landing/HeroSection"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { LandingNavbar } from "@/components/landing/LandingNavbar"
import { ResearchContext } from "@/components/landing/ResearchContext"
import { ResearchWorkflow } from "@/components/landing/ResearchWorkflow"

interface MolecularParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
}

export function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    window.addEventListener("resize", handleResize)
    window.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseleave", handleMouseLeave)

    const particleCount = Math.min(75, Math.floor((width * height) / 22000))
    const particles: MolecularParticle[] = []
    const palette = [
      "rgba(45, 212, 191,", // teal-400
      "rgba(16, 185, 129,", // emerald-500
      "rgba(56, 189, 248,", // sky-400
      "rgba(52, 211, 153,", // emerald-400
    ]

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 1.8 + 1.2,
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: Math.random() * 0.45 + 0.35,
      })
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // Check active theme
      const isLight = document.documentElement.getAttribute("data-theme") === "light"

      // Connect filaments between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 135) {
            const alpha = (1 - dist / 135) * (isLight ? 0.28 : 0.16)
            ctx.strokeStyle = isLight
              ? `rgba(5, 150, 105, ${alpha})`
              : `rgba(45, 212, 191, ${alpha})`
            ctx.lineWidth = isLight ? 1 : 0.8
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }

        // Connect filaments to cursor if nearby
        const mdx = particles[i].x - mouseRef.current.x
        const mdy = particles[i].y - mouseRef.current.y
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
        if (mDist < 160) {
          const mAlpha = (1 - mDist / 160) * (isLight ? 0.45 : 0.35)
          ctx.strokeStyle = isLight
            ? `rgba(13, 148, 136, ${mAlpha})`
            : `rgba(52, 211, 153, ${mAlpha})`
          ctx.lineWidth = 1.1
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(mouseRef.current.x, mouseRef.current.y)
          ctx.stroke()
        }
      }

      // Draw and update particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = width
        else if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        else if (p.y > height) p.y = 0

        ctx.fillStyle = isLight
          ? `rgba(5, 150, 105, ${p.alpha * 0.95})`
          : `${p.color} ${p.alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [])

  return (
    <div className="lp relative min-h-screen bg-[var(--lp-paper)] text-[var(--lp-ink)] selection:bg-emerald-500/30 selection:text-emerald-200 transition-colors duration-300" id="top">

      {/* Dynamic Molecular Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-60"
        aria-hidden
      />

      {/* Atmospheric Ambient Glow Orbs */}
      <div
        className="login-orb-1 pointer-events-none fixed -left-20 -top-20 h-[36rem] w-[36rem] rounded-full bg-emerald-500/15 blur-[140px]"
        aria-hidden
      />
      <div
        className="login-orb-2 pointer-events-none fixed -bottom-32 -right-20 h-[38rem] w-[38rem] rounded-full bg-teal-500/14 blur-[150px]"
        aria-hidden
      />
      <div
        className="login-orb-3 pointer-events-none fixed top-1/3 left-1/2 -translate-x-1/2 h-[28rem] w-[28rem] rounded-full bg-cyan-600/10 blur-[130px]"
        aria-hidden
      />

      {/* High-tech Nano Grid Texture Overlay */}
      <div className="login-grid-bg pointer-events-none fixed inset-0 z-0 opacity-70" aria-hidden />

      <a className="lp-skip" href="#main">
        Skip to content
      </a>

      <div className="relative z-10">
        <LandingNavbar />
        <main id="main">
          <HeroSection />
          <ResearchContext />
          <ResearchWorkflow />
          <FinalCTA />
        </main>
        <LandingFooter />
      </div>
    </div>
  )
}
