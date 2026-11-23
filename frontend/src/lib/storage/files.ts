// =============================================================================
// The files of the app.
// -----------------------------------------------------------------------------
// The files live on the disk of the server: the browser sends them to
// the API and the API gives them back. There is no third-party storage
// in the middle.
//
// The rows of the database keep the PATH of the file (`avatars/<user>/
// avatar-1712.png`), never its address: the browser asks the API for
// the file and the API decides who may read it.
// =============================================================================

import { apiBaseUrl } from "@/lib/api/client";

export const BUCKETS = {
  schoolLogos: "school-logos",
  classContent: "class-content",
  taskSubmissions: "task-submissions",
  avatars: "avatars",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Where the API serves the files. */
export const FILES_PATH = "/v1/files";

/**
 * The address of a file the API has to serve.
 *
 * The rows keep a relative path (`avatars/<user>/avatar.png`). An
 * absolute address is left as it is: it points to a file that lives
 * somewhere else.
 */
export function fileUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) return stored;
  return `${apiBaseUrl}${FILES_PATH}/${stored.replace(/^\/+/, "")}`;
}

/**
 * A file name that is safe to put in a storage path.
 *
 * The browser sends the name the user gave the file: it can have
 * spaces, accents or characters the file system does not like. The
 * name keeps its extension, because the reader of the row uses it to
 * know the type of the file.
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

/** The response of the upload endpoints. */
export type UploadedFile = {
  /** The path of the file, the one the row keeps. */
  path: string;
  /** The address the API serves it under. */
  url: string;
};

/**
 * Upload a file to the API.
 *
 * The API answers with the path of the file and the address it is
 * served under.
 */
async function upload(path: string, file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", file, file.name);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    let message = "No se pudo subir el archivo.";
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // The body is not JSON: the generic message is fine.
    }
    throw new Error(message);
  }

  return (await response.json()) as UploadedFile;
}

/** Upload the delivery of a task. */
export async function uploadTaskSubmission(args: {
  taskId: string;
  file: File;
}): Promise<UploadedFile> {
  return upload(`${FILES_PATH}/task-submissions/${args.taskId}`, args.file);
}

/** Upload the material of a class. */
export async function uploadClassContent(args: {
  courseSubjectId: string;
  file: File;
}): Promise<UploadedFile> {
  return upload(`${FILES_PATH}/class-content/${args.courseSubjectId}`, args.file);
}
