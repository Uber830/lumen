// =============================================================================
// The file helpers.
// -----------------------------------------------------------------------------
// Storage stays on Supabase. The browser uploads the files directly,
// with the short-lived token the backend mints, so the bucket's own
// RLS policies decide who may write where.
//
// The path conventions are the same as in
// `supabase/migrations/20260812220000_storage_buckets.sql` and are
// enforced by those policies.
// =============================================================================

import { storageAuthHeaders } from "@/lib/supabase/client";

export const BUCKETS = {
  schoolLogos: "school-logos",
  classContent: "class-content",
  taskSubmissions: "task-submissions",
  avatars: "avatars",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

export function classContentPath(
  schoolId: string,
  courseSubjectId: string,
  filename: string,
): string {
  return `${schoolId}/${courseSubjectId}/${safeFileName(filename)}`;
}

export function taskSubmissionPath(
  schoolId: string,
  taskId: string,
  studentId: string,
  filename: string,
): string {
  return `${schoolId}/${taskId}/${studentId}/${safeFileName(filename)}`;
}

/**
 * A file name that is safe to put in a storage path.
 *
 * The browser sends the name the user gave the file: it can have
 * spaces, accents or characters the storage API does not like. The
 * name keeps its extension, because the bucket policies read the
 * first segments of the path and nothing else.
 */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-120);
  return cleaned || "archivo";
}

/** The public URL of an object. It is stable: the bucket is public. */
export function publicUrl(bucket: BucketName, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Upload a file to a bucket.
 *
 * The token goes in the Authorization header: the storage API reads it
 * from there, and the bucket's policies decide whether the write is
 * allowed.
 */
export async function uploadFile(
  bucket: BucketName,
  path: string,
  file: File,
  options: { upsert?: boolean; contentType?: string } = {},
): Promise<{ path: string }> {
  const headers = await storageAuthHeaders();
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodePath(path)}`;

  const response = await fetch(url, {
    method: options.upsert ? "POST" : "PUT",
    headers: {
      ...headers,
      "Content-Type": options.contentType ?? file.type,
      ...(options.upsert ? { "x-upsert": "true" } : {}),
    },
    body: file,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`No se pudo subir el archivo: ${response.status} ${detail}`);
  }

  return { path };
}

/**
 * Remove a file from a bucket.
 *
 * A failure here is not fatal: storage keeps the old file and the new
 * one goes in alongside it.
 */
export async function removeFile(bucket: BucketName, path: string): Promise<void> {
  const headers = await storageAuthHeaders();
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodePath(path)}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error(`No se pudo eliminar el archivo: ${response.status}`);
  }
}

/**
 * A signed URL for a private object.
 *
 * The buckets the app reads from are public, so this is only needed
 * for the ones that are not.
 */
export async function createSignedUrl(
  bucket: BucketName,
  path: string,
  expiresInSeconds = 60,
): Promise<string> {
  const headers = await storageAuthHeaders();
  const url = `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodePath(path)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo firmar la URL: ${response.status}`);
  }

  const body = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signed = body.signedURL ?? body.signedUrl;
  if (!signed) {
    throw new Error("Supabase no devolvio una URL firmada.");
  }
  return `${SUPABASE_URL}${signed.replace(/^\/storage\/v1/, "/storage/v1")}`;
}

/** Encode a path for the storage API, keeping the slashes. */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function uploadClassContent(args: {
  schoolId: string;
  courseSubjectId: string;
  file: File;
}): Promise<{ path: string }> {
  const path = classContentPath(args.schoolId, args.courseSubjectId, args.file.name);
  return uploadFile(BUCKETS.classContent, path, args.file, { upsert: true });
}

export async function uploadTaskSubmission(args: {
  schoolId: string;
  taskId: string;
  studentId: string;
  file: File;
}): Promise<{ path: string }> {
  const path = taskSubmissionPath(args.schoolId, args.taskId, args.studentId, args.file.name);
  return uploadFile(BUCKETS.taskSubmissions, path, args.file, { upsert: true });
}
