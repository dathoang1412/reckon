-- CreateTable
CREATE TABLE "SyncRecord" (
    "kind" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "data" JSONB NOT NULL,

    CONSTRAINT "SyncRecord_pkey" PRIMARY KEY ("kind","recordId")
);

-- CreateIndex
CREATE INDEX "SyncRecord_updatedAt_idx" ON "SyncRecord"("updatedAt");
