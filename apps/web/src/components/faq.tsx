import type { Faq } from "~/lib/content"
import { Icon } from "./icons"

export function FaqSection({ items }: { items: Faq[] }) {
  return (
    <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 py-24 sm:px-6 sm:py-28">
      <h2 id="faq-title" className="mb-4 text-3xl font-extrabold tracking-tight sm:text-[34px]">Questions people ask</h2>
      {items.map((f) => (
        <details key={f.q} className="group border-b border-line py-5">
          <summary className="flex items-center justify-between gap-4 text-lg font-bold">
            {f.q}
            <Icon name="plus" size={22} className="shrink-0 text-brand transition group-open:rotate-45" />
          </summary>
          <p className="mt-3 text-base leading-relaxed text-slate-600">{f.a}</p>
        </details>
      ))}
    </section>
  )
}
