// =============================================================================
// The menu of each role.
// -----------------------------------------------------------------------------
// The menu is a list of groups, so the reader sees the areas of the
// work and not a flat list of screens. The roles that share the same
// areas share the same groups.
//
// The platform role has no section of plans: the plans of the schools
// are not its business.
// =============================================================================

import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FolderOpen,
  GraduationCap,
  History,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Palette,
  PieChart,
  ShieldCheck,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppShellRole = "super" | "admin" | "docente" | "estudiante";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  /**
   * Where the counter of the entry comes from.
   *
   * The figure is never written by hand: it is read from the API.
   */
  badgeSource?: "material" | "support" | "schools" | "materials";
  /**
   * The entry only shows up when the school has the ICFES entitlement.
   */
  icfes?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/** The menu of each role, in the groups of the areas. */
export const NAV: Record<AppShellRole, NavGroup[]> = {
  super: [
    {
      label: "Operación",
      items: [
        { label: "Panel global", to: "/super", icon: LayoutDashboard },
        {
          label: "Colegios",
          to: "/super/colegios",
          icon: Building2,
          badgeSource: "schools",
        },
      ],
    },
    {
      label: "Contenido",
      items: [
        {
          label: "Catálogo editorial",
          to: "/super/catalogo",
          icon: BookOpen,
          badgeSource: "materials",
        },
      ],
    },
    {
      label: "Plataforma",
      items: [{ label: "Soporte y auditoría", to: "/super/soporte", icon: History }],
    },
  ],
  admin: [
    {
      label: "Operación",
      items: [
        { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
        {
          label: "Contenido",
          to: "/admin/contenido",
          icon: BookOpen,
          badgeSource: "material",
        },
      ],
    },
    {
      label: "Gestión académica",
      items: [
        { label: "Docentes", to: "/admin/docentes", icon: Users },
        { label: "Estudiantes", to: "/admin/estudiantes", icon: GraduationCap },
        { label: "Cursos y materias", to: "/admin/cursos", icon: BookOpen },
        { label: "Asignaciones", to: "/admin/asignaciones", icon: ClipboardList },
        { label: "Períodos", to: "/admin/periodos", icon: CalendarRange },
      ],
    },
    {
      // The simulators of the school are the ones the platform enabled:
      // the school activates them by course. The rest of the ICFES work
      // (the bank, the builder and the aggregate results) stays for the
      // roles that author the exams.
      label: "ICFES",
      items: [
        { label: "Simulacros del colegio", to: "/admin/icfes-colegio", icon: Target, icfes: true },
        { label: "Banco de preguntas", to: "/admin/icfes", icon: ListChecks, icfes: true },
        { label: "Crear simulacro", to: "/admin/icfes-simulacros", icon: ListChecks, icfes: true },
        { label: "Resultados", to: "/admin/icfes-resultados", icon: PieChart, icfes: true },
      ],
    },
    {
      label: "Configuración",
      items: [
        { label: "Personalización", to: "/admin/personalizacion", icon: Palette },
        { label: "Administradores", to: "/admin/administradores", icon: ShieldCheck },
      ],
    },
    {
      label: "Apoyo",
      items: [{ label: "Soporte", to: "/admin/soporte", icon: Inbox, badgeSource: "support" }],
    },
  ],
  docente: [
    {
      label: "Mi trabajo",
      items: [
        { label: "Mis materias", to: "/docente", icon: BookOpen },
        { label: "Materia", to: "/docente/materia", icon: FileCheck2 },
        { label: "Calificaciones", to: "/docente/calificaciones", icon: BarChart3 },
        { label: "Mensajes", to: "/docente/chat", icon: MessageSquare },
      ],
    },
    {
      label: "Pruebas",
      items: [
        { label: "Banco ICFES", to: "/docente/icfes", icon: ListChecks, icfes: true },
        { label: "Simulacros ICFES", to: "/docente/icfes-simulacros", icon: Target, icfes: true },
        { label: "Resultados ICFES", to: "/docente/icfes-resultados", icon: PieChart, icfes: true },
      ],
    },
  ],
  estudiante: [
    {
      label: "Mi colegio",
      items: [
        { label: "Mis clases", to: "/estudiante", icon: BookOpen },
        { label: "Materiales", to: "/estudiante/materiales", icon: FolderOpen },
        { label: "Evaluaciones", to: "/estudiante/evaluaciones", icon: FileCheck2 },
        { label: "Tareas", to: "/estudiante/tareas", icon: ClipboardList },
        { label: "Mis notas", to: "/estudiante/notas", icon: BarChart3 },
        { label: "Mensajes", to: "/estudiante/chat", icon: MessageSquare },
      ],
    },
    {
      label: "Pruebas",
      items: [{ label: "Simulacros ICFES", to: "/estudiante/icfes", icon: Target, icfes: true }],
    },
  ],
};

/** The note at the foot of the menu: what this role can and cannot do. */
export const ROLE_NOTE: Record<AppShellRole, string> = {
  super: "Cargas el material de la editorial y decides qué colegio puede ver cada pieza.",
  admin:
    "Administras la comunidad del colegio. El material lo carga el equipo de plataforma y tú ves lo que quedó habilitado.",
  docente: "Consultas el material habilitado para tus cursos.",
  estudiante: "Accedes al material publicado para tus cursos, tareas y calificaciones.",
};

export const ROLE_LABEL: Record<AppShellRole, string> = {
  super: "Panel de plataforma",
  admin: "Administración del colegio",
  docente: "Docente",
  estudiante: "Estudiante",
};

/**
 * Whether an entry is the page the reader is on.
 *
 * The comparison is exact. With a prefix comparison (`/super` matches
 * `/super/colegios`) two entries lit up at once and the one the reader
 * had just left kept its block painted, which looked like a leftover
 * shadow.
 */
export function isCurrentPath(pathname: string, to: string): boolean {
  return pathname === to;
}

/** The icon of the plan, used by the entry that opens the plan of the school. */
export const PLAN_ICON = CreditCard;
