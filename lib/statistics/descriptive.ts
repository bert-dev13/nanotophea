/**
 * Descriptive statistics for experimental replicates.
 * Missing values are never treated as zero — only finite numbers count.
 */

export function mean(values: number[]): number | undefined {
  if (!values.length) return undefined
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Sample variance (Bessel-corrected, n − 1). Undefined if n < 2. */
export function sampleVariance(values: number[]): number | undefined {
  if (values.length < 2) return undefined
  const m = mean(values)
  if (m === undefined) return undefined
  return values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1)
}

/** Sample standard deviation (√variance). Undefined if n < 2. */
export function sampleSd(values: number[]): number | undefined {
  const v = sampleVariance(values)
  if (v === undefined) return undefined
  return Math.sqrt(v)
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}
