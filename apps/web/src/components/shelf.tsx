import type { WebProductCard } from "@martly/shared/types"
import { ProductCard } from "./product-card"
import { Icon } from "./icons"

export function SeeAll({ href, label = "See all", className = "text-brand hover:text-brand-deep" }: { href: string; label?: string; className?: string }) {
  return (
    <a href={href} className={`flex shrink-0 items-center gap-1 text-sm font-extrabold ${className}`}>
      {label} <Icon name="arrow" size={16} />
    </a>
  )
}

/** A sideways-scrolling row of product cards that runs to the page edge on phones */
export function ProductRail({ products }: { products: WebProductCard[] }) {
  return (
    <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 [scrollbar-width:thin]">
      {products.map((p) => (
        <li key={p.slug} className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[18.6%] xl:w-[15.6%]">
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  )
}

/** A heading and a sideways-scrolling row of products, linking to the full list */
export function Shelf({ title, path, products, id }: { title: string; path?: string; products: WebProductCard[]; id?: string }) {
  if (!products.length) return null
  return (
    <section aria-labelledby={id} className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id={id} className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
        {path && <SeeAll href={path} />}
      </div>
      <ProductRail products={products} />
    </section>
  )
}
