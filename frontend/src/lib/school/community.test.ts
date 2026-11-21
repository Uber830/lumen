import { describe, expect, it } from "vitest";

import { buildMemberQuery } from "@/lib/school/community";

/**
 * The community lists are filtered in the server: the school may have
 * hundreds of students and the browser never receives all of them.
 *
 * These tests check that the filters travel to the server, and that the
 * "all" values do not travel at all: sending `status=all` would make
 * the backend filter by a status that does not exist.
 */
describe("the query of the community lists", () => {
  it("asks for the first page when nothing is filtered", () => {
    expect(buildMemberQuery({})).toBe("page=1&per_page=10");
  });

  it("carries the search, the status and the course", () => {
    const query = new URLSearchParams(
      buildMemberQuery({ q: "lucia", status: "activo", course_id: "c1" }),
    );

    expect(query.get("q")).toBe("lucia");
    expect(query.get("status")).toBe("activo");
    expect(query.get("course_id")).toBe("c1");
    expect(query.get("page")).toBe("1");
    expect(query.get("per_page")).toBe("10");
  });

  it("does not send the filters that mean 'all'", () => {
    const query = new URLSearchParams(buildMemberQuery({ q: "", status: "all", course_id: "all" }));

    expect(query.has("q")).toBe(false);
    expect(query.has("status")).toBe(false);
    expect(query.has("course_id")).toBe(false);
  });

  it("carries the page that is asked for", () => {
    const query = new URLSearchParams(buildMemberQuery({ page: 3 }));

    expect(query.get("page")).toBe("3");
  });
});
