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
  city: string | null;
  status: string;
  students: number;
  teachers: number;
  covered: number;
  total: number;
}

/** One material of the catalog, as the sheet of a school shows it. */
export interface SchoolCatalogItem {
  id: string;
  code: string;
  title: string;
  type: string;
  area: string;
  status: MaterialStatus;
  /** Whether the school can see it right now. */
  enabled: boolean;
}

/** One school with its figures and its coverage of the catalog. */
export interface SchoolDetail {
  id: string;
  name: string;
  short_code: string;
  city: string | null;
  status: string;
  students: number;
  teachers: number;
  covered: number;
  total: number;
  catalog: SchoolCatalogItem[];
}

/** The school and the administrator that are registered. */
export interface RegisteredSchool {
  school_id: string;
  admin_user_id: string;
  admin_email: string;
  activation_token: string;
  activation_expires_at: string;
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
  /** When it is true, the piece goes to every school of the network. */
  all_schools?: boolean;
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

/**
 * What each state means for the school that gets the piece.
 *
 * The state names say where the piece is; these lines say what the
 * school can expect from it.
 */
export const MATERIAL_STATUS_HINT: Record<MaterialStatus, string> = {
  draft: "Se puede seguir completando",
  review: "Pendiente de visto bueno",
  published: "Visible en los cursos",
  archived: "Retirado del catálogo",
};

// =============================================================================
// The support desk
// -----------------------------------------------------------------------------
// The levels, the states and the channels come from the API
// (`GET /v1/platform/case-options`): the frontend never hardcodes them.
// =============================================================================

export type CaseLevel = "info" | "aviso" | "urgente";

export type CaseStatus = "abierto" | "en_espera" | "resuelto";

export type CaseChannel = "formulario_colegio" | "formulario_web" | "correo" | "llamada";

export type CaseCategory = "problema_tecnico" | "solicitud_material" | "duda_acceso" | "otro";

export interface CaseMessage {
  id: string;
  author_id: string | null;
  author_name: string;
  /** `colegio` or `plataforma`: who wrote it. */
  author_role: string;
  body: string;
  /** The files the author attached: the paths they have in the store. */
  attachment_ids: string[];
  created_at: string;
}

/** One movement of the platform, shown inside a case. */
export interface CaseAuditEvent {
  id: string;
  event_type: string;
  level: string;
  actor_name: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface CaseSummary {
  id: string;
  code: string;
  title: string;
  category: CaseCategory;
  school_id: string | null;
  school_name: string | null;
  opened_by: string | null;
  opened_by_name: string;
  channel: CaseChannel;
  level: CaseLevel;
  status: CaseStatus;
  message_count: number;
  last_message_at: string | null;
  opened_at: string;
}

export interface CaseDetail extends CaseSummary {
  messages: CaseMessage[];
  audit: CaseAuditEvent[];
  /** Whether the case can still be closed. */
  can_resolve: boolean;
}

export interface CaseOptions {
  levels: string[];
  statuses: string[];
  channels: string[];
  categories: string[];
}

/** How urgent a case is, as the panel shows it. */
export const CASE_LEVEL_LABEL: Record<CaseLevel, string> = {
  info: "Info",
  aviso: "Aviso",
  urgente: "Urgente",
};

export const CASE_LEVEL_TONE: Record<CaseLevel, "info" | "warning" | "danger"> = {
  info: "info",
  aviso: "warning",
  urgente: "danger",
};

/** The state of a case, as the panel shows it. */
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  abierto: "Abierto",
  en_espera: "En espera",
  resuelto: "Resuelto",
};

export const CASE_STATUS_TONE: Record<CaseStatus, "info" | "warning" | "success"> = {
  abierto: "info",
  en_espera: "warning",
  resuelto: "success",
};

/** How the case arrived. */
export const CASE_CHANNEL_LABEL: Record<CaseChannel, string> = {
  formulario_colegio: "Formulario del colegio",
  formulario_web: "Formulario web",
  correo: "Correo",
  llamada: "Llamada",
};

/** What the school is asking for. */
export const CASE_CATEGORY_LABEL: Record<CaseCategory, string> = {
  problema_tecnico: "Problema técnico",
  solicitud_material: "Solicitud de material",
  duda_acceso: "Duda de acceso",
  otro: "Otro",
};

/**
 * The movements of the platform, as the panel reads them.
 *
 * The backend writes the type of the event; the label is the one the
 * platform team reads.
 */
export const AUDIT_EVENT_LABEL: Record<string, string> = {
  "material.created": "Material creado en el catálogo",
  "material.updated": "Metadatos del material editados",
  "material.deleted": "Material eliminado del catálogo",
  "material.status_changed": "Cambió el estado del material",
  "school.access_granted": "Acceso al material habilitado",
  "school.access_revoked": "Acceso al material retirado",
  "support.case_answered": "El equipo respondió un caso",
  "support.case_resolved": "Caso cerrado",
};

/** The label of a movement, or its own name when it is not known. */
export function auditEventLabel(eventType: string): string {
  return AUDIT_EVENT_LABEL[eventType] ?? eventType;
}
