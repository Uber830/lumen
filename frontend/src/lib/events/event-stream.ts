// =============================================================================
// The event stream: what the browser is told without asking.
// -----------------------------------------------------------------------------
// One connection per tab carries the events of the user: a new
// notification, a new message in a conversation.
//
// An event says **what happened**, not what it is: the client asks the
// API for what changed and refetches. That way a lost event costs a
// refetch and never leaves the panel showing something that is not
// there.
//
// The connection is opened once and shared by everything that listens.
// The browser reconnects on its own when the connection drops; when the
// session has expired the stream is reopened with a fresh token.
// =============================================================================

import { useEffect, useRef } from "react";

import { apiBaseUrl, refreshSession } from "@/lib/api/client";

/** One event of the stream. */
export type StreamEvent = {
  type: string;
  data: Record<string, unknown>;
};

type Handler = (event: StreamEvent) => void;

// The handlers of each kind of event.
const handlers = new Map<string, Set<Handler>>();

// The connection of the tab, and how many parts of the app need it.
let source: EventSource | null = null;
let references = 0;

// How long the client waits before trying again, in milliseconds.
const RECONNECT_DELAY = 3000;

function dispatch(payload: string) {
  let parsed: StreamEvent;
  try {
    parsed = JSON.parse(payload) as StreamEvent;
  } catch {
    // A frame that is not JSON is not ours: the browser ignores it.
    return;
  }
  if (!parsed || typeof parsed.type !== "string") return;

  const listeners = handlers.get(parsed.type);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(parsed);
    } catch {
      // A listener that fails does not stop the others.
    }
  }
}

function open() {
  if (source) return;

  const stream = new EventSource(`${apiBaseUrl}/v1/events`, { withCredentials: true });

  stream.onmessage = (message) => dispatch(message.data);

  stream.onerror = () => {
    // The browser reconnects on its own, but when the session has
    // expired the stream comes back refused. The token is refreshed and
    // the connection is opened again.
    if (stream.readyState === EventSource.CLOSED) {
      close();
      void refreshSession().then(() => {
        if (references > 0) {
          setTimeout(open, RECONNECT_DELAY);
        }
      });
    }
  };

  source = stream;
}

function close() {
  if (!source) return;
  source.close();
  source = null;
}

/**
 * Keep the event stream open while the app needs it.
 *
 * The connection is shared: the first part of the app that asks for it
 * opens it and the last one that lets go closes it.
 */
export function useEventStream(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    references += 1;
    open();

    return () => {
      references -= 1;
      if (references <= 0) {
        references = 0;
        close();
      }
    };
  }, [enabled]);
}

/**
 * Listen to one kind of event.
 *
 * The handler is read on every event, so a closure that changes does
 * not have to open the stream again.
 */
export function useEvent(type: string, handler: Handler): void {
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener: Handler = (event) => latest.current(event);
    const listeners = handlers.get(type) ?? new Set<Handler>();
    listeners.add(listener);
    handlers.set(type, listeners);

    return () => {
      listeners.delete(listener);
    };
  }, [type]);
}

/** How many listeners a kind of event has. For the tests. */
export function listenerCount(type: string): number {
  return handlers.get(type)?.size ?? 0;
}
