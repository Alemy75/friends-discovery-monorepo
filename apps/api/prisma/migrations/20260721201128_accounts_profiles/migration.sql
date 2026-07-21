-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('single', 'couple');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('active', 'hidden', 'banned');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "cityId" TEXT NOT NULL,
    "bio" TEXT,
    "status" "ProfileStatus" NOT NULL DEFAULT 'active',
    "intents" TEXT[],
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_members" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "photoUrl" TEXT,

    CONSTRAINT "account_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interests" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_interests" (
    "accountId" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,

    CONSTRAINT "account_interests_pkey" PRIMARY KEY ("accountId","interestId")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_ownerUserId_key" ON "accounts"("ownerUserId");

-- CreateIndex
CREATE INDEX "accounts_cityId_status_idx" ON "accounts"("cityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "account_members_accountId_position_key" ON "account_members"("accountId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "interests_slug_key" ON "interests"("slug");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_interests" ADD CONSTRAINT "account_interests_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_interests" ADD CONSTRAINT "account_interests_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "interests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma не генерирует USING GIN для скалярного массива; добавлено вручную.
-- ВНИМАНИЕ: сохранять эту строку при будущих migrate diff.
CREATE INDEX "accounts_intents_gin" ON "accounts" USING GIN ("intents");
