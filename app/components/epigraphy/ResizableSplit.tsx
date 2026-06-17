"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Props = {
  // Split orientation. "horizontal" places the two panes left/right and the
  // divider is a vertical bar; "vertical" stacks them top/bottom.
  direction: "horizontal" | "vertical";
  first: ReactNode;
  second: ReactNode;
  // Initial size of the FIRST pane, as a percentage (0–100). After the first
  // render this is controlled by drag; the prop only seeds the initial value.
  initialFirstPct?: number;
  // Clamp bounds for the first pane, in percent.
  minFirstPct?: number;
  maxFirstPct?: number;
  // When set, only this pane renders full-bleed (no divider, no second pane).
  // Lets the parent collapse a split without unmounting the surviving child.
  only?: "first" | "second" | null;
  className?: string;
};

const DIVIDER_PX = 6;

export default function ResizableSplit({
  direction,
  first,
  second,
  initialFirstPct = 50,
  minFirstPct = 10,
  maxFirstPct = 90,
  only = null,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [firstPct, setFirstPct] = useState(initialFirstPct);
  const draggingRef = useRef(false);

  const isHorizontal = direction === "horizontal";

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pos = isHorizontal
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;
      const pct = Math.min(
        maxFirstPct,
        Math.max(minFirstPct, pos * 100),
      );
      setFirstPct(pct);
    },
    [isHorizontal, minFirstPct, maxFirstPct],
  );

  const stopDrag = useCallback(() => {
    draggingRef.current = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
    };
  }, [onPointerMove, stopDrag]);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
  };

  // Both panes are ALWAYS rendered in the same DOM structure so their children
  // (e.g. a Leaflet map) are never unmounted when `only` changes. Collapsing a
  // pane just hides the other pane + the divider via CSS and lets the survivor
  // fill the area. This keeps map position/zoom/region-selection intact across
  // show/hide toggles.
  const collapsed = only !== null;
  const showFirst = only !== "second";
  const showSecond = only !== "first";

  // Sizing for the first pane: when collapsed, the visible pane fills 100% and
  // the hidden one collapses to 0; otherwise the dragged percentage applies.
  const firstSize = !showFirst ? "0%" : collapsed ? "100%" : `${firstPct}%`;
  const firstStyle = isHorizontal
    ? { width: firstSize }
    : { height: firstSize };

  return (
    <div
      ref={containerRef}
      className={
        "flex h-full w-full min-h-0 min-w-0 " +
        (isHorizontal ? "flex-row" : "flex-col") +
        " " +
        className
      }
    >
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ ...firstStyle, display: showFirst ? undefined : "none" }}
      >
        {first}
      </div>

      <div
        onPointerDown={startDrag}
        role="separator"
        aria-orientation={isHorizontal ? "vertical" : "horizontal"}
        className={
          "shrink-0 bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-400 active:bg-blue-500 transition-colors " +
          (isHorizontal ? "cursor-col-resize" : "cursor-row-resize")
        }
        style={{
          ...(isHorizontal ? { width: DIVIDER_PX } : { height: DIVIDER_PX }),
          // Hide the divider when either pane is collapsed.
          display: collapsed ? "none" : undefined,
        }}
      />

      <div
        className="min-h-0 min-w-0 overflow-hidden flex-1"
        style={{ display: showSecond ? undefined : "none" }}
      >
        {second}
      </div>
    </div>
  );
}
