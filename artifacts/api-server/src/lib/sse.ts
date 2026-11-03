import { EventEmitter } from "node:events";
import { Request, Response } from "express";

export type SseEnvelope = { id: string; type: string; payload?: unknown; ts: number };

interface Hub {
  emitter: EventEmitter;
  subscribers: number;
}

const hubs = new Map<string, Hub>();
let sequence = 0;

export function getHub(channel: string): Hub {
  let hub = hubs.get(channel);
  if (!hub) {
    hub = { emitter: new EventEmitter(), subscribers: 0 };
    hubs.set(channel, hub);
    hub.emitter.setMaxListeners(50);
  }
  return hub;
}

/** Publish an event to every subscriber of a channel. */
export function publish(channel: string, type: string, payload?: unknown): void {
  const hub = getHub(channel);
  const envelope: SseEnvelope = {
    id: String(++sequence),
    type,
    payload,
    ts: Date.now(),
  };
  hub.emitter.emit("envelope", envelope);
}

/** Subscribe to a channel. Returns an unsubscribe function. */
export function subscribe(
  channel: string,
  listener: (envelope: SseEnvelope) => void,
): () => void {
  const hub = getHub(channel);
  hub.subscribers += 1;
  hub.emitter.on("envelope", listener);
  return () => {
    hub.emitter.off("envelope", listener);
    hub.subscribers = Math.max(0, hub.subscribers - 1);
    if (hub.subscribers === 0) {
      hubs.delete(channel);
    }
  };
}

export function channelFor(role: "candidate" | "recruiter", userId: string): string {
  return `${role}:${userId}`;
}

/**
 * Express handler for GET /api/events (SSE).
 * Expects req.resolvedUserId and req.resolvedRole to be set by auth middleware.
 */
export function sseHandler(_req: Request, res: Response): void {
  const userId = (_req as any).resolvedUserId as string;
  const role = (_req as any).resolvedRole as "candidate" | "recruiter";
  const channel = channelFor(role, userId);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(": connected\n\n");

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    try { res.end(); } catch {}
  };

  _req.on("close", close);
  _req.on("aborted", close);
  res.on("close", close);
  res.on("error", close);

  const heartbeat = setInterval(() => {
    if (!closed) {
      try { (res as any).write(": heartbeat\n\n"); } catch { close(); }
    }
  }, 25000);

  const unsubscribe = subscribe(channel, (envelope) => {
    if (closed) return;
    try {
      res.write(
        `id: ${envelope.id}\nevent: ${envelope.type}\ndata: ${JSON.stringify(
          envelope.payload,
        )}\n\n`,
      );
    } catch {
      close();
    }
  });
}
