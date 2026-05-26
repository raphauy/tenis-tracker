// Tipos compartidos entre capas.

// Retorno estándar de las server actions: éxito con data opcional, o error con mensaje.
export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string }
