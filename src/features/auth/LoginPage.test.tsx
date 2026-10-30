import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { currentPathname, renderApp } from "@/test/renderApp";
import { SESSION_STORAGE_KEY } from "./session";

const fillAndSubmit = async (email: string, password: string) => {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText(/email/i), email);
  if (password) await user.type(screen.getByLabelText(/password/i), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
};

describe("Login", () => {
  it("shows the official logo and validates required fields before calling the API", async () => {
    let calls = 0;
    server.events.on("request:start", () => calls++);
    renderApp("/login");
    expect(screen.getAllByAltText("Engineers Pizza")[0]).toHaveAttribute("src", expect.stringContaining("logo"));
    await fillAndSubmit("", "");
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/email/i), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    server.events.removeAllListeners();
    expect(calls).toBe(0);
  });

  it("signs in, stores the session and opens the POS", async () => {
    renderApp("/login");
    await fillAndSubmit("cashier@mock.local", "mock-cashier");
    expect(await screen.findByRole("heading", { level: 1, name: "POS" })).toBeInTheDocument();
    expect(currentPathname()).toBe("/pos");
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeTruthy();
  });

  it("returns to the page the user originally asked for", async () => {
    renderApp("/orders");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    await fillAndSubmit("cashier@mock.local", "mock-cashier");
    await waitFor(() => expect(currentPathname()).toBe("/orders"));
  });

  it("wrong credentials: the backend message, no session", async () => {
    renderApp("/login");
    await fillAndSubmit("cashier@mock.local", "wrong-password");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(currentPathname()).toBe("/login");
  });

  it("429: tells the user how long to wait (from Retry-After)", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json(
          { message: "Too many failed login attempts. Try again later.", statusCode: 429, code: "RATE_LIMITED", error: { code: "RATE_LIMITED", details: { retryAfterSeconds: 600 } } },
          { status: 429, headers: { "Retry-After": "600" } }
        )
      )
    );
    renderApp("/login");
    await fillAndSubmit("cashier@mock.local", "whatever");
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in 10 minutes.");
  });

  it("server and network failures are distinguished", async () => {
    server.use(http.post("*/api/auth/login", () => HttpResponse.json({ message: "internal server error", statusCode: 500 }, { status: 500 })));
    renderApp("/login");
    await fillAndSubmit("cashier@mock.local", "mock-cashier");
    expect(await screen.findByRole("alert")).toHaveTextContent("The server could not complete the request.");

    server.use(http.post("*/api/auth/login", () => HttpResponse.error()));
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Cannot reach the server."));
  });

  it("prevents double submission while signing in", async () => {
    let requests = 0;
    server.use(
      http.post("*/api/auth/login", async () => {
        requests++;
        await delay(150);
        return HttpResponse.json({ response: {}, message: "Invalid email or password" }, { status: 401 });
      })
    );
    renderApp("/login");
    const user = await fillAndSubmit("cashier@mock.local", "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.keyboard("{Enter}");
    await screen.findByRole("alert");
    expect(requests).toBe(1);
  });
});
