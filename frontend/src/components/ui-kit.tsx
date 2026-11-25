import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Children, cloneElement, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The pieces every view of the panel is built with.
 *
 * There is one design in Lumen — the one of «El Índice» — so these
 * pieces carry the same language: hairline borders instead of shadows,
 * square corners, a dark band on the head of the tables and the type
 * of the public site.
 */

/**
 * The header of a view: the title, what the view is about and the
 * action of the screen.
 *
 * There is one primary action per screen. It goes on the right, and
 * it says what happens: "Nuevo docente", "Guardar cambios". Never
 * "Aceptar".
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
    <header className="mb-[22px] flex flex-wrap items-start gap-5">
      <div className="min-w-0">
        <h1 className="text-[27px] font-bold leading-tight tracking-[-0.022em]">{title}</h1>
        {subtitle && (
          <p className="mt-[3px] max-w-[70ch] text-[13.8px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/**
 * The button of the panel.
 *
 * Four variants, and only one primary action per screen. The ghost one
 * is for the links that live inside a card.
 */
const buttonVariants = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_rgba(26,76,240,.55)] hover:bg-primary/90",
  outline:
    "border border-input bg-card text-foreground hover:bg-secondary hover:border-foreground/40",
  // The ghost one lives inside the cards: on hover it takes a surface,
  // a hairline border and a soft shadow, so the reader sees that the
  // control is there and that it can be pressed.
  ghost:
    "bg-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground hover:shadow-[0_2px_10px_-6px_rgba(10,13,19,.38)]",
  danger:
    "border border-destructive/35 bg-destructive-soft text-destructive hover:bg-destructive/20",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function Button({
  children,
  variant = "primary",
  icon: Icon,
  size = "md",
  className,
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  // A control that cannot be used stays in the tab order when it is
  // marked with `aria-disabled`: the reader can reach it and hear the
  // reason, which is the point of saying why it does not work.
  const unavailable =
    rest.disabled === true || rest["aria-disabled"] === true || rest["aria-disabled"] === "true";

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-idx border border-transparent font-medium transition-[background,border-color,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "px-[11px] py-1.5 text-[12.4px]" : "px-[15px] py-2 text-[13.2px]",
        buttonVariants[variant],
        unavailable && "cursor-not-allowed opacity-45",
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className="size-[15.5px] shrink-0" strokeWidth={1.9} aria-hidden />}
      {children}
    </button>
  );
}

/**
 * The indicator of a card.
 *
 * The accent is a line at the bottom of the card and the colour of
 * the icon: the number is what matters, the colour only helps to find
 * it again. The colours are the ones of El Indice: the brand, the
 * three states and the ink.
 */
const statAccents = {
  primary: "var(--accent-solid)",
  success: "var(--ok-fg)",
  warning: "var(--warn-fg)",
  danger: "var(--bad-fg)",
  teal: "var(--ink)",
  muted: "var(--ink-2)",
} as const;

export type StatTone = keyof typeof statAccents;

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "primary",
  loading = false,
}: {
  label: string;
  value: string;
  /** The line under the number: what the number means. */
  delta?: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  /** While the number is on its way, the card shows its own shape. */
  loading?: boolean;
}) {
  const accent = statAccents[tone];
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card px-[18px] py-[17px]"
      style={{ "--acc": accent } as React.CSSProperties}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2.5">
        <p className="text-[12.6px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className="grid size-8 shrink-0 place-items-center rounded-idx bg-secondary"
            style={{ color: accent }}
          >
            <Icon className="size-4" strokeWidth={1.9} aria-hidden />
          </span>
        )}
      </div>
      {loading ? (
        <>
          <span className="block h-[26px] w-[62px] animate-pulse rounded-lg bg-muted" aria-hidden />
          <span
            className="mt-[7px] block h-[11px] w-[128px] animate-pulse rounded bg-muted"
            aria-hidden
          />
        </>
      ) : (
        <>
          <p className="text-[29px] font-bold leading-[1.05] tracking-[-0.03em]">{value}</p>
          {delta && <p className="mt-[3px] text-[12px] text-muted-foreground">{delta}</p>}
        </>
      )}
    </div>
  );
}

/** The card of the panel: the title, what it is about and the body. */
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
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      {(title || actions || leading) && (
        <div className="flex items-center gap-3 border-b border-border px-[18px] py-[15px]">
          {leading}
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
            )}
            {description && (
              <p className="mt-px text-[12.5px] text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("px-[18px] py-[18px]", bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * The empty state: the icon, the cause and the way out.
 *
 * A list with nothing in it says why, and what to do about it. It
 * never shows a blank rectangle.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-11 text-center text-muted-foreground">
      {Icon && (
        <span className="mx-auto mb-3.5 grid size-12 place-items-center rounded-idx bg-secondary">
          <Icon className="size-[22px]" strokeWidth={1.9} aria-hidden />
        </span>
      )}
      <b className="mb-[5px] block text-[14.5px] font-semibold text-foreground">{title}</b>
      {description && <p className="mx-auto max-w-[52ch] text-[13px]">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * A short message inside a card, for the lists that are empty but do
 * not need a whole empty state.
 */
export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * The status of a row: a dot and the words.
 *
 * The state is never told by the colour alone: the dot and the label
 * travel together, so it also works for a reader who does not see the
 * colours.
 */
export type ChipTone = "ok" | "warn" | "danger" | "info" | "teal" | "muted";

const chipTones: Record<ChipTone, string> = {
  ok: "border-success/30 bg-success-soft text-success",
  warn: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-destructive/30 bg-destructive-soft text-destructive",
  info: "border-primary/30 bg-primary-soft text-primary",
  teal: "border-primary/30 bg-primary-soft text-primary",
  muted: "border-border bg-muted text-muted-foreground",
};

export function Chip({
  children,
  tone = "muted",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: ChipTone;
  /** The dot that says the state without depending on the colour. */
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[11.8px] font-medium",
        chipTones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/**
 * The state of a piece, as a pill with a dot and its name.
 *
 * It is the chip of the design system with the point of its colour:
 * the whole panel speaks the same language.
 */
export type StatusTone = "muted" | "success" | "warning" | "danger" | "info";

const statusTones: Record<StatusTone, ChipTone> = {
  muted: "muted",
  success: "ok",
  warning: "warn",
  danger: "danger",
  info: "info",
};

export function StatusPill({
  label,
  tone = "muted",
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <Chip tone={statusTones[tone]} dot className={className}>
      {label}
    </Chip>
  );
}

/** A neutral tag: the type of a material, a school code. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-[9px] py-[3px] text-[11.8px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The toolbar of a table: the search, the filters and the counter.
 *
 * The search of the panel lives here, inside the table it filters.
 * There is no search in the top bar.
 */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2.5 border-b border-border bg-card px-[18px] py-3",
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
    <label className={cn("flex h-9 items-center gap-2 rounded-idx bg-card px-3", className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        className="size-4 shrink-0 text-muted-foreground"
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
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

/** The table of the panel: the header stays fixed while it scrolls. */
export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
}

/**
 * The text of a header cell, to label the cell of the row.
 *
 * The label of a column can be hidden behind a screen-reader only
 * span, so the text is looked for in the whole subtree.
 */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return textOf(props.children);
  }
  return "";
}

/**
 * The table of the panel.
 *
 * On a wide screen it is a table. Under 768 px it becomes a stack of
 * cards, one per row, and every card carries the label of its column:
 * a phone reader needs to know what each value means.
 *
 * The labels come from the header of the table itself, so a column can
 * be renamed in one place and the mobile view follows.
 */
export function PanelTable({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  // The caption can come first, so the header and the body are looked
  // for by their type and not by their position.
  const head = Children.toArray(children).find(
    (child) => isValidElement(child) && child.type === "thead",
  );
  const body = Children.toArray(children).find(
    (child) => isValidElement(child) && child.type === "tbody",
  );
  // The caption describes the table for the screen reader.
  const caption = Children.toArray(children).find(
    (child) => isValidElement(child) && child.type === "caption",
  );

  const labels: string[] = [];
  if (isValidElement(head)) {
    const headProps = head.props as { children?: ReactNode };
    Children.forEach(Children.toArray(headProps.children), (row) => {
      if (!isValidElement(row)) return;
      const rowProps = row.props as { children?: ReactNode };
      Children.forEach(Children.toArray(rowProps.children), (cell) => {
        if (!isValidElement(cell)) return;
        const cellProps = cell.props as { children?: ReactNode };
        labels.push(textOf(cellProps.children).trim());
      });
    });
  }

  const labelledBody = isValidElement(body)
    ? cloneElement(
        body as React.ReactElement<{ children?: ReactNode }>,
        undefined,
        (() => {
          const rows = Children.toArray((body.props as { children?: ReactNode }).children);
          return Children.map(rows, (row) => {
            if (!isValidElement(row)) return row;
            const rowProps = row.props as { children?: ReactNode };
            const cells = Children.toArray(rowProps.children);
            let index = 0;
            const labelled = Children.map(cells, (cell) => {
              if (!isValidElement(cell)) return cell;
              const cellProps = cell.props as { "data-label"?: string };
              const label = labels[index] ?? cellProps["data-label"];
              index += 1;
              return cloneElement(cell as React.ReactElement<Record<string, unknown>>, {
                "data-label": label,
              });
            });
            return cloneElement(
              row as React.ReactElement<Record<string, unknown>>,
              undefined,
              labelled,
            );
          });
        })(),
      )
    : body;

  return (
    <table {...props}>
      {caption}
      {head}
      {labelledBody}
    </table>
  );
}

export const tableHeadClass =
  "sticky top-0 z-[1] border-b border-border bg-[var(--head-bg)] px-[14px] py-[11px] text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--head-fg)]";

export const tableCellClass =
  "border-b border-border px-[14px] py-[13px] text-[13.4px] align-middle";

/**
 * The page numbers to show: all of them when there are few, and a
 * window around the current one when there are many.
 */
function pageNumbers(page: number, pageCount: number): number[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const start = Math.min(Math.max(page - 2, 1), pageCount - 4);
  return Array.from({ length: 5 }, (_, index) => start + index);
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

  return (
    <div className="flex flex-wrap items-center gap-3.5 border-t border-border bg-secondary px-4 py-3 text-[12.6px] text-muted-foreground">
      <span>
        Mostrando{" "}
        <b className="font-semibold text-foreground">
          {from}–{to}
        </b>{" "}
        de <b className="font-semibold text-foreground">{total}</b>
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="grid size-[30px] place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-input hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="size-[13px]" strokeWidth={1.9} aria-hidden />
          <span className="sr-only">Anterior</span>
        </button>
        {pageNumbers(page, pageCount).map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onPageChange(number)}
            aria-current={number === page ? "page" : undefined}
            aria-label={`Ir a la página ${number}`}
            className={cn(
              "grid size-[30px] place-items-center rounded-lg border font-mono text-[12.4px] transition-colors",
              number === page
                ? "border-primary bg-primary text-white"
                : "border-border bg-card text-muted-foreground hover:border-input hover:text-foreground",
            )}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Página siguiente"
          className="grid size-[30px] place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-input hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="size-[13px]" strokeWidth={1.9} aria-hidden />
          <span className="sr-only">Siguiente</span>
        </button>
        <span className="sr-only" aria-live="polite">
          Página {page} de {pageCount}
        </span>
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
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-[18px] py-[15px] text-left transition-colors hover:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {description && (
            <p className="mt-px text-[12.5px] text-muted-foreground">{description}</p>
          )}
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
      {open && <div className="px-[18px] py-[18px]">{children}</div>}
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
        <div key={index} className="rounded-2xl border border-border bg-card p-5">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-7 w-16 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-3 w-28 animate-pulse rounded bg-muted" />
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
    "inline-flex items-center rounded-full bg-primary-soft px-[9px] py-[3px] font-mono text-[11.8px] font-semibold text-primary";
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
