-- Subcategories whose products are used up and bought again; reorder suggestions skip the rest
ALTER TABLE "subcategories" ADD COLUMN "restockable" BOOLEAN NOT NULL DEFAULT true;

-- Durables and seasonal items
UPDATE "subcategories" SET "restockable" = false WHERE "name" IN (
  'Cleaning Brushes', 'Broom & Mop', 'Dustpan & Brush', 'Mosquito Racquet',
  'Menstrual Cups', 'Tongue Cleaner',
  'Feeding Bottles', 'Pacifiers & Teethers', 'Sippers & Cups', 'Breast Pump & Accessories', 'Changing Mats',
  'Extension Cords', 'LED Bulbs', 'Rechargeable Batteries',
  'Kitchen Tools (Peeler, Grater)', 'Lunch Boxes', 'Storage Containers', 'Water Bottles', 'Scissors & Cutters',
  'Bowls & Feeders',
  'Diyas & Decorative Candles', 'Gift Packs & Hampers', 'Holi Colours (Gulal)', 'Rangoli Colours'
);
