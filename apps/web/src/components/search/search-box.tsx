import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import type { WebSuggestion } from "@martly/shared/types"
import { getSuggestions } from "~/lib/api"
import { recordAd, useAdView } from "~/lib/ad-events"
import { useRecentSearches } from "~/lib/recent-searches"
import { Icon } from "../icons"

const MAX_RECENT_MATCHES = 2
const DEBOUNCE_MS = 200

interface Row { text: string; imageUrl: string | null; recent: boolean; adBannerId?: string }

/** Recent searches that start with the text come first, as in the app, then the API's suggestions */
function suggestionRows(query: string, suggestions: WebSuggestion[], recent: string[]): Row[] {
  const q = query.trim().toLowerCase()
  if (!q) return recent.map((text) => ({ text, imageUrl: null, recent: true }))
  const recentRows = recent
    .filter((r) => r.toLowerCase().startsWith(q) && r.toLowerCase() !== q)
    .slice(0, MAX_RECENT_MATCHES)
    .map((text) => ({ text, imageUrl: null, recent: true }))
  const taken = new Set(recentRows.map((r) => r.text.toLowerCase()))
  return [...recentRows, ...suggestions.filter((s) => !taken.has(s.text.toLowerCase())).map((s) => ({ ...s, recent: false }))]
}

/** Suggestions for the text as typed, after a pause; a late answer for older text is dropped */
function useSuggestions(text: string) {
  const [suggestions, setSuggestions] = useState<WebSuggestion[]>([])
  useEffect(() => {
    const q = text.trim()
    if (q.length < 2) return setSuggestions([])
    let current = true
    const timer = setTimeout(() => {
      void getSuggestions({ data: { q } }).then((rows) => { if (current) setSuggestions(rows) })
    }, DEBOUNCE_MS)
    return () => { current = false; clearTimeout(timer) }
  }, [text])
  return suggestions
}

// What the shopper typed stays regular and the rest is bold ("Milk|shake", "Liquid Detergent")
function Highlighted({ text, query }: { text: string; query: string }) {
  const typed = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return (
    <span className="truncate text-[15px] text-slate-700">
      {text.split(" ").map((w, i) => {
        const prefix = typed.filter((t) => w.toLowerCase().startsWith(t)).sort((a, b) => b.length - a.length)[0] ?? ""
        return <span key={i}>{i > 0 && " "}{w.slice(0, prefix.length)}<b className="font-bold text-ink">{w.slice(prefix.length)}</b></span>
      })}
    </span>
  )
}

function SuggestionRow({ row, query, storeId, active, id, onPick, onFill }: {
  row: Row; query: string; storeId: string; active: boolean; id: string; onPick: () => void; onFill: () => void
}) {
  useAdView(storeId, row.adBannerId)
  const pick = () => {
    if (row.adBannerId) recordAd(storeId, { bannerId: row.adBannerId, type: "TAP" })
    onPick()
  }
  return (
    <li id={id} role="option" aria-selected={active} className={`flex items-center ${active ? "bg-brand-tint" : "hover:bg-surface"}`}>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={pick} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-muted">
          {row.imageUrl ? <img src={row.imageUrl} alt="" className="h-full w-full object-contain" /> : <Icon name={row.recent ? "clock" : "search"} size={18} />}
        </span>
        <Highlighted text={row.text} query={query} />
        {row.adBannerId && <span className="shrink-0 rounded border border-line px-1 text-[10px] font-bold text-muted">Ad</span>}
      </button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onFill} aria-label={`Edit search as ${row.text}`} className="flex h-12 w-12 shrink-0 items-center justify-center text-slate-400 hover:text-brand">
        <Icon name="fill" size={20} />
      </button>
    </li>
  )
}

function SuggestionList({ id, rows, query, storeId, active, onPick, onFill }: {
  id: string; rows: Row[]; query: string; storeId: string; active: number; onPick: (text: string) => void; onFill: (text: string) => void
}) {
  return (
    <ul id={id} role="listbox" aria-label={query.trim() ? "Suggestions" : "Recent searches"} className="absolute inset-x-0 top-[52px] z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-white py-2 shadow-xl shadow-slate-200/80">
      {rows.map((row, i) => (
        <SuggestionRow key={`${row.recent}-${row.text}`} id={`${id}-${i}`} row={row} query={query} storeId={storeId} active={i === active} onPick={() => onPick(row.text)} onFill={() => onFill(row.text)} />
      ))}
    </ul>
  )
}

/** Header search with the app's typeahead: recents, suggestions with pictures and ads, ↑/↓/Enter/Esc */
export function SearchBox({ q = "", storeId, className }: { q?: string; storeId: string | undefined; className: string }) {
  const [text, setText] = useState(q)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const navigate = useNavigate()
  const recent = useRecentSearches()
  const suggestions = useSuggestions(open ? text : "")
  const rows = suggestionRows(text, suggestions, recent)
  const showing = open && rows.length > 0 && !!storeId

  const search = (query: string) => {
    const term = query.trim()
    if (!term) return
    setText(term)
    setOpen(false)
    input.current?.blur()
    void navigate({ to: "/search", search: { q: term } })
  }
  const fill = (value: string) => { setText(`${value} `); setActive(-1); input.current?.focus() }
  const type = (value: string) => { setText(value); setActive(-1); setOpen(true) }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return setOpen(false)
    if (!showing || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return
    e.preventDefault()
    // -1 is the box itself, so the keys cycle box → rows → box
    const step = e.key === "ArrowDown" ? 1 : -1
    setActive((i) => ((i + 1 + step + rows.length + 1) % (rows.length + 1)) - 1)
  }

  return (
    <form action="/search" role="search" className={`relative ${className}`} onSubmit={(e) => { e.preventDefault(); search(active >= 0 && rows[active] ? rows[active].text : text) }}>
      <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-brand focus-within:bg-white">
        <Icon name="search" size={18} className="shrink-0 text-muted" />
        <input
          ref={input} name="q" value={text} type="search" autoComplete="off" placeholder="Search atta, milk, soap…" aria-label="Search products"
          role="combobox" aria-expanded={showing} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => type(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
        />
      </label>
      {showing && storeId && <SuggestionList id={listId} rows={rows} query={text} storeId={storeId} active={active} onPick={search} onFill={fill} />}
    </form>
  )
}
