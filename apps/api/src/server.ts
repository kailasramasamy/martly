import "dotenv/config";
import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 7001);
const HOST = process.env.HOST ?? "0.0.0.0";

async function start() {
  const app = await buildApp();

  // Graceful shutdown — release the port before tsx watch restarts
  for (const signal of ["SIGINT", "SIGTERM", "SIGUSR2"] as const) {
    process.on(signal, () => {
      app.close().then(() => process.exit(0));
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
