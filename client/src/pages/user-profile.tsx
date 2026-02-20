import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Trophy,
  Users,
  TrendingUp,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Search,
  Award,
  Target,
  Zap,
  Star,
  X,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface ProfileData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string | null;
  sleeperUsername: string | null;
  sleeperUserId: string | null;
  friendCount: number;
  stats: {
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    championships: number;
    playoffAppearances: number;
    bestFinish: number | null;
    totalLeagues: number;
    activeLeagues: number;
    totalPointsFor: number;
    avatarUrl: string | null;
    computedAt: string | null;
  } | null;
}

interface FriendshipStatus {
  status: string;
  friendshipId?: string;
  isRequester?: boolean;
}

interface FriendUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  sleeperUsername: string | null;
  sleeperUserId: string | null;
}

interface FriendRequest {
  id: string;
  requesterId?: string;
  addresseeId?: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string | null;
}

export default function UserProfilePage() {
  const [, params] = useRoute("/profile/:userId");
  const userId = params?.userId;
  const { user: currentUser } = useAuth();
  const isOwnProfile = currentUser?.id === userId;
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  usePageTitle("Profile");

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile", userId],
    enabled: !!userId,
  });

  const { data: friendStatus } = useQuery<FriendshipStatus>({
    queryKey: ["/api/friends/status", userId],
    enabled: !!userId && !isOwnProfile,
  });

  const { data: friendsList } = useQuery<FriendUser[]>({
    queryKey: ["/api/friends"],
    enabled: isOwnProfile,
  });

  const { data: friendRequests } = useQuery<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>({
    queryKey: ["/api/friends/requests"],
    enabled: isOwnProfile,
  });

  const { data: searchResults } = useQuery<FriendUser[]>({
    queryKey: ["/api/users/search", searchQuery],
    enabled: searchQuery.length >= 2,
  });

  const sendRequest = useMutation({
    mutationFn: (addresseeId: string) => apiRequest("POST", "/api/friends/request", { addresseeId }),
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/status"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const respondRequest = useMutation({
    mutationFn: ({ friendId, action }: { friendId: string; action: string }) =>
      apiRequest("POST", "/api/friends/respond", { friendId, action }),
    onSuccess: () => {
      toast({ title: "Done!" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/status"] });
    },
  });

  const removeFriend = useMutation({
    mutationFn: (friendshipId: string) => apiRequest("DELETE", `/api/friends/${friendshipId}`),
    onSuccess: () => {
      toast({ title: "Friend removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/status"] });
    },
  });

  const refreshStats = useMutation({
    mutationFn: () => apiRequest("POST", "/api/leaderboard/refresh"),
    onSuccess: () => {
      toast({ title: "Stats refreshed!" });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
    },
    onError: async (err: any) => {
      const msg = err?.message || "Failed to refresh stats";
      toast({ title: msg.includes("Sleeper") ? "Link your Sleeper account first in your profile settings" : msg, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground" data-testid="text-profile-not-found">User not found</p>
      </div>
    );
  }

  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.sleeperUsername || "User";
  const winPct = profile.stats && (profile.stats.totalWins + profile.stats.totalLosses) > 0
    ? ((profile.stats.totalWins / (profile.stats.totalWins + profile.stats.totalLosses)) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Card data-testid="card-profile-header">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.profileImageUrl || profile.stats?.avatarUrl || ""} alt={displayName} />
              <AvatarFallback className="text-2xl">{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold" data-testid="text-profile-name">{displayName}</h1>
              {profile.sleeperUsername && (
                <p className="text-muted-foreground" data-testid="text-sleeper-username">@{profile.sleeperUsername}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Badge variant="secondary" data-testid="badge-friend-count">
                  <Users className="h-3 w-3 mr-1" /> {profile.friendCount} friends
                </Badge>
                {profile.stats && (
                  <Badge variant="secondary" data-testid="badge-league-count">
                    {profile.stats.totalLeagues} leagues
                  </Badge>
                )}
                {profile.createdAt && (
                  <Badge variant="outline" data-testid="badge-member-since">
                    <Clock className="h-3 w-3 mr-1" /> Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {isOwnProfile && (
                <Button
                  size="sm"
                  onClick={() => refreshStats.mutate()}
                  disabled={refreshStats.isPending}
                  data-testid="button-refresh-stats"
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {refreshStats.isPending ? "Refreshing..." : "Refresh Stats"}
                </Button>
              )}
              {!isOwnProfile && friendStatus?.status === "none" && (
                <Button size="sm" onClick={() => sendRequest.mutate(userId!)} disabled={sendRequest.isPending} data-testid="button-add-friend">
                  <UserPlus className="h-4 w-4 mr-1" /> Add Friend
                </Button>
              )}
              {!isOwnProfile && friendStatus?.status === "pending" && friendStatus.isRequester && (
                <Button size="sm" variant="secondary" disabled data-testid="button-request-sent">
                  <Clock className="h-4 w-4 mr-1" /> Request Sent
                </Button>
              )}
              {!isOwnProfile && friendStatus?.status === "pending" && !friendStatus.isRequester && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respondRequest.mutate({ friendId: friendStatus.friendshipId!, action: "accept" })} data-testid="button-accept-friend">
                    <UserCheck className="h-4 w-4 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => respondRequest.mutate({ friendId: friendStatus.friendshipId!, action: "reject" })} data-testid="button-reject-friend">
                    <UserX className="h-4 w-4 mr-1" /> Decline
                  </Button>
                </div>
              )}
              {!isOwnProfile && friendStatus?.status === "accepted" && (
                <Button size="sm" variant="secondary" onClick={() => removeFriend.mutate(friendStatus.friendshipId!)} data-testid="button-remove-friend">
                  <UserCheck className="h-4 w-4 mr-1" /> Friends
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {profile.stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="grid-stats">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Trophy className="h-6 w-6 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold" data-testid="text-championships">{profile.stats.championships}</div>
              <p className="text-xs text-muted-foreground">Championships</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <TrendingUp className="h-6 w-6 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold" data-testid="text-record">{profile.stats.totalWins}-{profile.stats.totalLosses}{profile.stats.totalTies > 0 ? `-${profile.stats.totalTies}` : ""}</div>
              <p className="text-xs text-muted-foreground">Career Record ({winPct}%)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Target className="h-6 w-6 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold" data-testid="text-playoffs">{profile.stats.playoffAppearances}</div>
              <p className="text-xs text-muted-foreground">Playoff Appearances</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Zap className="h-6 w-6 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold" data-testid="text-points">{profile.stats.totalPointsFor.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Career Points</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Star className="h-6 w-6 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold" data-testid="text-best-finish">{profile.stats.bestFinish ? `#${profile.stats.bestFinish}` : "--"}</div>
              <p className="text-xs text-muted-foreground">Best Finish</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Award className="h-6 w-6 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold" data-testid="text-total-leagues">{profile.stats.totalLeagues}</div>
              <p className="text-xs text-muted-foreground">Total Leagues</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold" data-testid="text-active-leagues">{profile.stats.activeLeagues}</div>
              <p className="text-xs text-muted-foreground">Active Leagues</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold" data-testid="text-win-pct">{winPct}%</div>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">No stats computed yet.</p>
            {isOwnProfile && (
              <Button onClick={() => refreshStats.mutate()} disabled={refreshStats.isPending} data-testid="button-compute-stats">
                <TrendingUp className="h-4 w-4 mr-1" />
                {refreshStats.isPending ? "Computing..." : "Compute My Stats"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isOwnProfile && (
        <>
          {friendRequests && friendRequests.incoming.length > 0 && (
            <Card data-testid="card-friend-requests">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5" /> Friend Requests ({friendRequests.incoming.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {friendRequests.incoming.map((req) => (
                  <div key={req.id} className="flex items-center gap-3" data-testid={`friend-request-${req.id}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={req.profileImageUrl || ""} />
                      <AvatarFallback>{(req.firstName || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 font-medium">{[req.firstName, req.lastName].filter(Boolean).join(" ")}</span>
                    <Button size="sm" onClick={() => respondRequest.mutate({ friendId: req.id, action: "accept" })} data-testid={`button-accept-${req.id}`}>
                      Accept
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => respondRequest.mutate({ friendId: req.id, action: "reject" })} data-testid={`button-reject-${req.id}`}>
                      Decline
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-friends-list">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" /> Friends ({friendsList?.length || 0})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowSearch(!showSearch)} data-testid="button-toggle-search">
                  <Search className="h-4 w-4 mr-1" /> Find Friends
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showSearch && (
                <div className="space-y-3" data-testid="div-friend-search">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or Sleeper username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-friend-search"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {searchResults && searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((user) => (
                        <div key={user.id} className="flex items-center gap-3 p-2 rounded-md hover-elevate" data-testid={`search-result-${user.id}`}>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.profileImageUrl || ""} />
                            <AvatarFallback>{(user.firstName || "?")[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <Link href={`/profile/${user.id}`} className="font-medium hover:underline">
                              {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                            </Link>
                            {user.sleeperUsername && (
                              <p className="text-xs text-muted-foreground">@{user.sleeperUsername}</p>
                            )}
                          </div>
                          <Button size="sm" onClick={() => sendRequest.mutate(user.id)} disabled={sendRequest.isPending} data-testid={`button-add-${user.id}`}>
                            <UserPlus className="h-3 w-3 mr-1" /> Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {searchQuery.length >= 2 && searchResults && searchResults.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No users found</p>
                  )}
                </div>
              )}

              {friendsList && friendsList.length > 0 ? (
                <div className="space-y-2">
                  {friendsList.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-3 p-2 rounded-md" data-testid={`friend-${friend.id}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={friend.profileImageUrl || ""} />
                        <AvatarFallback>{(friend.firstName || "?")[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${friend.id}`} className="font-medium hover:underline">
                          {[friend.firstName, friend.lastName].filter(Boolean).join(" ")}
                        </Link>
                        {friend.sleeperUsername && (
                          <p className="text-xs text-muted-foreground">@{friend.sleeperUsername}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No friends yet. Use the search above to find and add friends!
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
