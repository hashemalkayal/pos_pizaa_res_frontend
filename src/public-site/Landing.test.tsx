import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/renderApp";

const link = (name: RegExp) => screen.getByRole("link", { name });

describe("public landing page", () => {
  it("shows the logo as the page heading and links out to the menu, offers, location and social pages", async () => {
    renderApp("/landing");
    expect(await screen.findByRole("heading", { level: 1, name: "Engineers Pizza" })).toBeInTheDocument();
    expect(screen.getByText(/designing taste/)).toBeInTheDocument();

    expect(link(/View the menu/)).toHaveAttribute("href", expect.stringContaining("dropbox.com"));
    expect(link(/Offers/)).toHaveAttribute("href", "https://www.instagram.com/engineerspizza/");
    expect(link(/Locations/)).toHaveAttribute("href", "https://maps.app.goo.gl/mbnkxKF17gnpqYc96");
    expect(link(/Facebook/)).toHaveAttribute("href", expect.stringContaining("facebook.com"));
    expect(link(/Instagram/)).toHaveAttribute("href", "https://www.instagram.com/engineerspizza/");

    for (const each of screen.getAllByRole("link")) {
      expect(each).toHaveAttribute("target", "_blank");
      expect(each).toHaveAttribute("rel", "noopener noreferrer");
    }
    // The page's own buttons say they open a new tab; the social icons are named by their brand.
    expect(link(/View the menu/)).toHaveAccessibleName("View the menu (opens in a new tab)");
  });

  it("switches to Arabic, right to left", async () => {
    renderApp("/landing");
    await screen.findByRole("heading", { level: 1, name: "Engineers Pizza" });

    await userEvent.click(screen.getByText("عربي"));
    await waitFor(() => expect(document.documentElement).toHaveAttribute("dir", "rtl"));
    expect(screen.getByText(/تصميم المذاق/)).toBeInTheDocument();
    expect(link(/تصفّح المنيو/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Engineers Pizza" })).toBeInTheDocument();
  });

  it("the background video can be paused and played again", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, "paused", { configurable: true, value: false });
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    });
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, "paused", { configurable: true, value: true });
      this.dispatchEvent(new Event("pause"));
    });
    renderApp("/landing");

    // jsdom does not autoplay: the control offers to play until the video actually plays.
    await userEvent.click(await screen.findByRole("button", { name: "Play the background video" }));
    expect(play).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Pause the background video" }));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Play the background video" })).toBeInTheDocument();
  });
});
