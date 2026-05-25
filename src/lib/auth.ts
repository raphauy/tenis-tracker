import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getUserByEmail } from '@/services/user-service'
import { verifyOtpToken } from '@/services/auth-service'

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === 'production',
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
  },

  providers: [
    Credentials({
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

        const isValid = await verifyOtpToken({ userId: user.id, token: otp })
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
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
