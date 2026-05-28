import type { MetadataRoute } from 'next'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

// robots.txt nativo de Next 16. Bloquea zonas privadas / sin valor de búsqueda
// y apunta al sitemap. Los perfiles privados ya se autoexcluyen vía
// `robots: noindex` en su generateMetadata.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/login',
          '/onboarding',
          '/*/nuevo',
          '/*/ajustes',
          '/*/participacion/',
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  }
}
