import type { WebDepartment } from "@martly/shared/types"
import { Icon } from "./icons"

export const departmentPath = (slug: string) => `/c/${slug}`

/** Every department the store stocks, as tiles into its aisles */
export function Departments({ departments }: { departments: WebDepartment[] }) {
  if (!departments.length) return null
  return (
    <section aria-labelledby="departments" className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
      <h2 id="departments" className="mb-4 text-xl font-extrabold tracking-tight sm:text-2xl">Shop by department</h2>
      <ul className="-mx-4 grid auto-cols-[23%] grid-flow-col grid-rows-2 gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-6 sm:grid-rows-none sm:gap-3 sm:px-0 lg:grid-cols-8">
        {departments.map((d) => (
          <li key={d.slug}>
            <a href={departmentPath(d.slug)} className="group block h-full rounded-2xl bg-brand-tint px-1.5 pb-2.5 pt-1.5 text-center hover:bg-teal-100 sm:px-2">
              {d.imageUrl
                ? <img src={d.imageUrl} alt="" loading="lazy" width={120} height={120} className="aspect-square w-full object-contain transition group-hover:scale-105" />
                : <span className="flex aspect-square items-center justify-center text-brand"><Icon name="basket" size={32} strokeWidth={1.5} /></span>}
              <span className="mt-1 block text-[11px] font-bold leading-tight sm:text-[13px]">{d.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
