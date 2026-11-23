import { Link } from "@tanstack/react-router";
import { Bell, UserSquare2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** The two views of the account. */
export type ProfileView = "perfil" | "notificaciones";

/**
 * The two views of the account.
 *
 * The menu of the user opens each one of them, and this bar lets the
 * reader move between them without going back to the menu: the account
 * is one place with two screens, not two places in the rail.
 */
const VIEWS: {
  key: ProfileView;
  to: "/perfil" | "/perfil/notificaciones";
  label: string;
  icon: LucideIcon;
}[] = [
  { key: "perfil", to: "/perfil", label: "Mi perfil", icon: UserSquare2 },
  { key: "notificaciones", to: "/perfil/notificaciones", label: "Notificaciones", icon: Bell },
];

/** The switch between the two screens of the account. */
export function ProfileNav({ active }: { active: ProfileView }) {
  return (
    <nav
      aria-label="Secciones de la cuenta"
      className="mb-[18px] flex flex-wrap items-center gap-2"
    >
      {VIEWS.map((view) => {
        const isActive = view.key === active;
        return (
          <Link
            key={view.to}
            to={view.to}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-idx border px-[13px] py-[7px] text-[13px] font-medium transition-colors",
              isActive
                ? "border-primary/45 bg-primary-soft text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-input hover:text-foreground",
            )}
          >
            <view.icon className="size-[15px] shrink-0 opacity-85" strokeWidth={1.9} aria-hidden />
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
