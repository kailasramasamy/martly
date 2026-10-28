import { Prisma } from "../../../generated/prisma/client.js";

/** Carried / not carried / unconfirmed / hidden-suggestion counts over the rows of a LISTINGS query */
export const COUNTS = Prisma.sql`count(*)::int AS "total",
  count(*) FILTER (WHERE sp.carried IS TRUE)::int AS "carried",
  count(*) FILTER (WHERE sp.carried IS FALSE)::int AS "notCarried",
  count(*) FILTER (WHERE sp.carried IS NULL)::int AS "unchecked",
  count(*) FILTER (WHERE sp.carried IS NULL AND sp.suggested)::int AS "suggested"`;

/** Product photos for a group, best-known brands first; deduplicated and trimmed by `samples` */
export const SAMPLE_IMAGES = Prisma.sql`(array_agg(p.image_url ORDER BY COALESCE(b.popularity, 0) DESC, p.id)
  FILTER (WHERE p.image_url IS NOT NULL))[1:12] AS "sampleImages"`;

const SAMPLE_COUNT = 3;

export const samples = (urls: string[] | null) => [...new Set(urls ?? [])].slice(0, SAMPLE_COUNT);
