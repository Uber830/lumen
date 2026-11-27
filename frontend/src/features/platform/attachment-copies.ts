// =============================================================================
// The copies of the files that an answer carries.
// -----------------------------------------------------------------------------
// A file lives in the store of the school of the case, because that is
// the copy the school reads. When the platform answers several cases at
// once, the cases of the same school share a single copy and the ones of
// another school get their own.
//
// The plan is computed here, apart from the composer, because it is a
// rule of the product and not a detail of the screen.
// =============================================================================

import type { PickedAttachment } from "@/features/admin/support-attachments";
import type { CaseSummary } from "@/lib/platform/types";

/** One school that receives a copy of the files. */
export type AttachmentCopy = {
  /** The school the copies belong to. */
  schoolId: string;
  /** The case that opens the door of the upload for this school. */
  caseId: string;
  /** The files to copy there. */
  attachments: PickedAttachment[];
};

/**
 * The copies to make, one per school.
 *
 * The cases of the same school are answered with the same copies, so
 * the file is stored once. The cases without a school have nowhere to
 * keep a file: they are left out and the answer goes without it.
 */
export function planAttachmentCopies(
  cases: CaseSummary[],
  attachments: PickedAttachment[],
): AttachmentCopy[] {
  const copies = new Map<string, AttachmentCopy>();

  for (const item of cases) {
    if (!item.school_id) continue;
    const existing = copies.get(item.school_id);
    if (existing) continue;
    copies.set(item.school_id, {
      schoolId: item.school_id,
      caseId: item.id,
      attachments: [...attachments],
    });
  }

  return [...copies.values()];
}

/**
 * The paths of the files that the answer of a case carries.
 *
 * The paths are stored per school: the same file has one copy in the
 * store of each school, and each one keeps its own path.
 */
export function attachmentPathsForCase(
  copies: AttachmentCopy[],
  schoolId: string | null,
  paths: Map<string, string[]>,
): string[] {
  if (!schoolId) return [];
  if (!copies.some((item) => item.schoolId === schoolId)) return [];
  return paths.get(schoolId) ?? [];
}
