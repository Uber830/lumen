import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the event stream.
 *
 * The browser's EventSource is replaced by a fake one, so the tests can
 * push frames by hand and check who hears them. The module keeps its
 * state (the connection, the handlers) in itself, so it is reloaded
 * before each test to start from a clean sheet.
 */

const mocks = vi.hoisted(() => ({
  refreshSession: vi.fn(async () => true),
}));

vi.mock("@/lib/api/client", () => ({
  apiBaseUrl: () => "http://api.test",
  refreshSession: mocks.refreshSession,
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState: number = FakeEventSource.OPEN;
  closed = false;

  constructor(
    readonly url: string,
    readonly options?: { withCredentials?: boolean },
  ) {
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  /** The server sends a frame. */
  emit(payload: string): void {
    this.onmessage?.({ data: payload });
  }
}

type StreamModule = typeof import("./event-stream");

let stream: StreamModule;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(async () => {
  vi.resetModules();
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  stream = await import("./event-stream");
});

afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function unmount(): Promise<void> {
  if (!root) return;
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
}

async function mount(node: ReactNode): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(node);
  });
}

function source(): FakeEventSource {
  const instance = FakeEventSource.instances[0];
  if (!instance) throw new Error("the stream was not opened");
  return instance;
}

describe("the event stream", () => {
  it("opens the connection with the credentials of the session", async () => {
    function App() {
      stream.useEventStream(true);
      return null;
    }

    await mount(createElement(App));

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(source().url).toBe("http://api.test/v1/events");
    expect(source().options?.withCredentials).toBe(true);
  });

  it("does not open the connection when it is not wanted", async () => {
    function App() {
      stream.useEventStream(false);
      return null;
    }

    await mount(createElement(App));

    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("an event reaches the listener of its kind", async () => {
    const received: unknown[] = [];

    function App() {
      stream.useEventStream(true);
      stream.useEvent("notification", (event) => received.push(event));
      return null;
    }

    await mount(createElement(App));

    source().emit(JSON.stringify({ type: "notification", data: { kind: "chat_message" } }));

    expect(received).toEqual([{ type: "notification", data: { kind: "chat_message" } }]);
  });

  it("an event of another kind is not heard", async () => {
    const received: unknown[] = [];

    function App() {
      stream.useEventStream(true);
      stream.useEvent("chat.message", (event) => received.push(event));
      return null;
    }

    await mount(createElement(App));

    source().emit(JSON.stringify({ type: "notification", data: {} }));

    expect(received).toEqual([]);
  });

  it("a frame that is not ours is ignored", async () => {
    const received: unknown[] = [];

    function App() {
      stream.useEventStream(true);
      stream.useEvent("notification", (event) => received.push(event));
      return null;
    }

    await mount(createElement(App));

    expect(() => source().emit("not json")).not.toThrow();
    expect(() => source().emit(JSON.stringify({ data: {} }))).not.toThrow();
    expect(received).toEqual([]);
  });

  it("a listener that fails does not stop the others", async () => {
    const received: string[] = [];

    function Broken() {
      stream.useEvent("notification", () => {
        throw new Error("boom");
      });
      return null;
    }

    function Working() {
      stream.useEvent("notification", () => received.push("ok"));
      return null;
    }

    function App() {
      stream.useEventStream(true);
      return createElement("div", null, createElement(Broken), createElement(Working));
    }

    await mount(createElement(App));

    expect(() => source().emit(JSON.stringify({ type: "notification", data: {} }))).not.toThrow();
    expect(received).toEqual(["ok"]);
  });

  it("the connection is shared and lives until the last one lets go", async () => {
    function First() {
      stream.useEventStream(true);
      return null;
    }

    function Second() {
      stream.useEventStream(true);
      return null;
    }

    await mount(createElement("div", null, createElement(First), createElement(Second)));

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(source().closed).toBe(false);

    await unmount();
    expect(source().closed).toBe(true);
  });

  it("a listener is removed when its component goes away", async () => {
    function App() {
      stream.useEvent("notification", () => undefined);
      return null;
    }

    await mount(createElement(App));
    expect(stream.listenerCount("notification")).toBe(1);

    await unmount();
    expect(stream.listenerCount("notification")).toBe(0);
  });
});
