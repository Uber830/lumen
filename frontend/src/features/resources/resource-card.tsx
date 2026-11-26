// =============================================================================
// The card of a resource.
// -----------------------------------------------------------------------------
// The library of the school and the library of the platform show the same
// thing: a piece of material with its cover, its name, who it is for and
// what can be done with it. The card is the same on both sides, so a
// resource looks the same to the team that publishes it and to the one
// that reads it.
//
// The cover carries the colour of the area: the same area always has the
// same colour, so the grid can be read without reading a word.
// =============================================================================

import { BookOpen, Play } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The colour of each area.
 *
 * The palette of the panel has five colours, so the areas that are not
 * in the list take the one that corresponds to the first letter of their
 * name. The same area is always the same colour.
 */
const AREA_COVERS: Record<string, string> = {
  Matemáticas: "bg-chart-1",
  Lenguaje: "bg-chart-2",
  Ciencias: "bg-chart-3",
  Sociales: "bg-chart-4",
  Inglés: "bg-chart-5",
  Convivencia: "bg-chart-2",
  Orientación: "bg-chart-3",
  ICFES: "bg-chart-1",
  Artes: "bg-chart-4",
  Deportes: "bg-chart-5",
};

const FALLBACK_COVERS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

/** The colour of the cover of an area. */
export function coverOf(area: string): string {
  const known = AREA_COVERS[area];
  if (known) return known;
  let sum = 0;
  for (const letter of area) sum += letter.charCodeAt(0);
  return FALLBACK_COVERS[sum % FALLBACK_COVERS.length];
}

/**
 * Who a piece of material is for, written the way a person says it.
 *
 * The catalogue speaks in keys: "all", "teachers", "students" and
 * "admins". The panel speaks in people.
 */
export const AUDIENCE_LABEL: Record<string, string> = {
  all: "Para todos",
  teachers: "Solo docentes",
  students: "Solo estudiantes",
  admins: "Solo administradores",
};

/** The label of an audience, with the fallback for an unknown one. */
export function audienceLabel(audience: string): string {
  return AUDIENCE_LABEL[audience] ?? "Para todos";
}

/** One piece of material, as the card shows it. */
export type ResourceCardData = {
  /** The name of the piece: "Matemáticas 7 — Álgebra y funciones". */
  title: string;
  /** What the piece is: "Libro", "Guía", "Evaluación"... */
  type: string;
  /** The area it belongs to: the colour of the cover comes from it. */
  area: string;
  /** The line below the name: the area, the courses and the size. */
  meta: string;
  /** Who the piece is for, with the wording of the panel. */
  audience?: string;
  /** True when the school uploaded it and not the editorial team. */
  fromSchool?: boolean;
  /** True when the piece is a simulator that is played inside the app. */
  interactive?: boolean;
};

export function ResourceCard({
  data,
  chips,
  actions,
}: {
  data: ResourceCardData;
  /** The labels under the name: the audience, the state, the origin. */
  chips?: ReactNode;
  /** What can be done with the piece: the button of the card. */
  actions?: ReactNode;
}) {
  const Icon = data.interactive ? Play : BookOpen;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-idx border border-border bg-card transition-colors",
        "hover:border-primary/40",
      )}
    >
      {/* The cover: the type of the piece and its icon, over the colour
          of the area. */}
      <div
        className={cn("relative flex h-[104px] flex-col justify-between p-3", coverOf(data.area))}
      >
        <span
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/18 to-black/25"
          aria-hidden
        />
        <span className="relative text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/95">
          {data.type}
        </span>
        <Icon
          className="relative size-[22px] self-end text-white/95"
          strokeWidth={1.8}
          aria-hidden
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[13.4px] font-semibold leading-[1.35] text-foreground">
            {data.title}
          </h3>
          <p className="mt-1 text-[11.8px] leading-snug text-muted-foreground">{data.meta}</p>
        </div>

        {chips ? <div className="flex flex-wrap items-center gap-1.5">{chips}</div> : null}

        {actions ? <div className="mt-auto flex justify-end pt-1">{actions}</div> : null}
      </div>
    </article>
  );
}
