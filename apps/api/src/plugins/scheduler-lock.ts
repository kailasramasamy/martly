import fp from "fastify-plugin";
import pg from "pg";
import type { FastifyInstance } from "fastify";
import { createJobRunner, pgJobLocks } from "../services/scheduler/exclusive.js";

declare module "fastify" {
  interface FastifyInstance {
    /** A scheduler tick that never overlaps itself and runs on one API instance at a time; `name` must be unique per job */
    scheduledJob(name: string, job: () => Promise<unknown>): () => Promise<void>;
  }
}

/** Registered before the schedulers, so on close it runs after they stop their timers and before Prisma disconnects */
async function schedulerLockPlugin(app: FastifyInstance) {
  // One connection that is never recycled while idle, so a lock is released on the session that took it
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, idleTimeoutMillis: 0, keepAlive: true, connectionTimeoutMillis: 10_000 });
  pool.on("error", (err) => app.log.error(err, "Scheduler lock connection failed"));
  const runner = createJobRunner(pgJobLocks(pool), app.log);

  app.decorate("scheduledJob", runner.wrap);

  app.addHook("onClose", async () => {
    await runner.drain();
    await pool.end();
  });
}

export default fp(schedulerLockPlugin, { name: "scheduler-lock" });
