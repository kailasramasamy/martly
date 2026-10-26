/**
 * Gives the Dharmapuri demo stores their storefront branding: tagline (with Tamil), brand colour and highlights.
 * Offer lines and posters are left to store owners; the app falls back to live deals and free delivery.
 *
 *   cd apps/api && npx tsx prisma/seed-store-branding.ts
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

interface Branding {
  tagline: string;
  taglineTa: string;
  brandColor: string;
  highlights: string[];
}

const BRANDING: Record<string, Branding> = {
  "template-store": {
    tagline: "Fresh stock every morning, right by the bus stand",
    taglineTa: "பேருந்து நிலையம் அருகே, தினமும் காலையில் புதிய சரக்கு",
    brandColor: "#15803d",
    highlights: ["Widest range", "Fresh produce", "Household needs"],
  },
  "harur-daily-basket": {
    tagline: "Your everyday basket, packed with care",
    taglineTa: "உங்கள் தினசரி தேவைகள், அக்கறையுடன் பேக் செய்து",
    brandColor: "#ea580c",
    highlights: ["Daily essentials", "Dairy & bakery", "Quick top-ups"],
  },
  "thamizh-supermarket": {
    tagline: "Taste of home: local brands and traditional staples",
    taglineTa: "வீட்டுச் சுவை: உள்ளூர் பிராண்டுகளும் பாரம்பரியப் பொருட்களும்",
    brandColor: "#b91c1c",
    highlights: ["Local brands", "Traditional staples", "Millets"],
  },
  "nallampalli-daily-needs": {
    tagline: "Everything for the home, close to home",
    taglineTa: "வீட்டுக்குத் தேவையான அனைத்தும், வீட்டின் அருகிலேயே",
    brandColor: "#2563eb",
    highlights: ["Daily essentials", "Cleaning & care", "Snacks"],
  },
  "sri-murugan-stores": {
    tagline: "Trusted by Adhiyamankottai families",
    taglineTa: "அதியமான்கோட்டை குடும்பங்களின் நம்பிக்கைக்குரிய கடை",
    brandColor: "#a16207",
    highlights: ["Pooja items", "Rice & dals", "Spices"],
  },
  "greenleaf-organics": {
    tagline: "Organic and natural, from farm to your kitchen",
    taglineTa: "இயற்கை மற்றும் ஆர்கானிக், பண்ணையிலிருந்து உங்கள் சமையலறைக்கு",
    brandColor: "#4d7c0f",
    highlights: ["Organic", "Cold-pressed oils", "Millets"],
  },
  "kaveri-fresh": {
    tagline: "Fruits and vegetables picked fresh every day",
    taglineTa: "தினமும் புதிதாகப் பறித்த பழங்களும் காய்கறிகளும்",
    brandColor: "#0891b2",
    highlights: ["Fruits & veggies", "Dairy", "Fresh daily"],
  },
  "annapoorna-supermart": {
    tagline: "A full kitchen, stocked for every festival",
    taglineTa: "ஒவ்வொரு பண்டிகைக்கும் நிறைந்த சமையலறை",
    brandColor: "#be185d",
    highlights: ["Festival specials", "Sweets & snacks", "Bulk packs"],
  },
  "downtown-mart": {
    tagline: "Big-city range in the heart of Dharmapuri",
    taglineTa: "தருமபுரி நகர மையத்தில் பெரிய நகர வகைகள்",
    brandColor: "#4338ca",
    highlights: ["Imported picks", "Personal care", "Beverages"],
  },
};

async function main() {
  for (const [slug, b] of Object.entries(BRANDING)) {
    const { count } = await prisma.store.updateMany({
      where: { slug },
      data: { tagline: b.tagline, brandColor: b.brandColor, highlights: b.highlights, translations: { ta: { tagline: b.taglineTa } } },
    });
    console.log(`${count ? "branded" : "missing"}  ${slug}`);
  }
}

main().finally(() => prisma.$disconnect());
