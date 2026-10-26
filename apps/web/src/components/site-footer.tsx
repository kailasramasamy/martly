import type { WebTown } from "@martly/shared/types"
import { LINKS } from "~/lib/site"
import { storePath } from "./stores-section"

const HELP = [
  { label: "For store owners", href: "/for-stores" },
  { label: "Support", href: LINKS.support },
  { label: "Privacy policy", href: LINKS.privacy },
  { label: "Terms of use", href: LINKS.terms },
  { label: "Delete account", href: LINKS.deleteAccount },
]

export function SiteFooter({ towns }: { towns: WebTown[] }) {
  return (
    <footer className="bg-ink text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-10 pt-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <img src="/brand/wordmark-white.svg" alt="Martly" width={84} height={34} loading="lazy" className="h-8 w-auto" />
          <p className="mt-4 text-sm leading-relaxed">Local stores, online. Made in Dharmapuri.</p>
        </div>
        {towns.map((t) => (
          <nav key={t.slug} aria-label={`Stores in ${t.name}`}>
            <h2 className="mb-3 text-sm font-extrabold text-white">Stores in {t.name}</h2>
            {t.stores.map((s) => (
              <a key={s.slug} href={storePath(t, s)} className="block py-1.5 text-sm hover:text-white">{s.name}</a>
            ))}
          </nav>
        ))}
        <nav aria-label="Help">
          <h2 className="mb-3 text-sm font-extrabold text-white">Help</h2>
          {HELP.map((l) => <a key={l.label} href={l.href} className="block py-1.5 text-sm hover:text-white">{l.label}</a>)}
        </nav>
      </div>
      <div className="mx-auto max-w-7xl border-t border-slate-800 px-4 py-6 text-[13px] text-slate-400 sm:px-6">
        © {new Date().getFullYear()} Martly · martlyshop.in
      </div>
    </footer>
  )
}
