import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

// Plain query strings, so "?q=500" stays a search for 500 instead of the router's JSON reading of it
const parseSearch = (search: string) => Object.fromEntries(new URLSearchParams(search))
function stringifySearch(search: Record<string, unknown>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) if (value !== undefined && value !== null) params.set(key, String(value))
  const query = params.toString()
  return query ? `?${query}` : ""
}

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    parseSearch,
    stringifySearch,
    defaultNotFoundComponent: () => (
      <main className="mx-auto max-w-xl px-4 py-32 text-center">
        <h1 className="text-3xl font-extrabold">Page not found</h1>
        <a href="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-brand px-6 font-bold text-white">Go to Martly home</a>
      </main>
    ),
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
