// The terminal client's own build (spec §1.5). It is not an entry of the
// Electron build on purpose: that one bundles its dependencies, and Ink brings
// yoga-layout (WASM) and react-reconciler, which belong in node_modules,
// resolved at runtime like any Node CLI.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Externalizes node_modules: ink, react and the core's own dependencies stay
    // where they are. Only our sources are bundled (the core's imports have no
    // extensions, so plain node --experimental-strip-types could not resolve them).
    ssr: true,
    outDir: 'out/tuicano',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: {
      input: { index: 'src/tuicano/index.tsx' },
      output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: '[name].js' }
    }
  }
})
