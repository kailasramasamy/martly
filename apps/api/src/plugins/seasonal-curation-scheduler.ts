import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { findDueCurations } from "../services/seasonal/due-events.js";
import { curateEvent, isCurationConfigured } from "../services/seasonal/index.js";

const INTERVAL_MS = 6 * 60 * 60_000;

async function seasonalCurationSchedulerPlugin(app: FastifyInstance) {
  if (!isCurationConfigured()) {
    app.log.warn("Seasonal curation disabled: ANTHROPIC_API_KEY and OPENAI_API_KEY are both required");
    return;
  }
  // Skips aren't persisted, so remember them for this process instead of re-asking the curator every run
  const skipped = new Set<string>();
  let running = false;

  async function processDueCurations() {
    if (running) return;
    running = true;
    try {
      const due = await findDueCurations(app.prisma);
      for (const { org, event } of due) {
        const key = `${org.id}:${event.id}`;
        if (skipped.has(key)) continue;
        try {
          const result = await curateEvent(app.prisma, org, event, (msg) => app.log.warn(`${org.slug} / ${event.slug}: ${msg}`));
          if (result.status === "skipped") skipped.add(key);
          app.log.info({ org: org.slug, event: event.slug, ...result }, "Seasonal curation");
        } catch (err) {
          app.log.error(err, `Seasonal curation failed for ${org.slug} / ${event.slug}`);
        }
      }
    } catch (err) {
      app.log.error(err, "Error finding due seasonal curations");
    } finally {
      running = false;
    }
  }

  let intervalId: ReturnType<typeof setInterval>;

  app.addHook("onReady", () => {
    intervalId = setInterval(processDueCurations, INTERVAL_MS);
    app.log.info("Seasonal curation scheduler started (6h interval)");
  });

  app.addHook("onClose", () => {
    if (intervalId) clearInterval(intervalId);
  });
}

export default fp(seasonalCurationSchedulerPlugin, { name: "seasonal-curation-scheduler" });
