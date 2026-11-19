import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/features/site/components/login-page";
import { destinationForSession, safeNext } from "@/features/site/destination";
import { flush, typeInto } from "@/test/site-helpers";
import type { SessionInfo } from "@/lib/api/types";

// The development password of the seeded accounts. It is a fixture of
// the test, not a secret: it is documented in the README and only
// works against the local database.
const SEED_LOGIN = "lumen-dev";

async function render(onSignedIn = vi.fn()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<LoginPage onSignedIn={onSignedIn} contactEmail="hola@lumen.co" />);
  });
  await flush();

  return {
    container,
    onSignedIn,
    email: container.querySelector<HTMLInputElement>("input[name='email']")!,
    password: container.querySelector<HTMLInputElement>("input[name='password']")!,
    submit: container.querySelector<HTMLButtonElement>("button[type='submit']")!,
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Make the API answer with this status and body. */
function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      // The client refreshes the session once before giving up on a
      // 401; the refresh fails the same way.
      if (url.includes("/refresh")) {
        return new Response(JSON.stringify({ detail: "nope", code: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

describe("LoginPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the button disabled until the email looks like an email", async () => {
    const { container, email, submit, cleanup } = await render();
    const form = container.querySelector("form")!;

    expect(submit.disabled).toBe(true);

    await typeInto(email, "ana@colegio.edu.co");
    expect(submit.disabled).toBe(false);

    await typeInto(email, "ana");
    expect(submit.disabled).toBe(true);

    await typeInto(email, "ana@colegio.edu.co");
    expect(submit.disabled).toBe(false);

    expect(form.getAttribute("aria-busy")).toBe("false");
    await cleanup();
  });

  it("answers wrong credentials with a generic message", async () => {
    respondWith(401, {
      detail: "El correo o la contraseña no coinciden.",
      code: "invalid_credentials",
    });

    const { container, email, password, submit, cleanup } = await render();

    await typeInto(email, "ana@colegio.edu.co");
    await typeInto(password, "incorrecta");
    await act(async () => {
      submit.click();
    });
    await flush();

    const alert = container.querySelector("[role='alert']");
    expect(alert?.textContent).toContain("El correo o la contraseña no coinciden.");
    // The message never says whether the account exists.
    expect(alert?.textContent).not.toContain("ana@colegio.edu.co");
    expect(alert?.textContent).not.toMatch(/no existe|no registrado/i);

    await cleanup();
  });

  it("says when the account is locked", async () => {
    respondWith(423, { detail: "La cuenta está bloqueada.", code: "account_locked" });

    const { container, email, password, submit, cleanup } = await render();

    await typeInto(email, "ana@colegio.edu.co");
    await typeInto(password, SEED_LOGIN);
    await act(async () => {
      submit.click();
    });
    await flush();

    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      "La cuenta está bloqueada.",
    );

    await cleanup();
  });

  it("counts down when the attempts run out", async () => {
    respondWith(429, {
      detail: "Demasiados intentos.",
      code: "rate_limited",
      retry_after: 120,
    });

    const { container, email, password, submit, cleanup } = await render();

    await typeInto(email, "ana@colegio.edu.co");
    await typeInto(password, SEED_LOGIN);
    await act(async () => {
      submit.click();
    });
    await flush();

    const alert = container.querySelector("[role='alert']");
    expect(alert?.textContent).toContain("Demasiados intentos");
    expect(alert?.textContent).toContain("2 minutos");
    // The button stays closed while the countdown runs.
    expect(submit.disabled).toBe(true);

    await cleanup();
  });

  it("offers a retry when the server does not answer", async () => {
    respondWith(503, { detail: "service unavailable", code: "service_unavailable" });

    const { container, email, password, submit, cleanup } = await render();

    await typeInto(email, "ana@colegio.edu.co");
    await typeInto(password, SEED_LOGIN);
    await act(async () => {
      submit.click();
    });
    await flush();

    const alert = container.querySelector("[role='alert']");
    expect(alert?.textContent).toContain("No pudimos conectar con el servidor.");
    expect(alert?.textContent).toContain("Reintentar");

    await cleanup();
  });

  it("signs in and hands the session over", async () => {
    respondWith(200, {
      tokens: { access_token: "a", refresh_token: "r", token_type: "Bearer", expires_in: 900 },
      session: {
        user: { id: "1", email: "ana@colegio.edu.co" },
        profile: null,
        memberships: [
          {
            id: "m",
            school_id: "s",
            role: "teacher",
            admin_role: null,
            is_primary: true,
            joined_at: "",
          },
        ],
        platform_role: null,
        primary_school_id: "s",
        school: null,
      },
      supabase_token: null,
    });

    const onSignedIn = vi.fn();
    const { email, password, submit, cleanup } = await render(onSignedIn);

    await typeInto(email, "ana@colegio.edu.co");
    await typeInto(password, SEED_LOGIN);
    await act(async () => {
      submit.click();
    });
    await flush();

    expect(onSignedIn).toHaveBeenCalledOnce();
    await cleanup();
  });

  it("shows illustrative rows, never real schools", async () => {
    const { container, cleanup } = await render();

    expect(container.textContent).toContain("Colegio Alfa");
    expect(container.textContent).toContain("Habilitado");
    // The names of the tenants of the platform are not here.
    expect(container.textContent).not.toContain("San Juan");
    expect(container.textContent).not.toContain("admin@cms.edu.co");

    await cleanup();
  });
});

describe("destinationForSession", () => {
  const session = (overrides: Partial<SessionInfo> = {}): SessionInfo => ({
    user: { id: "1", email: "ana@colegio.edu.co" },
    profile: null,
    memberships: [],
    platform_role: null,
    primary_school_id: null,
    school: null,
    permissions: [],
    ...overrides,
  });

  it("sends each role to its own panel", () => {
    expect(destinationForSession(session({ platform_role: "platform_admin" }))).toBe("/super");
    expect(
      destinationForSession(
        session({
          memberships: [
            {
              id: "m",
              school_id: "s",
              role: "school_admin",
              admin_role: "principal",
              is_primary: true,
              joined_at: "",
            },
          ],
        }),
      ),
    ).toBe("/admin");
    expect(
      destinationForSession(
        session({
          memberships: [
            {
              id: "m",
              school_id: "s",
              role: "teacher",
              admin_role: null,
              is_primary: true,
              joined_at: "",
            },
          ],
        }),
      ),
    ).toBe("/docente");
    expect(
      destinationForSession(
        session({
          memberships: [
            {
              id: "m",
              school_id: "s",
              role: "student",
              admin_role: null,
              is_primary: true,
              joined_at: "",
            },
          ],
        }),
      ),
    ).toBe("/estudiante");
  });
});

describe("safeNext", () => {
  it("keeps the internal routes", () => {
    expect(safeNext("/docente/materia")).toBe("/docente/materia");
  });

  it("refuses anything that leaves the site", () => {
    expect(safeNext("https://evil.example/login")).toBeNull();
    expect(safeNext("//evil.example/login")).toBeNull();
    expect(safeNext("\\\\evil.example")).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
