import * as React from 'react'

// Devuelve false en SSR y true tras montar en el cliente.
// Útil para evitar hydration mismatch en componentes que dependen del tema o de Radix/base-ui.
export function useMounted() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}
