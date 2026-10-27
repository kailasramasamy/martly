import { useEffect, useRef, useState } from "react"
import type { WebHeroCard, WebHomeSection, WebProductCard } from "@martly/shared/types"
import { rupees } from "~/lib/format"
import { AddButton, productPath, usePack } from "../product-card"
import { Icon } from "../icons"
import { Art } from "./parts"

type Card = WebHeroCard<WebProductCard>
const ROTATE_MS = 5000
const LINES = 4

/** The title band, a lighter shade of the card, with its "See all" on the top line; a festival's strip art is blended into it */
function Head({ card }: { card: Card }) {
  const art = card.kind === "FESTIVE" ? card.imageUrl : null
  const badge = card.kind === "STORE_SPECIAL" && card.imageUrl
  return (
    <div className="relative -mx-3.5 -mt-3.5 mb-3 shrink-0 overflow-hidden px-3.5 pb-3 pt-3" style={{ background: card.theme.tintSoft }}>
      {art && (
        <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-multiply [mask-image:linear-gradient(90deg,transparent_10%,black_75%)]" />
      )}
      <div className="relative flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.08em] opacity-80">{card.kicker ?? "\u00a0"}</p>
        <a href={card.href} className="-mr-1 flex h-7 shrink-0 items-center gap-0.5 rounded-full bg-white/70 pl-2.5 pr-1.5 text-xs font-extrabold hover:bg-white">
          {linkLabel(card)} <Icon name="chevron" size={14} className="-rotate-90" />
        </a>
      </div>
      <div className="relative flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-extrabold leading-6 tracking-tight"><a href={card.href} className="hover:underline">{card.title}</a></h3>
          <p className="mt-1 truncate text-xs font-semibold opacity-80">{card.subtitle ?? "\u00a0"}</p>
        </div>
        {badge && <img src={card.imageUrl!} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 border-white object-cover" />}
        {card.kind === "BUY_GET" && <span className="shrink-0 rounded-full px-2.5 py-1 text-sm font-extrabold text-white" style={{ background: card.theme.cardInk }}>1+1</span>}
      </div>
    </div>
  )
}

/** One product straight on the card: photo, name over size and offer, then price over ADD so the name gets the width */
function Line({ product, ink }: { product: WebProductCard; ink: string }) {
  const [pack] = usePack(product.packs)
  return (
    <li className="flex items-center gap-2">
      <a href={productPath(product.slug)} className="flex min-w-0 flex-1 items-center gap-2.5">
        <Art src={product.imageUrl} className="h-[52px] w-[52px] shrink-0 rounded-xl bg-white p-1" />
        <span className="min-w-0">
          <span className="line-clamp-2 text-[13px] font-semibold leading-4 text-ink">{product.name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {pack.name}
            {pack.offer && <b style={{ color: ink }}> · {pack.offer.buy}+{pack.offer.get}</b>}
          </span>
        </span>
      </a>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="flex items-baseline gap-1 text-sm">
          {pack.mrp && <s className="text-[11px] text-muted">{rupees(pack.mrp)}</s>}
          <b className="text-ink">{rupees(pack.price)}</b>
        </span>
        <AddButton pack={pack} name={product.name} size="compact" />
      </span>
    </li>
  )
}

function Tiles({ card }: { card: Card }) {
  return (
    <ul className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-2">
      {card.tiles.slice(0, 6).map((t) => (
        <li key={t.href}>
          <a href={t.href} className="flex h-full flex-col items-center justify-center rounded-xl bg-white/70 p-1.5 text-center hover:bg-white">
            <Art src={t.imageUrl} className="min-h-0 w-full flex-1" />
            <span className="mt-0.5 line-clamp-2 text-[11.5px] font-bold leading-tight text-ink">{t.label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function Body({ card }: { card: Card }) {
  if (card.kind === "FESTIVE") return <Tiles card={card} />
  return (
    <ul className="flex flex-1 flex-col justify-around gap-2">
      {card.products.slice(0, LINES).map((p) => <Line key={p.slug} product={p} ink={card.theme.cardInk} />)}
    </ul>
  )
}

function linkLabel(card: Card) {
  if (card.kind === "FESTIVE") return "Shop all"
  return card.total > LINES ? `See all ${card.total}` : "See all"
}

function HeroCardView({ card }: { card: Card }) {
  return (
    <article className="flex h-[424px] flex-col overflow-hidden rounded-[22px] p-3.5" style={{ background: card.theme.card, color: card.theme.cardInk }}>
      <Head card={card} />
      <Body card={card} />
    </article>
  )
}

/** Turns to the next card every few seconds while the rail scrolls, until the shopper touches it */
function useRotation(count: number) {
  const rail = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)
  const [stopped, setStopped] = useState(false)
  useEffect(() => {
    const el = rail.current
    if (!el || stopped || count < 2 || el.scrollWidth <= el.clientWidth) return
    const timer = setTimeout(() => {
      const next = el.children[(active + 1) % count] as HTMLElement
      el.scrollTo({ left: next.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: "smooth" })
    }, ROTATE_MS)
    return () => clearTimeout(timer)
  }, [active, stopped, count])
  const onScroll = () => {
    const el = rail.current!
    const step = (el.children[1] as HTMLElement | undefined)?.offsetLeft ?? 0
    const first = (el.children[0] as HTMLElement).offsetLeft
    setActive(Math.min(count - 1, Math.round(el.scrollLeft / Math.max(1, step - first))))
  }
  return { rail, active, setActive, onScroll, stop: () => setStopped(true) }
}

/** Tall cards leading Home; the wash behind them takes the colours of the card in view (or under the pointer) */
export function HeroCards({ section }: { section: Extract<WebHomeSection, { type: "HERO_CARDS" }> }) {
  const { cards } = section
  const { rail, active, setActive, onScroll, stop } = useRotation(cards.length)
  const theme = cards[active].theme
  return (
    <section aria-label="Highlights" className="pb-2 pt-4 sm:pt-6" style={{ background: `linear-gradient(180deg, ${theme.tint} 0%, ${theme.tintSoft} 55%, #fff 100%)` }}>
      <ul
        ref={rail}
        onScroll={onScroll}
        onPointerDown={stop}
        onWheel={stop}
        className="mx-auto flex max-w-7xl snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:scroll-px-6 sm:px-6 lg:gap-4"
      >
        {cards.map((card, i) => (
          <li key={card.id} onMouseEnter={() => setActive(i)} className="w-[78%] shrink-0 snap-start sm:w-[340px] lg:min-w-[300px] lg:flex-1">
            <HeroCardView card={card} />
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className="flex justify-center gap-1.5 pt-3 lg:hidden">
        {cards.map((c, i) => <span key={c.id} className={`h-1.5 rounded-full transition-all ${i === active ? "w-[18px]" : "w-1.5 opacity-30"}`} style={{ background: theme.ink }} />)}
      </div>
    </section>
  )
}
