import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { alertOnce } from "./once.js";
import { plural } from "./copy.js";
import { notifyStaff } from "./staff.js";

interface Finished { id: string; storeId: string; createdById: string; status: string; error: string | null }

function readyCopy(drafts: Finished[]) {
  const review = drafts.filter((d) => d.status === "NEEDS_REVIEW").length;
  const title = `${plural(drafts.length, "draft")} ready`;
  return { title: review > 0 ? `${title} · ${review} need review` : title, body: review > 0 ? "Check the flagged drafts before they go live." : "They are now live in your catalog." };
}

function failedCopy(drafts: Finished[]) {
  if (drafts.length === 1) return { title: `Draft failed: ${drafts[0].error ?? "unknown error"}`.slice(0, 80), body: "Open the draft to retry or fix it." };
  return { title: `${plural(drafts.length, "draft")} failed`, body: "Open the drafts to retry or fix them." };
}

/** One alert per creator and store for the drafts the agent finished in this run; each draft status alerts once */
export async function notifyDraftsFinished(fcm: Messaging | null, prisma: PrismaClient, ids: string[]) {
  const drafts = await prisma.catalogDraft.findMany({
    where: { id: { in: ids }, status: { in: ["NEEDS_REVIEW", "PUBLISHED", "DUPLICATE", "FAILED"] } },
    select: { id: true, storeId: true, createdById: true, status: true, error: true },
  });
  const fresh: Finished[] = [];
  for (const d of drafts) {
    if (await alertOnce(prisma, `draft:${d.id}:${d.status}`)) fresh.push(d);
  }
  const groups = new Map<string, Finished[]>();
  for (const d of fresh) groups.set(`${d.storeId}|${d.createdById}`, [...(groups.get(`${d.storeId}|${d.createdById}`) ?? []), d]);
  for (const group of groups.values()) {
    const { storeId, createdById } = group[0];
    for (const [failed, batch] of [[false, group.filter((d) => d.status !== "FAILED")], [true, group.filter((d) => d.status === "FAILED")]] as const) {
      if (batch.length === 0) continue;
      await notifyStaff(fcm, prisma, storeId, { userIds: [createdById] }, {
        type: "STAFF_STOCK",
        ...(failed ? failedCopy(batch) : readyCopy(batch)),
        data: { screen: "catalog-draft", ...(batch.length === 1 ? { draftId: batch[0].id } : {}) },
      });
    }
  }
}
