import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/*
 * The pieces every view of the panel is built with.
 *
 * There is one design in Lumen — the one of «El Índice» — so these
 * pieces carry the same language: hairline borders instead of shadows,
 * square corners, a dark band on the head of the tables and the type
 * of the public site.
 */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-[-0.022em] sm:text-[27px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

const statTone = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  teal: "text-chart-2",
} as const;

const statAccent = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  teal: "bg-chart-2",
} as const;

/**
 * One figure of the panel.
 *
 * The accent line at the bottom says what the figure is about without
 * adding another colour to the page.
 */
export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  delta?: string;
  icon?: LucideIcon;
  tone?: keyof typeof statTone;
}) {
  return (
    <div className="surface-card relative overflow-hidden p-4">
      <span className={cn("absolute inset-x-0 bottom-0 h-0.5", statAccent[tone])} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg bg-muted",
              statTone[tone],
            )}
          >
            <Icon className="size-4" strokeWidth={1.9} />
          </span>
        )}
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-[-0.03em]">{value}</p>
      {delta && <p className="mt-1 text-[11px] text-muted-foreground">{delta}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  leading,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** What goes before the title: a link to the screen of the block. */
  leading?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      {(title || actions || leading) && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {leading}
            <div className="min-w-0">
              {title && <h2 className="truncate text-[15px] font-semibold">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * The empty state: what happened, why, and what to do about it.
 *
 * An empty table is never just blank: it says the cause and offers the
 * action that fills it.
 */
export function EmptyHint({
  title,
  description,
  action,
  icon: Icon = Inbox,
  children,
}: {
  /** What happened. When it is missing, the children say it instead. */
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      {title && <p className="text-sm font-semibold">{title}</p>}
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
      {description && (
        <p className="mx-auto mt-1.5 max-w-[46ch] text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** The toolbar of a table: the search, the filters and the counter. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2.5 border-b border-border bg-card px-4 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The search field of a toolbar. */
export function SearchField({
  value,
  onChange,
  placeholder = "Buscar",
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  return (
    <label className={cn("flex h-9 items-center gap-2 rounded-lg bg-background px-3", className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        className="size-4 shrink-0 text-ink-3"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span className="sr-only">{label ?? placeholder}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
      />
    </label>
  );
}

/** The state of a piece, as a pill with a dot and its name. */
export function StatusPill({
  label,
  tone = "muted",
  className,
}: {
  label: string;
  tone?: "muted" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    muted: "bg-muted text-ink-2",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-destructive-soft text-destructive",
    info: "bg-primary-soft text-primary",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

/** A neutral tag: the type of a material, a school code. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The counter of the extra schools of a row: "+3".
 *
 * When it is given a click, it becomes the button that opens the full
 * list, so the counter is the way into the schools that are not on
 * screen.
 */
export function ExtraCount({ count, onClick }: { count: number; onClick?: () => void }) {
  if (count <= 0) return null;
  const style =
    "inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-primary";
  if (!onClick) {
    return <span className={style}>+{count}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Ver los ${count} colegio(s) que también tienen acceso`}
      className={cn(style, "transition-opacity hover:opacity-80")}
    >
      +{count}
    </button>
  );
}

/**
 * The footer of a long list: how many rows are shown and how to move
 * between pages.
 *
 * It hides itself when everything fits in a single page, so a short list
 * does not get a row of controls it does not need.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0 || pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // The page numbers, with an ellipsis when there are many pages.
  const numbers: (number | "…")[] = [];
  for (let index = 1; index <= pageCount; index += 1) {
    const far = pageCount > 6 && index > 2 && index < pageCount - 1 && Math.abs(index - page) > 1;
    if (far) {
      if (numbers[numbers.length - 1] !== "…") numbers.push("…");
      continue;
    }
    numbers.push(index);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-semibold text-foreground">{from}</span>–
        <span className="font-semibold text-foreground">{to}</span> de{" "}
        <span className="font-semibold text-foreground">{total}</span>
      </p>
      <p className="hidden text-xs text-muted-foreground sm:block">
        Página {page} de {pageCount}
      </p>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-line-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" strokeWidth={1.9} />
          Anterior
        </button>
        {numbers.map((item, index) =>
          item === "…" ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              aria-label={`Página ${item}`}
              className={cn(
                "h-8 min-w-8 rounded-lg border px-2 font-mono text-xs font-medium transition-colors",
                item === page
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-line-2 hover:text-foreground",
              )}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Página siguiente"
          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-line-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
          <ChevronRight className="size-3.5" strokeWidth={1.9} />
        </button>
      </div>
    </div>
  );
}

/**
 * A card whose body folds away.
 *
 * The title stays visible and works as the toggle: one click folds the
 * body, the next one opens it again with the content as it was left.
 */
export function CollapsibleCard({
  title,
  description,
  open,
  onToggle,
  children,
  className,
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          strokeWidth={1.9}
          aria-hidden
        />
      </button>
      {open && <div className="p-5">{children}</div>}
    </section>
  );
}

/**
 * The skeleton of a table: it has the shape of the real table, so the
 * page does not jump when the data arrives.
 */
export function SkeletonRows({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-4" aria-hidden>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <div
              key={columnIndex}
              className="h-4 animate-pulse rounded bg-muted"
              style={{
                width: columnIndex === 0 ? "34%" : `${Math.max(10, 60 - columnIndex * 8)}%`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The skeleton of the figures of the panel. */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface-card space-y-3 p-5">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-16 animate-pulse rounded bg-muted" />
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * A bar with its figure: the shape the panel uses to compare states or
 * areas.
 */
export function MeterRow({
  label,
  value,
  max,
  display,
}: {
  label: string;
  value: number;
  max: number;
  display?: string;
}) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[128px_1fr_48px] items-center gap-3 py-1 text-sm">
      <span className="truncate">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
          aria-hidden
        />
      </span>
      <span className="text-right font-mono text-xs text-muted-foreground">{display ?? value}</span>
    </div>
  );
}
