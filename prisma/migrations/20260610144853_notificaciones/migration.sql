-- CreateEnum
CREATE TYPE "EmailNotifyMode" AS ENUM ('OFF', 'IMMEDIATE', 'DIGEST');

-- CreateEnum
CREATE TYPE "WhatsappNotifyMode" AS ENUM ('OFF', 'IMMEDIATE');

-- CreateEnum
CREATE TYPE "NotifyOutcome" AS ENUM ('WON', 'LOST', 'CHAMPION', 'FINALIST');

-- CreateEnum
CREATE TYPE "NotifyChannelStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "ExternalBracket" ADD COLUMN     "notificationsBaselineAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FavoritePlayer" ADD COLUMN     "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyEmailMode" "EmailNotifyMode" NOT NULL DEFAULT 'OFF',
ADD COLUMN     "notifyNudgeDismissedAt" TIMESTAMP(3),
ADD COLUMN     "notifyWhatsappMode" "WhatsappNotifyMode" NOT NULL DEFAULT 'IMMEDIATE';

-- CreateTable
CREATE TABLE "ResultNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "matchSlot" INTEGER NOT NULL,
    "outcome" "NotifyOutcome" NOT NULL,
    "tournamentName" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "roundLabel" TEXT NOT NULL,
    "nextRoundLabel" TEXT,
    "opponentName" TEXT,
    "score" TEXT,
    "tournamentSlug" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailStatus" "NotifyChannelStatus" NOT NULL DEFAULT 'PENDING',
    "emailSentAt" TIMESTAMP(3),
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "whatsappStatus" "NotifyChannelStatus" NOT NULL DEFAULT 'PENDING',
    "whatsappSentAt" TIMESTAMP(3),
    "whatsappAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ResultNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResultNotification_userId_detectedAt_idx" ON "ResultNotification"("userId", "detectedAt");

-- CreateIndex
CREATE INDEX "ResultNotification_emailStatus_idx" ON "ResultNotification"("emailStatus");

-- CreateIndex
CREATE INDEX "ResultNotification_whatsappStatus_idx" ON "ResultNotification"("whatsappStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ResultNotification_userId_bracketId_roundIndex_matchSlot_na_key" ON "ResultNotification"("userId", "bracketId", "roundIndex", "matchSlot", "nameKey");

-- AddForeignKey
ALTER TABLE "ResultNotification" ADD CONSTRAINT "ResultNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill (defaults frozen): los usuarios con email verificado nacen con el "smart default"
-- email-first (resumen diario por email, WhatsApp off). Los phone-only quedan en los defaults
-- estáticos de la columna (WhatsApp inmediato, email off). No se auto-cambian al verificar email.
UPDATE "User"
SET "notifyEmailMode" = 'DIGEST', "notifyWhatsappMode" = 'OFF'
WHERE "emailVerifiedAt" IS NOT NULL;
