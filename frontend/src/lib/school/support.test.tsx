import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  openCaseCount,
  useUploadSupportAttachment,
  type SupportCaseSummary,
} from "@/lib/school/support";

/**
 * The counter of the rail: how many requests of the school are still
 * open.
 *
 * A resolved case is not work that is waiting: it leaves the counter.
 */
describe("the counter of the open cases", () => {
  const caseOf = (status: string): SupportCaseSummary => ({
    id: "1",
    code: "SOL-1043",
    title: "Los docentes no ven el material",
    category: "problema_tecnico",
    channel: "formulario_colegio",
    level: "aviso",
    status,
    opened_at: "2026-11-14T09:15:00Z",
    opened_by: null,
    opened_by_name: "Ana Restrepo",
    messages: 2,
  });

  it("counts the cases that are not resolved", () => {
    expect(openCaseCount([caseOf("abierto"), caseOf("en_espera"), caseOf("resuelto")])).toBe(2);
  });

  it("is zero when there are no cases", () => {
    expect(openCaseCount([])).toBe(0);
  });

  it("does not fail when the list did not arrive", () => {
    expect(openCaseCount(undefined)).toBe(0);
  });
});

/**
 * The upload of an attachment.
 *
 * The file goes to the API in a `FormData`, straight to the address of
 * the API. The test checks that the request leaves for the right place:
 * the address of the API is a string, and calling it as if it were a
 * function breaks the upload.
 */
describe("the upload of an attachment", () => {
  const requests: string[] = [];

  beforeEach(() => {
    requests.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        requests.push(url);
        return new Response(JSON.stringify({ id: "att-1", name: "prueba.txt", size: 10 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("goes to the endpoint of the API", async () => {
    const { apiBaseUrl } = await import("@/lib/api/client");
    const client = new QueryClient();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let upload: ReturnType<typeof useUploadSupportAttachment> | null = null;

    function Probe() {
      upload = useUploadSupportAttachment();
      return null;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });

    const file = new File(["contenido"], "prueba.txt", { type: "text/plain" });
    await act(async () => {
      await upload!.mutateAsync(file);
    });

    expect(requests).toEqual([`${apiBaseUrl}/v1/school/support/attachments`]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
