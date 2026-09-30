/**
 * Bookmark paths kept during the workspace migration.
 * Each destination page redirects into the open study.
 * Runtime redirects also live in next.config.ts.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/cell-lines": "/research/cell-lines",
  "/proteins": "/research/proteins",
  "/phytochemicals": "/research/phytochemicals",
  "/docking": "/insilico/docking",
  "/docking-lab": "/insilico/docking",
  "/dpph": "/insilico/predictions/dpph",
  "/mtt": "/insilico/predictions/mtt",
  "/ldh": "/insilico/predictions/ldh",
  "/ros": "/insilico/predictions/ros",
  "/bax": "/insilico/predictions/bax",
  "/yap": "/insilico/predictions/yap",
  "/results": "/analysis/compare",
  "/interpreter": "/analysis/interpretation",
  "/dosage": "/",
}
