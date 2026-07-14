import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-dom') || id.includes('react/')) return 'react-vendor'
          if (id.includes('framer-motion')) return 'motion-vendor'
          if (id.includes('@xyflow')) return 'flow-vendor'
          if (id.includes('react-markdown') || id.includes('remark-') || id.includes('rehype-') || id.includes('katex')) {
            return 'markdown-vendor'
          }
          if (id.includes('@ricky0123/vad-web') || id.includes('onnxruntime-web')) return 'voice-vendor'
          if (id.includes('lucide-react')) return 'icons-vendor'
          return 'vendor'
        },
      },
    },
  },
})
