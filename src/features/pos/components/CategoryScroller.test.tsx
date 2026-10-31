import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/queryClient";
import i18n from "@/i18n";
import { CategoryScroller } from "./CategoryScroller";

const renderRow = () => {
  render(
    <AppProviders queryClient={createQueryClient()} env="test">
      <CategoryScroller>
        <div role="group" aria-label="Categories">
          {["All", "Pizza", "Manakish", "Folded Sandwiches", "Pasta", "Drinks"].map((name) => (
            <button key={name} type="button">
              {name}
            </button>
          ))}
        </div>
      </CategoryScroller>
    </AppProviders>
  );
  const viewport = screen.getByRole("group", { name: "Categories" }).parentElement!;
  const scrollBy = vi.fn();
  viewport.scrollBy = scrollBy;
  return { viewport, scrollBy };
};

/** jsdom has no layout: give the row the dimensions a browser would measure, then let it re-measure. */
const layout = (viewport: HTMLElement, { scrollWidth, clientWidth, scrollLeft = 0 }: { scrollWidth: number; clientWidth: number; scrollLeft?: number }) => {
  Object.defineProperty(viewport, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(viewport, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(viewport, "scrollLeft", { configurable: true, writable: true, value: scrollLeft });
  fireEvent.scroll(viewport);
};

const previous = () => screen.queryByRole("button", { name: "Previous categories" });
const next = () => screen.queryByRole("button", { name: "Next categories" });

describe("category row arrows", () => {
  it("no arrows while every category fits", () => {
    const { viewport } = renderRow();
    layout(viewport, { scrollWidth: 600, clientWidth: 600 });
    expect(previous()).not.toBeInTheDocument();
    expect(next()).not.toBeInTheDocument();
  });

  it("LTR: arrows when the row overflows, disabled at each end; a press scrolls about 300px smoothly", () => {
    const { viewport, scrollBy } = renderRow();
    layout(viewport, { scrollWidth: 1200, clientWidth: 500 });
    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();

    fireEvent.click(next()!);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 300, behavior: "smooth" });

    layout(viewport, { scrollWidth: 1200, clientWidth: 500, scrollLeft: 300 });
    expect(previous()).toBeEnabled();
    fireEvent.click(previous()!);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -300, behavior: "smooth" });

    layout(viewport, { scrollWidth: 1200, clientWidth: 500, scrollLeft: 700 });
    expect(next()).toBeDisabled();
    expect(previous()).toBeEnabled();
  });

  it("narrow screens move by most of the visible width, so no category is skipped", () => {
    const { viewport, scrollBy } = renderRow();
    layout(viewport, { scrollWidth: 900, clientWidth: 200 });
    fireEvent.click(next()!);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 160, behavior: "smooth" });
  });

  it("RTL: “next” moves towards the end on the left (negative scrollLeft); the ends are detected the same way", async () => {
    await act(async () => {
      await i18n.changeLanguage("ar");
    });
    const { viewport, scrollBy } = renderRow();
    layout(viewport, { scrollWidth: 1200, clientWidth: 500 });
    const previousAr = screen.getByRole("button", { name: "الفئات السابقة" });
    const nextAr = screen.getByRole("button", { name: "الفئات التالية" });
    expect(previousAr).toBeDisabled();
    fireEvent.click(nextAr);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -300, behavior: "smooth" });

    layout(viewport, { scrollWidth: 1200, clientWidth: 500, scrollLeft: -700 });
    expect(nextAr).toBeDisabled();
    expect(previousAr).toBeEnabled();
    fireEvent.click(previousAr);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 300, behavior: "smooth" });
  });

  it("a vertical mouse wheel scrolls the row sideways (towards the end in both directions)", () => {
    const { viewport } = renderRow();
    layout(viewport, { scrollWidth: 1200, clientWidth: 500 });
    fireEvent.wheel(viewport, { deltaY: 120 });
    expect(viewport.scrollLeft).toBe(120);
  });
});
