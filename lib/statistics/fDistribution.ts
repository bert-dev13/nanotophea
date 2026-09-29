/**
 * Deterministic F-distribution helpers for one-way ANOVA / Scheffé.
 * Regularized incomplete beta via Lentz continued fraction (Numerical Recipes).
 * No external statistics library.
 */

const FPMIN = 1e-30
const EPS = 3e-12
const MAX_IT = 200

function logGamma(z: number): number {
  // Lanczos approximation (g = 7)
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.3234287996533,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.984369654078991e-6,
    1.5056327351493116e-7,
  ]
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  }
  const x = z - 1
  let a = p[0]
  for (let i = 1; i < p.length; i++) a += p[i] / (x + i)
  const t = x + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Continued fraction for incomplete beta (Lentz). */
function betacf(a: number, b: number, x: number): number {
  const qab = a + b
  const qap = a + 1
  const qam = a - 1

  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d

  for (let m = 1; m <= MAX_IT; m++) {
    const m2 = 2 * m

    // Even step
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c

    // Odd step
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del

    if (Math.abs(del - 1) < EPS) return h
  }
  return h
}

/** Regularized incomplete beta I_x(a, b) */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  if (!(a > 0 && b > 0) || !Number.isFinite(x)) return NaN

  const lbeta =
    a * Math.log(x) + b * Math.log(1 - x) + logGamma(a + b) - logGamma(a) - logGamma(b)

  const bt = Math.exp(lbeta)

  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

/**
 * CDF of Fisher–Snedecor F(d1, d2) at f.
 * F_{d1,d2}(f) = I_z(d1/2, d2/2),  z = (d1·f) / (d1·f + d2)
 */
export function fCdf(f: number, d1: number, d2: number): number {
  if (!(f >= 0) || !(d1 > 0) || !(d2 > 0)) return NaN
  if (f === 0) return 0
  if (!Number.isFinite(f)) return 1
  const z = (d1 * f) / (d1 * f + d2)
  return regularizedIncompleteBeta(z, d1 / 2, d2 / 2)
}

/** Upper-tail p-value P(F ≥ f) */
export function fSurvival(f: number, d1: number, d2: number): number {
  if (!(f >= 0) || !(d1 > 0) || !(d2 > 0)) return NaN
  if (f === 0) return 1
  if (!Number.isFinite(f)) return 0
  const y = d2 / (d2 + d1 * f)
  return regularizedIncompleteBeta(y, d2 / 2, d1 / 2)
}

/** Upper critical value F_{α; d1, d2} via bisection on the CDF. */
export function fCritical(alpha: number, d1: number, d2: number): number {
  if (!(alpha > 0 && alpha < 1) || !(d1 > 0) || !(d2 > 0)) return NaN
  const target = 1 - alpha
  let lo = 0
  let hi = 1
  while (fCdf(hi, d1, d2) < target) {
    hi *= 2
    if (hi > 1e12) return hi
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (fCdf(mid, d1, d2) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
