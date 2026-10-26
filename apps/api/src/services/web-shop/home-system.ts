import type { DayPart } from "@martly/shared/constants";
import type { HomeSection, HomeTheme, WebBanner, WebHomeSection } from "@martly/shared/types";
import { bannerHref, type LinkBook } from "./links.js";
import type { BrandRail, Cards } from "./home-sections.js";

type Base = { id: string; title: string | null; subtitle: string | null; href: string | null };
type Data = Record<string, unknown>;

interface FestiveData {
  heroes: { id: string; title: string; kicker: string | null; subtitle: string | null; imageUrl: string; theme: HomeTheme; tiles: { id: string; title: string; imageUrl: string }[] }[];
}
interface BannerData {
  banners: { id: string; title: string; subtitle: string | null; imageUrl: string; textInImage: boolean; actionType: string | null; actionTarget: string | null }[];
}
interface DepartmentData { departments: { id: string; name: string; imageUrl: string | null }[] }
interface TimePicksData { period: DayPart; categories: { id: string; name: string; products: unknown[] }[] }

function festive(data: Data, links: LinkBook) {
  return (data as unknown as FestiveData).heroes.flatMap((h) => {
    const href = links.collection(h.id);
    if (!href) return [];
    const tiles = h.tiles.map((t) => ({ label: t.title, imageUrl: t.imageUrl, href: `${href}?tile=${t.id}` }));
    return [{ id: h.id, title: h.title, kicker: h.kicker, subtitle: h.subtitle, imageUrl: h.imageUrl, theme: h.theme, href, tiles }];
  });
}

function banners(data: Data, links: LinkBook): WebBanner[] {
  return (data as unknown as BannerData).banners.map((b) => ({
    id: b.id, title: b.title, subtitle: b.subtitle, imageUrl: b.imageUrl, textInImage: b.textInImage, href: bannerHref(links, b),
  }));
}

/**
 * The app's built-in blocks the website can show to a guest. Blocks tied to an account or an app-only feature
 * (membership, monthly list, buy again, coupons, recently viewed, store walk, recipes, store posts) are left out.
 */
export function systemSection<P>(s: HomeSection<unknown>, links: LinkBook, cards: Cards<P>, base: Base, brands: BrandRail): WebHomeSection<P> | null {
  if (!("data" in s)) return null;
  const data = s.data;
  switch (s.type) {
    case "FESTIVE_HERO": {
      const slides = festive(data, links);
      return slides.length ? { ...base, type: s.type, slides } : null;
    }
    case "HERO_BANNERS":
    case "BRAND_POSTERS":
      return { ...base, type: s.type, banners: banners(data, links) };
    case "DEPARTMENT_GRID": {
      const tiles = (data as unknown as DepartmentData).departments.flatMap((d) => {
        const href = links.category(d.id);
        return href ? [{ label: d.name, imageUrl: d.imageUrl, href }] : [];
      });
      return { ...base, type: s.type, tiles };
    }
    case "BRAND_RAIL": {
      const rail = brands.flatMap((b) => {
        const href = links.brand(b.id);
        return href ? [{ label: b.name, imageUrl: b.imageUrl, themeColor: b.themeColor, href }] : [];
      });
      return rail.length ? { ...base, type: s.type, brands: rail } : null;
    }
    case "TIME_PICKS": {
      const { period, categories } = data as unknown as TimePicksData;
      const picks = categories.flatMap((c) => {
        const href = links.category(c.id);
        return href ? [{ label: c.name, imageUrl: null, href, products: cards(c.products) }] : [];
      });
      return picks.length ? { ...base, type: s.type, dayPart: period, categories: picks } : null;
    }
    case "DEALS": {
      const products = cards((data as { products: unknown[] }).products);
      return { ...base, href: null, type: s.type, products, total: products.length };
    }
    default:
      return null;
  }
}
