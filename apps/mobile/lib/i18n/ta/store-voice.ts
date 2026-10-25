import type { Strings } from "../index";

export const storeVoice: Strings<"storeVoice"> = {
  fromTheShop: "கடையிலிருந்து",
  byline: (name: string, when: string) => `${name}, உரிமையாளர் · ${when}`,
  ownerOf: (name: string, store: string) => `${name}, ${store}`,
  kind: { FRESH_TODAY: "இன்று புதிது", NEW_IN_STORE: "கடையில் புதிது", BACK_IN_STOCK: "மீண்டும் வந்தது" },
  headline: { FRESH_TODAY: "இப்போது வந்தது", NEW_IN_STORE: "கடைக்குப் புதிது", BACK_IN_STOCK: "மீண்டும் அலமாரியில்" },
  atStore: (store: string) => `${store} கடையில்`,
  saidBy: (name: string) => `${name}, உரிமையாளர்`,
  moreThisWeek: (n: number) => `இந்த வாரம் கடையிலிருந்து மேலும் ${n}`,
  seeAll: "கடையிலிருந்து எல்லாம் பாருங்கள்",
  boardSubtitle: "என்ன வந்தது, உரிமையாளர் எதைப் பரிந்துரைக்கிறார்",
  add: (name: string) => `${name} சேர்`,
  today: "இன்று",
  yesterday: "நேற்று",
  noPosts: "இந்த வாரம் கடையிலிருந்து புதிதாக எதுவும் இல்லை.",
  loadFailed: "கடையின் பதிவுகளை ஏற்ற முடியவில்லை. இணைப்பைச் சரிபாருங்கள்.",
  retry: "மீண்டும் முயலுங்கள்",
  ownersPick: "உரிமையாளர் தேர்வு",
  ownerRecommends: "உரிமையாளர் பரிந்துரை",
};
