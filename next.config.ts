import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pubchem.ncbi.nlm.nih.gov",
        pathname: "/rest/pug/**",
      },
    ],
  },
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/cell-lines", destination: "/research/cell-lines", permanent: false },
      { source: "/proteins", destination: "/research/proteins", permanent: false },
      { source: "/phytochemicals", destination: "/research/phytochemicals", permanent: false },
      { source: "/docking", destination: "/insilico/docking", permanent: false },
      { source: "/docking-lab", destination: "/insilico/docking", permanent: false },
      { source: "/dpph", destination: "/insilico/predictions/dpph", permanent: false },
      { source: "/mtt", destination: "/insilico/predictions/mtt", permanent: false },
      { source: "/ldh", destination: "/insilico/predictions/ldh", permanent: false },
      { source: "/ros", destination: "/insilico/predictions/ros", permanent: false },
      { source: "/bax", destination: "/insilico/predictions/bax", permanent: false },
      { source: "/yap", destination: "/insilico/predictions/yap", permanent: false },
      { source: "/insilico/predictions/hippo-yap", destination: "/insilico/predictions/yap", permanent: false },
      { source: "/results", destination: "/analysis/compare", permanent: false },
      { source: "/interpreter", destination: "/analysis/interpretation", permanent: false },
      { source: "/dosage", destination: "/", permanent: false },
    ]
  },
}

export default nextConfig
