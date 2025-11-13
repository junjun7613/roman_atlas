import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Cesium用の設定
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }

    // Cesiumのソースマップの警告を無視
    config.module = {
      ...config.module,
      unknownContextCritical: false,
      unknownContextRegExp: /\/cesium\/cesium\/Source\/Core\/buildModuleUrl\.js/,
    }

    return config
  },
}

export default nextConfig
