import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Cache durations for different data types
export const CACHE_TIMES = {
  // Stable data - rarely changes (15+ min stale, 1 hour cache)
  STABLE: { staleTime: 15 * 60 * 1000, gcTime: 60 * 60 * 1000 },
  // Semi-stable - changes occasionally (5 min stale, 30 min cache)
  NORMAL: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  // Dynamic - changes frequently (1 min stale, 10 min cache)
  DYNAMIC: { staleTime: 1 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  // Real-time - always fresh (30s stale, 5 min cache)
  REALTIME: { staleTime: 30 * 1000, gcTime: 5 * 60 * 1000 },
};

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - show cached data instantly
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Prefetch common data for a league - call this when league is selected
export async function prefetchLeagueData(leagueId: string) {
  const prefetchPromises = [
    // Standings - most commonly viewed (uses array format)
    queryClient.prefetchQuery({
      queryKey: ["/api/sleeper/standings", leagueId],
      ...CACHE_TIMES.NORMAL,
    }),
    // Current matchups (uses template string in single-element array)
    queryClient.prefetchQuery({
      queryKey: [`/api/sleeper/matchups/${leagueId}`],
      ...CACHE_TIMES.DYNAMIC,
    }),
    // Roster (uses array format)
    queryClient.prefetchQuery({
      queryKey: ["/api/fantasy/roster", leagueId],
      ...CACHE_TIMES.NORMAL,
    }),
    // League info - very stable (uses array format)
    queryClient.prefetchQuery({
      queryKey: ["/api/sleeper/league-info", leagueId],
      ...CACHE_TIMES.STABLE,
    }),
  ];
  
  // Run all prefetches in parallel, don't wait for completion
  Promise.all(prefetchPromises).catch(() => {
    // Silently fail prefetching - not critical
  });
}

// Prefetch player data - call once on app load
export async function prefetchPlayerData() {
  queryClient.prefetchQuery({
    queryKey: ["/api/sleeper/players"],
    ...CACHE_TIMES.STABLE,
  }).catch(() => {
    // Silently fail
  });
}
