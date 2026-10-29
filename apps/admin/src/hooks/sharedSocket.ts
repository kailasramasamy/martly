import { refreshAccessToken } from "../providers/auth-provider";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const WS_URL = API_URL.replace(/^http/, "ws");
const MAX_BACKOFF = 30000;

export interface SocketMessage {
  type: string;
  [key: string]: unknown;
}

type Listener = (msg: SocketMessage) => void;

const listeners = new Set<Listener>();
const orderSubscriptions = new Map<string, number>();
let ws: WebSocket | null = null;
let backoff = 1000;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
// Bumped whenever the socket is torn down, so a connect still waiting on its token gives up
let generation = 0;

function send(payload: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

/** The stored access token, refreshed first when it has expired or is about to (a socket can't refresh on a 401) */
async function freshToken(): Promise<string | null> {
  const token = localStorage.getItem("martly_admin_token");
  if (!token) return null;
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const { exp } = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="))) as { exp?: number };
  return (exp ?? 0) * 1000 - Date.now() > 30_000 ? token : refreshAccessToken();
}

function retryLater() {
  reconnectTimer = setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, MAX_BACKOFF);
}

async function connect() {
  if (listeners.size === 0) return;
  const attempt = generation;
  const token = await freshToken();
  if (attempt !== generation || listeners.size === 0) return;
  // No token: signed out, or the refresh failed while still signed in (offline), which is worth another try
  if (!token) {
    if (localStorage.getItem("martly_admin_token")) retryLater();
    return;
  }

  if (ws) {
    ws.onclose = null;
    ws.close();
  }

  const socket = new WebSocket(`${WS_URL}/ws?token=${token}`);
  ws = socket;

  socket.onopen = () => {
    backoff = 1000;
    for (const orderId of orderSubscriptions.keys()) send({ type: "subscribe", orderId });
  };

  socket.onmessage = (event) => {
    let msg: SocketMessage;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    for (const listener of listeners) listener(msg);
  };

  socket.onclose = () => {
    if (listeners.size > 0) retryLater();
  };
}

function reconnectIfDown() {
  if (document.visibilityState !== "visible" || listeners.size === 0) return;
  if (ws && ws.readyState === WebSocket.OPEN) return;
  clearTimeout(reconnectTimer);
  backoff = 1000;
  void connect();
}

/** Closes the socket and stops reconnecting, e.g. on sign-out; listeners stay, and it reconnects once signed in again */
export function closeSharedSocket() {
  generation++;
  clearTimeout(reconnectTimer);
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
}

function disconnect() {
  document.removeEventListener("visibilitychange", reconnectIfDown);
  closeSharedSocket();
}

/** Register a listener on the single shared socket; returns the unsubscribe function */
export function addSocketListener(listener: Listener, orderId?: string): () => void {
  listeners.add(listener);
  if (orderId) {
    orderSubscriptions.set(orderId, (orderSubscriptions.get(orderId) ?? 0) + 1);
    send({ type: "subscribe", orderId });
  }
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", reconnectIfDown);
    void connect();
  }

  return () => {
    listeners.delete(listener);
    if (orderId) {
      const count = (orderSubscriptions.get(orderId) ?? 1) - 1;
      if (count <= 0) {
        orderSubscriptions.delete(orderId);
        send({ type: "unsubscribe", orderId });
      } else {
        orderSubscriptions.set(orderId, count);
      }
    }
    if (listeners.size === 0) disconnect();
  };
}
