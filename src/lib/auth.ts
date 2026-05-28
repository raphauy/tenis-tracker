import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getUserByEmail, getUserById } from '@/services/user-service'
import { verifyOtpToken } from '@/services/auth-service'
import { getPendingAuthByCode } from '@/services/pending-auth-service'

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === 'production',
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
  },

  providers: [
    // Canal primario (Fase 2): Magic-link inverso por WhatsApp.
    // El cliente llama signIn('whatsapp', { code }) tras detectar consumed por polling.
    // El authorize confía en PendingAuth.consumedAt + resolvedUserId (lo seteó el webhook
    // tras validar el inbound y el phone). La autorización efectiva ya pasó en el webhook.
    Credentials({
      id: 'whatsapp',
      credentials: {
        code: { label: 'Código de sesión', type: 'text' },
      },
      authorize: async (credentials) => {
        const code = credentials?.code as string | undefined
        if (!code) return null

        const pending = await getPendingAuthByCode(code.toUpperCase())
        if (!pending) return null
        if (pending.rejectedReason) return null
        if (!pending.consumedAt || !pending.resolvedUserId) return null

        const user = await getUserById(pending.resolvedUserId)
        if (!user || !user.isActive) return null

        return {
          id: user.id,
          // NextAuth User espera string; email es opcional desde Fase 2.
          email: user.email ?? undefined,
          name: user.name,
          role: user.role,
        }
      },
    }),

    // Backup (Fase 2): email + OTP por Resend. Solo loguea a usuarios con email YA verificado
    // (la verificación se hace previamente desde el banner persistente tras un login WA exitoso).
    Credentials({
      id: 'email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        otp: { label: 'OTP', type: 'text' },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined
        const otp = credentials?.otp as string | undefined

        if (!email || !otp) return null

        const user = await getUserByEmail(email)
        if (!user || !user.isActive) return null
        // Email no verificado → no es puerta. Cualquiera podría agregar un email random
        // sin verificarlo y usarlo para loguearse; bloqueamos eso acá.
        if (!user.emailVerifiedAt) return null

        const isValid = await verifyOtpToken({ userId: user.id, token: otp })
        if (!isValid) return null

        return {
          id: user.id,
          // NextAuth User espera string; email es opcional desde Fase 2.
          email: user.email ?? undefined,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],

  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
      }
      return token
    },
    session: async ({ session, token }) => {
      if (token) {
        session.user.id = token.id as string
        session.user.name = token.name as string | null
        session.user.role = token.role as string
      }
      return session
    },
  },
})
