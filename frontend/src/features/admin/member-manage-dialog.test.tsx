import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemberManageDialog } from "@/features/admin/member-manage-dialog";
import type { SchoolMember } from "@/features/academics/types";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock("@/lib/users/invitations", () => ({
  useUpdateMembership: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
    error: null,
  }),
  useCreateActivationLink: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
    error: null,
  }),
  activationLink: (token: string) => `http://localhost/activar?token=${token}`,
}));

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function member(overrides: Partial<SchoolMember> = {}): SchoolMember {
  return {
    membership_id: "membership-1",
    school_id: "school-1",
    user_id: "user-1",
    role: "teacher",
    is_primary: true,
    joined_at: "2026-11-01T00:00:00Z",
    full_name: "Docente Pendiente",
    email: "pendiente@colegio.edu",
    phone: null,
    avatar_url: null,
    revoked_at: null,
    account_activated: false,
    ...overrides,
  };
}

async function render(props: Partial<React.ComponentProps<typeof MemberManageDialog>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemberManageDialog member={member()} roleLabel="docente" onClose={() => {}} {...props} />,
    );
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

describe("MemberManageDialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mocks.mutateAsync.mockClear();
  });

  it("does not keep a link: it offers to generate one", async () => {
    // The link is not stored, so the admin always asks for a new one.
    const { container, cleanup } = await render();

    expect(container.textContent).toContain("Enlace de activación");
    expect(container.textContent).toContain("Generar enlace de activación");
    expect(container.textContent).not.toContain("token-123");

    await cleanup();
  });

  it("hides the link once the account is activated", async () => {
    const { container, cleanup } = await render({
      member: member({ account_activated: true }),
    });

    expect(container.textContent).not.toContain("Enlace de activación");

    await cleanup();
  });

  it("shows the link right after it is generated", async () => {
    mocks.mutateAsync.mockResolvedValueOnce({ activation_token: "token-nuevo" });

    const { container, cleanup } = await render();

    const button = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Generar enlace de activación",
    );
    await act(async () => {
      button?.click();
    });

    expect(container.textContent).toContain("token-nuevo");

    await cleanup();
  });
});
