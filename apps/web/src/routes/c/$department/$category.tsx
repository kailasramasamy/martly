import { createFileRoute, notFound } from "@tanstack/react-router"
import type { WebCategoryPage } from "@martly/shared/types"
import { getCategory } from "~/lib/api"
import { breadcrumbJsonLd, pageHead } from "~/lib/seo"
import { Breadcrumbs, ShopLayout } from "~/components/shop-layout"
import { ProductGrid } from "~/components/product-card"
import { departmentPath } from "~/components/departments"
import { listHref, pageParam, Pager } from "~/components/list-page"

interface Search {
  sub?: string
  page?: number
}

const categoryPath = (page: Pick<WebCategoryPage, "department" | "category">) => `${departmentPath(page.department.slug)}/${page.category.slug}`

export const Route = createFileRoute("/c/$department/$category")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    sub: typeof search.sub === "string" ? search.sub : undefined,
    page: pageParam(search.page),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const page = await getCategory({ data: { ...params, ...deps } })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData }) => {
    if (!loaderData) return pageHead({ title: "Not found | Martly", description: "", path: "/", noindex: true })
    const { category, department, store, subcategory, subcategories, page } = loaderData
    const base = categoryPath(loaderData)
    const sub = subcategories.find((s) => s.slug === subcategory)
    const name = sub?.name ?? category.name
    return pageHead({
      title: `${name}${page > 1 ? ` (page ${page})` : ""}: buy online in ${store.town.name} | Martly`,
      description: `Order ${name.toLowerCase()} online from ${store.name}, ${store.town.name}. Every brand and pack size the store stocks, at its own prices.`,
      path: listHref(base, { sub: subcategory ?? undefined, page }),
      image: category.imageUrl,
      jsonLd: {
        "@context": "https://schema.org",
        ...breadcrumbJsonLd([{ name: department.name, path: departmentPath(department.slug) }, { name: category.name, path: base }]),
      },
    })
  },
  component: CategoryPage,
})

function SubcategoryChips({ page, base }: { page: WebCategoryPage; base: string }) {
  const chip = "flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold"
  const on = "border-brand bg-brand text-white"
  const off = "border-line hover:border-brand hover:text-brand"
  return (
    <ul className="mt-5 flex gap-2 overflow-x-auto pb-1">
      <li><a href={base} className={`${chip} ${page.subcategory ? off : on}`}>All</a></li>
      {page.subcategories.map((s) => (
        <li key={s.slug}>
          <a href={listHref(base, { sub: s.slug })} className={`${chip} ${s.slug === page.subcategory ? on : off}`}>
            {s.name} <span className="ml-1.5 font-semibold opacity-70">{s.count}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function CategoryPage() {
  const page = Route.useLoaderData()
  const base = categoryPath(page)
  return (
    <ShopLayout store={page.store}>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: page.department.name, path: departmentPath(page.department.slug) }, { name: page.category.name }]} />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{page.category.name}</h1>
        <SubcategoryChips page={page} base={base} />
        <div className="mt-6">
          {page.products.length
            ? <ProductGrid products={page.products} />
            : <p className="py-16 text-center text-muted">Nothing here at {page.store.name} right now.</p>}
        </div>
        <Pager page={page.page} totalPages={page.totalPages} href={(n) => listHref(base, { sub: page.subcategory ?? undefined, page: n })} />
      </div>
    </ShopLayout>
  )
}
