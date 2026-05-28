-- Fase 2 de whatsapp-kapso: Magic-link inverso por WhatsApp + email backup opcional.
-- Ver docs/PRPs/whatsapp-kapso-prp.md (Decisiones cerradas, revisión 2026-05-28)
--     docs/adr/0002-magic-link-inverso-whatsapp.md
--
-- Cambios:
--   1) User.email pasa de NOT NULL a NULLABLE (email opcional, rol de backup).
--   2) User gana phone (NOT NULL, @unique), phoneVerifiedAt, emailVerifiedAt.
--   3) Limpieza de datos: borramos los usuarios de prueba; el único usuario real es el owner
--      (rapha.uy@rapha.uy). Reasignamos al owner cualquier catálogo creado por los borrados
--      (createdById no tiene onDelete: Cascade, así que sin esto el DELETE FROM "User" falla).
--   4) Seedeamos al owner con phone='+59898353507' y ambas verificaciones en now().
--   5) Creamos la tabla PendingAuth (código de sesión del Magic-link inverso).
--
-- La migración corre en transacción atómica (default de prisma migrate).

-- ============================================================================
-- 1) User: agregar columnas nullable + email DROP NOT NULL
-- ============================================================================

ALTER TABLE "User"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ALTER COLUMN "email" DROP NOT NULL;

-- ============================================================================
-- 2) Reasignar catálogo creado por usuarios a borrar → al superadmin (si existe)
--    Si no existe el superadmin con ese email, no hay nada que reasignar; el
--    DELETE posterior simplemente vaciará la tabla.
-- ============================================================================

DO $$
DECLARE
  superadmin_id TEXT;
BEGIN
  SELECT id INTO superadmin_id FROM "User" WHERE email = 'rapha.uy@rapha.uy' LIMIT 1;

  IF superadmin_id IS NOT NULL THEN
    UPDATE "Venue"      SET "createdById" = superadmin_id WHERE "createdById" <> superadmin_id;
    UPDATE "Category"   SET "createdById" = superadmin_id WHERE "createdById" <> superadmin_id;
    UPDATE "Tournament" SET "createdById" = superadmin_id WHERE "createdById" <> superadmin_id;
    UPDATE "Player"     SET "createdById" = superadmin_id WHERE "createdById" <> superadmin_id;
  END IF;
END $$;

-- ============================================================================
-- 3) Borrar usuarios de prueba (cascade: Entry → Match, OtpToken).
-- ============================================================================

DELETE FROM "User" WHERE email IS NULL OR email <> 'rapha.uy@rapha.uy';

-- ============================================================================
-- 4) Seedear phone + verificaciones del owner (idempotente: solo afecta si existe).
-- ============================================================================

UPDATE "User"
SET "phone" = '+59898353507',
    "phoneVerifiedAt" = CURRENT_TIMESTAMP,
    "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE email = 'rapha.uy@rapha.uy';

-- ============================================================================
-- 5) Ahora sí: phone NOT NULL + unique index.
--    Si la tabla quedó vacía (no había superadmin), el ALTER pasa OK; el seed
--    posterior (prisma db seed) lo creará con phone correcto.
-- ============================================================================

ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- ============================================================================
-- 6) Tabla PendingAuth (código de sesión del Magic-link inverso).
-- ============================================================================

CREATE TABLE "PendingAuth" (
  "id"             TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "consumedAt"     TIMESTAMP(3),
  "rejectedReason" TEXT,
  "resolvedPhone"  TEXT,
  "resolvedUserId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PendingAuth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingAuth_code_key"   ON "PendingAuth"("code");
CREATE INDEX        "PendingAuth_expiresAt_idx" ON "PendingAuth"("expiresAt");

ALTER TABLE "PendingAuth"
  ADD CONSTRAINT "PendingAuth_resolvedUserId_fkey"
  FOREIGN KEY ("resolvedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
