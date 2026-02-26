import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TF.js and MediaPipe are loaded dynamically on the client.
  // They are not compatible with Turbopack's static analysis.
  serverExternalPackages: [
    '@tensorflow/tfjs',
    '@tensorflow-models/body-segmentation',
    '@mediapipe/tasks-vision',
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // These libraries use dynamic imports and WASM — mark them as external
      // so webpack doesn't try to bundle/analyze them statically.
      config.externals = config.externals || [];
    }

    // Ignore missing optional peer dependencies from ML libraries
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
  // Disable turbopack for production builds (ML libraries not compatible)
  experimental: {},
};

export default nextConfig;
