import { PrismaClient } from '@prisma/client'
import {
  SUPERADMIN_EMAIL,
  SUPERADMIN_NAME,
  SEED_VENUES,
  SEED_CATEGORIES,
} from '../src/lib/constants/catalog'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // 1. Superadmin (el dueño).
  const superadmin = await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: { role: 'SUPERADMIN' },
    create: {
      email: SUPERADMIN_EMAIL,
      name: SUPERADMIN_NAME,
      role: 'SUPERADMIN',
    },
  })
  console.log(`✅ Superadmin: ${superadmin.email}`)

  // 2. Sedes (APPROVED, owned por el superadmin). Idempotente por nombre.
  for (const name of SEED_VENUES) {
    const existing = await prisma.venue.findFirst({ where: { name } })
    if (!existing) {
      await prisma.venue.create({
        data: { name, status: 'APPROVED', createdById: superadmin.id },
      })
      console.log(`✅ Sede: ${name}`)
    }
  }

  // 3. Categorías (APPROVED, owned por el superadmin). Idempotente por nombre.
  for (const name of SEED_CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { name } })
    if (!existing) {
      await prisma.category.create({
        data: { name, status: 'APPROVED', createdById: superadmin.id },
      })
      console.log(`✅ Categoría: ${name}`)
    }
  }

  console.log('🌱 Seed completo.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
