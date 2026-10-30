"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Atom,
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { BrandLogo } from "@/components/brand/BrandLogo"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import { useAuth } from "@/components/providers/AuthProvider"

interface MolecularParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
}

export function LoginScreen() {
  const { login, error, clearError, loading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [demoFilled, setDemoFilled] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 })

  // Interactive molecular filament canvas animation
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

    const particleCount = Math.min(65, Math.floor((width * height) / 24000))
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
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        radius: Math.random() * 1.8 + 1.2,
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: Math.random() * 0.45 + 0.35,
      })
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // Connect filaments between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.16
            ctx.strokeStyle = `rgba(45, 212, 191, ${alpha})`
            ctx.lineWidth = 0.8
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
          const mAlpha = (1 - mDist / 160) * 0.35
          ctx.strokeStyle = `rgba(52, 211, 153, ${mAlpha})`
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

        ctx.fillStyle = `${p.color} ${p.alpha})`
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

  const fillDemoCredentials = () => {
    setEmail("admin@demo.com")
    setPassword("admin123")
    setDemoFilled(true)
    setTimeout(() => setDemoFilled(false), 2400)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Sign-in failed. Please verify credentials.")
    } finally {
      setBusy(false)
    }
  }

  const activeError = localError || error

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation Back Action */}
      <div className="absolute top-5 left-5 sm:top-7 sm:left-8 z-20">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-3.5 py-2 text-xs font-medium text-[var(--muted-foreground)] backdrop-blur-md transition-all duration-200 hover:border-emerald-500/40 hover:bg-[var(--surface)] hover:text-[var(--foreground)] shadow-sm"
        >
          <ArrowLeft
            size={14}
            className="text-emerald-500 transition-transform duration-200 group-hover:-translate-x-1"
          />
          <span>Back to Overview</span>
        </Link>
      </div>

      {/* Top Right Theme Toggle */}
      <div className="absolute top-5 right-5 sm:top-7 sm:right-8 z-20">
        <ThemeToggle showLabel />
      </div>

      {/* Dynamic Molecular Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-60"
        aria-hidden
      />

      {/* Atmospheric Ambient Glow Orbs */}
      <div
        className="login-orb-1 pointer-events-none absolute -left-20 -top-20 h-[32rem] w-[32rem] rounded-full bg-emerald-500/15 blur-[130px]"
        aria-hidden
      />
      <div
        className="login-orb-2 pointer-events-none absolute -bottom-32 -right-20 h-[36rem] w-[36rem] rounded-full bg-teal-500/12 blur-[140px]"
        aria-hidden
      />
      <div
        className="login-orb-3 pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-[26rem] w-[26rem] rounded-full bg-cyan-600/10 blur-[120px]"
        aria-hidden
      />

      {/* High-tech Nano Grid Texture Overlay */}
      <div className="login-grid-bg pointer-events-none absolute inset-0 z-0 opacity-70" aria-hidden />

      {/* Main Responsive Split Layout */}
      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        {/* Left Column: Scientific Research Platform Showcase */}
        <div className="lg:col-span-7 flex flex-col gap-6 login-animate-fade-up">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-300">
              NANOTOPHEA Research Platform
            </span>
          </div>

          {/* Brand Heading Lockup */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="login-pulse-ring relative rounded-2xl border border-emerald-500/30 bg-[var(--surface)] p-3 shadow-xl backdrop-blur-md">
                <BrandLogo size="md" priority className="h-12 w-12" />
              </div>
              <div>
                <span className="block text-2xl sm:text-3xl font-black tracking-tight text-[var(--foreground)] font-display">
                  NANOTOPHEA
                </span>
                <span className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide">
                  NanoHepatoTea Bioinformatics Platform
                </span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.12]">
              From Natural Compounds to{" "}
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
                Experimental Evidence
              </span>
            </h1>

            <p className="text-sm sm:text-base text-[var(--muted-foreground)] leading-relaxed max-w-2xl">
              An integrated research platform for the computational and experimental assessment of{" "}
              <em className="text-emerald-600 dark:text-emerald-300 not-italic font-semibold">
                Phyllanthus niruri (Sampasampalukan)
              </em>
              , connecting phytochemical screening, molecular docking, biological predictions,
              laboratory validation, and scientific interpretation.
            </p>
          </div>

          {/* Three Core Scientific Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
            <div className="group rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 backdrop-blur-md transition-all duration-300 hover:border-emerald-500/40 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Atom size={18} strokeWidth={2} />
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400/90">
                  AutoDock Vina
                </span>
              </div>
              <p className="text-xs font-bold text-[var(--card-foreground)]">Molecular Docking</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                Evaluate selected phytochemicals against validated biological targets using reproducible AutoDock Vina workflows.
              </p>
            </div>

            <div className="group rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 backdrop-blur-md transition-all duration-300 hover:border-teal-500/40 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400">
                  <Activity size={18} strokeWidth={2} />
                </span>
                <span className="text-[11px] font-mono font-bold text-teal-600 dark:text-teal-400/90">
                  In-Silico Screening
                </span>
              </div>
              <p className="text-xs font-bold text-[var(--card-foreground)]">Computational Assessment</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                Organize compound properties, target information, and computational evidence with traceable scientific provenance.
              </p>
            </div>

            <div className="group rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                  <FlaskConical size={18} strokeWidth={2} />
                </span>
                <span className="text-[11px] font-mono font-bold text-cyan-600 dark:text-cyan-400/90">
                  Laboratory Validation
                </span>
              </div>
              <p className="text-xs font-bold text-[var(--card-foreground)]">Experimental Evidence</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                Record and compare laboratory findings with computational predictions to support evidence-based interpretation.
              </p>
            </div>
          </div>

          {/* Provenance & Evidence Lifecycle Pill */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono tracking-wider text-[var(--muted-foreground)] uppercase">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span className="text-[var(--foreground)] font-semibold">REFERENCE</span>
            <span className="text-[var(--muted-foreground)]">·</span>
            <span className="text-[var(--foreground)] font-semibold">LITERATURE</span>
            <span className="text-[var(--muted-foreground)]">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">PREDICTED</span>
            <span className="text-[var(--muted-foreground)]">·</span>
            <span className="text-teal-600 dark:text-teal-300 font-semibold">EXPERIMENTAL</span>
            <span className="text-[var(--muted-foreground)]">·</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">INTERPRETATION</span>
          </div>
        </div>

        {/* Right Column: High-End Authentication Card */}
        <div className="lg:col-span-5 w-full login-animate-fade-up-delay-1">
          <div className="login-glass-card relative overflow-hidden rounded-2xl p-7 sm:p-9 shadow-xl">
            {/* Top Specular Edge Glow */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
              aria-hidden
            />

            {/* Form Title & Subtitle */}
            <div className="mb-6 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Sparkles size={14} />
                  <span>Researcher Portal</span>
                </span>
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-300 active:scale-95"
                  title="Click to populate demo administrator credentials"
                >
                  {demoFilled ? (
                    <>
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span>Loaded!</span>
                    </>
                  ) : (
                    <span>Auto-fill Demo</span>
                  )}
                </button>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-[var(--card-foreground)] font-display">
                Sign In to NANOTOPHEA
              </h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                Enter your authorized credentials to access research studies, computational workflows, and experimental records.
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--foreground)]">
                  Institutional Email
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--muted-foreground)]">
                    <Mail size={16} strokeWidth={1.8} />
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="investigator@institution.edu"
                    className="login-input w-full rounded-xl py-2.5 pl-10 pr-3.5 text-sm placeholder:text-[var(--muted-foreground)] border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--foreground)] focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--foreground)]">Password</label>
                  <span className="text-[11px] text-[var(--muted-foreground)]">Minimum 6 characters</span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--muted-foreground)]">
                    <Lock size={16} strokeWidth={1.8} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="login-input w-full rounded-xl py-2.5 pl-10 pr-10 text-sm placeholder:text-[var(--muted-foreground)] border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--foreground)] focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff size={16} strokeWidth={1.8} />
                    ) : (
                      <Eye size={16} strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message Banner */}
              {activeError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-200 animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-500" />
                  <span className="leading-relaxed">{activeError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy || loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 py-3 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all duration-200 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
              >
                {busy || loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-white" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight
                      size={16}
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>

            {/* Notice & Platform Overview */}
            <div className="mt-6 border-t border-[var(--border)] pt-4 space-y-3 text-center">
              <p className="text-[11.5px] leading-relaxed text-[var(--muted-foreground)]">
                Access is restricted to authorized NANOTOPHEA researchers. Self-registration is disabled.
              </p>
              <Link
                href="/"
                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] py-2.5 px-4 text-xs font-semibold text-[var(--foreground)] transition-all duration-200 hover:border-emerald-500/40 hover:bg-[var(--surface)] active:scale-[0.99]"
              >
                <ArrowLeft
                  size={15}
                  className="text-emerald-500 transition-transform duration-200 group-hover:-translate-x-1"
                />
                <span>Platform Overview</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
