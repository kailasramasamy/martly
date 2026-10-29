import { getHomeSections } from "~/lib/api"

/** Home for a store: the shopper's (from the cookie) or the one a store page names. Two pages of sections come with the
 *  HTML, so the hero and the first rows are there for search engines and first paint */
export async function loadHomePage(store?: { id: string; town: string }) {
  const first = await getHomeSections({ data: { store } })
  if (!first) return null
  const second = first.nextCursor ? await getHomeSections({ data: { cursor: first.nextCursor, store } }) : null
  const sections = [...first.sections, ...(second?.sections ?? [])]
  // The store's own banners lead the page, under its header, instead of where the layout puts them
  const covers = sections.find((s) => s.type === "HERO_BANNERS")
  return {
    store: first.store,
    profile: first.profile,
    covers: covers?.type === "HERO_BANNERS" ? covers.banners : [],
    sections: sections.filter((s) => s !== covers),
    cursor: (second ?? first).nextCursor,
  }
}

export type HomePageData = NonNullable<Awaited<ReturnType<typeof loadHomePage>>>
