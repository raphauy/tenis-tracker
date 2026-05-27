import { z } from 'zod'

// Envío de texto desde el inbox de /admin/whatsapp.
// `to` en E.164 (+598...); `body` el texto libre (límite de WhatsApp: 4096 chars).
export const sendTextSchema = z.object({
  to: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'El teléfono debe estar en formato E.164 (+598...)'),
  body: z.string().trim().min(1, 'El mensaje no puede estar vacío').max(4096),
})
export type SendTextInput = z.infer<typeof sendTextSchema>
