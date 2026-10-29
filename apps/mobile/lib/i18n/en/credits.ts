export const credits = {
  martlyCash: "Martly Cash",
  storeCash: (store: string) => `${store} Cash`,
  headline: (amount: string) => `₹${amount} free on your first order`,
  storeHeadline: (amount: string, store: string) => `₹${amount} free from ${store}`,
  message: (min: string, days: number) => `Use it on any order above ₹${min} within ${days} days`,
  storeMessage: (min: string, days: number, store: string) => `Use it at ${store} on orders above ₹${min} within ${days} days`,
  banner: {
    signUp: "Sign up in 30 sec",
    loginCallout: (headline: string) => `New here? ${headline}`,
  },
  saved: {
    title: "We're not in your area yet",
    body: (amount: string) => `Your ₹${amount} welcome gift is saved. It'll be waiting when we arrive.`,
  },
  reminder: {
    toSpend: (amount: string) => `₹${amount} to spend`,
    daysLeft: (n: number) => (n <= 0 ? "expires today" : n === 1 ? "1 day left" : `${n} days left`),
    addMore: (more: string, amount: string) => `Add ₹${more} more to use your ₹${amount}`,
    partial: (applied: string, more: string, amount: string) => `₹${applied} applied · add ₹${more} more to also get ₹${amount}. First order only`,
  },
  celebration: {
    eyebrow: "Welcome gift",
    free: "free to shop with",
    freeName: (name: string) => `${name} to shop with`,
    anyStore: (min: string) => `Any store · above ₹${min}`,
    atStore: (min: string) => `This store only · above ₹${min}`,
    validTill: (date: string) => `Valid till ${date}`,
    start: "Start shopping",
    a11y: "Welcome credit added to your wallet",
  },
  checkout: {
    together: "Free credit",
    loseShort: (more: string, amount: string, name: string) => `Add ₹${more} more to use your ₹${amount} ${name}. It only works on your first order`,
    lose: (amount: string) => `₹${amount} free credit can't be used after this order. It only works on your first order`,
  },
  wallet: {
    title: "Martly Cash",
    minOrder: (min: string) => `Orders above ₹${min}`,
    expires: (date: string) => `Expires ${date}`,
    onlyAt: (store: string) => `Only at ${store}`,
  },
  orderLine: "Welcome credit",
};
