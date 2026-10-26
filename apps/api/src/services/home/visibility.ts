import { expandLayout } from "./layout.js";
import { RESOLVERS } from "./registry.js";
import type { LayoutEntry, ResolveContext } from "./types.js";

/** Whether each layout entry shows anything at the store, by the Home screen's own rules */
export async function sectionVisibility(ctx: ResolveContext, entries: LayoutEntry[]) {
  return Promise.all(entries.map(async (entry) => {
    const expanded = await expandLayout(ctx, [entry]);
    const resolved = await Promise.all(expanded.map((e) => RESOLVERS[e.type](ctx, e)));
    return { entry, resolves: resolved.some((s) => s !== null) };
  }));
}
