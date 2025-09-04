/*
  Warnings:

  - Made the column `team` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "department" TEXT,
ALTER COLUMN "team" SET NOT NULL;
