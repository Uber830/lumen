import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Children, cloneElement, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

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
    "bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_rgba(46,143,255,.9)] hover:bg-primary/90",
  outline:
    "border border-[rgba(150,175,220,.26)] bg-card text-foreground hover:bg-secondary hover:border-[rgba(150,175,220,.4)]",
  ghost: "bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
  danger:
    "border border-[rgba(240,93,94,.35)] bg-destructive-soft text-[#FF9293] hover:bg-destructive/20",
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
        "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-[10px] border border-transparent font-medium transition-[background,border-color,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
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
 * it again.
 */
const statAccents = {
  primary: "#2E8FFF",
  success: "#2BD98A",
  warning: "#F5A524",
  danger: "#F05D5E",
  teal: "#2DD4BF",
  muted: "#6B7D9C",
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
            className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-secondary"
            style={{ color: accent }}
          >
            <Icon className="size-4" strokeWidth={1.9} aria-hidden />
          </span>
        )}
      </div>
      {loading ? (
        <>
          <span
            className="block h-[26px] w-[62px] animate-pulse rounded-lg bg-[rgba(150,175,220,.13)]"
            aria-hidden
          />
          <span
            className="mt-[7px] block h-[11px] w-[128px] animate-pulse rounded bg-[rgba(150,175,220,.09)]"
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
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      {(title || actions) && (
        <div className="flex items-center gap-3 border-b border-border px-[18px] py-[15px]">
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
        <span className="mx-auto mb-3.5 grid size-12 place-items-center rounded-[14px] bg-secondary">
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
  ok: "border-[rgba(43,217,138,.28)] bg-success-soft text-success",
  warn: "border-[rgba(245,165,36,.28)] bg-warning-soft text-warning",
  danger: "border-[rgba(240,93,94,.28)] bg-destructive-soft text-[#FF9293]",
  info: "border-[rgba(46,143,255,.28)] bg-primary-soft text-[#7FB8FF]",
  teal: "border-[rgba(45,212,191,.28)] bg-[rgba(45,212,191,.13)] text-[#2DD4BF]",
  muted: "border-border bg-[rgba(150,175,220,.1)] text-muted-foreground",
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
 * The toolbar of a table: the search, the filters and the counter.
 *
 * The search of the panel lives here, inside the table it filters.
 * There is no search in the top bar.
 */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2.5 border-b border-border px-[18px] py-3",
        className,
      )}
    >
      {children}
    </div>
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
  "sticky top-0 z-[1] border-b border-border bg-secondary px-[14px] py-[11px] text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground";

export const tableCellClass =
  "border-b border-[rgba(150,175,220,.08)] px-[14px] py-[13px] text-[13.4px] align-middle";

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
    <div className="flex flex-wrap items-center gap-3.5 border-t border-border bg-[#0B1222] px-4 py-3 text-[12.6px] text-muted-foreground">
      <span>
        Mostrando{" "}
        <b className="font-semibold text-[#A0B2CE]">
          {from}–{to}
        </b>{" "}
        de <b className="font-semibold text-[#A0B2CE]">{total}</b>
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="grid size-[30px] place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-[rgba(150,175,220,.26)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
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
                : "border-border bg-card text-muted-foreground hover:border-[rgba(150,175,220,.26)] hover:text-foreground",
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
          className="grid size-[30px] place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-[rgba(150,175,220,.26)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
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
        className="flex w-full items-center gap-3 px-[18px] py-[15px] text-left transition-colors hover:bg-white/[0.045]"
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
