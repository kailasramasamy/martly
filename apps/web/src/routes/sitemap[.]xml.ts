import { createFileRoute } from "@tanstack/react-router"
import { getHome, getSitemap } from "~/lib/api"
import { SITE_URL } from "~/lib/site"

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [home, shop] = await Promise.all([getHome(), getSitemap()])
        const entries: [string, string?][] = [
          ["/"],
          ["/for-stores"],
          ["/for-stores/pricing"],
          ...home.towns.flatMap((t): [string][] => [[`/${t.slug}`], ...t.stores.map((s): [string] => [`/${t.slug}/${s.slug}`])]),
          ...shop.departments.map((d): [string] => [`/c/${d}`]),
          ...shop.categories.map((c): [string] => [`/c/${c.department}/${c.slug}`]),
          ...shop.collections.map((slug): [string] => [`/collections/${slug}`]),
          ["/brands"],
          ...shop.brands.map((slug): [string] => [`/brands/${slug}`]),
          ...shop.products.map((p): [string, string] => [`/p/${p.slug}`, p.updatedAt.slice(0, 10)]),
        ]
        const urls = entries.map(([path, lastmod]) => `  <url><loc>${SITE_URL}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("\n")
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } })
      },
    },
  },
})
