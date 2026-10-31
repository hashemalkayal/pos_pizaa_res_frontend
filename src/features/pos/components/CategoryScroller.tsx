import { useCallback, useEffect, useRef, useState, type ReactNode, type WheelEvent } from "react";
import { ActionIcon, useDirection } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "../Pos.module.css";

/** How far one arrow press moves the row: about 300px, never more than most of what is visible. */
const STEP_PX = 300;

interface ScrollState {
  overflow: boolean;
  atStart: boolean;
  atEnd: boolean;
}

/**
 * The category row: scrolls sideways by swipe, trackpad or mouse wheel, with previous/next arrows on either side
 * that appear only when the categories do not fit. The arrows stay in place and are disabled at either end.
 * RTL: browsers report `scrollLeft` from 0 at the start (right) to negative values towards the end (left).
 */
export const CategoryScroller = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const { dir } = useDirection();
  const reduceMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ScrollState>({ overflow: false, atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    const position = Math.abs(viewport.scrollLeft);
    const next = { overflow: max > 1, atStart: position <= 1, atEnd: position >= max - 1 };
    setState((current) => (current.overflow === next.overflow && current.atStart === next.atStart && current.atEnd === next.atEnd ? current : next));
  }, []);

  // Size changes of the row or of its categories, and window resizes.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Categories added or removed (and the first render): measure after every render; unchanged state is a no-op.
  useEffect(() => measure());

  /** 1 = towards the last category, −1 = towards the first, whatever the reading direction. */
  const scrollPage = (direction: 1 | -1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const distance = Math.min(STEP_PX, viewport.clientWidth * 0.8);
    viewport.scrollBy({ left: direction * distance * (dir === "rtl" ? -1 : 1), behavior: reduceMotion ? "auto" : "smooth" });
  };

  // A vertical mouse wheel moves the row sideways (horizontal trackpad gestures already do).
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!state.overflow || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.currentTarget.scrollLeft += dir === "rtl" ? -event.deltaY : event.deltaY;
  };

  const PreviousIcon = dir === "rtl" ? IconChevronRight : IconChevronLeft;
  const NextIcon = dir === "rtl" ? IconChevronLeft : IconChevronRight;
  return (
    <div className={classes.categoryScroller}>
      {state.overflow ? (
        <ActionIcon size={40} radius="xl" variant="default" className={classes.categoryArrow} disabled={state.atStart} onClick={() => scrollPage(-1)} aria-label={t("pos.browser.previousCategories")}>
          <PreviousIcon size={18} />
        </ActionIcon>
      ) : null}
      <div ref={viewportRef} className={classes.categoryViewport} onScroll={measure} onWheel={onWheel}>
        {children}
      </div>
      {state.overflow ? (
        <ActionIcon size={40} radius="xl" variant="default" className={classes.categoryArrow} disabled={state.atEnd} onClick={() => scrollPage(1)} aria-label={t("pos.browser.nextCategories")}>
          <NextIcon size={18} />
        </ActionIcon>
      ) : null}
    </div>
  );
};
