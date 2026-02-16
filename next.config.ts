import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize agent0-sdk and its IPFS deps from server bundles
  // (ipfs-http-client -> electron-fetch -> electron is Node-only)
  serverExternalPackages: [
    'agent0-sdk',
    'ipfs-http-client',
    'ipfs-utils',
    'electron-fetch',
  ],

  // Optimize dev server performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['@reown/appkit', '@reown/appkit-adapter-wagmi', 'wagmi', 'viem', 'framer-motion', 'lucide-react'],
  },

  // Turbopack configuration (Next.js 16 default bundler)
  turbopack: {
    resolveAlias: {
      // Web3 polyfill stubs (required for wagmi/viem in browser)
      'pino-pretty': { browser: '' },
      'lokijs': { browser: '' },
      'encoding': { browser: '' },
    },
  },

  // Webpack fallback config (used when building with --webpack flag)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        'pino-pretty': false,
        lokijs: false,
        encoding: false,
        '@react-native-async-storage/async-storage': false,
      };
    }

    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push('pino-pretty', 'lokijs', 'encoding');
    }

    return config;
  },

  // Transpile specific packages that need it
  transpilePackages: ['@reown/appkit', '@reown/appkit-adapter-wagmi', '@wagmi/core', 'wagmi', 'viem'],

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },

  // Image optimization — disable for local agent PNGs (canvas-generated, saves memory)
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
