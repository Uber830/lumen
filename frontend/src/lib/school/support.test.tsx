import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSchoolSupportCases, useUploadSupportAttachment } from "@/lib/school/support";

/**
 * The list of the requests of the school.
 *
 * The list is cut in the server, like the courses and the assignments:
 * the browser asks for one page, not for everything.
 */
describe("the list of the requests", () => {
  const requests: string[] = [];

  beforeEach(() => {
    requests.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        requests.push(url);
        return new Response(
          JSON.stringify({
            items: [],
            total: 12,
            page: 2,
            per_page: 10,
            pages: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for the page it shows", async () => {
    const { apiBaseUrl } = await import("@/lib/api/client");
    const client = new QueryClient();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let page: { total: number; pages: number } | null = null;

    function Probe() {
      const cases = useSchoolSupportCases({ page: 2, per_page: 10 });
      page = cases.data ?? null;
      return null;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });

    // The answer arrives a moment later: the query is in flight.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(requests[0]).toContain(`${apiBaseUrl}/v1/school/support/cases?`);
    expect(requests[0]).toContain("page=2");
    expect(requests[0]).toContain("per_page=10");
    expect(page!.total).toBe(12);
    expect(page!.pages).toBe(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("sends the search to the server", async () => {
    const { apiBaseUrl } = await import("@/lib/api/client");
    const client = new QueryClient();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Probe() {
      useSchoolSupportCases({ page: 1, per_page: 10, q: "impresora" });
      return null;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // The search does not run in the browser: it looks for the title or
    // the code of the request over every case of the school.
    expect(requests[0]).toContain(`${apiBaseUrl}/v1/school/support/cases?`);
    expect(requests[0]).toContain("q=impresora");

    await act(async () => {
      root.unmount();
    });
    container.remove();
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
