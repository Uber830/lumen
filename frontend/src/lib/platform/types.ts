// =============================================================================
// The types of the editorial catalog, as the API answers them.
// -----------------------------------------------------------------------------
// They mirror `backend/app/platform/catalog_schemas.py`. The closed
// catalogs (types, areas, grades) are never hardcoded in the frontend:
// they come from `GET /v1/platform/catalog-options`.
// =============================================================================

export type MaterialStatus = "draft" | "review" | "published" | "archived";

export type MaterialOrigin = "upload" | "link";

export interface SchoolRef {
  id: string;
  name: string;
}

export interface MaterialSummary {
  id: string;
  code: string;
  title: string;
  type: string;
  area: string;
  grades: string[];
  status: MaterialStatus;
  origin: MaterialOrigin;
  visible_to: string;
  size_label: string;
  updated_at: string;
  schools: SchoolRef[];
  /** How many schools are not shown: the backend counts them. */
  schools_extra: number;
}

export interface MaterialFile {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  size_label: string;
  is_primary: boolean;
  created_at: string;
}

export interface MaterialSchool {
  id: string;
  name: string;
  short_code: string;
  plan: string | null;
  students: number;
}

export interface HistoryEntry {
  id: string;
  action: string;
  detail: Record<string, unknown>;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface MaterialDetail {
  id: string;
  code: string;
  title: string;
  type: string;
  area: string;
  grades: string[];
  visible_to: string;
  publication_year: number | null;
  description: string | null;
  origin: MaterialOrigin;
  external_url: string | null;
  status: MaterialStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
  size_label: string;
  files: MaterialFile[];
  schools: MaterialSchool[];
  history: HistoryEntry[];
  /** The states the material can move to: the backend decides. */
  available_transitions: MaterialStatus[];
  /** What it still needs to be published. Empty when it can be. */
  missing: string[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface SchoolCoverage {
  school_id: string;
  name: string;
  short_code: string;
  status: string;
  plan: string | null;
  students: number;
  teachers: number;
  covered: number;
  total: number;
}

export interface PlatformMetrics {
  schools: number;
  teachers: number;
  students: number;
  materials: number;
  materials_by_status: Record<string, number>;
  materials_by_area: Record<string, number>;
  school_coverage: SchoolCoverage[];
}

export interface SchoolSummary {
  id: string;
  name: string;
  short_code: string;
  status: string;
  plan: string | null;
  students: number;
  teachers: number;
  covered: number;
  total: number;
}

export interface AuditEntry {
  id: string;
  event_type: string;
  level: "info" | "warning" | "error";
  actor_id: string | null;
  actor_name: string | null;
  school_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface CatalogOptions {
  types: string[];
  areas: string[];
  grades: string[];
  statuses: string[];
  visible_to: string[];
  plans: { code: string; name: string }[];
}

export interface CreateMaterialInput {
  title: string;
  type: string;
  area: string;
  grades?: string[];
  visible_to?: string;
  publication_year?: number | null;
  description?: string | null;
  origin: MaterialOrigin;
  external_url?: string | null;
  school_ids?: string[];
  file_id?: string | null;
}

export interface UploadResult {
  file_id: string;
  file_name: string;
  size_bytes: number;
  size_label: string;
  mime_type: string;
  duplicate_of: { id: string; code: string } | null;
}

/** The lifecycle, as the panel shows it. The backend decides the moves. */
export const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  draft: "Borrador",
  review: "En revisión",
  published: "Publicado",
  archived: "Archivado",
};

/** The tone of each state: a pill with a dot and its name. */
export const MATERIAL_STATUS_TONE: Record<
  MaterialStatus,
  "muted" | "warning" | "success" | "danger"
> = {
  draft: "muted",
  review: "warning",
  published: "success",
  archived: "danger",
};
