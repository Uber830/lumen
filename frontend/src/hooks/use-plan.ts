import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_PLAN, planAllowsIcfes, readPlan, subscribePlan, writePlan } from "@/lib/plan";
import type { Plan } from "@/lib/plan";

export function useSchoolPlan() {
  const plan = useSyncExternalStore(
    subscribePlan,
    () => readPlan(),
    () => DEFAULT_PLAN,
  );
  const setPlan = useCallback((p: Plan) => writePlan(p), []);
  return { plan, setPlan, icfesEnabled: planAllowsIcfes(plan) };
}
