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

function send(payload: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function connect() {
  const token = localStorage.getItem("martly_admin_token");
  if (!token || listeners.size === 0) return;

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
    if (listeners.size === 0) return;
    reconnectTimer = setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF);
  };
}

function reconnectIfDown() {
  if (document.visibilityState !== "visible" || listeners.size === 0) return;
  if (ws && ws.readyState === WebSocket.OPEN) return;
  clearTimeout(reconnectTimer);
  backoff = 1000;
  connect();
}

function disconnect() {
  clearTimeout(reconnectTimer);
  document.removeEventListener("visibilitychange", reconnectIfDown);
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
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
    connect();
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
