import { useEffect, useRef } from "react"
import { useLoaderData, useLocation } from "@tanstack/react-router"
import { departmentPath } from "./departments"

/** The store's departments in one sideways row under the header, the page's own department filled in */
export function DepartmentBar() {
  const { departments } = useLoaderData({ from: "__root__" })
  const current = useLocation({ select: (l) => l.pathname.match(/^\/c\/([^/]+)/)?.[1] })
  const active = useRef<HTMLAnchorElement>(null)
  useEffect(() => { active.current?.scrollIntoView({ block: "nearest", inline: "center" }) }, [current])
  if (!departments.length) return null

  const pill = "flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border pl-1.5 pr-4 text-sm font-bold"
  return (
    <nav aria-label="Departments" className="border-b border-line bg-white">
      <ul className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6">
        {departments.map((d) => {
          const on = d.slug === current
          return (
            <li key={d.slug} className="shrink-0">
              <a href={departmentPath(d.slug)} ref={on ? active : undefined} aria-current={on ? "page" : undefined}
                className={`${pill} ${on ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand hover:text-brand"} ${d.imageUrl ? "" : "pl-4"}`}>
                {d.imageUrl && <img src={d.imageUrl} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 rounded-full bg-white object-contain" />}
                {d.name}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
