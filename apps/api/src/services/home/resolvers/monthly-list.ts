import { isDue, monthlyListView } from "../../monthly-list/index.js";
import { sectionBase, type SectionResolver } from "../types.js";

/** The shopper's monthly list, from its reminder day until it's ordered that month; hidden otherwise and for guests */
export const monthlyList: SectionResolver = async (ctx, entry) => {
  if (!ctx.userId) return null;
  const list = await ctx.prisma.monthlyList.findUnique({
    where: { userId_storeId: { userId: ctx.userId, storeId: ctx.store.id } },
    select: { id: true, reminderDay: true, lastOrderedMonth: true, isActive: true },
  });
  if (!list || !isDue(list)) return null;
  const view = await monthlyListView(ctx.prisma, ctx.userId, { id: list.id });
  if (!view || view.items.length === 0) return null;
  const changed = view.items.filter((i) => i.delta != null && i.delta !== 0).length;
  return {
    ...sectionBase(entry),
    type: "MONTHLY_LIST",
    data: {
      listId: view.id, month: view.month, itemCount: view.items.length, total: view.total, changed, toCheck: view.changes.length,
    },
  };
};
