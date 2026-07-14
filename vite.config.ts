import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env files: .env, .env.local, .env.{mode}, .env.{mode}.local
  const env = loadEnv(mode, process.cwd(), '')

  // RPC proxy targets (configurable via env)
  const devnetRpcTarget = env.VITE_DEVNET_RPC_URL || 'https://devnet.octrascan.io/rpc'
  const mainnetRpcTarget = env.VITE_MAINNET_RPC_URL || 'https://octra.network/rpc'

  return {
    plugins: [
      react(),
      // 0xio SDK depends on Node.js globals (Buffer, process, crypto, stream)
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream', 'events', 'crypto'],
        globals: { Buffer: true, global: true, process: true },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      // Proxy RPC requests to bypass CORS issues during development.
      // The browser fetches `/rpc/devnet` and `/rpc/mainnet` (same-origin),
      // and Vite forwards them to the actual Octra RPC endpoints.
      // In production, the dApp fetches the RPC URLs directly (CORS must be
      // configured on the RPC server, OR you deploy behind a reverse proxy).
      proxy: {
        '/rpc/devnet': {
          target: devnetRpcTarget.replace(/\/rpc$/, ''),
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/rpc\/devnet/, '/rpc'),
        },
        '/rpc/mainnet': {
          target: mainnetRpcTarget.replace(/\/rpc$/, ''),
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/rpc\/mainnet/, '/rpc'),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      target: 'es2020',
      chunkSizeWarningLimit: 1500,
    },
  }
})
