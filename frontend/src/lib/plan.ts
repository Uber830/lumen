export type Plan = "Free" | "Básico" | "Estándar" | "Premium";

export const PLAN_COOKIE = "edu_plan";
export const DEFAULT_PLAN: Plan = "Estándar";

/** Planes con acceso al módulo Simulacros ICFES. */
export const ICFES_PLANS: Plan[] = ["Estándar", "Premium"];

export function planAllowsIcfes(plan: string | undefined | null): boolean {
  return ICFES_PLANS.includes((plan ?? "") as Plan);
}

export function parsePlanFromCookie(cookieHeader: string | undefined | null): Plan {
  const match = /(?:^|;\s*)edu_plan=([^;]+)/.exec(cookieHeader ?? "");
  const raw = match?.[1] ? decodeURIComponent(match[1]) : "";
  const valid: Plan[] = ["Free", "Básico", "Estándar", "Premium"];
  return valid.includes(raw as Plan) ? (raw as Plan) : DEFAULT_PLAN;
}

const EVENT = "edu-plan-change";

export function readPlan(): Plan {
  if (typeof document === "undefined") return DEFAULT_PLAN;
  return parsePlanFromCookie(document.cookie);
}

export function writePlan(plan: Plan) {
  if (typeof document === "undefined") return;
  document.cookie = `${PLAN_COOKIE}=${encodeURIComponent(plan)}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribePlan(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
