import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationPreferences } from "@/components/notifications/notification-preferences";

// The hooks talk to the API; here they are replaced by a fixed answer so
// the component can be rendered on its own.
const mocks = vi.hoisted(() => ({
  preferences: {
    preferences: [
      { kind: "task_assigned", in_app: true, email: false },
      { kind: "task_submitted", in_app: true, email: false },
      { kind: "task_graded", in_app: true, email: false },
      { kind: "chat_message", in_app: true, email: false },
      { kind: "email_received", in_app: true, email: false },
    ],
  },
  mutate: vi.fn(),
}));

vi.mock("@/features/notifications/hooks", () => ({
  useNotificationPreferences: () => ({
    data: mocks.preferences,
    isLoading: false,
    error: null,
  }),
  useUpdateNotificationPreferences: () => ({
    mutate: mocks.mutate,
    isPending: false,
    error: null,
  }),
}));

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(role: "platform_admin" | "school_admin" | "teacher" | "student") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<NotificationPreferences userId="user-1" role={role} />);
  });

  return {
    container,
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("NotificationPreferences", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mocks.mutate.mockClear();
  });

  it("does not offer tasks to an administrator", async () => {
    const { container, cleanup } = await render("school_admin");

    expect(container.textContent).not.toContain("Tarea asignada");
    expect(container.textContent).not.toContain("Entrega recibida");
    expect(container.textContent).not.toContain("Tarea calificada");
    expect(container.textContent).toContain("Mensajes de chat");

    await cleanup();
  });

  it("offers the assignments to a student", async () => {
    const { container, cleanup } = await render("student");

    expect(container.textContent).toContain("Tarea asignada");
    expect(container.textContent).not.toContain("Entrega recibida");

    await cleanup();
  });

  it("puts the label before the switch, so the switch cannot cover it", async () => {
    // The complaint this fixes: the switch landed on top of the text
    // "En la app". The label goes first, the switch last.
    const { container, cleanup } = await render("school_admin");

    const row = container.querySelector("li");
    expect(row).not.toBeNull();

    const label = Array.from(row?.querySelectorAll("span") ?? []).find(
      (span) => span.textContent === "En la app",
    );
    const toggle = row?.querySelector('[role="switch"]');

    expect(label).toBeDefined();
    expect(toggle).not.toBeNull();
    // compareDocumentPosition: the label comes before the switch.
    expect(label!.compareDocumentPosition(toggle!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await cleanup();
  });

  it("explains what the switch means", async () => {
    const { container, cleanup } = await render("school_admin");

    expect(container.textContent).toContain("campana de notificaciones");

    await cleanup();
  });
});
