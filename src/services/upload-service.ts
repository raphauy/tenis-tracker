import { put, del } from '@vercel/blob'

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB

// Sube una imagen a Vercel Blob (pública, con sufijo aleatorio) y devuelve su URL.
// Lanza si el archivo no es imagen o supera el límite (las actions catchean).
export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen')
  if (file.size > MAX_BYTES) throw new Error('La imagen no debe superar 4 MB')
  const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true })
  return blob.url
}

export async function deleteImage(url: string): Promise<void> {
  await del(url)
}
