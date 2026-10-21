import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/index.js";

dotenv.config({ override: true });

const prisma = new PrismaClient();

// The Tamil / Tanglish staples and household words the list reader started with. Safe to run again: terms upsert
// by their catalog word and their phrases are replaced, so edits made in the admin panel to other terms are left alone.
const TERMS: { searchTerm: string; note?: string; ta: string[] }[] = [
  { searchTerm: "rice", ta: ["அரிசி", "arisi"] },
  { searchTerm: "ponni rice", ta: ["பொன்னி அரிசி", "ponni arisi"] },
  { searchTerm: "idli rice", ta: ["இட்லி அரிசி", "idli arisi"] },
  { searchTerm: "toor dal", ta: ["துவரம் பருப்பு", "thuvaram paruppu"] },
  { searchTerm: "urad dal", ta: ["உளுந்து", "ulundhu", "உளுத்தம் பருப்பு", "ulutham paruppu"] },
  { searchTerm: "moong dal", ta: ["பாசிப்பருப்பு", "paasi paruppu"] },
  { searchTerm: "chana dal", ta: ["கடலைப்பருப்பு", "kadalai paruppu"] },
  { searchTerm: "besan", note: "raw gram flour, never roasted", ta: ["கடலை மாவு", "kadalai maavu", "kadalai mavu"] },
  { searchTerm: "roasted gram", ta: ["பொட்டுக்கடலை", "pottukadalai"] },
  { searchTerm: "rice flour", ta: ["அரிசி மாவு", "arisi maavu"] },
  { searchTerm: "wheat atta", ta: ["கோதுமை மாவு", "gothumai maavu"] },
  { searchTerm: "rava", ta: ["ரவை", "ravai"] },
  { searchTerm: "maida", ta: ["மைதா"] },
  { searchTerm: "gingelly oil", ta: ["நல்லெண்ணெய்", "nallennai"] },
  { searchTerm: "groundnut oil", ta: ["கடலை எண்ணெய்", "kadalai ennai"] },
  { searchTerm: "coconut oil", ta: ["தேங்காய் எண்ணெய்", "thengai ennai"] },
  { searchTerm: "sugar", ta: ["சர்க்கரை", "sakkarai"] },
  { searchTerm: "jaggery", ta: ["வெல்லம்", "vellam"] },
  { searchTerm: "tamarind", ta: ["புளி", "puli"] },
  { searchTerm: "curry leaves", ta: ["கறிவேப்பிலை", "karuveppilai"] },
  { searchTerm: "coriander leaves", ta: ["கொத்தமல்லி", "kothamalli"] },
  { searchTerm: "vermicelli", ta: ["சேமியா", "semiya"] },
  { searchTerm: "oil", note: "when they don't say which oil", ta: ["எண்ணெய்", "ennai"] },
  // "Soap" covers washing bars too: a laundry or dish brand, or cloth / vessel, with soap means the bar
  {
    searchTerm: "detergent bar", note: "soap for washing clothes",
    ta: ["துணி சோப்பு", "thuni soap", "thuni soppu", "துவைக்கும் சோப்பு", "washing soap"],
  },
  { searchTerm: "dishwash bar", note: "soap for washing vessels", ta: ["பாத்திரம் தேய்க்கும் சோப்பு", "pathiram soap", "vessel soap"] },
  { searchTerm: "rin detergent bar", ta: ["rin soap", "rin soppu", "ரின் சோப்பு"] },
  { searchTerm: "wheel detergent bar", ta: ["wheel soap", "wheel soppu", "வீல் சோப்பு"] },
  { searchTerm: "surf excel detergent bar", ta: ["surf soap", "surf excel soap"] },
  { searchTerm: "501 detergent bar", ta: ["501 soap", "501 soppu"] },
  { searchTerm: "vim dishwash bar", ta: ["vim soap", "vim bar", "விம் சோப்பு"] },
];

async function main() {
  for (const { searchTerm, note, ta } of TERMS) {
    const phrases = ta.map((text) => ({ language: "ta", text }));
    await prisma.listGlossaryTerm.upsert({
      where: { searchTerm },
      create: { searchTerm, note, phrases: { create: phrases } },
      update: { note, phrases: { deleteMany: {}, create: phrases } },
    });
  }
  console.log(`Seeded ${TERMS.length} glossary terms`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
