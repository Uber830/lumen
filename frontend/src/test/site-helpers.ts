// =============================================================================
// Helpers for the tests of the public site.
// -----------------------------------------------------------------------------
// The repository does not use Testing Library: the components are
// rendered with `react-dom/client` and `act`.
// =============================================================================

import { act } from "react";

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Let the pending promises settle.
 *
 * React Query resolves the request in a microtask, and the render that
 * follows is another one, so the test has to give it a couple of
 * ticks.
 */
export async function flush(times = 3) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/**
 * Type into an input the way a person does.
 *
 * React keeps a copy of the last value of the field, and it ignores a
 * change that matches it. Assigning the value through the native
 * setter is what makes React see the change.
 */
export async function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
