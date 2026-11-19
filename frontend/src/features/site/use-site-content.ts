// =============================================================================
// The content of the public site.
// -----------------------------------------------------------------------------
// One call fills the whole landing: the copy, the figures and the
// catalog come from the same response, so the page never waits on a
// second request.
//
// The content is cached for five minutes, the same window the API
// serves it with.
// =============================================================================

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { SitePayload } from "./types";

export const siteContentKey = ["site", "content"] as const;

export function fetchSiteContent(): Promise<SitePayload> {
  return api.get<SitePayload>("/v1/public/site");
}

export function useSiteContent() {
  return useQuery({
    queryKey: siteContentKey,
    queryFn: fetchSiteContent,
    staleTime: 5 * 60 * 1000,
  });
}
