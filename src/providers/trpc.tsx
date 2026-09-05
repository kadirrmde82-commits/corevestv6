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
  });
}

function customerActionFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Some iOS/WebKit sessions leave fetch() pending even after Railway has
  // answered. XHR provides a hard timeout and a separate, stable transport for
  // the two money-related customer actions without changing the rest of tRPC.
  return new Promise((resolve, reject) => {
    const requestUrl = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const xhr = new XMLHttpRequest();
    xhr.open(init?.method || "GET", requestUrl, true);
    xhr.withCredentials = true;
    xhr.timeout = 7000;

    const headers = new Headers(init?.headers);
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));

    const abortFromUpstream = () => xhr.abort();
    init?.signal?.addEventListener("abort", abortFromUpstream, { once: true });

    const cleanup = () => init?.signal?.removeEventListener("abort", abortFromUpstream);
    xhr.onload = () => {
      cleanup();
      const responseHeaders = new Headers();
      xhr.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach((line) => {
        const separator = line.indexOf(":");
        if (separator > 0) responseHeaders.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
      });
      resolve(new Response(xhr.responseText, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: responseHeaders,
      }));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new TypeError("Network request failed"));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new DOMException("Request timed out", "TimeoutError"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Request aborted", "AbortError"));
    };

    if (init?.signal?.aborted) {
      xhr.abort();
      return;
    }
    xhr.send((init?.body as XMLHttpRequestBodyInit | null | undefined) ?? null);
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
        || operation.path === "deposit.requestStatus"
        || operation.path === "click.record"
        || operation.path === "click.status"
        || operation.path === "click.history",
      // Deposit and Quantify use plain, single-operation responses over the
      // bounded XHR transport; unrelated API calls preserve their old path.
      true: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        headers: authHeaders,
        fetch: customerActionFetch,
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
