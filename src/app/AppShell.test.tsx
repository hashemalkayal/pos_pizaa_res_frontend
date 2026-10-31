import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getCatalog } from "@/api/v2/catalog";
import { SESSION_STORAGE_KEY } from "@/features/auth/session";
import i18n from "@/i18n";
import { currentPathname, renderApp, signInAs } from "@/test/renderApp";

const navigation = () => screen.getByRole("navigation", { name: "Main navigation" });

describe("route protection", () => {
  it("without a session every staff route leads to sign-in", async () => {
    renderApp("/pos");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(currentPathname()).toBe("/login");
  });

  it("an expired stored session is cleared and explained", async () => {
    signInAs("CASHER", { issuedAt: Math.floor(Date.now() / 1000) - 3600, lifetimeSeconds: 60 });
    renderApp("/pos");
    expect(await screen.findByRole("status")).toHaveTextContent("Your session has expired.");
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("a signed-in user skips the sign-in page", async () => {
    signInAs("CASHER");
    renderApp("/login");
    expect(await screen.findByRole("heading", { level: 1, name: "POS" })).toBeInTheDocument();
  });

  it("the public Landing and Menu pages are reachable without a session", async () => {
    renderApp("/landing");
    expect(await screen.findByRole("heading", { name: "Engineers Pizza" })).toBeInTheDocument();
  });
});

describe("application shell", () => {
  it("cashier: POS and Orders — no Menu (ADMIN only, D80), Reports or Finance (UX rule, D30)", async () => {
    signInAs("CASHER");
    renderApp("/pos");
    await screen.findByRole("heading", { level: 1, name: "POS" });
    const links = within(navigation()).getAllByRole("link").map((link) => link.textContent);
    expect(links.map((text) => text?.replace("Soon", ""))).toEqual(["POS", "Orders"]);
    expect(within(navigation()).getByRole("link", { name: /POS/ })).toHaveAttribute("aria-current", "page");
  });

  it("there is no Customers section for any role: not in the navigation, and its addresses are not found", async () => {
    for (const role of ["CASHER", "ADMIN"] as const) {
      signInAs(role);
      const { unmount } = renderApp("/customers");
      expect(await screen.findByText("Page not found")).toBeInTheDocument();
      expect(within(navigation()).queryByRole("link", { name: /Customers/ })).not.toBeInTheDocument();
      unmount();
    }
    signInAs("ADMIN");
    renderApp("/customers/1");
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });

  it("admin also sees Menu, Sales Reports and Finance, none of them planned any more", async () => {
    signInAs("ADMIN");
    renderApp("/reports");
    expect(await screen.findByRole("heading", { level: 1, name: "Sales Reports" })).toBeInTheDocument();
    const links = within(navigation()).getAllByRole("link").map((link) => link.textContent);
    expect(links).toEqual(["POS", "Orders", "Menu", "Sales Reports", "Finance"]); // no "Soon" badge left
  });

  it("a cashier opening an admin-only address sees the role notice", async () => {
    signInAs("CASHER");
    renderApp("/finance");
    expect(await screen.findByText("Not available for your role")).toBeInTheDocument();
  });

  it("sign out clears the session and returns to sign-in", async () => {
    signInAs("ADMIN");
    renderApp("/pos");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Account menu" }));
    expect(screen.getAllByText("admin@mock.local").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByText("You have been signed out.")).toBeInTheDocument();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("a 401 from any API call clears the session and redirects to sign-in", async () => {
    signInAs("CASHER");
    renderApp("/orders");
    await screen.findByRole("heading", { level: 1, name: "Orders" });
    // Simulate the server rejecting the token (e.g. the user was removed): the stored token is replaced.
    window.localStorage.setItem(SESSION_STORAGE_KEY, "invalid.token.value");
    await act(async () => {
      await getCatalog().catch(() => undefined);
    });
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(currentPathname()).toBe("/login");
  });
});

describe("localization and RTL", () => {
  it("switching to Arabic translates the shell and sets dir=rtl and lang=ar", async () => {
    signInAs("ADMIN");
    renderApp("/pos");
    await screen.findByRole("heading", { level: 1, name: "POS" });
    expect(document.documentElement).toHaveAttribute("dir", "ltr");

    await userEvent.click(screen.getByText("عربي"));
    await waitFor(() => expect(document.documentElement).toHaveAttribute("dir", "rtl"));
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(screen.getByRole("heading", { level: 1, name: "نقطة البيع" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "التنقل الرئيسي" })).getByRole("link", { name: /الطلبات/ })).toBeInTheDocument();
    expect(window.localStorage.getItem("ep.language")).toBe("ar");

    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
  });
});
