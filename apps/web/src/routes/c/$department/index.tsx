import { createFileRoute, notFound } from "@tanstack/react-router"
import { getDepartment } from "~/lib/api"
import { breadcrumbJsonLd, pageHead } from "~/lib/seo"
import { Breadcrumbs, ShopLayout } from "~/components/shop-layout"
import { Shelf } from "~/components/shelf"
import { departmentPath } from "~/components/departments"

export const Route = createFileRoute("/c/$department/")({
  loader: async ({ params }) => {
    const page = await getDepartment({ data: params })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return pageHead({ title: "Not found | Martly", description: "", path: "/", noindex: true })
    const { department, store } = loaderData
    const names = department.categories.slice(0, 4).map((c) => c.name.toLowerCase()).join(", ")
    const path = departmentPath(params.department)
    return pageHead({
      title: `${department.name} online in ${store.town.name} | Martly`,
      description: `Buy ${department.name.toLowerCase()} online from ${store.name}, ${store.town.name}: ${names} and more, packed and delivered by the store.`,
      path,
      image: department.imageUrl,
      jsonLd: { "@context": "https://schema.org", ...breadcrumbJsonLd([{ name: department.name, path }]) },
    })
  },
  component: DepartmentPage,
})

function DepartmentPage() {
  const { store, department, shelves } = Route.useLoaderData()
  return (
    <ShopLayout store={store}>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: department.name }]} />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{department.name}</h1>
        <ul className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {department.categories.map((c) => (
            <li key={c.slug} className="shrink-0">
              <a href={`${departmentPath(department.slug)}/${c.slug}`} className="flex h-11 items-center whitespace-nowrap rounded-full border border-line px-4 text-sm font-bold hover:border-brand hover:text-brand">{c.name}</a>
            </li>
          ))}
        </ul>
      </div>
      {shelves.map((s) => <Shelf key={s.path} id={s.path} title={s.name} path={s.path} products={s.products} />)}
    </ShopLayout>
  )
}
