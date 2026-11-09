import type { Modifier } from "@dnd-kit/core";

/** Lock dragging to the vertical axis (column list). */
export const restrictToParent: Modifier = ({ transform }) => ({ ...transform, x: 0 });
