-- The shopper tab bar's last slot becomes a placement brands book: a banner row carrying the brand's logo
ALTER TYPE "AdProductKind" ADD VALUE 'BRAND_TAB_SLOT';
ALTER TYPE "BannerPlacement" ADD VALUE 'BRAND_TAB';
