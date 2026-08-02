-- AlterEnum: allow CF-parity Monthly scheduled tasks
ALTER TYPE "RepeatType" ADD VALUE IF NOT EXISTS 'MONTHLY';
