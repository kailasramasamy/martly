import type { ReactNode } from "react"
import { HeadContent, Outlet, Scripts, createRootRoute, useRouter } from "@tanstack/react-router"
import appCss from "~/styles/app.css?url"
import { getDepartments, getHome } from "~/lib/api"
import { AppSheetProvider } from "~/components/app-sheet"

export const Route = createRootRoute({
  // Live towns and their stores for the store picker and footer, and the store's departments for the department bar, on every page
  loader: async () => {
    const [home, departments] = await Promise.all([getHome(), getDepartments()])
    return { ...home, departments }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0f766e" },
      { property: "og:site_name", content: "Martly" },
      { property: "og:locale", content: "en_IN" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+Tamil:wght@500;700;800&family=Playfair+Display:wght@700&family=Yatra+One&family=Kalam:wght@700&family=Lobster&display=swap" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  // The document is a shell around the root match, so a failed root loader still renders a page (the error below)
  shellComponent: RootDocument,
  component: Outlet,
  errorComponent: RootError,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppSheetProvider>{children}</AppSheetProvider>
        <Scripts />
      </body>
    </html>
  )
}

function RootError() {
  const router = useRouter()
  return (
    <main className="mx-auto max-w-xl px-4 py-32 text-center">
      <h1 className="text-3xl font-extrabold">Something went wrong</h1>
      <p className="mt-4 text-slate-600">We couldn't load this page. Please try again in a moment.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => router.invalidate()} className="inline-flex h-12 items-center rounded-full bg-brand px-6 font-bold text-white">Try again</button>
        <a href="/" className="inline-flex h-12 items-center rounded-full border border-slate-300 px-6 font-bold">Go to Martly home</a>
      </div>
    </main>
  )
}
