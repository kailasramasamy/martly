import type { WebHome, WebProductPage, WebStorePage, WebTownPage } from "@martly/shared/types"
import type { Faq } from "./content"
import { SITE_NAME, SITE_URL } from "./site"

/** schema.org graph for the home page: the brand, the site, its live stores and the FAQ */
export function homeJsonLd(home: WebHome, faq: Faq[]) {
  const stores = home.towns.flatMap((t) => t.stores.map((s) => ({ town: t, store: s })))
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/brand/app-icon.png`,
      },
      { "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: SITE_NAME, url: SITE_URL, publisher: { "@id": `${SITE_URL}/#org` }, inLanguage: "en-IN" },
      {
        "@type": "ItemList",
        name: "Stores on Martly",
        itemListElement: stores.map(({ town, store }, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "GroceryStore",
            name: store.name,
            url: `${SITE_URL}/${town.slug}/${store.slug}`,
            image: store.imageUrl ?? store.logoUrl ?? undefined,
            address: { "@type": "PostalAddress", streetAddress: store.address, addressLocality: town.name, addressRegion: town.state, addressCountry: "IN" },
          },
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  }
}

interface PageHead {
  title: string
  description: string
  path: string
  image?: string | null
  /** Search results and other pages that shouldn't be indexed */
  noindex?: boolean
  jsonLd?: object
}

/** Title, description, canonical, Open Graph and structured data for one page */
export function pageHead({ title, description, path, image, noindex, jsonLd }: PageHead) {
  const url = `${SITE_URL}${path}`
  return {
    meta: [
      { title },
      { name: "description", content: description },
      ...(noindex ? [{ name: "robots", content: "noindex, follow" }] : []),
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image ?? `${SITE_URL}/brand/app-icon.png` },
    ],
    links: noindex ? [] : [{ rel: "canonical", href: url }],
    scripts: jsonLd ? [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }] : [],
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Martly", path: "/" }, ...items].map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  }
}

/** A product with its price at the store the page shows, for rich results */
export function productJsonLd(page: WebProductPage) {
  const { product, packs, store } = page
  const prices = packs.map((p) => p.price)
  const offers = prices.length
    ? {
        "@type": "AggregateOffer",
        priceCurrency: "INR",
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offerCount: packs.length,
        availability: packs.some((p) => p.inStock) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        seller: { "@type": "GroceryStore", name: store.name },
      }
    : undefined
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        url: `${SITE_URL}/p/${product.slug}`,
        image: product.images,
        description: product.description ?? undefined,
        brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
        offers,
      },
      breadcrumbJsonLd([...product.trail, { name: product.name, path: `/p/${product.slug}` }]),
    ],
  }
}

/** A store's own address: the store as a GroceryStore, under its town */
export function storeJsonLd({ store, town }: WebStorePage, path: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "GroceryStore",
        name: store.name,
        url: `${SITE_URL}${path}`,
        image: store.imageUrl ?? store.logoUrl ?? undefined,
        address: { "@type": "PostalAddress", streetAddress: store.address, addressLocality: town.name, addressRegion: town.state, addressCountry: "IN" },
      },
      breadcrumbJsonLd([{ name: town.name, path: `/${town.slug}` }, { name: store.name, path }]),
    ],
  }
}

/** A town's page: its stores as a list, under the town */
export function townJsonLd({ town, stores }: WebTownPage) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: `Grocery stores in ${town.name}`,
        itemListElement: stores.map((store, i) => ({ "@type": "ListItem", position: i + 1, name: store.name, url: `${SITE_URL}/${town.slug}/${store.slug}` })),
      },
      breadcrumbJsonLd([{ name: town.name, path: `/${town.slug}` }]),
    ],
  }
}
