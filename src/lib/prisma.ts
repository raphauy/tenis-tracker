import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // Adapter serverless de Neon: mejor cold start.
  const adapter = new PrismaNeon({ connectionString })

  return new PrismaClient({
    adapter,
    log: ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Helper para reintentar queries ante cold starts de Neon.
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      const isConnectionError =
        lastError.message?.includes("Can't reach database server") ||
        lastError.message?.includes('Connection terminated') ||
        lastError.message?.includes('connect ETIMEDOUT') ||
        // Neon despierta el compute desde autosuspend vía su control plane; con poco tráfico
        // está dormido casi siempre y a veces ese arranque falla en frío (XX000). Es transitorio:
        // el backoff le da tiempo a levantar y el reintento pasa. Ver docs sobre cold starts.
        lastError.message?.includes('Control plane request failed')

      if (!isConnectionError || attempt === maxRetries) {
        throw error
      }

      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, attempt - 1))
      )
    }
  }

  throw lastError
}
