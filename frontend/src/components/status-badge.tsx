import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const toneMap = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-destructive-soft text-destructive",
  info: "bg-primary-soft text-primary",
  neutral: "bg-muted text-muted-foreground",
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
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        toneMap[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function toneForEstado(estado: string): Tone {
  const s = estado.toLowerCase();
  if (["activo", "entregado", "revisada", "aprobado"].includes(s)) return "success";
  if (["trial", "pendiente", "licencia", "en revisión"].includes(s)) return "warning";
  if (["suspendido", "en riesgo", "urgente", "vencida"].includes(s)) return "danger";
  return "neutral";
}
