-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "category" TEXT NOT NULL,
    "memo" TEXT,
    "spentAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deletedAt" DATETIME
);
