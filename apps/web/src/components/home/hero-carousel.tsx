import { useEffect, useRef, useState, type RefObject } from "react"
import type { WebBanner } from "@martly/shared/types"
import { recordAd } from "~/lib/ad-events"
import { Icon } from "../icons"
import { BannerImage } from "./banners"
import { PAGE } from "./parts"

const TURN_MS = 5000

/** Counts a slide's view once most of it is on screen, as the app counts the slide it shows */
function useSlideViews(list: RefObject<HTMLUListElement | null>, banners: WebBanner[], storeId: string) {
  useEffect(() => {
    const seen = new Set<string>()
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.banner
        if (!e.isIntersecting || !id || seen.has(id)) continue
        seen.add(id)
        recordAd(storeId, { bannerId: id, type: "VIEW" })
      }
    }, { threshold: 0.6 })
    list.current?.querySelectorAll("[data-banner]").forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [list, banners, storeId])
}

function Arrow({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={dir === "prev" ? "Previous banner" : "Next banner"}
      className={`absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lg shadow-black/15 hover:text-brand lg:flex ${dir === "prev" ? "left-2" : "right-2"}`}>
      <Icon name="chevron" size={20} className={dir === "prev" ? "rotate-90" : "-rotate-90"} />
    </button>
  )
}

function Dots({ banners, index, onPick }: { banners: WebBanner[]; index: number; onPick: (i: number) => void }) {
  return (
    <div className="flex justify-center gap-1.5 pt-3">
      {banners.map((b, i) => (
        <button key={b.id} type="button" aria-label={`Show ${b.title}`} aria-current={i === index} onClick={() => onPick(i)} className="flex h-6 items-center">
          <span className={`h-1.5 rounded-full bg-brand transition-all ${i === index ? "w-[18px]" : "w-1.5 opacity-25"}`} />
        </button>
      ))}
    </div>
  )
}

/** The store's banners right under its header: one with the next peeking on phones, three on desktop, turning on their own */
export function HeroCarousel({ banners, storeId }: { banners: WebBanner[]; storeId: string }) {
  const list = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  useSlideViews(list, banners, storeId)

  const slides = () => [...(list.current?.children ?? [])] as HTMLElement[]
  const go = (i: number) => {
    const all = slides()
    const target = all[(i + all.length) % all.length]
    if (target && list.current) list.current.scrollTo({ left: target.offsetLeft - all[0].offsetLeft, behavior: "smooth" })
  }
  const onScroll = () => {
    const el = list.current
    if (!el) return
    const left = el.scrollLeft + slides()[0].offsetLeft
    setIndex(slides().reduce((best, s, i) => (Math.abs(s.offsetLeft - left) < Math.abs(slides()[best].offsetLeft - left) ? i : best), 0))
  }
  useEffect(() => {
    if (paused || banners.length < 2) return
    const el = list.current
    const atEnd = el ? el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 : false
    const timer = setTimeout(() => go(atEnd ? 0 : index + 1), TURN_MS)
    return () => clearTimeout(timer)
  }, [index, paused, banners.length])

  return (
    <section aria-label="Offers from the store" className="pt-5 sm:pt-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className={`${PAGE} relative`}>
        {banners.length > 3 && <Arrow dir="prev" onClick={() => go(index - 1)} />}
        <ul ref={list} onScroll={onScroll} className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 [scrollbar-width:none]">
          {banners.map((b) => (
            <li key={b.id} data-banner={b.id} className="w-[88%] shrink-0 snap-start sm:w-[calc(50%-8px)] lg:w-[calc((100%-32px)/3)]">
              <BannerImage banner={b} className="aspect-[3/2]" onOpen={() => recordAd(storeId, { bannerId: b.id, type: "TAP" })} />
            </li>
          ))}
        </ul>
        {banners.length > 3 && <Arrow dir="next" onClick={() => go(index + 1)} />}
      </div>
      {banners.length > 1 && <Dots banners={banners} index={index} onPick={go} />}
    </section>
  )
}
