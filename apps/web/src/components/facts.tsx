import { facts } from "~/lib/content"
import { Icon } from "./icons"

export function Facts() {
  return (
    <section aria-label="Why Martly" className="border-b border-line">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-6 px-4 py-7 sm:px-6 lg:grid-cols-4">
        {facts.map((f) => (
          <li key={f.title} className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
              <Icon name={f.icon} size={21} />
            </span>
            <span>
              <span className="block text-[15px] font-bold leading-snug">{f.title}</span>
              <span className="hidden text-[13px] text-muted sm:block">{f.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
