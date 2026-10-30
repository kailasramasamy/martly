import { Prisma } from "../../../generated/prisma/client.js";
import { brandPopularitySql } from "../brand-popularity.js";

/** Carried / not carried / unconfirmed / hidden-suggestion counts over the rows of a LISTINGS query */
export const COUNTS = Prisma.sql`count(*)::int AS "total",
  count(*) FILTER (WHERE sp.carried IS TRUE)::int AS "carried",
  count(*) FILTER (WHERE sp.carried IS FALSE)::int AS "notCarried",
  count(*) FILTER (WHERE sp.carried IS NULL)::int AS "unchecked",
  count(*) FILTER (WHERE sp.carried IS NULL AND sp.suggested)::int AS "suggested"`;

/** Product photos for a group, brands best known in the store's region first; deduplicated and trimmed by `samples` */
export const sampleImages = (region: string | null) => Prisma.sql`(array_agg(p.image_url ORDER BY ${brandPopularitySql(region)} DESC, p.id)
  FILTER (WHERE p.image_url IS NOT NULL))[1:12] AS "sampleImages"`;

const SAMPLE_COUNT = 3;

export const samples = (urls: string[] | null) => [...new Set(urls ?? [])].slice(0, SAMPLE_COUNT);
