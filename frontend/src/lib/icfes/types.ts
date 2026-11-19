// =============================================================================
// ICFES domain types.
// -----------------------------------------------------------------------------
// The question bank and simulation entities, the student-facing attempt
// shapes (answer keys never reach the browser), and the hook inputs.
// =============================================================================

// --- Entities --------------------------------------------------------------

export type IcfesQuestion = {
  id: string;
  school_id: string;
  area: string;
  grado: string;
  difficulty: string;
  competencia: string | null;
  prompt: string;
  reading: string | null;
  options: string[];
  points: string;
  created_at: string;
  updated_at: string;
};

export type IcfesAnswerKey = {
  id: string;
  school_id: string;
  question_id: string;
  correct_index: number;
  created_at: string;
  updated_at: string;
};

export type IcfesSimulation = {
  id: string;
  school_id: string;
  course_subject_id: string;
  posted_by: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  available_from: string | null;
  available_until: string | null;
  is_published: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  created_at: string;
  updated_at: string;
  question_count: number;
};

export type IcfesComparison = {
  simulation_id: string;
  title: string;
  course_subject_id: string;
  available_from: string | null;
  available_until: string | null;
  student_count: number;
  avg_global: number;
  avg_max: number;
  avg_percent: number;
  by_area: Array<{ area: string; correct: number; total: number; percent: number }>;
};

// --- Attempt lifecycle (student-facing, no answer keys) --------------------

export type IcfesQuestionForStudent = {
  id: string;
  area: string;
  prompt: string;
  reading: string | null;
  options: string[];
  points: number;
};

export type StartAttemptResponse = {
  attempt_id: string;
  simulation_id: string;
  questions: IcfesQuestionForStudent[];
};

export type FinalizeAnswer = {
  question_id: string;
  chosen_index: number | null;
};

export type FinalizeResponse = {
  attempt_id: string;
  global_score: number;
  max_score: number;
  percent: number;
  puntaje_global: number;
  by_area: Array<{ area: string; correct: number; total: number; percent: number }>;
  correct_count: number;
  question_count: number;
};

// --- Hook inputs -----------------------------------------------------------

export type StartIcfesAttemptInput = {
  simulationId: string;
};

export type FinalizeIcfesAttemptInput = {
  attemptId: string;
  answers: FinalizeAnswer[];
};
