import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { CourseSubjectChips, type CourseSubjectItem } from "@/features/admin/course-subject-chips";

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function items(count: number): CourseSubjectItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `cs-${index}`,
    label: `6to A · Materia ${index + 1}`,
  }));
}

async function render(props: React.ComponentProps<typeof CourseSubjectChips>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<CourseSubjectChips {...props} />);
  });

  return {
    container,
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("the courses and subjects of a teacher", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the first two and counts the rest", async () => {
    const { container, cleanup } = await render({ items: items(5) });

    expect(container.textContent).toContain("6to A · Materia 1");
    expect(container.textContent).toContain("6to A · Materia 2");
    // The third one is only in the counter.
    expect(container.textContent).not.toContain("6to A · Materia 3");
    expect(container.textContent).toContain("+3");

    await cleanup();
  });

  it("does not count what fits", async () => {
    const { container, cleanup } = await render({ items: items(2) });

    expect(container.textContent).toContain("6to A · Materia 2");
    expect(container.textContent).not.toContain("+");

    await cleanup();
  });

  it("says when the teacher has no course", async () => {
    const { container, cleanup } = await render({ items: [] });

    expect(container.textContent).toContain("Sin curso");

    await cleanup();
  });

  it("opens the whole list when the counter is clicked", async () => {
    const { container, cleanup } = await render({
      items: items(5),
      who: "Lucia Ferreyra",
    });

    const counter = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("+3"),
    );
    expect(counter).toBeDefined();

    await act(async () => {
      counter?.click();
    });

    // The modal lives in a portal: it is in the document, not in the
    // container of the component.
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Cursos y materias de Lucia Ferreyra");
    expect(dialog?.textContent).toContain("6to A · Materia 5");

    await cleanup();
  });
});
