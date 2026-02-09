import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Crown, AlertCircle, ShieldCheck, ShieldX, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLocation } from "wouter";

interface AdminUser {
  userId: string;
  email: string;
  name: string;
  sleeperUsername: string | null;
  isPremium: boolean;
  isGrandfathered: boolean;
  subscriptionStatus: string | null;
  subscriptionSource: string | null;
  joinedAt: string | null;
}

interface AdminUsersData {
  users: AdminUser[];
  totalUsers: number;
  premiumUsers: number;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<AdminUsersData>({
    queryKey: ["/api/admin/users"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ userId, makePremium }: { userId: string; makePremium: boolean }) => {
      setTogglingUser(userId);
      const res = await apiRequest("POST", "/api/admin/toggle-premium", { userId, makePremium });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: result.isPremium ? "Premium Activated" : "Premium Removed",
        description: `User ${result.userId} has been ${result.isPremium ? "upgraded to premium" : "downgraded to free"}.`,
      });
      setTogglingUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
      setTogglingUser(null);
    },
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold" data-testid="text-access-denied">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  const realUsers = data?.users?.filter(u =>
    !u.userId.startsWith('test') && !u.userId.startsWith('devy')
  ) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLocation("/league")}
          data-testid="button-admin-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Crown className="h-8 w-8 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-users">{realUsers.length}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
            <Crown className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-primary" data-testid="text-premium-users">
                {realUsers.filter(u => u.isPremium).length}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-free-users">
                {realUsers.filter(u => !u.isPremium).length}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : realUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Sleeper</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realUsers.map((user) => (
                    <TableRow key={user.userId} data-testid={`row-user-${user.userId}`}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.sleeperUsername || "-"}</TableCell>
                      <TableCell>
                        {user.isPremium ? (
                          <Badge variant="default" data-testid={`badge-status-${user.userId}`}>
                            {user.isGrandfathered ? "OG" : "Premium"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-status-${user.userId}`}>
                            Free
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {user.subscriptionSource || "-"}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(user.joinedAt)}</TableCell>
                      <TableCell className="text-right">
                        {user.isPremium ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleMutation.mutate({ userId: user.userId, makePremium: false })}
                            disabled={toggleMutation.isPending && togglingUser === user.userId}
                            data-testid={`button-remove-premium-${user.userId}`}
                          >
                            <ShieldX className="h-4 w-4 mr-1" />
                            {toggleMutation.isPending && togglingUser === user.userId ? "..." : "Remove"}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => toggleMutation.mutate({ userId: user.userId, makePremium: true })}
                            disabled={toggleMutation.isPending && togglingUser === user.userId}
                            data-testid={`button-give-premium-${user.userId}`}
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            {toggleMutation.isPending && togglingUser === user.userId ? "..." : "Give Premium"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
