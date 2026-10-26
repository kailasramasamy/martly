import { useState, type FormEvent } from "react"
import type { WebTown } from "@martly/shared/types"
import { LINKS } from "~/lib/site"
import { Icon } from "./icons"

function matchTown(towns: WebTown[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  return towns.find((t) => [t.name, t.slug, t.district].some((v) => v.toLowerCase().startsWith(q)))
}

/** Town search in the hero: a live town opens its stores below, any other town gets a "not here yet" note */
export function TownFinder({ towns, onPick }: { towns: WebTown[]; onPick: (slug: string) => void }) {
  const [query, setQuery] = useState("")
  const [missing, setMissing] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const town = matchTown(towns, query)
    if (!town) {
      setMissing(query.trim() || null)
      return
    }
    setMissing(null)
    onPick(town.slug)
    document.getElementById("stores")?.scrollIntoView()
  }

  return (
    <div id="find" className="scroll-mt-24">
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-2 rounded-[20px] bg-white p-2.5 shadow-2xl shadow-brand-ink/40 sm:flex-row">
        <label htmlFor="town" className="sr-only">Your town</label>
        <div className="flex flex-1 items-center gap-2.5 px-3">
          <Icon name="pin" size={20} className="shrink-0 text-brand" />
          <input
            id="town"
            list="live-towns"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your town"
            autoComplete="address-level2"
            className="h-12 min-w-0 flex-1 bg-transparent text-[17px] font-medium text-ink outline-none placeholder:text-slate-400"
          />
          <datalist id="live-towns">
            {towns.map((t) => <option key={t.slug} value={t.name} />)}
          </datalist>
        </div>
        <button type="submit" className="h-[52px] rounded-[14px] bg-amber px-7 text-base font-extrabold text-amber-ink hover:bg-amber-300">
          Find stores
        </button>
      </form>
      {missing && (
        <p role="status" className="mt-4 max-w-xl rounded-2xl bg-brand-deep px-4 py-3 text-[15px] leading-relaxed text-teal-50">
          Martly isn't in {missing} yet.{" "}
          <a href={LINKS.contact} className="font-bold text-amber underline-offset-2 hover:underline">Ask your local store to join</a>
          {towns.length > 0 && <> or shop in {towns.map((t) => t.name).join(", ")}.</>}
        </p>
      )}
    </div>
  )
}
