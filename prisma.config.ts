import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// Cargar .env.local para desarrollo (Next lee .env.local; la CLI de Prisma no, por defecto).
config({ path: '.env.local' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Conexión directa para migraciones (no pooled).
    url: env('DIRECT_DATABASE_URL') || env('DATABASE_URL'),
  },
})
