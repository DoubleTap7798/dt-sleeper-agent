import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

interface SubscriptionStatus {
  hasSubscription: boolean;
  status: string | null;
  periodEnd: string | null;
  subscriptionId: string | null;
  isGrandfathered: boolean;
}

export function useSubscription() {
  const { isAuthenticated } = useAuth();
  
  const { data, isLoading, error, refetch } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: isAuthenticated,
  });

  return {
    isPremium: data?.hasSubscription ?? false,
    isGrandfathered: data?.isGrandfathered ?? false,
    status: data?.status ?? null,
    periodEnd: data?.periodEnd ?? null,
    isLoading: isAuthenticated ? isLoading : false,
    error,
    refetch,
  };
}
