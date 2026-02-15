import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

declare module "fastify" {
  interface FastifyInstance {
    fcm: Messaging | null;
  }
}

export const firebasePlugin = fp(async (app: FastifyInstance) => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    app.log.warn("Firebase credentials not configured — push notifications disabled");
    app.decorate("fcm", null);
    return;
  }

  let firebaseApp: App;
  if (getApps().length === 0) {
    firebaseApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    firebaseApp = getApps()[0];
  }

  const messaging = getMessaging(firebaseApp);
  app.decorate("fcm", messaging);
  app.log.info("Firebase Cloud Messaging initialized");
});
