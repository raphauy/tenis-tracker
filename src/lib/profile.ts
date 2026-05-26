import { cache } from 'react'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getProfileBySlug } from '@/services/user-service'

// Dedup por request (React cache): la page de /[slug] resuelve el perfil en
// generateMetadata y en resolveProfile; con cache se hace una sola query.
export const getProfileBySlugCached = cache((slug: string) => getProfileBySlug(slug.toLowerCase()))

// Resuelve el dueño de un Perfil por slug y la relación con el visitante.
// Lanza notFound() si el slug no existe. Usado por todas las pages de /[slug].
export async function resolveProfile(slugParam: string) {
  const owner = await getProfileBySlugCached(slugParam)
  if (!owner) notFound()

  const session = await auth()
  const viewer = session?.user ?? null
  const isOwner = !!viewer && viewer.id === owner.id

  return { owner, viewer, isOwner }
}
