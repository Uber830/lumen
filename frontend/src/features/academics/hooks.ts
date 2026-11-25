// =============================================================================
// The academic hooks: periods, courses, subjects, assignments, enrollments.
// -----------------------------------------------------------------------------
// These used to read and write PostgREST directly from the browser.
// They talk to the API now.
//
// Types live in `./types`: entities and the hook input shapes. This
// file only wires React Query to the API, so the shapes stay in one
// place and the module is self-contained.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { cycleKeys } from "@/lib/school/cycles";
import type {
  AcademicPeriod,
  Course,
  CourseSubject,
  CourseSubjectSummary,
  CourseSummary,
  CreateAcademicPeriodInput,
  CreateCourseInput,
  CreateCourseSubjectInput,
  CreateStudentEnrollmentInput,
  CreateSubjectInput,
  CreateTeacherAssignmentInput,
  SchoolMember,
  StudentEnrollment,
  Subject,
  TeacherAssignment,
  UpdateAcademicPeriodInput,
  UpdateCourseInput,
  UpdateSubjectInput,
  UpdateTeacherAssignmentInput,
} from "@/features/academics/types";

export const queryKeys = {
  periods: (schoolId: string) => ["academic_periods", schoolId] as const,
  courses: (schoolId: string) => ["courses", schoolId] as const,
  subjects: (schoolId: string) => ["subjects", schoolId] as const,
  courseSubjects: (schoolId: string) => ["course_subjects", schoolId] as const,
  teacherAssignments: (schoolId: string) => ["teacher_assignments", schoolId] as const,
  studentEnrollments: (schoolId: string) => ["student_enrollments", schoolId] as const,
  members: (schoolId: string) => ["school_members", schoolId] as const,
};

/**
 * The lists that show the academic structure.
 *
 * The panel reads the courses, the subjects and the assignments from
 * the endpoints of the school (`/v1/school/courses`), and the forms
 * read them from the academic ones. When the structure changes, both
 * have to be asked again: with only one of them, the list keeps
 * showing what was there before and the panel asks for a reload.
 */
function invalidateStructure(qc: ReturnType<typeof useQueryClient>, schoolId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.courses(schoolId) });
  qc.invalidateQueries({ queryKey: queryKeys.subjects(schoolId) });
  qc.invalidateQueries({ queryKey: queryKeys.courseSubjects(schoolId) });
  qc.invalidateQueries({ queryKey: ["school", "courses"] });
  qc.invalidateQueries({ queryKey: ["school", "subjects"] });
  qc.invalidateQueries({ queryKey: ["school", "assignments"] });
}

// ---------------------------------------------------------------------------
// Academic periods
// ---------------------------------------------------------------------------

export function useAcademicPeriods(
  schoolId: string | null,
): UseQueryResult<AcademicPeriod[], Error> {
  return useQuery({
    queryKey: schoolId ? queryKeys.periods(schoolId) : ["academic_periods", "none"],
    enabled: !!schoolId,
    queryFn: () => api.get<AcademicPeriod[]>("/v1/academics/periods"),
  });
}

export function useCreateAcademicPeriod(
  schoolId: string,
): UseMutationResult<AcademicPeriod, Error, CreateAcademicPeriodInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<AcademicPeriod>("/v1/academics/periods", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.periods(schoolId) });
      // The list of the school reads another key: without this, the
      // period that was just created does not show up until a reload.
      qc.invalidateQueries({ queryKey: cycleKeys.periods() });
    },
  });
}

export function useUpdateAcademicPeriod(
  schoolId: string,
): UseMutationResult<AcademicPeriod, Error, UpdateAcademicPeriodInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => api.patch<AcademicPeriod>(`/v1/academics/periods/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.periods(schoolId) });
      qc.invalidateQueries({ queryKey: cycleKeys.periods() });
    },
  });
}

export function useDeleteAcademicPeriod(schoolId: string): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/v1/academics/periods/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.periods(schoolId) });
      qc.invalidateQueries({ queryKey: cycleKeys.periods() });
    },
  });
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export function useCourses(schoolId: string | null): UseQueryResult<CourseSummary[], Error> {
  return useQuery({
    queryKey: schoolId ? queryKeys.courses(schoolId) : ["courses", "none"],
    enabled: !!schoolId,
    queryFn: () => api.get<CourseSummary[]>("/v1/academics/courses"),
  });
}

export function useCreateCourse(
  schoolId: string,
): UseMutationResult<Course, Error, CreateCourseInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<Course>("/v1/academics/courses", input),
    onSuccess: () => {
      invalidateStructure(qc, schoolId);
    },
  });
}

export function useUpdateCourse(
  schoolId: string,
): UseMutationResult<Course, Error, UpdateCourseInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => api.patch<Course>(`/v1/academics/courses/${id}`, patch),
    onSuccess: () => {
      invalidateStructure(qc, schoolId);
    },
  });
}

export function useDeleteCourse(schoolId: string): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/v1/academics/courses/${id}`),
    onSuccess: () => {
      invalidateStructure(qc, schoolId);
    },
  });
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export function useSubjects(schoolId: string | null): UseQueryResult<Subject[], Error> {
  return useQuery({
    queryKey: schoolId ? queryKeys.subjects(schoolId) : ["subjects", "none"],
    enabled: !!schoolId,
    queryFn: () => api.get<Subject[]>("/v1/academics/subjects"),
  });
}

export function useCreateSubject(
  schoolId: string,
): UseMutationResult<Subject, Error, CreateSubjectInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<Subject>("/v1/academics/subjects", input),
    onSuccess: () => {
      invalidateStructure(qc, schoolId);
    },
  });
}

export function useUpdateSubject(
  schoolId: string,
): UseMutationResult<Subject, Error, UpdateSubjectInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => api.patch<Subject>(`/v1/academics/subjects/${id}`, patch),
    onSuccess: () => {
      invalidateStructure(qc, schoolId);
    },
  });
}

export function useDeleteSubject(schoolId: string): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/v1/academics/subjects/${id}`),
    onSuccess: () => {
      invalidateStructure(qc, schoolId);
    },
  });
}

// ---------------------------------------------------------------------------
// Course subjects
// ---------------------------------------------------------------------------

export function useCourseSubjects(
  schoolId: string | null,
): UseQueryResult<CourseSubjectSummary[], Error> {
  return useQuery({
    queryKey: schoolId ? queryKeys.courseSubjects(schoolId) : ["course_subjects", "none"],
    enabled: !!schoolId,
    queryFn: () => api.get<CourseSubjectSummary[]>("/v1/academics/course-subjects"),
  });
}

export function useCreateCourseSubject(
  schoolId: string,
): UseMutationResult<CourseSubject, Error, CreateCourseSubjectInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<CourseSubject>("/v1/academics/course-subjects", input),
    onSuccess: () => {
      invalidateStructure(qc, schoolId);
    },
  });
}

export function useDeleteCourseSubject(schoolId: string): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/v1/academics/course-subjects/${id}`),
    onSuccess: () => {
      invalidateStructure(qc, schoolId);
    },
  });
}

// ---------------------------------------------------------------------------
// Teacher assignments
// ---------------------------------------------------------------------------

export function useTeacherAssignments(
  schoolId: string | null,
): UseQueryResult<TeacherAssignment[], Error> {
  return useQuery({
    queryKey: schoolId ? queryKeys.teacherAssignments(schoolId) : ["teacher_assignments", "none"],
    enabled: !!schoolId,
    queryFn: () => api.get<TeacherAssignment[]>("/v1/academics/teacher-assignments"),
  });
}

export function useCreateTeacherAssignment(
  schoolId: string,
): UseMutationResult<TeacherAssignment, Error, CreateTeacherAssignmentInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<TeacherAssignment>("/v1/academics/teacher-assignments", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teacherAssignments(schoolId) });
      qc.invalidateQueries({ queryKey: ["school", "assignments"] });
      qc.invalidateQueries({ queryKey: queryKeys.courseSubjects(schoolId) });
    },
  });
}

export function useUpdateTeacherAssignment(
  schoolId: string,
): UseMutationResult<TeacherAssignment, Error, UpdateTeacherAssignmentInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) =>
      api.patch<TeacherAssignment>(`/v1/academics/teacher-assignments/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teacherAssignments(schoolId) });
      qc.invalidateQueries({ queryKey: ["school", "assignments"] });
      qc.invalidateQueries({ queryKey: queryKeys.courseSubjects(schoolId) });
    },
  });
}

export function useDeleteTeacherAssignment(
  schoolId: string,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/v1/academics/teacher-assignments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teacherAssignments(schoolId) });
      qc.invalidateQueries({ queryKey: ["school", "assignments"] });
      qc.invalidateQueries({ queryKey: queryKeys.courseSubjects(schoolId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Student enrollments
// ---------------------------------------------------------------------------

export function useStudentEnrollments(
  schoolId: string | null,
): UseQueryResult<StudentEnrollment[], Error> {
  return useQuery({
    queryKey: schoolId ? queryKeys.studentEnrollments(schoolId) : ["student_enrollments", "none"],
    enabled: !!schoolId,
    queryFn: () => api.get<StudentEnrollment[]>("/v1/academics/student-enrollments"),
  });
}

export function useCreateStudentEnrollment(
  schoolId: string,
): UseMutationResult<StudentEnrollment, Error, CreateStudentEnrollmentInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<StudentEnrollment>("/v1/academics/student-enrollments", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.studentEnrollments(schoolId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses(schoolId) });
    },
  });
}

export function useDeleteStudentEnrollment(
  schoolId: string,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/v1/academics/student-enrollments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.studentEnrollments(schoolId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses(schoolId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export function useSchoolMembers(
  schoolId: string | null,
  role?: string,
  includeRevoked = false,
): UseQueryResult<SchoolMember[], Error> {
  return useQuery({
    queryKey: schoolId
      ? [...queryKeys.members(schoolId), role ?? "all", includeRevoked ? "withRevoked" : "active"]
      : ["school_members", "none"],
    enabled: !!schoolId,
    queryFn: () =>
      api.get<SchoolMember[]>("/v1/academics/members", {
        ...(role ? { role } : {}),
        ...(includeRevoked ? { include_revoked: true } : {}),
      }),
  });
}
