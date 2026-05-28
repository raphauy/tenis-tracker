import type { MetadataRoute } from 'next'
import { getPublicProfilesForSitemap } from '@/services/user-service'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

// Sitemap dinámico: landing + cada perfil PUBLIC con su subruta /stats.
// Perfiles PRIVATE se excluyen por la query del service.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const profiles = await getPublicProfilesForSitemap()

  return [
    {
      url: `${APP_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...profiles.flatMap((u) =>
      u.slug
        ? [
            {
              url: `${APP_URL}/${u.slug}`,
              lastModified: u.updatedAt,
              changeFrequency: 'weekly' as const,
              priority: 0.8,
            },
            {
              url: `${APP_URL}/${u.slug}/stats`,
              lastModified: u.updatedAt,
              changeFrequency: 'weekly' as const,
              priority: 0.6,
            },
          ]
        : []
    ),
  ]
}
