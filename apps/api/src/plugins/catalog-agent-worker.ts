import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { runDraft } from "../services/catalog-agent/pipeline.js";
import { notifyDraftsFinished } from "../services/notify/catalog-alerts.js";

const POLL_MS = 5_000;
const CONCURRENCY = 2;
// A draft still PROCESSING after this long was cut off by a restart (a full 8-shot run takes ~2 minutes);
// it is requeued and resumes with its finished shots kept
const STALE_MS = 10 * 60_000;
const MAX_ATTEMPTS = 2;

async function catalogAgentWorkerPlugin(app: FastifyInstance) {
  let running = 0;
  let finished: string[] = [];
  let polling = false;
  let interval: ReturnType<typeof setInterval> | undefined;

  // Takes the oldest queued draft; SKIP LOCKED keeps two API instances from taking the same one
  async function claim() {
    const rows = await app.prisma.$queryRaw<{ id: string }[]>`
      UPDATE catalog_drafts SET status = 'PROCESSING', claimed_at = now() AT TIME ZONE 'UTC', attempts = attempts + 1, updated_at = now() AT TIME ZONE 'UTC'
      WHERE id = (
        SELECT id FROM catalog_drafts WHERE status = 'QUEUED' ORDER BY created_at
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      RETURNING id`;
    return rows[0]?.id;
  }

  async function requeueStale() {
    const cutoff = new Date(Date.now() - STALE_MS);
    await app.prisma.catalogDraft.updateMany({
      where: { status: "PROCESSING", claimedAt: { lt: cutoff }, attempts: { gte: MAX_ATTEMPTS } },
      data: { status: "FAILED", error: "Stopped twice before finishing" },
    });
    await app.prisma.catalogDraft.updateMany({ where: { status: "PROCESSING", claimedAt: { lt: cutoff } }, data: { status: "QUEUED" } });
  }

  async function work(id: string) {
    try {
      await runDraft(app.prisma, id, app.log);
    } catch (err) {
      app.log.error(err, `Catalog draft ${id} failed`);
      const draft = await app.prisma.catalogDraft.findUnique({ where: { id }, select: { attempts: true } });
      const retry = (draft?.attempts ?? MAX_ATTEMPTS) < MAX_ATTEMPTS;
      await app.prisma.catalogDraft.update({
        where: { id },
        data: { status: retry ? "QUEUED" : "FAILED", error: err instanceof Error ? err.message.slice(0, 500) : String(err) },
      });
    }
  }

  // Once the queue drains, tells each creator about everything that finished since the last drain
  async function flushFinished() {
    const ids = finished;
    finished = [];
    await notifyDraftsFinished(app.fcm, app.prisma, ids);
  }

  async function tick() {
    while (running < CONCURRENCY) {
      const id = await claim();
      if (!id) {
        if (running === 0 && finished.length > 0) await flushFinished();
        return;
      }
      running++;
      void work(id).finally(() => { running--; finished.push(id); });
    }
  }

  app.addHook("onReady", async () => {
    interval = setInterval(() => {
      if (polling) return;
      polling = true;
      requeueStale().then(tick).catch((err: unknown) => app.log.error(err, "Catalog agent poll failed")).finally(() => { polling = false; });
    }, POLL_MS);
    app.log.info(`Catalog agent worker started (every ${POLL_MS / 1000}s, ${CONCURRENCY} at a time)`);
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(catalogAgentWorkerPlugin, { name: "catalog-agent-worker" });
