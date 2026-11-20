import { StatusPill } from "@/components/ui-kit";
import type { ReactNode } from "react";

/**
 * The badge of a state.
 *
 * It is the pill of the design system with the point of its color, so
 * the whole panel speaks the same language: a state is a point and a
 * word, never a piece of text alone.
 */

const toneMap = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  neutral: "muted",
} as const;

export type Tone = keyof typeof toneMap;

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <StatusPill label={String(children)} tone={toneMap[tone]} className={className} />;
}

export function toneForEstado(estado: string): Tone {
  const s = estado.toLowerCase();
  if (["activo", "entregado", "revisada", "aprobado"].includes(s)) return "success";
  if (["trial", "pendiente", "licencia", "en revisión"].includes(s)) return "warning";
  if (["suspendido", "en riesgo", "urgente", "vencida"].includes(s)) return "danger";
  return "neutral";
}
