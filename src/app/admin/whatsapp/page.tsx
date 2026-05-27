import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getNumberStatus,
  listConversations,
  getThread,
} from '@/services/whatsapp-service'
import { WhatsAppPanel } from './whatsapp-panel'
import { WhatsAppSkeleton } from './whatsapp-skeleton'

export const metadata = { title: 'WhatsApp · Tenis Tracker' }

async function WhatsAppData({ selectedId }: { selectedId?: string }) {
  try {
    const [status, conversations] = await Promise.all([getNumberStatus(), listConversations()])
    const selected = selectedId && conversations.some((c) => c.id === selectedId) ? selectedId : null
    const thread = selected ? await getThread(selected) : []

    return (
      <WhatsAppPanel
        status={status}
        conversations={conversations}
        selectedId={selected}
        thread={thread}
      />
    )
  } catch (error) {
    console.error('[whatsapp] error al cargar el panel:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No se pudo conectar con Kapso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{message}</p>
          <p>
            Verificá que <code>KAPSO_API_KEY</code> y <code>KAPSO_PHONE_NUMBER_ID</code> estén
            configurados en el entorno.
          </p>
        </CardContent>
      </Card>
    )
  }
}

export default async function WhatsAppAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { c } = await searchParams

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Estado del número, salud de la conexión y bandeja para responder dentro de la ventana de
          24 h.
        </p>
      </header>
      <Suspense fallback={<WhatsAppSkeleton />}>
        <WhatsAppData selectedId={c} />
      </Suspense>
    </main>
  )
}
