import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

function authHeaders() {
  const token = localStorage.getItem("corevest_token");
  return token ? { "x-local-auth-token": token } : {};
}

function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return globalThis.fetch(input, {
    ...(init ?? {}),
    credentials: "include",
    cache: "no-store",
    keepalive: true,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      retry: 1,
    },
  },
});
const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (operation) =>
        operation.path === "deposit.create"
        || operation.path === "deposit.requestStatus",
      // Deposit submission uses a plain, single-operation HTTP response. This
      // avoids iOS Safari intermittently losing the tRPC batch response even
      // though Railway has already completed the mutation.
      true: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        headers: authHeaders,
        fetch: authenticatedFetch,
      }),
      false: splitLink({
        // Preserve the existing isolated transport for every other mutation
        // and the wallet list; this fix must not alter unrelated flows.
        condition: (operation) =>
          operation.type === "mutation" || operation.path === "walletAddress.list",
        true: httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          maxItems: 1,
          headers: authHeaders,
          fetch: authenticatedFetch,
        }),
        false: httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          headers: authHeaders,
          fetch: authenticatedFetch,
        }),
      }),
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
