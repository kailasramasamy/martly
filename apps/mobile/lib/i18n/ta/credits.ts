import type { credits as en } from "../en/credits";

export const credits: typeof en = {
  martlyCash: "மார்ட்லி கேஷ்",
  storeCash: (store) => `${store} கேஷ்`,
  headline: (amount) => `உங்கள் முதல் ஆர்டரில் ₹${amount} இலவசம்`,
  storeHeadline: (amount, store) => `${store} தரும் ₹${amount} இலவசம்`,
  message: (min, days) => `₹${min}-க்கு மேல் உள்ள எந்த ஆர்டரிலும் ${days} நாட்களுக்குள் பயன்படுத்தலாம்`,
  storeMessage: (min, days, store) => `${store}-இல் ₹${min}-க்கு மேல் உள்ள ஆர்டரில் ${days} நாட்களுக்குள் பயன்படுத்தலாம்`,
  banner: {
    signUp: "30 விநாடியில் பதிவு செய்யுங்கள்",
    loginCallout: (headline) => `புதியவரா? ${headline}`,
  },
  saved: {
    title: "உங்கள் பகுதிக்கு நாங்கள் இன்னும் வரவில்லை",
    body: (amount) => `உங்கள் ₹${amount} வரவேற்பு பரிசு சேமிக்கப்பட்டுள்ளது. நாங்கள் வரும்போது அது காத்திருக்கும்.`,
  },
  reminder: {
    toSpend: (amount) => `செலவழிக்க ₹${amount}`,
    daysLeft: (n) => (n <= 0 ? "இன்றுடன் முடிகிறது" : `${n} நாள் உள்ளது`),
    addMore: (more, amount) => `உங்கள் ₹${amount}-ஐப் பயன்படுத்த இன்னும் ₹${more} சேர்க்கவும்`,
    partial: (applied, more, amount) => `₹${applied} பயன்படுத்தப்பட்டது · மேலும் ₹${amount} பெற இன்னும் ₹${more} சேர்க்கவும். முதல் ஆர்டருக்கு மட்டும்`,
  },
  celebration: {
    eyebrow: "வரவேற்பு பரிசு",
    free: "இலவசமாக ஷாப்பிங் செய்ய",
    freeName: (name) => `${name} ஷாப்பிங் செய்ய`,
    anyStore: (min) => `எந்தக் கடையிலும் · ₹${min}-க்கு மேல் உள்ள ஆர்டர்கள்`,
    atStore: (min) => `இந்தக் கடையில் மட்டும் · ₹${min}-க்கு மேல் உள்ள ஆர்டர்கள்`,
    validTill: (date) => `${date} வரை செல்லும்`,
    start: "ஷாப்பிங் தொடங்குங்கள்",
    a11y: "வரவேற்பு கிரெடிட் உங்கள் வாலெட்டில் சேர்க்கப்பட்டது",
  },
  checkout: {
    together: "இலவச கிரெடிட்",
    loseShort: (more, amount, name) => `உங்கள் ₹${amount} ${name}-ஐப் பயன்படுத்த இன்னும் ₹${more} சேர்க்கவும். இது முதல் ஆர்டருக்கு மட்டுமே`,
    lose: (amount) => `₹${amount} இலவச கிரெடிட்டை இந்த ஆர்டருக்குப் பிறகு பயன்படுத்த முடியாது. இது முதல் ஆர்டருக்கு மட்டுமே`,
  },
  wallet: {
    title: "மார்ட்லி கேஷ்",
    minOrder: (min) => `₹${min}-க்கு மேல் உள்ள ஆர்டர்கள்`,
    expires: (date) => `${date} வரை`,
    onlyAt: (store) => `${store}-இல் மட்டும்`,
  },
  orderLine: "வரவேற்பு கிரெடிட்",
};
