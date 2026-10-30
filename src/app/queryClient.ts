import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/errors";

/** Retry a failed read once on network/timeout/5xx; never retry 4xx or mutations (orders must not duplicate). */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          failureCount < 1 && error instanceof ApiError && ["network", "timeout", "server"].includes(error.kind),
      },
      mutations: { retry: false },
    },
  });
