/** A request URL fit for the logs: any `token` query value is replaced, so a WebSocket JWT never lands in them */
export function redactUrl(url: string) {
  return url.replace(/([?&]token=)[^&#]*/gi, "$1[redacted]");
}
