import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, splitLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

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
      // Customer actions and the small wallet list must never wait for an
      // unrelated slow query in the same batched HTTP response. Regular read
      // queries can still share a batch.
      condition: (operation) =>
        operation.type === "mutation" || operation.path === "walletAddress.list",
      // Keep the batch wire format that is reliable in iOS Safari, but allow
      // only one operation per request so it stays isolated from slow queries.
      true: httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        maxItems: 1,
        headers() {
          const token = localStorage.getItem("corevest_token");
          return token ? { "x-local-auth-token": token } : {};
        },
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
      false: httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        headers() {
          const token = localStorage.getItem("corevest_token");
          return token ? { "x-local-auth-token": token } : {};
        },
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
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
