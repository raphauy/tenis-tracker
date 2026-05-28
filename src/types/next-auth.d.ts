import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    id: string
    // Desde Fase 2 (whatsapp-kapso): email es opcional. Quien entra por WhatsApp puede
    // no tener email asociado. Identidad primaria = phone (no se expone en la sesión).
    email?: string | null
    name: string | null
    role: string
  }

  interface Session {
    user: User
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    name: string | null
    role: string
  }
}
