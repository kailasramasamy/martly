import type pg from "pg";

/** A cross-instance lock per job name; a job runs only on the instance that took it */
export interface JobLocks {
  tryLock(name: string): Promise<boolean>;
  unlock(name: string): Promise<void>;
}

interface JobLog {
  error(err: unknown, msg: string): void;
}

// Two-key advisory locks are a separate key space from the one-key locks used inside transactions elsewhere
const LOCK_NAMESPACE = 81029;

/**
 * Session-level advisory locks on one dedicated connection. Prisma's pool hands each query to any connection, so a
 * session lock taken through it could be released on another; holding a Prisma transaction open for the whole job
 * instead would tie up a pooled connection for minutes. If this connection drops, Postgres frees its locks with it.
 */
export function pgJobLocks(pool: pg.Pool): JobLocks {
  return {
    async tryLock(name) {
      const { rows } = await pool.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1, hashtext($2)) AS locked", [LOCK_NAMESPACE, name]);
      return rows[0].locked;
    },
    async unlock(name) {
      await pool.query("SELECT pg_advisory_unlock($1, hashtext($2))", [LOCK_NAMESPACE, name]);
    },
  };
}

/**
 * Wraps scheduler jobs so a tick is skipped while this process still runs the previous one, or while another instance
 * holds the job's lock. Jobs sharing a name share both guards. drain() stops new runs and waits for those in flight.
 */
export function createJobRunner(locks: JobLocks, log: JobLog) {
  const running = new Map<string, Promise<void>>();
  let closed = false;

  async function runLocked(name: string, job: () => Promise<unknown>) {
    if (!(await locks.tryLock(name))) return;
    try {
      await job();
    } finally {
      await locks.unlock(name);
    }
  }

  function wrap(name: string, job: () => Promise<unknown>): () => Promise<void> {
    return () => {
      const current = running.get(name);
      if (current) return current;
      if (closed) return Promise.resolve();
      const run = runLocked(name, job)
        .catch((err: unknown) => log.error(err, `Scheduled job ${name} failed`))
        .finally(() => running.delete(name));
      running.set(name, run);
      return run;
    };
  }

  async function drain() {
    closed = true;
    await Promise.all(running.values());
  }

  return { wrap, drain };
}
