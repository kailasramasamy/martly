-- New enum values must commit before the next migration uses them
ALTER TYPE "BannerActionType" ADD VALUE 'BRAND';
ALTER TYPE "UserRole" ADD VALUE 'BRAND_PARTNER';
