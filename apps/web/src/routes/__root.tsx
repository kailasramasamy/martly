import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router"
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
  component: RootLayout,
})

function RootLayout() {
  return (
    <html lang="en-IN">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppSheetProvider>
          <Outlet />
        </AppSheetProvider>
        <Scripts />
      </body>
    </html>
  )
}
