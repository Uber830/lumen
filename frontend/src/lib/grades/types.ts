// =============================================================================
// Grades domain types.
// -----------------------------------------------------------------------------
// The grade entity, the hook input shapes, and the two student-sheet
// shapes. Note the student sheet comes in two flavours:
//
//   StudentGradesResponse — as the API sends it (scores as strings)
//   StudentGrades         — as the UI uses it (scores parsed to numbers)
//
// Keeping both named here makes the string->number conversion in the
// hook explicit and keeps every grade shape in one place.
// =============================================================================

// --- Entity ----------------------------------------------------------------

export type Grade = {
  id: string;
  school_id: string;
  course_subject_id: string;
  student_id: string;
  academic_period_id: string;
  // Decimal on the Colombian 0-5 scale, sent as a string to keep precision.
  score: string;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

// --- Student sheet: API shape (scores as strings) --------------------------

export type StudentGradeRowResponse = {
  course_subject_id: string;
  subject_name: string;
  subject_area: string | null;
  grades: Record<string, string | null>;
  average: string | null;
};

export type StudentGradesResponse = {
  rows: StudentGradeRowResponse[];
  periods: Array<{ id: string; name: string }>;
};

// --- Student sheet: UI shape (scores parsed to numbers) --------------------

export type StudentGradeRow = {
  course_subject_id: string;
  subject_name: string;
  subject_area: string | null;
  // The score per period, keyed by the period name.
  grades: Record<string, number | null>;
  average: number | null;
};

export type StudentGrades = {
  rows: StudentGradeRow[];
  periods: Array<{ id: string; name: string }>;
};

// --- Hook inputs -----------------------------------------------------------

export type RecordGradeInput = {
  course_subject_id: string;
  student_id: string;
  academic_period_id: string;
  // 0-5 on the Colombian scale. Sent as a number; the API stores a decimal.
  score: number;
  notes?: string | null;
};

export type UpdateGradeInput = {
  id: string;
  score?: number;
  notes?: string | null;
};
