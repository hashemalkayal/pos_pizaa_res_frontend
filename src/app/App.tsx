import { useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "@/features/auth/SessionProvider";
import { AppProviders } from "./AppProviders";
import { AppRoutes } from "./AppRoutes";
import { createQueryClient } from "./queryClient";

export const App = () => {
  const [queryClient] = useState(createQueryClient);
  return (
    <AppProviders queryClient={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <AppRoutes />
        </SessionProvider>
      </BrowserRouter>
    </AppProviders>
  );
};
