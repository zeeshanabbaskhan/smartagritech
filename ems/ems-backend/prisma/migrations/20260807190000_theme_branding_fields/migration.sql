-- AlterTable: theme branding fields
ALTER TABLE "themes" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "themes" ADD COLUMN "sidebarColor" TEXT DEFAULT 'Dark';
ALTER TABLE "themes" ADD COLUMN "fontFamily" TEXT DEFAULT 'Inter';
ALTER TABLE "themes" ADD COLUMN "darkModeDefault" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "themes" ADD COLUMN "showLogoInSidebar" BOOLEAN NOT NULL DEFAULT true;
