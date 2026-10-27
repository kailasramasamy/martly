import { createFileRoute, notFound } from "@tanstack/react-router"
import type { WebCategoryPage } from "@martly/shared/types"
import { getCategory } from "~/lib/api"
import { breadcrumbJsonLd, pageHead } from "~/lib/seo"
import { Breadcrumbs, ShopLayout } from "~/components/shop-layout"
import { departmentPath } from "~/components/departments"
import { listHref } from "~/components/list-page"
import { FilteredListView, isFilteredView, listSearch } from "~/components/category/filtered-list"
const categoryPath = (page: Pick<WebCategoryPage, "department" | "category">) => `${departmentPath(page.department.slug)}/${page.category.slug}`

export const Route = createFileRoute("/c/$department/$category")({
  validateSearch: listSearch,
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
      // A filtered or sorted view is the same shelf again; only the plain category and its subcategories are indexed
      noindex: isFilteredView(loaderData),
      jsonLd: {
        "@context": "https://schema.org",
        ...breadcrumbJsonLd([{ name: department.name, path: departmentPath(department.slug) }, { name: category.name, path: base }]),
      },
    })
  },
  component: CategoryPage,
})

function CategoryPage() {
  const page = Route.useLoaderData()
  return (
    <ShopLayout store={page.store}>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: page.department.name, path: departmentPath(page.department.slug) }, { name: page.category.name }]} />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{page.category.name}</h1>
        <FilteredListView list={page} route="/c/$department/$category" base={categoryPath(page)} allLabel={`All ${page.category.name}`} empty={`Nothing here at ${page.store.name} right now.`} />
      </div>
    </ShopLayout>
  )
}
