import { createFileRoute } from "@tanstack/react-router"
import { getBestSellers } from "~/lib/api"
import { pageHead } from "~/lib/seo"
import { ListPageView } from "~/components/list-page"

export const Route = createFileRoute("/best-sellers")({
  loader: () => getBestSellers(),
  head: ({ loaderData }) => pageHead({
    title: `Best sellers at ${loaderData?.store.name ?? "your store"} | Martly`,
    description: `What shoppers at ${loaderData?.store.name ?? "your store"} bought most this month.`,
    path: "/best-sellers",
  }),
  component: () => <ListPageView page={Route.useLoaderData()} crumb="Most bought" base="/best-sellers" params={{}} empty="Not enough orders yet to rank best sellers." />,
})
