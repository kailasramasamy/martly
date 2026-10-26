/** Mirrors storeSlugSchema in @martly/shared */
export const STORE_SLUG_RULE = {
  pattern: /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])$/,
  message: "2–30 lowercase letters, numbers or hyphens, starting and ending with a letter or number",
};
