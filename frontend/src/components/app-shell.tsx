import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  GraduationCap,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { signOut } from "@/lib/auth/browser";
import type { SessionContext } from "@/lib/auth/functions";
import { useEntitlement } from "@/lib/billing/hooks";
import { usePlatformMetrics } from "@/lib/platform/hooks";
import { useSchool } from "@/lib/school/hooks";
import { applyPrimaryColor, primaryColorStyle } from "@/lib/school/theme";
import {
  getServerSidebarCollapsed,
  getStoredSidebarCollapsed,
  setSidebarCollapsed,
  subscribeSidebar,
} from "@/lib/sidebar";
import {
  getServerTheme,
  getStoredTheme,
  setTheme,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";
import { NAV, isCurrentPath, type AppShellRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type { AppShellRole } from "@/lib/navigation";

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
  collapsed,
}: {
  role: AppShellRole;
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
      className="size-9 shrink-0 rounded-lg bg-card object-contain p-0.5 ring-1 ring-border"
    />
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
      <GraduationCap className="size-5" strokeWidth={1.9} />
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
        <p className="truncate text-xs text-muted-foreground">
          {role === "super" ? "Operación global" : "Lumen"}
        </p>
      </div>
    </div>
  );
}

function NavList({
  role,
  icfesEnabled,
  onNavigate,
  collapsed,
  badges,
}: {
  role: AppShellRole;
  icfesEnabled: boolean;
  onNavigate?: () => void;
  collapsed: boolean;
  badges: Partial<Record<string, number>>;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = NAV[role];

  // Which entry is the current page. The rule lives in the navigation
  // module, where it can be tested.
  const isCurrent = (to: string) => isCurrentPath(pathname, to);

  // The ICFES views live in one block that folds and unfolds. It opens
  // by itself when the user is already inside one of them.
  const insideIcfes = groups.some((group) =>
    group.items.some((item) => item.collapsible && isCurrent(item.to)),
  );
  const [icfesChoice, setIcfesChoice] = useState<{ path: string; open: boolean } | null>(null);
  const icfesOpen = icfesChoice?.path === pathname ? icfesChoice.open : insideIcfes;

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center rounded-lg text-sm font-medium transition-colors",
      collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground",
    );

  // Folded, there is no room for the groups: the entries become plain
  // icons, one after the other.
  if (collapsed) {
    return (
      <nav className="flex flex-col gap-1">
        {groups
          .flatMap((group) => group.items)
          .map((item) => {
            const active = isCurrent(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                title={item.label}
                aria-label={item.label}
                className={linkClass(active)}
              >
                <item.icon className="size-4.5 shrink-0" strokeWidth={1.9} />
              </Link>
            );
          })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-3">
            {group.label}
          </p>
          <div className="flex flex-col gap-1">
            {group.items.map((item) => {
              const hidden = item.collapsible && !icfesEnabled;
              if (hidden) return null;
              const active = isCurrent(item.to);
              const badge = badges[item.to];

              if (item.collapsible) {
                return (
                  <div key={item.to}>
                    <button
                      type="button"
                      onClick={() => setIcfesChoice({ path: pathname, open: !icfesOpen })}
                      aria-expanded={icfesOpen}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground",
                      )}
                    >
                      <item.icon className="size-4.5 shrink-0" strokeWidth={1.9} />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 transition-transform",
                          icfesOpen && "rotate-180",
                        )}
                        strokeWidth={1.9}
                        aria-hidden
                      />
                    </button>
                    {icfesOpen && (
                      <ul className="ml-4 space-y-1 border-l border-sidebar-border pl-3">
                        {groups
                          .flatMap((g) => g.items)
                          .filter((child) => child.collapsible)
                          .map((child) => {
                            const childActive = isCurrent(child.to);
                            return (
                              <li key={child.to}>
                                <Link
                                  to={child.to}
                                  onClick={onNavigate}
                                  className={cn(
                                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    childActive
                                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                      : "text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground",
                                  )}
                                >
                                  <child.icon className="size-4 shrink-0" strokeWidth={1.9} />
                                  <span className="truncate">
                                    {child.label.replace(" ICFES", "")}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                );
              }

              return (
                <Link key={item.to} to={item.to} onClick={onNavigate} className={linkClass(active)}>
                  <item.icon className="size-4.5 shrink-0" strokeWidth={1.9} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className="rounded-full bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** The bottom of the sidebar: the theme of the app and the way out. */
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
      <ThemePicker collapsed={collapsed} />
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expandir la barra lateral" : "Contraer la barra lateral"}
        title={collapsed ? "Expandir la barra lateral" : "Contraer la barra lateral"}
        className={cn(
          "flex w-full items-center rounded-lg text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4.5" strokeWidth={1.9} />
        ) : (
          <>
            <PanelLeftClose className="size-4.5" strokeWidth={1.9} />
            <span className="flex-1 text-left">Contraer menú</span>
          </>
        )}
      </button>
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
        <LogOut className="size-4.5" strokeWidth={1.9} />
        {!collapsed && (signingOut ? "Cerrando..." : "Cerrar sesion")}
      </button>
    </div>
  );
}

const THEME_CHOICES: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

/**
 * The theme of the app, at the foot of the sidebar.
 *
 * The preference is personal and lives in the browser, so the picker
 * is always at hand: folded it walks through the three choices with a
 * single button, open it shows the three icons.
 */
function ThemePicker({ collapsed }: { collapsed: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, getStoredTheme, getServerTheme);
  const current = THEME_CHOICES.find((choice) => choice.value === theme);

  if (collapsed) {
    const next: ThemePreference =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        title={`Tema: ${current?.label ?? "Sistema"}`}
        aria-label={`Tema: ${current?.label ?? "Sistema"}. Cambiar el tema`}
        className="flex w-full items-center justify-center rounded-lg px-0 py-2.5 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        {current && <current.icon className="size-4.5" strokeWidth={1.9} aria-hidden />}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Tema de la aplicación"
      className="mb-2 flex items-center gap-1 rounded-lg bg-muted px-1.5 py-1"
    >
      {THEME_CHOICES.map((choice) => (
        <button
          key={choice.value}
          type="button"
          onClick={() => setTheme(choice.value)}
          aria-pressed={theme === choice.value}
          title={choice.label}
          className={cn(
            "flex flex-1 items-center justify-center rounded-md px-2 py-1.5 transition-colors",
            theme === choice.value
              ? "bg-card text-foreground shadow-sm"
              : "text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground",
          )}
        >
          <choice.icon className="size-4" strokeWidth={1.9} aria-hidden />
          <span className="sr-only">{choice.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * The menu of the user: the profile, the preferences and the way out.
 *
 * It is a plain list, not a library: three entries and a theme picker.
 */
function UserMenu({
  displayName,
  caption,
  avatarUrl,
  onSignOut,
  signingOut,
}: {
  displayName: string;
  caption: string;
  avatarUrl: string | null;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const theme = useSyncExternalStore(subscribeTheme, getStoredTheme, getStoredTheme);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      // The menu follows the ARIA pattern: the arrows walk through the
      // entries and the first one takes the focus when it opens.
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"], [role="menuitemradio"]',
        ) ?? [],
      );
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = current === -1 ? 0 : (current + step + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de usuario"
        className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-2 py-1.5 transition-colors hover:border-line-2"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`Foto de perfil de ${displayName}`}
            className="size-7 shrink-0 rounded-lg object-cover ring-1 ring-border"
          />
        ) : (
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
            {initials(displayName)}
          </span>
        )}
        <span className="hidden min-w-0 text-left md:block">
          <span className="block truncate text-xs font-semibold leading-tight">{displayName}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{caption}</span>
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground"
          strokeWidth={1.9}
          aria-hidden
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Menú de usuario"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lift"
        >
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            Sesión
          </p>
          <Link to="/perfil" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <ShieldCheck className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
            Mi perfil y seguridad
          </Link>
          <button
            type="button"
            role="menuitem"
            aria-expanded={prefsOpen}
            onClick={() => setPrefsOpen((value) => !value)}
            className={itemClass}
          >
            <Palette className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
            <span className="flex-1">Preferencias</span>
            <ChevronDown
              className={cn("size-3.5 transition-transform", prefsOpen && "rotate-180")}
              strokeWidth={1.9}
              aria-hidden
            />
          </button>
          {prefsOpen && (
            <div className="mx-1 mb-1 rounded-lg bg-muted p-1">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                Tema
              </p>
              {THEME_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === choice.value}
                  onClick={() => setTheme(choice.value)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-card",
                    theme === choice.value
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <choice.icon className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                  {choice.label}
                </button>
              ))}
            </div>
          )}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            disabled={signingOut}
            className={cn(itemClass, "disabled:cursor-not-allowed disabled:opacity-60")}
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
            {signingOut ? "Cerrando..." : "Cerrar sesión"}
          </button>
        </div>
      )}
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
  const metrics = usePlatformMetrics(role === "super");

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

  // The ICFES flag comes from the entitlement snapshot: the module is
  // open for the schools whose subscription includes it.
  const icfesEnabled = Boolean(
    entitlement.data &&
    (entitlement.data.status === "active" || entitlement.data.status === "trial") &&
    entitlement.data.includes_icfes,
  );

  const displayName = session.profile?.full_name ?? session.user.email ?? "Usuario";
  const caption = (() => {
    if (role === "super") return "Equipo de plataforma";
    if (role === "admin") return "Administración";
    if (role === "docente") return "Docente";
    return "Estudiante";
  })();

  // The counts of the menu of the platform role come from the API: the
  // panel never shows a figure that is written by hand.
  const badges: Partial<Record<string, number>> =
    role === "super" && metrics.data
      ? {
          "/super/colegios": metrics.data.schools,
          "/super/catalogo": metrics.data.materials,
        }
      : {};

  // The bar above the page says where the user is and how big the
  // network is.
  const context = (() => {
    if (role === "super") {
      const schools = metrics.data?.schools;
      const materials = metrics.data?.materials;
      return {
        title: "Panel de plataforma",
        detail:
          schools !== undefined && materials !== undefined
            ? `${schools} colegios · ${materials} materiales en catálogo`
            : "Cargando la red…",
      };
    }
    return {
      title: resolvedSchoolName ?? "Colegio",
      detail: "Comunidad educativa",
    };
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
          schoolName={resolvedSchoolName}
          logoUrl={logoUrl}
          collapsed={collapsed}
        />
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavList role={role} icfesEnabled={icfesEnabled} collapsed={collapsed} badges={badges} />
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
                badges={badges}
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
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/85 px-4 py-3 backdrop-blur sm:px-6">
          <button
            aria-label="Abrir menu"
            className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-muted lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" strokeWidth={1.9} />
          </button>

          <div className="flex min-w-0 items-center gap-2.5">
            <span className="truncate text-sm font-semibold">{context.title}</span>
            <span className="hidden size-1 shrink-0 rounded-full bg-ink-3 sm:block" aria-hidden />
            <span className="hidden truncate text-xs text-muted-foreground sm:block">
              {context.detail}
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationBell userId={session.user.id} />
            <UserMenu
              displayName={displayName}
              caption={caption}
              avatarUrl={session.profile?.avatar_url ?? null}
              onSignOut={onSignOut}
              signingOut={signingOut}
            />
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
