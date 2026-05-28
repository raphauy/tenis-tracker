import { PrismaClient } from '@prisma/client'
import {
  SUPERADMIN_EMAIL,
  SUPERADMIN_NAME,
  SUPERADMIN_PHONE,
  SEED_VENUES,
  SEED_CATEGORIES,
} from '../src/lib/constants/catalog'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')
  const now = new Date()

  // 1. Superadmin (el dueño). Phone + ambas verificaciones cubiertas desde el día 1
  //    (su login va por WhatsApp pero el email backup queda operativo).
  const superadmin = await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: {
      role: 'SUPERADMIN',
      phone: SUPERADMIN_PHONE,
      phoneVerifiedAt: now,
      emailVerifiedAt: now,
    },
    create: {
      email: SUPERADMIN_EMAIL,
      name: SUPERADMIN_NAME,
      role: 'SUPERADMIN',
      phone: SUPERADMIN_PHONE,
      phoneVerifiedAt: now,
      emailVerifiedAt: now,
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
