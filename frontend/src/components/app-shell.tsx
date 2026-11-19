import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  ShieldCheck,
  Target,
  Users,
  UserSquare2,
  X,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { signOut } from "@/lib/auth/browser";
import type { SessionContext } from "@/lib/auth/functions";
import { useEntitlement } from "@/lib/billing/hooks";
import { useSchool } from "@/lib/school/hooks";
import { applyPrimaryColor, primaryColorStyle } from "@/lib/school/theme";
import {
  getServerSidebarCollapsed,
  getStoredSidebarCollapsed,
  setSidebarCollapsed,
  subscribeSidebar,
} from "@/lib/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type SchoolPlan = "Basico" | "Estandar" | "Premium" | "Sin plan";

export type AppShellRole = "super" | "admin" | "docente" | "estudiante";

type NavItem = { label: string; to: string; icon: LucideIcon; icfes?: boolean };

const NAV: Record<AppShellRole, NavItem[]> = {
  super: [
    { label: "Dashboard", to: "/super", icon: LayoutDashboard },
    { label: "Colegios", to: "/super/colegios", icon: Building2 },
    { label: "Planes", to: "/super/planes", icon: CreditCard },
    { label: "Mi perfil", to: "/perfil", icon: UserSquare2 },
  ],
  admin: [
    { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
    { label: "Docentes", to: "/admin/docentes", icon: Users },
    { label: "Estudiantes", to: "/admin/estudiantes", icon: GraduationCap },
    { label: "Cursos y materias", to: "/admin/cursos", icon: BookOpen },
    { label: "Asignaciones", to: "/admin/asignaciones", icon: ClipboardList },
    { label: "Periodos", to: "/admin/periodos", icon: CalendarRange },
    { label: "Banco ICFES", to: "/admin/icfes", icon: ListChecks, icfes: true },
    { label: "Simulacros ICFES", to: "/admin/icfes-simulacros", icon: Target, icfes: true },
    { label: "Resultados ICFES", to: "/admin/icfes-resultados", icon: PieChart, icfes: true },
    { label: "Personalizacion", to: "/admin/personalizacion", icon: Palette },
    { label: "Administradores", to: "/admin/administradores", icon: ShieldCheck },
    { label: "Mi perfil", to: "/perfil", icon: UserSquare2 },
  ],
  docente: [
    { label: "Mis materias", to: "/docente", icon: BookOpen },
    { label: "Materia", to: "/docente/materia", icon: FileCheck2 },
    { label: "Calificaciones", to: "/docente/calificaciones", icon: BarChart3 },
    { label: "Banco ICFES", to: "/docente/icfes", icon: ListChecks, icfes: true },
    { label: "Simulacros ICFES", to: "/docente/icfes-simulacros", icon: Target, icfes: true },
    { label: "Resultados ICFES", to: "/docente/icfes-resultados", icon: PieChart, icfes: true },
    { label: "Mensajes", to: "/docente/chat", icon: MessageSquare },
    { label: "Mi perfil", to: "/perfil", icon: UserSquare2 },
  ],
  estudiante: [
    { label: "Mis clases", to: "/estudiante", icon: BookOpen },
    { label: "Materiales", to: "/estudiante/materiales", icon: FolderOpen },
    { label: "Evaluaciones", to: "/estudiante/evaluaciones", icon: FileCheck2 },
    { label: "Simulacros ICFES", to: "/estudiante/icfes", icon: Target, icfes: true },
    { label: "Tareas", to: "/estudiante/tareas", icon: ClipboardList },
    { label: "Mis notas", to: "/estudiante/notas", icon: BarChart3 },
    { label: "Mensajes", to: "/estudiante/chat", icon: MessageSquare },
    { label: "Mi perfil", to: "/perfil", icon: UserSquare2 },
  ],
};

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
  plan,
  schoolName,
  logoUrl,
  collapsed,
}: {
  role: AppShellRole;
  plan: SchoolPlan;
  schoolName: string | null;
  logoUrl: string | null;
  collapsed: boolean;
}) {
  const title = role === "super" ? "Lumen Platform" : (schoolName ?? "Lumen");
  // The platform brand is Lumen's own: it does not wear the logo of
  // the school the super admin happens to belong to.
  const showLogo = role !== "super" && Boolean(logoUrl);
  const mark = showLogo ? (
    <img
      src={logoUrl ?? ""}
      alt={`Logo de ${title}`}
      className="size-9 shrink-0 rounded-xl bg-card object-contain p-0.5 ring-1 ring-border"
    />
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
      <GraduationCap className="size-5" strokeWidth={1.75} />
    </span>
  );

  // Folded, only the mark is left: the name would not fit.
  if (collapsed) {
    return (
      <div className="flex justify-center">
        <span title={title}>{mark}</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      {mark}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight">{title}</p>
        <p className="truncate text-xs text-muted-foreground">Lumen · {plan}</p>
      </div>
    </div>
  );
}

function NavList({
  role,
  icfesEnabled,
  onNavigate,
  collapsed,
}: {
  role: AppShellRole;
  icfesEnabled: boolean;
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV[role].filter((item) => !item.icfes || icfesEnabled);
  const plainItems = items.filter((item) => !item.icfes);
  const icfesItems = items.filter((item) => item.icfes);

  // The ICFES views live in one collapsible block. It opens by itself
  // when the user is already inside one of them, and the choice the user
  // makes is kept for the page they are on.
  const insideIcfes = icfesItems.some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
  const [icfesChoice, setIcfesChoice] = useState<{ path: string; open: boolean } | null>(null);
  const icfesOpen = icfesChoice?.path === pathname ? icfesChoice.open : insideIcfes;

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center rounded-lg text-sm font-medium transition-colors",
      collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-muted hover:text-sidebar-foreground",
    );

  // Folded, there is no room for the ICFES block: its views become
  // regular icons, one after the other.
  if (collapsed) {
    return (
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={item.label}
              aria-label={item.label}
              className={linkClass(active)}
            >
              <item.icon className="size-4.5 shrink-0" strokeWidth={1.75} />
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {plainItems.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link key={item.to} to={item.to} onClick={onNavigate} className={linkClass(active)}>
            <item.icon className="size-4.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      {icfesItems.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setIcfesChoice({ path: pathname, open: !icfesOpen })}
            aria-expanded={icfesOpen}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              insideIcfes
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-muted hover:text-sidebar-foreground",
            )}
          >
            <ListChecks className="size-4.5 shrink-0" strokeWidth={1.75} />
            <span className="flex-1 truncate text-left">ICFES</span>
            <ChevronDown
              className={cn("size-4 shrink-0 transition-transform", icfesOpen && "rotate-180")}
              strokeWidth={1.75}
              aria-hidden
            />
          </button>

          {icfesOpen && (
            <ul className="ml-4 space-y-1 border-l border-sidebar-border pl-3">
              {icfesItems.map((item) => {
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{item.label.replace(" ICFES", "")}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </nav>
  );
}

/** The bottom of the sidebar: the theme, the fold and the way out. */
function SidebarFooter({
  onSignOut,
  signingOut,
  collapsed,
  onToggleCollapsed,
}: {
  onSignOut: () => void;
  signingOut: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <div className="mt-4 space-y-1 border-t border-sidebar-border pt-3">
      {collapsed ? (
        <div className="flex flex-col items-center gap-1">
          <ThemeToggle variant="icon-only" />
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Expandir la barra lateral"
            title="Expandir la barra lateral"
            className="grid size-9 place-items-center rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <PanelLeftOpen className="size-4.5" strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <>
          <ThemeToggle variant="menu" />
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Contraer la barra lateral"
            title="Contraer la barra lateral"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <PanelLeftClose className="size-4.5" strokeWidth={1.75} />
            <span className="flex-1 text-left">Contraer menú</span>
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        aria-label="Cerrar sesion"
        title="Cerrar sesion"
        className={cn(
          "flex w-full items-center rounded-lg text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:cursor-not-allowed disabled:opacity-60",
          collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
        )}
      >
        <LogOut className="size-4.5" strokeWidth={1.75} />
        {!collapsed && (signingOut ? "Cerrando..." : "Cerrar sesion")}
      </button>
    </div>
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

  // The sidebar can be folded into a narrow strip of icons. It is a
  // personal preference: it lives in the browser and is remembered.
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getStoredSidebarCollapsed,
    getServerSidebarCollapsed,
  );
  const toggleCollapsed = () => setSidebarCollapsed(!collapsed);

  const entitlement = useEntitlement(session.primarySchoolId);
  const school = useSchool(session.primarySchoolId);

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

  // Derive the plan label and ICFES-enabled flag from the entitlement
  // snapshot. Phase 5 commits 7/8 keep the fallback "Sin plan" / false
  // until the Wompi webhook writes the first row.
  const plan: SchoolPlan = ((): SchoolPlan => {
    if (!entitlement.data) return "Sin plan";
    const status = entitlement.data.status;
    if (status !== "active" && status !== "trial") return "Sin plan";
    const code = entitlement.data.plan_code.toLowerCase();
    if (code === "basico") return "Basico";
    if (code === "estandar") return "Estandar";
    if (code === "premium") return "Premium";
    return "Sin plan";
  })();
  const icfesEnabled = Boolean(
    entitlement.data &&
    (entitlement.data.status === "active" || entitlement.data.status === "trial") &&
    entitlement.data.includes_icfes,
  );

  const displayName = session.profile?.full_name ?? session.user.email ?? "Usuario";
  const caption = (() => {
    if (role === "super") return "Super Admin";
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

  return (
    <div className="min-h-screen w-full bg-background">
      {/* The school's colour, painted with the page: the first frame is
          already in the school's colour, so there is no flash of the
          default theme while the browser catches up. */}
      {themeStyle && <style dangerouslySetInnerHTML={{ __html: themeStyle }} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar lg:flex",
          collapsed ? "w-16 p-2" : "w-64 p-4",
        )}
      >
        <Brand
          role={role}
          plan={plan}
          schoolName={resolvedSchoolName}
          logoUrl={logoUrl}
          collapsed={collapsed}
        />
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavList role={role} icfesEnabled={icfesEnabled} collapsed={collapsed} />
        </div>
        <SidebarFooter
          onSignOut={onSignOut}
          signingOut={signingOut}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Cerrar menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <Brand
                role={role}
                plan={plan}
                schoolName={resolvedSchoolName}
                logoUrl={logoUrl}
                collapsed={false}
              />
              <button
                aria-label="Cerrar menu"
                className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <NavList
                role={role}
                icfesEnabled={icfesEnabled}
                collapsed={false}
                onNavigate={() => setOpen(false)}
              />
            </div>
            <SidebarFooter
              onSignOut={onSignOut}
              signingOut={signingOut}
              collapsed={false}
              onToggleCollapsed={toggleCollapsed}
            />
          </div>
        </div>
      )}

      <div className={cn("lg:pl-64", collapsed && "lg:pl-16")}>
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/85 px-4 py-3 backdrop-blur sm:px-6">
          <button
            aria-label="Abrir menu"
            className="grid size-10 place-items-center rounded-lg hover:bg-muted lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationBell userId={session.user.id} />
            <div className="flex items-center gap-2.5">
              {session.profile?.avatar_url ? (
                <img
                  src={session.profile.avatar_url}
                  alt={`Foto de perfil de ${displayName}`}
                  className="size-9 shrink-0 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                  {initials(displayName)}
                </span>
              )}
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-sm font-semibold leading-tight">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{caption}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
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
