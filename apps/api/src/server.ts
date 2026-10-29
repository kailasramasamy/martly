import "./load-env.js";
import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 7001);
const HOST = process.env.HOST ?? "0.0.0.0";
// Closing waits for in-flight requests and scheduler runs; past this the process exits anyway
const SHUTDOWN_TIMEOUT_MS = 15_000;

async function start() {
  const app = await buildApp();

  process.on("unhandledRejection", (reason) => app.log.error(reason, "Unhandled promise rejection"));
  process.on("uncaughtException", (err) => {
    app.log.fatal(err, "Uncaught exception");
    process.exit(1);
  });

  // Graceful shutdown: stop taking requests, stop the schedulers, disconnect Prisma (onClose hooks), then exit.
  // SIGUSR2 is tsx watch restarting, which needs the port released too
  let closing = false;
  for (const signal of ["SIGINT", "SIGTERM", "SIGUSR2"] as const) {
    process.on(signal, () => {
      if (closing) return;
      closing = true;
      app.log.info(`${signal} received, shutting down`);
      setTimeout(() => {
        app.log.error(`Shutdown took over ${SHUTDOWN_TIMEOUT_MS / 1000}s, exiting`);
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS).unref();
      app.close().then(
        () => {
          app.log.info("Shutdown complete");
          process.exit(0);
        },
        (err: unknown) => {
          app.log.error(err, "Shutdown failed");
          process.exit(1);
        },
      );
    });
  }

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
