/** A real app screenshot in a dark device frame */
export function PhoneFrame({ src, alt, className = "", eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <div className={`rounded-[2.4rem] border border-white/10 bg-[#0b0f16] p-2 shadow-2xl shadow-brand-ink/40 ${className}`}>
      <img
        src={src}
        alt={alt}
        width={640}
        height={1387}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="block h-auto w-full rounded-[1.9rem]"
      />
    </div>
  )
}
