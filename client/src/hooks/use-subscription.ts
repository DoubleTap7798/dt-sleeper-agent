import { useQuery } from "@tanstack/react-query";

interface SubscriptionStatus {
  hasSubscription: boolean;
  status: string | null;
  periodEnd: string | null;
  subscriptionId: string | null;
}

export function useSubscription() {
  const { data, isLoading, error, refetch } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: false,
  });

  return {
    isPremium: data?.hasSubscription ?? false,
    status: data?.status ?? null,
    periodEnd: data?.periodEnd ?? null,
    isLoading,
    error,
    refetch,
  };
}
