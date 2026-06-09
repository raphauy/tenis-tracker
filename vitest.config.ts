import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Tests unitarios de lógica pura (parsers de cuadros en src/lib/cuadros/).
// Entorno node: no se testea UI ni DB acá. El alias `@/` lo resuelve tsconfigPaths.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
