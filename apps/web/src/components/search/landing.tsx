import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import type { CollectionKind } from "@martly/shared/constants"
import type { WebSearchLanding } from "@martly/shared/types"
import { clearRecentSearches, removeRecentSearch, useRecentSearches } from "~/lib/recent-searches"
import { ProductRail, SeeAll } from "../shelf"
import { Art } from "../home/parts"
import { Icon, type IconName } from "../icons"

// The app's spotlight looks: festivals warm, seasons cool, a store's own range bakery-warm
const THEMES: Partial<Record<CollectionKind, { from: string; to: string; accent: string; ink: string; kicker: string }>> = {
  OCCASION: { from: "#fff7ed", to: "#ffedd5", accent: "#c2410c", ink: "#431407", kicker: "Festive picks" },
  SEASON: { from: "#f0fdfa", to: "#e0f2fe", accent: "#0f766e", ink: "#083344", kicker: "In season" },
  STORE_SPECIAL: { from: "#f8d3a8", to: "#fff8ef", accent: "#9a4a12", ink: "#3b1d08", kicker: "Made at" },
}

function LandingSection({ title, subtitle, icon, action, children }: {
  title: string; subtitle?: string; icon?: IconName; action?: ReactNode; children: ReactNode
}) {
  return (
    <section className="pt-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight sm:text-xl">{icon && <Icon name={icon} size={18} className="text-brand" />}{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function QueryChips({ queries, icon, onRemove }: { queries: string[]; icon: IconName; onRemove?: (q: string) => void }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {queries.map((q) => (
        <li key={q} className="flex h-11 items-center rounded-full border border-line bg-white text-sm font-semibold hover:border-brand">
          <Link to="/search" search={{ q }} className={`flex h-full items-center gap-2 pl-4 ${onRemove ? "pr-1" : "pr-4"} hover:text-brand`}>
            <Icon name={icon} size={15} className="text-muted" />{q}
          </Link>
          {onRemove && (
            <button type="button" onClick={() => onRemove(q)} aria-label={`Remove ${q} from recent searches`} className="flex h-11 w-10 items-center justify-center text-slate-400 hover:text-ink">
              <Icon name="close" size={15} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function Spotlight({ occasion, storeName }: { occasion: WebSearchLanding["occasions"][number]; storeName: string }) {
  const theme = THEMES[occasion.kind] ?? THEMES.OCCASION!
  const kicker = occasion.kind === "STORE_SPECIAL" ? `${theme.kicker} ${storeName}` : theme.kicker
  return (
    <section className="-mx-4 mt-8 px-4 py-5 sm:mx-0 sm:rounded-3xl sm:px-6" style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})`, color: theme.ink }}>
      <div className="mb-4 flex items-center gap-4">
        {occasion.imageUrl && <img src={occasion.imageUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: theme.accent }}>{kicker}</p>
          <h2 className="text-xl font-extrabold tracking-tight">{occasion.title}</h2>
          {occasion.subtitle && <p className="text-sm opacity-80">{occasion.subtitle}</p>}
        </div>
        <SeeAll href={occasion.href} label="Shop all" className="hidden sm:flex" />
      </div>
      {occasion.aisles.length > 1 && (
        <ul className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {occasion.aisles.map((a) => (
            <li key={a.href} className="shrink-0">
              <a href={a.href} className="flex h-10 items-center gap-1 rounded-full border bg-white/70 px-4 text-sm font-bold hover:bg-white" style={{ borderColor: `${theme.accent}33` }}>
                {a.label}<Icon name="chevron" size={13} className="-rotate-90" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <ProductRail products={occasion.products} />
      <SeeAll href={occasion.href} label="Shop all" className="mt-3 sm:hidden" />
    </section>
  )
}

/** /search before anything is typed: recent and trending searches, spotlights, time-of-day picks, popular categories */
export function SearchLandingView({ landing }: { landing: WebSearchLanding }) {
  const recent = useRecentSearches()
  const { timePicks } = landing
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Search {landing.store.name}</h1>
      {recent.length > 0 && (
        <LandingSection title="Recent searches" icon="clock" action={<button type="button" onClick={clearRecentSearches} className="h-11 text-sm font-extrabold text-brand hover:text-brand-deep">Clear</button>}>
          <QueryChips queries={recent} icon="clock" onRemove={removeRecentSearch} />
        </LandingSection>
      )}
      {landing.trending.length > 0 && (
        <LandingSection title="Trending near you" icon="trending"><QueryChips queries={landing.trending} icon="search" /></LandingSection>
      )}
      {landing.occasions.map((o) => <Spotlight key={o.href} occasion={o} storeName={landing.store.name} />)}
      {timePicks.products.length > 0 && (
        <LandingSection title={timePicks.title} subtitle="Picked for this time of day" icon="clock"><ProductRail products={timePicks.products} /></LandingSection>
      )}
      {landing.categories.length > 0 && (
        <LandingSection title="Popular categories" icon="grid">
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {landing.categories.map((c) => (
              <li key={c.href}>
                <a href={c.href} className="group flex flex-col items-center gap-2 rounded-2xl bg-surface p-3 text-center text-[13px] font-bold leading-tight hover:text-brand">
                  <Art src={c.imageUrl} className="aspect-square w-full rounded-xl transition group-hover:scale-[1.03]" />
                  <span className="line-clamp-2">{c.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </LandingSection>
      )}
    </>
  )
}
