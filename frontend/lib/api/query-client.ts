import { QueryClient } from "@tanstack/react-query";

import { ApiClientError } from "@/lib/types/api";

function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount >= 2) {
    return false;
  }

  if (error instanceof ApiClientError) {
    return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
  }

  return true;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 5 * 60_000,
        staleTime: 20_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
