import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
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
      // A mutation must never wait for an unrelated, slow query in the same
      // batched HTTP response. This keeps actions such as deposit confirmation
      // responsive while regular read queries can still be batched.
      condition: (operation) => operation.type === "mutation",
      true: httpLink({
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
