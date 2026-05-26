import { auth } from '@/lib/auth'

// Usuario autenticado mínimo para scopear queries en services/actions.
export type CurrentUser = { id: string; role: string }

// Exige sesión. Lanza si no hay (las actions catchean y devuelven ActionResult).
// El acceso a rutas ya lo protege src/proxy.ts; esto asegura el userId server-side.
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('No autenticado')
  }
  return { id: session.user.id, role: session.user.role }
}
