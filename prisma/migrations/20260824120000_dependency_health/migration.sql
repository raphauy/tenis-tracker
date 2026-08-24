-- CreateTable
CREATE TABLE "DependencyHealth" (
    "component" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastFailureDetail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DependencyHealth_pkey" PRIMARY KEY ("component")
);
