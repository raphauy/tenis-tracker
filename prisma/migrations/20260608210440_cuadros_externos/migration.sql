-- CreateEnum
CREATE TYPE "ExternalTournamentStatus" AS ENUM ('LIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BracketFormat" AS ENUM ('BRACKET', 'ROUND_ROBIN');

-- CreateTable
CREATE TABLE "ExternalTournament" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "status" "ExternalTournamentStatus" NOT NULL DEFAULT 'LIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalTournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalBracket" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "format" "BracketFormat" NOT NULL DEFAULT 'BRACKET',
    "data" JSONB NOT NULL,
    "rawHash" TEXT NOT NULL,
    "rawSnapshot" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "lastSyncError" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalBracket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTournament_identityKey_key" ON "ExternalTournament"("identityKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTournament_slug_key" ON "ExternalTournament"("slug");

-- CreateIndex
CREATE INDEX "ExternalTournament_sourceType_idx" ON "ExternalTournament"("sourceType");

-- CreateIndex
CREATE INDEX "ExternalTournament_status_idx" ON "ExternalTournament"("status");

-- CreateIndex
CREATE INDEX "ExternalBracket_tournamentId_idx" ON "ExternalBracket"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalBracket_tournamentId_slug_key" ON "ExternalBracket"("tournamentId", "slug");

-- AddForeignKey
ALTER TABLE "ExternalBracket" ADD CONSTRAINT "ExternalBracket_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "ExternalTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
