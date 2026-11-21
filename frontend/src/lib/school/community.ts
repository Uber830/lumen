// =============================================================================
// The community of the school: its teachers, its students, its courses
// and its subjects.
// -----------------------------------------------------------------------------
// The lists come from the server, already filtered and paginated: a
// school with two hundred students does not pull the whole list into the
// browser to filter it there.
//
// Two signals describe a member, and they say different things:
//
//   status   whether the member belongs to the school right now.
//   access   whether the member can reach the content of the school. A
//            teacher without an assignment has no course, and a course
//            without an assignment has no content to see.
// =============================================================================

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

/** One member of the community, as the API describes it. */
export type SchoolMemberRow = {
  membership_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  joined_at: string;
  revoked_at: string | null;
  account_activated: boolean;
  /** The courses of the member: taught by a teacher, attended by a student. */
  courses: string[];
  /** The subjects of the teacher. */
  subjects?: string[];
  /** The average of the student. `null` when it has no grades. */
  average?: number | null;
  /** `activado` or `pendiente`: one signal, not two loose badges. */
  access: "activado" | "pendiente";
  /** Why the access is pending, in the words of the panel. */
  access_reason: string | null;
  /** `activo` or `inactivo`. */
  status: "activo" | "inactivo";
};

/** A page of the community. */
export type MemberPage = {
  items: SchoolMemberRow[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
};

/** One course of the school. */
export type SchoolCourse = {
  id: string;
  name: string;
  grade_label: string;
  subject_count: number;
  teacher_count: number;
  student_count: number;
  status: "activo" | "inactivo";
};

/** One subject of the school. */
export type SchoolSubject = {
  id: string;
  name: string;
  area: string | null;
  course_count: number;
  courses: string[];
};

/** The filters of the community lists. */
export type MemberFilters = {
  q?: string;
  status?: string;
  course_id?: string;
  page?: number;
};

export const communityKeys = {
  teachers: (filters: MemberFilters) => ["school", "teachers", filters] as const,
  students: (filters: MemberFilters) => ["school", "students", filters] as const,
  courses: () => ["school", "courses"] as const,
  subjects: () => ["school", "subjects"] as const,
};

/**
 * The query of the list: the filters travel to the server, they are
 * never applied in the browser.
 */
export function buildMemberQuery(filters: MemberFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.course_id && filters.course_id !== "all") {
    params.set("course_id", filters.course_id);
  }
  params.set("page", String(filters.page ?? 1));
  params.set("per_page", "10");
  return params.toString();
}

/** The teachers of the school, filtered and paginated in the server. */
export function useSchoolTeachers(filters: MemberFilters): UseQueryResult<MemberPage, Error> {
  return useQuery({
    queryKey: communityKeys.teachers(filters),
    queryFn: () => api.get<MemberPage>(`/v1/school/teachers?${buildMemberQuery(filters)}`),
  });
}

/** The students of the school, filtered and paginated in the server. */
export function useSchoolStudents(filters: MemberFilters): UseQueryResult<MemberPage, Error> {
  return useQuery({
    queryKey: communityKeys.students(filters),
    queryFn: () => api.get<MemberPage>(`/v1/school/students?${buildMemberQuery(filters)}`),
  });
}

/** The courses of the school, with the structure they hold. */
export function useSchoolCourses(): UseQueryResult<SchoolCourse[], Error> {
  return useQuery({
    queryKey: communityKeys.courses(),
    queryFn: () => api.get<SchoolCourse[]>("/v1/school/courses"),
  });
}

/** The subjects of the school, with the courses they are taught in. */
export function useSchoolSubjects(): UseQueryResult<SchoolSubject[], Error> {
  return useQuery({
    queryKey: communityKeys.subjects(),
    queryFn: () => api.get<SchoolSubject[]>("/v1/school/subjects"),
  });
}
