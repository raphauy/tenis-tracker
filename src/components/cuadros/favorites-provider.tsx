'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { normalizeName } from '@/lib/text'
import { toggleFavoritePlayerAction } from '@/app/cuadros/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type FavoritesContextValue = {
  isFavorite: (name: string) => boolean
  toggle: (name: string) => void
  isAuthenticated: boolean
  // Para anónimos: abre el diálogo que invita a iniciar sesión.
  requestLogin: () => void
}

// Default no-op: useFavorites() no crashea si se usa sin provider.
const FavoritesContext = React.createContext<FavoritesContextValue>({
  isFavorite: () => false,
  toggle: () => {},
  isAuthenticated: false,
  requestLogin: () => {},
})

export function useFavorites() {
  return React.useContext(FavoritesContext)
}

// Mantiene el set de nombres favoritos (claves normalizadas) sembrado desde el server.
// El toggle es optimista: actualiza el set al instante (todas las apariciones del
// nombre reaccionan) y persiste por la action; si falla, revierte.
export function FavoritesProvider({
  initialKeys,
  isAuthenticated,
  children,
}: {
  initialKeys: string[]
  isAuthenticated: boolean
  children: React.ReactNode
}) {
  const [keys, setKeys] = React.useState<Set<string>>(() => new Set(initialKeys))
  const [loginOpen, setLoginOpen] = React.useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const isFavorite = React.useCallback((name: string) => keys.has(normalizeName(name)), [keys])

  const requestLogin = React.useCallback(() => setLoginOpen(true), [])

  function goToLogin() {
    setLoginOpen(false)
    router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`)
  }

  const toggle = React.useCallback(
    (name: string) => {
      const key = normalizeName(name)
      if (!key) return
      const wasFavorite = keys.has(key)

      setKeys((prev) => {
        const next = new Set(prev)
        if (wasFavorite) next.delete(key)
        else next.add(key)
        return next
      })

      toggleFavoritePlayerAction(name).then((res) => {
        if (!res.success) {
          setKeys((prev) => {
            const next = new Set(prev)
            if (wasFavorite) next.add(key)
            else next.delete(key)
            return next
          })
          toast.error(res.error)
        }
      })
    },
    [keys]
  )

  const value = React.useMemo(
    () => ({ isFavorite, toggle, isAuthenticated, requestLogin }),
    [isFavorite, toggle, isAuthenticated, requestLogin]
  )

  return (
    <FavoritesContext.Provider value={value}>
      {children}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Marcá tus jugadores favoritos</DialogTitle>
            <DialogDescription>
              Para marcar un jugador como favorito tenés que iniciar sesión. Tus favoritos
              quedan resaltados en todos los cuadros.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button onClick={goToLogin}>Iniciar sesión</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FavoritesContext.Provider>
  )
}
