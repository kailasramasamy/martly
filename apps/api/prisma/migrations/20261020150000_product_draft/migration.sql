-- New products can wait as drafts until the owner reviews and launches them
ALTER TABLE "products" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;
