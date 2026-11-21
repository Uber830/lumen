import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FolderOpen,
  GraduationCap,
  Inbox,
  Info,
  LayoutDashboard,
  Link2,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Palette,
  PieChart,
  ShieldCheck,
  Target,
  UserSquare2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/browser";
import type { SessionContext } from "@/lib/auth/functions";
import { useEntitlement } from "@/lib/billing/hooks";
import { useSchool } from "@/lib/school/hooks";
import { useSchoolOverview } from "@/lib/school/overview";
import { openCaseCount, useSchoolSupportCases } from "@/lib/school/support";
import { applyPrimaryColor, primaryColorStyle } from "@/lib/school/theme";
import { cn } from "@/lib/utils";

type SchoolPlan = "Basico" | "Estandar" | "Premium" | "Sin plan";

export type AppShellRole = "super" | "admin" | "docente" | "estudiante";

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  /** The counter of the rail: the material the school has available. */
  badge?: "material" | "support";
  /** The entry only shows up when the school has the ICFES entitlement. */
  icfes?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

/**
 * The rail of each role.
 *
 * The groups say what the section is about: the operation of the day,
 * the academic structure, the configuration of the school and the
 * support. "Mi perfil" is not here: it lives in the menu of the user,
 * at the top right.
 */
const NAV: Record<AppShellRole, NavGroup[]> = {
  admin: [
    {
      label: "Operación",
      items: [
        { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
        { label: "Contenido", to: "/admin/contenido", icon: BookOpen, badge: "material" },
      ],
    },
    {
      label: "Gestión académica",
      items: [
        { label: "Docentes", to: "/admin/docentes", icon: Users },
        { label: "Estudiantes", to: "/admin/estudiantes", icon: GraduationCap },
        { label: "Cursos y materias", to: "/admin/cursos", icon: BookOpen },
        { label: "Asignaciones", to: "/admin/asignaciones", icon: Link2 },
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
      items: [{ label: "Soporte", to: "/admin/soporte", icon: Inbox, badge: "support" }],
    },
  ],
  super: [
    {
      label: "Operación",
      items: [
        { label: "Dashboard", to: "/super", icon: LayoutDashboard },
        { label: "Colegios", to: "/super/colegios", icon: Building2 },
        { label: "Planes", to: "/super/planes", icon: CreditCard },
      ],
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

/** What each role is allowed to do, told in the foot of the rail. */
const ROLE_NOTES: Record<AppShellRole, { title: string; note: string }> = {
  admin: {
    title: "Administrador de colegio",
    note: "Administras la comunidad del colegio. El material lo carga el equipo de plataforma y tú ves lo que quedó habilitado.",
  },
  docente: {
    title: "Docente",
    note: "Consultas y descargas el material habilitado para tus cursos. No puedes cargar ni archivar material.",
  },
  estudiante: {
    title: "Estudiante",
    note: "Accedes al material publicado para tus cursos, tareas y calificaciones.",
  },
  super: {
    title: "Plataforma",
    note: "Cargas el material de la editorial y defines qué colegio puede ver cada cosa.",
  },
};

/*
 * The rail has three shapes, decided by the width of the screen:
 *
 *   from 1180 px   the labels are shown
 *   900 to 1180    the rail is a strip of icons
 *   below 900      the rail is a drawer, opened from the top bar
 */
const ICON_ONLY = "max-[1179px]:hidden";
const ICON_ONLY_ITEM = "max-[1179px]:justify-center max-[1179px]:px-0";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Brand({
  role,
  schoolName,
  logoUrl,
}: {
  role: AppShellRole;
  schoolName: string | null;
  logoUrl: string | null;
}) {
  // The platform brand is Lumen's own: it does not wear the logo of
  // the school the super admin happens to belong to.
  const showLogo = role !== "super" && Boolean(logoUrl);
  const mark = showLogo ? (
    <img
      src={logoUrl ?? ""}
      alt={`Escudo de ${schoolName ?? "el colegio"}`}
      className="size-[38px] shrink-0 rounded-[11px] bg-card object-cover"
      loading="lazy"
      width={38}
      height={38}
    />
  ) : (
    <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-primary to-[#1B4FD1]">
      <GraduationCap className="size-5 text-white" strokeWidth={1.9} />
    </span>
  );

  return (
    <div className="flex min-w-0 items-center gap-[11px] px-[18px] pb-3.5 pt-[18px]">
      {mark}
      <div className="min-w-0">
        <p className="truncate text-[15.5px] font-bold leading-tight tracking-[-0.01em]">Lumen</p>
        <p className={cn("truncate text-[11.5px] leading-tight text-muted-foreground", ICON_ONLY)}>
          {role === "super" ? "Panel de plataforma" : (schoolName ?? "Colegio")}
        </p>
      </div>
    </div>
  );
}

function NavGroups({
  role,
  icfesEnabled,
  materialCount,
  supportCount,
  onNavigate,
}: {
  role: AppShellRole;
  icfesEnabled: boolean;
  materialCount: number | null;
  supportCount: number | null;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = NAV[role];

  return (
    <nav className="flex flex-col">
      {groups.map((group) => {
        const items = group.items.filter((item) => !item.icfes || icfesEnabled);
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="mb-[18px]">
            <p
              className={cn(
                "px-[10px] pb-2 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground",
                ICON_ONLY,
              )}
            >
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                // The counter only shows up where there is a real queue
                // of work: the material the school has, and the cases
                // that are still open.
                const count =
                  item.badge === "material"
                    ? materialCount
                    : item.badge === "support"
                      ? supportCount
                      : null;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      title={item.label}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center gap-[11px] rounded-[10px] border border-transparent px-[10px] py-[9px] text-left text-[13.5px] transition-colors",
                        ICON_ONLY_ITEM,
                        active
                          ? "border-sidebar-border bg-sidebar-accent font-medium text-white"
                          : "text-sidebar-foreground hover:bg-white/[0.045] hover:text-foreground",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-[17px] shrink-0 opacity-85",
                          active && "text-primary opacity-100",
                        )}
                        strokeWidth={1.9}
                        aria-hidden
                      />
                      <span className={cn("truncate", ICON_ONLY)}>{item.label}</span>
                      {count !== null && count > 0 && (
                        <span
                          className={cn(
                            "ml-auto rounded-full bg-primary-soft px-[7px] py-px font-mono text-[11px] font-semibold text-[#7FB8FF]",
                            ICON_ONLY,
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** The foot of the rail: what the role of the session can do. */
function RoleNote({ role }: { role: AppShellRole }) {
  const note = ROLE_NOTES[role];
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-sidebar-border bg-card p-3 text-[12px] text-muted-foreground">
        <Info
          className="mt-0.5 size-[15px] shrink-0 text-[#2DD4BF]"
          strokeWidth={1.9}
          aria-hidden
        />
        <p className={cn("min-w-0 leading-snug", ICON_ONLY)}>
          <span className="font-semibold text-sidebar-foreground">{note.title}</span>
          <br />
          {note.note}
        </p>
      </div>
    </div>
  );
}

/** The menu of the user: the profile and the way out. */
function UserMenu({
  session,
  role,
  displayName,
  caption,
  signingOut,
  onSignOut,
}: {
  session: SessionContext;
  role: AppShellRole;
  displayName: string;
  caption: string;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const avatar = session.profile?.avatar_url;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-[9px] rounded-xl border border-border bg-card py-1 pl-1 pr-2 transition-colors hover:border-[rgba(150,175,220,.26)]"
        >
          {avatar ? (
            <img
              src={avatar}
              alt={`Foto de ${displayName}`}
              className="size-8 shrink-0 rounded-[9px] object-cover"
              loading="lazy"
              width={32}
              height={32}
            />
          ) : (
            <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-primary to-[#6D4BE0] text-[12px] font-bold text-white">
              {initials(displayName)}
            </span>
          )}
          <span className="hidden min-w-0 text-left leading-tight sm:block">
            <span className="block truncate text-[12.8px] font-semibold">{displayName}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{caption}</span>
          </span>
          <ChevronDown
            className="size-3.5 shrink-0 text-muted-foreground"
            strokeWidth={1.9}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[232px]">
        <DropdownMenuLabel>Sesión</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil">
            <UserSquare2 className="size-4" strokeWidth={1.9} aria-hidden />
            Mi perfil y seguridad
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/perfil">
            <Bell className="size-4" strokeWidth={1.9} aria-hidden />
            Notificaciones
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/perfil">
            <Palette className="size-4" strokeWidth={1.9} aria-hidden />
            Preferencias
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event: Event) => {
            event.preventDefault();
            onSignOut();
          }}
          disabled={signingOut}
        >
          <LogOut className="size-4" strokeWidth={1.9} aria-hidden />
          {signingOut ? "Cerrando..." : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  session,
  role,
  schoolName,
}: {
  session: SessionContext;
  role: AppShellRole;
  schoolName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const entitlement = useEntitlement(session.primarySchoolId);
  const school = useSchool(session.primarySchoolId);
  // The counter of the rail: how much material the school has
  // available. The dashboard reads the same query, so the panel asks
  // for it once.
  const overview = useSchoolOverview(role === "admin" ? session.primarySchoolId : null);
  // The counter of the support: the cases of the school that are still
  // open. The query is off for the roles that do not have the channel.
  const supportCases = useSchoolSupportCases(role === "admin");

  // The school's branding comes with the session, so the server already
  // knows it when it renders the page. The live query (useSchool) keeps
  // it fresh after the admin saves a change.
  const sessionBrand = session.school;
  const primaryColor = school.data?.primary_color ?? sessionBrand?.primary_color ?? null;
  const logoUrl = school.data?.logo_url ?? sessionBrand?.logo_url ?? null;

  // Paint the theme with the school's colour. The rules are rendered
  // with the page (so the first frame is already in the school's
  // colour, with no flash of the default theme) and re-applied whenever
  // the colour changes, e.g. after the admin saves it in Personalización.
  const themeStyle = primaryColorStyle(primaryColor);
  useEffect(() => {
    applyPrimaryColor(primaryColor);
    return () => applyPrimaryColor(null);
  }, [primaryColor]);

  // The brand name: the school's display name, then its legal name,
  // then the prop passed by the route, then the Lumen fallback.
  const resolvedSchoolName =
    school.data?.display_name ||
    school.data?.name ||
    sessionBrand?.display_name ||
    sessionBrand?.name ||
    schoolName;

  const icfesEnabled = Boolean(
    entitlement.data &&
    (entitlement.data.status === "active" || entitlement.data.status === "trial") &&
    entitlement.data.includes_icfes,
  );

  const displayName = session.profile?.full_name ?? session.user.email ?? "Usuario";
  const caption = (() => {
    if (role === "super") return "Equipo Lumen";
    if (role === "admin") return "Administrador";
    if (role === "docente") return "Docente";
    return "Estudiante";
  })();

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      window.location.assign("/login");
    } catch {
      setSigningOut(false);
    }
  }

  const materialCount = overview.data?.material.available ?? null;
  const supportCount = supportCases.data ? openCaseCount(supportCases.data) : null;

  return (
    <div className="lumen-panel min-h-screen w-full bg-background">
      {/* The school's colour, painted with the page: the first frame is
          already in the school's colour, so there is no flash of the
          default theme while the browser catches up. */}
      {themeStyle && <style dangerouslySetInnerHTML={{ __html: themeStyle }} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar",
          "min-[900px]:flex",
          "w-[270px] max-[1179px]:w-[68px]",
        )}
      >
        <Brand role={role} schoolName={resolvedSchoolName} logoUrl={logoUrl} />
        <div className="flex-1 overflow-y-auto px-3 pb-[18px] pt-1.5">
          <NavGroups
            role={role}
            icfesEnabled={icfesEnabled}
            materialCount={materialCount}
            supportCount={supportCount}
          />
        </div>
        <RoleNote role={role} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 max-[899px]:block hidden">
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[270px] flex-col bg-sidebar">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <Brand role={role} schoolName={resolvedSchoolName} logoUrl={logoUrl} />
              <button
                aria-label="Cerrar menú"
                className="mt-[18px] grid size-9 shrink-0 place-items-center rounded-lg hover:bg-sidebar-accent"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" strokeWidth={1.9} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-[18px] pt-1.5">
              <NavGroups
                role={role}
                icfesEnabled={icfesEnabled}
                materialCount={materialCount}
                supportCount={supportCount}
                onNavigate={() => setOpen(false)}
              />
            </div>
            <RoleNote role={role} />
          </div>
        </div>
      )}

      <div className="min-[900px]:pl-[270px] max-[1179px]:pl-[68px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <button
            aria-label="Abrir menú"
            className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground hover:text-foreground min-[900px]:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-[18px]" strokeWidth={1.9} />
          </button>

          {/* The bar shows the context of the session, not a search: the
              search of the panel lives inside each table. */}
          <div className="flex min-w-0 items-center gap-2.5 text-[13px] text-muted-foreground">
            <span className="truncate text-[14px] font-semibold text-foreground">
              {role === "super" ? "Panel de plataforma" : (resolvedSchoolName ?? "Colegio")}
            </span>
            {session.currentPeriod && (
              <>
                <span
                  className="size-[5px] shrink-0 rounded-full bg-muted-foreground/60"
                  aria-hidden
                />
                <span className="truncate">{session.currentPeriod}</span>
              </>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <NotificationBell userId={session.user.id} />
            <UserMenu
              session={session}
              role={role}
              displayName={displayName}
              caption={caption}
              signingOut={signingOut}
              onSignOut={onSignOut}
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function deriveRole(session: SessionContext): AppShellRole | null {
  if (session.platformRole === "platform_admin") return "super";
  const primary = session.memberships.find((m) => m.is_primary) ?? session.memberships[0];
  if (!primary) return null;
  switch (primary.role) {
    case "school_admin":
      return "admin";
    case "teacher":
      return "docente";
    case "student":
      return "estudiante";
  }
}
