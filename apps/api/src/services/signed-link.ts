import crypto from "crypto";

const LINK_TTL_MS = 15 * 60 * 1000;
const secret = () => process.env.JWT_SECRET ?? "dev-secret-change-me";
const sign = (kind: string, id: string, expires: number) => crypto.createHmac("sha256", secret()).update(`${kind}:${id}:${expires}`).digest("hex");

/** Query string that lets a document open in any browser for 15 minutes, so apps can hand it to the system browser */
export function signedQuery(kind: string, id: string) {
  const expires = Date.now() + LINK_TTL_MS;
  return `expires=${expires}&sig=${sign(kind, id, expires)}`;
}

export function signatureValid(kind: string, id: string, expires: number, sig: string) {
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = Buffer.from(sign(kind, id, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
