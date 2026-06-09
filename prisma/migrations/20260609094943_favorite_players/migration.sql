-- CreateTable
CREATE TABLE "FavoritePlayer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoritePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoritePlayer_userId_idx" ON "FavoritePlayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoritePlayer_userId_nameKey_key" ON "FavoritePlayer"("userId", "nameKey");

-- AddForeignKey
ALTER TABLE "FavoritePlayer" ADD CONSTRAINT "FavoritePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
