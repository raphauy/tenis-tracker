'use server'

import { revalidatePath } from 'next/cache'
import type { Visibility } from '@prisma/client'
import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import { updateProfileSchema } from '@/lib/validations/profile'
import { getViewerChrome, updateUserProfile } from '@/services/user-service'
import { uploadImage, deleteImage } from '@/services/upload-service'

export async function uploadAvatarAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    await requireUser()
    const file = formData.get('file')
    if (!(file instanceof File)) return { success: false, error: 'No se recibió ningún archivo' }
    const url = await uploadImage(file)
    return { success: true, data: { url } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo subir la imagen' }
  }
}

export async function updateProfileAction(input: {
  name: string
  image: string | null
  visibility: Visibility
}): Promise<ActionResult> {
  const parsed = updateProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  try {
    const user = await requireUser()
    const current = await getViewerChrome(user.id)
    await updateUserProfile(user.id, {
      name: parsed.data.name,
      image: parsed.data.image,
      visibility: parsed.data.visibility,
    })
    // Borrar la imagen anterior si fue reemplazada o quitada.
    const oldImage = current?.image
    if (oldImage && oldImage !== parsed.data.image) {
      try {
        await deleteImage(oldImage)
      } catch {
        // La imagen pudo no existir ya; no es un error de la action.
      }
    }
    if (current?.slug) {
      revalidatePath(`/${current.slug}`)
      revalidatePath(`/${current.slug}/ajustes`)
    }
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo actualizar el perfil' }
  }
}
