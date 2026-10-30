import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import { AppRoutes } from "@/app/AppRoutes";
import { createQueryClient } from "@/app/queryClient";
import { SessionProvider } from "@/features/auth/SessionProvider";
import { storeSession } from "@/features/auth/session";
import { buildMockToken } from "@/mocks/jwt";
import { MOCK_USERS } from "@/mocks/fixtures/users";

let currentPath = "";
const LocationProbe = () => {
  currentPath = useLocation().pathname;
  return null;
};

/** Pathname of the app rendered by renderApp. */
export const currentPathname = () => currentPath;

/** Stores a mock session for the given fixture user (as if signed in earlier). */
export const signInAs = (role: "ADMIN" | "CASHER", options: { lifetimeSeconds?: number; issuedAt?: number } = {}) => {
  const user = MOCK_USERS.find((candidate) => candidate.role === role)!;
  const { token } = buildMockToken({ userId: user.id, email: user.email, role: user.role }, options);
  storeSession(token);
  return { user, token };
};

/** Renders the whole app (providers, session, routes) at `path`, with transitions and portals disabled. */
export const renderApp = (path = "/") =>
  render(
    <AppProviders queryClient={createQueryClient()} env="test">
      <MemoryRouter initialEntries={[path]}>
        <SessionProvider>
          <LocationProbe />
          <AppRoutes />
        </SessionProvider>
      </MemoryRouter>
    </AppProviders>
  );
