// =============================================================================
// The countdown of a timed attempt.
// -----------------------------------------------------------------------------
// The clock is anchored to the moment the attempt started, not to the
// moment the screen mounted: a student who reloads the page does not
// get the time back, and the backend closes the attempt anyway.
// =============================================================================

import { useEffect, useRef, useState } from "react";

/**
 * The seconds left of a timed attempt, or null when the attempt has no
 * time limit.
 *
 * `onExpire` fires when the time runs out. It is kept in a ref so the
 * interval is not restarted every time the caller passes a new
 * function.
 */
export function useCountdown({
  startedAt,
  durationSeconds,
  onExpire,
}: {
  startedAt: string | null;
  durationSeconds: number | null;
  onExpire?: () => void;
}): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  const expireRef = useRef<(() => void) | undefined>(undefined);

  // The callback is kept fresh here, not during the render: writing a
  // ref while rendering is not allowed.
  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!startedAt || !durationSeconds) return;

    const startedMs = new Date(startedAt).getTime();
    if (Number.isNaN(startedMs)) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const elapsed = Math.floor((Date.now() - startedMs) / 1000);
      const left = Math.max(0, durationSeconds - elapsed);
      setRemaining(left);
      if (left === 0) {
        expireRef.current?.();
      }
    };

    // The first tick waits a tick of the event loop: updating the
    // state synchronously inside the effect would force a second
    // render on every mount.
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [startedAt, durationSeconds]);

  if (!startedAt || !durationSeconds) return null;
  return remaining;
}

/** The seconds left, as a clock: "42:18". */
export function formatCountdown(seconds: number | null): string {
  if (seconds === null) return "—";
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
