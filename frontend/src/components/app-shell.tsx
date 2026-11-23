import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  Info,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  Sun,
  UserSquare2,
  X,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/browser";
import { fileUrl } from "@/lib/storage/files";
import type { SessionContext } from "@/lib/auth/functions";
import { useEntitlement } from "@/lib/billing/hooks";
import { NAV, ROLE_LABEL, ROLE_NOTE, isCurrentPath, type AppShellRole } from "@/lib/navigation";
import type { NavItem } from "@/lib/navigation";
import { usePlatformMetrics } from "@/lib/platform/hooks";
import { useSchool } from "@/lib/school/hooks";
import { useSchoolOverview } from "@/lib/school/overview";
import { openCaseCount, useSchoolSupportCases } from "@/lib/school/support";
import { applyPrimaryColor, primaryColorStyle } from "@/lib/school/theme";
import { getStoredTheme, setTheme, subscribeTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type { AppShellRole } from "@/lib/navigation";

type SchoolPlan = "Basico" | "Estandar" | "Premium" | "Sin plan";

/** Where a counter of the rail comes from. */
type BadgeCounts = Partial<Record<NonNullable<NavItem["badgeSource"]>, number | null>>;

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
  schoolLogo,
}: {
  role: AppShellRole;
  schoolName: string | null;
  schoolLogo: string | null;
}) {
  // The mark of the platform is the logo of Lumen. The roles of a school
  // wear the shield of their school instead: it is the identity of the
  // institution, and the administrator configures it in Personalización.
  const shield = role !== "super" ? fileUrl(schoolLogo) : null;
  const mark = shield ? (
    <img
      src={shield}
      alt=""
      className="size-[34px] shrink-0 rounded-idx object-cover"
      width={34}
      height={34}
    />
  ) : (
    <BrandLogo className="size-[34px]" />
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

/**
 * The rail of each role.
 *
 * The groups say what the section is about: the operation of the day,
 * the academic structure, the configuration of the school and the
 * support. "Mi perfil" is not here: it lives in the menu of the user,
 * at the top right.
 */
function NavGroups({
  role,
  icfesEnabled,
  badges,
  onNavigate,
}: {
  role: AppShellRole;
  icfesEnabled: boolean;
  badges: BadgeCounts;
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
                const active = isCurrentPath(pathname, item.to);
                // The counter only shows up where there is a real queue
                // of work: the material the school has, the cases that
                // are still open and the size of the network.
                const count = item.badgeSource ? (badges[item.badgeSource] ?? null) : null;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      title={item.label}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center gap-[11px] rounded-idx border border-transparent px-[10px] py-[9px] text-left text-[13.5px] transition-colors",
                        ICON_ONLY_ITEM,
                        active
                          ? "border-sidebar-border bg-sidebar-accent font-medium text-white"
                          : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
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
                            "ml-auto rounded-full bg-primary-soft px-[7px] py-px font-mono text-[11px] font-semibold text-primary",
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
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-sidebar-border bg-card p-3 text-[12px] text-muted-foreground">
        <Info className="mt-0.5 size-[15px] shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
        <p className={cn("min-w-0 leading-snug", ICON_ONLY)}>
          <span className="font-semibold text-sidebar-foreground">{ROLE_LABEL[role]}</span>
          <br />
          {ROLE_NOTE[role]}
        </p>
      </div>
    </div>
  );
}

const THEME_CHOICES: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

/**
 * The menu of the user: the profile, the preferences and the way out.
 */
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
  const avatar = fileUrl(session.profile?.avatar_url);
  // The theme is a personal preference that lives in the browser: the
  // store is the source of truth, so the menu reads it directly.
  const theme = useSyncExternalStore(subscribeTheme, getStoredTheme, getStoredTheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-[9px] rounded-xl border border-border bg-card py-1 pl-1 pr-2 transition-colors hover:border-input"
        >
          {avatar ? (
            <img
              src={avatar}
              alt={`Foto de ${displayName}`}
              className="size-8 shrink-0 rounded-idx object-cover"
              loading="lazy"
              width={32}
              height={32}
            />
          ) : (
            <span className="grid size-8 shrink-0 place-items-center rounded-idx bg-primary text-[12px] font-bold text-white">
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
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="size-4" strokeWidth={1.9} aria-hidden />
            Tema
            <span className="ml-auto pl-4 text-xs text-muted-foreground">
              {THEME_CHOICES.find((choice) => choice.value === theme)?.label}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as ThemePreference)}
            >
              {THEME_CHOICES.map((choice) => (
                <DropdownMenuRadioItem key={choice.value} value={choice.value}>
                  <choice.icon className="size-4" strokeWidth={1.9} aria-hidden />
                  {choice.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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
  // The size of the network, for the rail of the platform role.
  const metrics = usePlatformMetrics(role === "super");

  // The school's branding comes with the session, so the server already
  // knows it when it renders the page. The live query (useSchool) keeps
  // it fresh after the admin saves a change.
  const sessionBrand = session.school;
  const primaryColor = school.data?.primary_color ?? sessionBrand?.primary_color ?? null;
  // The shield of the school, the same one the administrator uploads in
  // Personalización. It travels with the session, so the rail wears it
  // from the first frame.
  const schoolLogo = school.data?.logo_url ?? sessionBrand?.logo_url ?? null;

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

  // The plan comes from the entitlement snapshot: it is the label the
  // platform shows for the school.
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

  // The counters of the rail. Every figure comes from the API: the
  // panel never shows a number that is written by hand.
  const badges: BadgeCounts = {
    material: overview.data?.material.available ?? null,
    support: supportCases.data ? openCaseCount(supportCases.data) : null,
    schools: metrics.data?.schools ?? null,
    materials: metrics.data?.materials ?? null,
  };

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
      detail: session.currentPeriod ?? `Plan ${plan}`,
    };
  })();

  return (
    <div className="lumen-panel idx-site min-h-screen w-full bg-background">
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
        <Brand role={role} schoolName={resolvedSchoolName} schoolLogo={schoolLogo} />
        <div className="flex-1 overflow-y-auto px-3 pb-[18px] pt-1.5">
          <NavGroups role={role} icfesEnabled={icfesEnabled} badges={badges} />
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
              <Brand role={role} schoolName={resolvedSchoolName} schoolLogo={schoolLogo} />
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
                badges={badges}
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
            className="grid size-9 shrink-0 place-items-center rounded-idx border border-border bg-card text-muted-foreground hover:text-foreground min-[900px]:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-[18px]" strokeWidth={1.9} />
          </button>

          {/* The bar shows the context of the session, not a search: the
              search of the panel lives inside each table. */}
          <div className="flex min-w-0 items-center gap-2.5 text-[13px] text-muted-foreground">
            <span className="truncate text-[14px] font-semibold text-foreground">
              {context.title}
            </span>
            <span className="size-[5px] shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
            <span className="truncate">{context.detail}</span>
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

        <main className="relative z-10 mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-7">
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
