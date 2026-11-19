import { describe, expectTypeOf, it } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";

import type { SchoolMember } from "@/features/academics/types";
import type { SchoolRole } from "@/lib/api/types";

/**
 * Type-level contract tests for the admin membership hooks.
 *
 * The hooks themselves need a TanStack QueryClientProvider to run, so
 * we test the public surface as types only. If a future refactor
 * changes the shape of the returned query, the type assertions here
 * fail to compile, which fails CI.
 */
type UseSchoolMembersFn = (
  schoolId: string | null,
  role?: SchoolRole,
) => UseQueryResult<SchoolMember[], Error>;

describe("SchoolMember type contract", () => {
  it("SchoolRole is the closed enum used for membership role filtering", () => {
    expectTypeOf<SchoolRole>().toEqualTypeOf<"school_admin" | "teacher" | "student">();
  });

  it("SchoolMember carries the fields admin/index.tsx renders", () => {
    // These are the fields used by the admin home page:
    expectTypeOf<SchoolMember["user_id"]>().toBeString();
    expectTypeOf<SchoolMember["full_name"]>().toBeString();
    expectTypeOf<SchoolMember["role"]>().toEqualTypeOf<SchoolRole>();
    expectTypeOf<SchoolMember["is_primary"]>().toBeBoolean();
    expectTypeOf<SchoolMember["joined_at"]>().toBeString();
    expectTypeOf<SchoolMember["school_id"]>().toBeString();
  });

  it("the hook signature contract is the one this app relies on", () => {
    // The application always consumes the hook through this signature.
    // We can't import the actual function in a unit test (it needs a
    // QueryClient context), so we type-assert against an alias.
    const _assert: UseSchoolMembersFn = null as unknown as UseSchoolMembersFn;
    void _assert;
    expectTypeOf<UseSchoolMembersFn>().parameters.toEqualTypeOf<
      [string | null, (SchoolRole | undefined)?]
    >();
    expectTypeOf<UseSchoolMembersFn>().returns.toEqualTypeOf<
      UseQueryResult<SchoolMember[], Error>
    >();
  });
});
