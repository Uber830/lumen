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

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

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
  /** The courses of the student, by id: the edit form works with ids. */
  course_ids?: string[];
  /** The course subjects of the teacher, by id: the edit form works with ids. */
  course_subject_ids?: string[];
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

/** One page of a list the server cuts. */
export type Page<T> = {
  items: T[];
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
  coursesPage: (page: number) => ["school", "courses", "page", page] as const,
  courseOptions: () => ["school", "courses", "options"] as const,
  subjectsPage: (offered: boolean | undefined, page: number) =>
    ["school", "subjects", "page", offered ?? "all", page] as const,
  subjectOptions: () => ["school", "subjects", "options"] as const,
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

/** One page of the courses of the school, cut in the server. */
export function useSchoolCoursesPage(page = 1): UseQueryResult<Page<SchoolCourse>, Error> {
  return useQuery({
    queryKey: communityKeys.coursesPage(page),
    queryFn: () => api.get<Page<SchoolCourse>>(`/v1/school/courses?page=${page}&per_page=10`),
    placeholderData: (previous) => previous,
  });
}

/**
 * Every course of the school, for the forms that offer a choice.
 *
 * The list is not cut here: the selector needs all of them.
 */
export function useSchoolCourseOptions(): UseQueryResult<SchoolCourse[], Error> {
  return useQuery({
    queryKey: communityKeys.courseOptions(),
    queryFn: () => api.get<SchoolCourse[]>("/v1/school/courses/options"),
  });
}

/**
 * One page of the subjects of the school.
 *
 * `offered` says which ones come back: the ones that are taught in
 * some course, or the ones that are in no course.
 */
export function useSchoolSubjects(
  options: { offered?: boolean; page?: number } = {},
): UseQueryResult<Page<SchoolSubject>, Error> {
  const offered = options.offered;
  const page = options.page ?? 1;
  const query = new URLSearchParams({ page: String(page), per_page: "10" });
  if (offered !== undefined) query.set("offered", String(offered));
  return useQuery({
    queryKey: communityKeys.subjectsPage(offered, page),
    queryFn: () => api.get<Page<SchoolSubject>>(`/v1/school/subjects?${query}`),
    placeholderData: (previous) => previous,
  });
}

/** Every subject of the school, for the forms that offer a choice. */
export function useSchoolSubjectOptions(): UseQueryResult<SchoolSubject[], Error> {
  return useQuery({
    queryKey: communityKeys.subjectOptions(),
    queryFn: () => api.get<SchoolSubject[]>("/v1/school/subjects/options"),
  });
}

/** What the admin can change of a member of the community. */
export type UpdateMemberInput = {
  membershipId: string;
  full_name?: string;
  email?: string;
  /** The courses of a student. */
  course_ids?: string[];
  /** The course subjects of a teacher. */
  course_subject_ids?: string[];
};

/** The member, after the edit. */
export type UpdatedMember = {
  membership_id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  course_ids: string[];
  course_subject_ids: string[];
};

/**
 * Edit a teacher or a student of the school.
 *
 * The list of the community and the assignments change with it: the
 * admin sees the new state without reloading.
 */
export function useUpdateMember(): UseMutationResult<UpdatedMember, Error, UpdateMemberInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, ...changes }) =>
      api.patch<UpdatedMember>(`/v1/school/members/${membershipId}`, changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school", "teachers"] });
      qc.invalidateQueries({ queryKey: ["school", "students"] });
      qc.invalidateQueries({ queryKey: ["school", "assignments"] });
      qc.invalidateQueries({ queryKey: ["teacher_assignments"] });
      qc.invalidateQueries({ queryKey: ["student_enrollments"] });
    },
  });
}
