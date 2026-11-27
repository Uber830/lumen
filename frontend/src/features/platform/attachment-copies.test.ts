import { describe, expect, it } from "vitest";

import {
  attachmentPathsForCase,
  planAttachmentCopies,
} from "@/features/platform/attachment-copies";
import type { PickedAttachment } from "@/features/admin/support-attachments";
import type { CaseSummary } from "@/lib/platform/types";

function supportCase(id: string, schoolId: string | null): CaseSummary {
  return {
    id,
    code: `SOL-${id}`,
    title: `Caso ${id}`,
    level: "info",
    status: "abierto",
    school_id: schoolId,
    school_name: schoolId ? `Colegio ${schoolId}` : null,
    opened_by: null,
    opened_by_name: "Colegio",
    channel: "formulario_colegio",
    category: "problema_tecnico",
    opened_at: "2026-01-01T00:00:00Z",
    message_count: 1,
  } as CaseSummary;
}

function attachment(id: string): PickedAttachment {
  return { id, name: `${id}.pdf`, size: 1024 };
}

describe("the copies of the files of an answer", () => {
  it("keeps one copy for each school", () => {
    const copies = planAttachmentCopies(
      [supportCase("a", "s1"), supportCase("b", "s2")],
      [attachment("f1")],
    );

    expect(copies).toHaveLength(2);
    expect(copies.map((copy) => copy.schoolId)).toEqual(["s1", "s2"]);
    expect(copies.map((copy) => copy.caseId)).toEqual(["a", "b"]);
  });

  it("shares the copy between the cases of the same school", () => {
    const copies = planAttachmentCopies(
      [supportCase("a", "s1"), supportCase("b", "s1")],
      [attachment("f1")],
    );

    expect(copies).toHaveLength(1);
    expect(copies[0].caseId).toBe("a");
  });

  it("leaves out the cases that do not belong to a school", () => {
    const copies = planAttachmentCopies(
      [supportCase("a", "s1"), supportCase("b", null)],
      [attachment("f1")],
    );

    expect(copies.map((copy) => copy.schoolId)).toEqual(["s1"]);
  });

  it("gives each case the copy of its own school", () => {
    const copies = planAttachmentCopies(
      [supportCase("a", "s1"), supportCase("b", "s2"), supportCase("c", "s1")],
      [attachment("f1")],
    );
    const paths = new Map([
      ["s1", ["support-attachments/s1/f1.pdf"]],
      ["s2", ["support-attachments/s2/f1.pdf"]],
    ]);

    expect(attachmentPathsForCase(copies, "s1", paths)).toEqual(["support-attachments/s1/f1.pdf"]);
    expect(attachmentPathsForCase(copies, "s2", paths)).toEqual(["support-attachments/s2/f1.pdf"]);
    expect(attachmentPathsForCase(copies, null, paths)).toEqual([]);
  });

  it("does not give a copy to a school that was not answered", () => {
    const copies = planAttachmentCopies([supportCase("a", "s1")], [attachment("f1")]);
    const paths = new Map([["s2", ["support-attachments/s2/f1.pdf"]]]);

    expect(attachmentPathsForCase(copies, "s2", paths)).toEqual([]);
  });
});
