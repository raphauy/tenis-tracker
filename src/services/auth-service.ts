import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const createOtpSchema = z.object({
  userId: z.string(),
  token: z.string().length(6),
  expiresAt: z.date(),
})

export const verifyOtpSchema = z.object({
  userId: z.string(),
  token: z.string().length(6),
})

export type CreateOtpInput = z.infer<typeof createOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>

export const OTP_EXPIRY_MINUTES = 10

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function createOtpToken(data: CreateOtpInput) {
  const validated = createOtpSchema.parse(data)

  // Invalidar tokens previos sin usar de este usuario.
  await prisma.otpToken.updateMany({
    where: { userId: validated.userId, usedAt: null },
    data: { usedAt: new Date() },
  })

  return prisma.otpToken.create({
    data: {
      userId: validated.userId,
      token: validated.token,
      expiresAt: validated.expiresAt,
    },
  })
}

export async function verifyOtpToken(data: VerifyOtpInput): Promise<boolean> {
  const validated = verifyOtpSchema.parse(data)

  const otpToken = await prisma.otpToken.findFirst({
    where: {
      userId: validated.userId,
      token: validated.token,
      expiresAt: { gt: new Date() },
      usedAt: null,
    },
  })

  if (!otpToken) return false

  // Single-use.
  await prisma.otpToken.update({
    where: { id: otpToken.id },
    data: { usedAt: new Date() },
  })

  return true
}

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.otpToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
    },
  })
  return result.count
}
