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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy,
  Users,
  TrendingUp,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Search,
  Target,
  Zap,
  X,
  Pencil,
  Check,
  Heart,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";

const NFL_TEAMS = [
  "Arizona Cardinals", "Atlanta Falcons", "Baltimore Ravens", "Buffalo Bills",
  "Carolina Panthers", "Chicago Bears", "Cincinnati Bengals", "Cleveland Browns",
  "Dallas Cowboys", "Denver Broncos", "Detroit Lions", "Green Bay Packers",
  "Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars", "Kansas City Chiefs",
  "Las Vegas Raiders", "Los Angeles Chargers", "Los Angeles Rams", "Miami Dolphins",
  "Minnesota Vikings", "New England Patriots", "New Orleans Saints", "New York Giants",
  "New York Jets", "Philadelphia Eagles", "Pittsburgh Steelers", "San Francisco 49ers",
  "Seattle Seahawks", "Tampa Bay Buccaneers", "Tennessee Titans", "Washington Commanders",
];

const NBA_TEAMS = [
  "Atlanta Hawks", "Boston Celtics", "Brooklyn Nets", "Charlotte Hornets",
  "Chicago Bulls", "Cleveland Cavaliers", "Dallas Mavericks", "Denver Nuggets",
  "Detroit Pistons", "Golden State Warriors", "Houston Rockets", "Indiana Pacers",
  "LA Clippers", "Los Angeles Lakers", "Memphis Grizzlies", "Miami Heat",
  "Milwaukee Bucks", "Minnesota Timberwolves", "New Orleans Pelicans", "New York Knicks",
  "Oklahoma City Thunder", "Orlando Magic", "Philadelphia 76ers", "Phoenix Suns",
  "Portland Trail Blazers", "Sacramento Kings", "San Antonio Spurs", "Toronto Raptors",
  "Utah Jazz", "Washington Wizards",
];

const MLB_TEAMS = [
  "Arizona Diamondbacks", "Atlanta Braves", "Baltimore Orioles", "Boston Red Sox",
  "Chicago Cubs", "Chicago White Sox", "Cincinnati Reds", "Cleveland Guardians",
  "Colorado Rockies", "Detroit Tigers", "Houston Astros", "Kansas City Royals",
  "Los Angeles Angels", "Los Angeles Dodgers", "Miami Marlins", "Milwaukee Brewers",
  "Minnesota Twins", "New York Mets", "New York Yankees", "Oakland Athletics",
  "Philadelphia Phillies", "Pittsburgh Pirates", "San Diego Padres", "San Francisco Giants",
  "Seattle Mariners", "St. Louis Cardinals", "Tampa Bay Rays", "Texas Rangers",
  "Toronto Blue Jays", "Washington Nationals",
];

const NHL_TEAMS = [
  "Anaheim Ducks", "Arizona Coyotes", "Boston Bruins", "Buffalo Sabres",
  "Calgary Flames", "Carolina Hurricanes", "Chicago Blackhawks", "Colorado Avalanche",
  "Columbus Blue Jackets", "Dallas Stars", "Detroit Red Wings", "Edmonton Oilers",
  "Florida Panthers", "Los Angeles Kings", "Minnesota Wild", "Montreal Canadiens",
  "Nashville Predators", "New Jersey Devils", "New York Islanders", "New York Rangers",
  "Ottawa Senators", "Philadelphia Flyers", "Pittsburgh Penguins", "San Jose Sharks",
  "Seattle Kraken", "St. Louis Blues", "Tampa Bay Lightning", "Toronto Maple Leafs",
  "Vancouver Canucks", "Vegas Golden Knights", "Washington Capitals", "Winnipeg Jets",
];

interface FavoriteTeams {
  nfl?: string;
  nba?: string;
  mlb?: string;
  nhl?: string;
}

interface ProfileData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string | null;
  sleeperUsername: string | null;
  sleeperUserId: string | null;
  bio: string | null;
  favoriteTeams: FavoriteTeams | null;
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
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [editingTeams, setEditingTeams] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<FavoriteTeams>({});

  usePageTitle("Profile");

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile", userId],
    enabled: !!userId,
  });

  useEffect(() => {
    if (profile) {
      setBioText(profile.bio || "");
      setSelectedTeams((profile.favoriteTeams as FavoriteTeams) || {});
    }
  }, [profile]);

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

  const saveBio = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/profile/bio", { bio: bioText }),
    onSuccess: () => {
      toast({ title: "Bio updated!" });
      setEditingBio(false);
      queryClient.invalidateQueries({ queryKey: ["/api/profile", userId] });
    },
    onError: () => toast({ title: "Failed to save bio", variant: "destructive" }),
  });

  const saveTeams = useMutation({
    mutationFn: () => {
      const cleaned: FavoriteTeams = {};
      if (selectedTeams.nfl && selectedTeams.nfl !== "none") cleaned.nfl = selectedTeams.nfl;
      if (selectedTeams.nba && selectedTeams.nba !== "none") cleaned.nba = selectedTeams.nba;
      if (selectedTeams.mlb && selectedTeams.mlb !== "none") cleaned.mlb = selectedTeams.mlb;
      if (selectedTeams.nhl && selectedTeams.nhl !== "none") cleaned.nhl = selectedTeams.nhl;
      return apiRequest("PATCH", "/api/profile/favorite-teams", { favoriteTeams: cleaned });
    },
    onSuccess: () => {
      toast({ title: "Favorite teams updated!" });
      setEditingTeams(false);
      queryClient.invalidateQueries({ queryKey: ["/api/profile", userId] });
    },
    onError: () => toast({ title: "Failed to save teams", variant: "destructive" }),
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

  const favTeams = (profile.favoriteTeams as FavoriteTeams) || {};
  const hasTeams = favTeams.nfl || favTeams.nba || favTeams.mlb || favTeams.nhl;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader title="Profile" backTo="/" />
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

      <Card data-testid="card-bio">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Bio
            </CardTitle>
            {isOwnProfile && !editingBio && (
              <Button size="sm" variant="ghost" onClick={() => setEditingBio(true)} data-testid="button-edit-bio">
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingBio ? (
            <div className="space-y-3">
              <Textarea
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                placeholder="Tell others about yourself as a fantasy manager..."
                maxLength={500}
                rows={3}
                data-testid="textarea-bio"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{bioText.length}/500</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingBio(false); setBioText(profile.bio || ""); }} data-testid="button-cancel-bio">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => saveBio.mutate()} disabled={saveBio.isPending} data-testid="button-save-bio">
                    <Check className="h-3 w-3 mr-1" /> Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm" data-testid="text-bio">
              {profile.bio || (isOwnProfile ? "No bio yet. Click Edit to add one!" : "No bio set.")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-favorite-teams">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Heart className="h-4 w-4" /> Favorite Teams
            </CardTitle>
            {isOwnProfile && !editingTeams && (
              <Button size="sm" variant="ghost" onClick={() => setEditingTeams(true)} data-testid="button-edit-teams">
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingTeams ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">NFL</label>
                  <Select value={selectedTeams.nfl || ""} onValueChange={(v) => setSelectedTeams(prev => ({ ...prev, nfl: v || undefined }))}>
                    <SelectTrigger data-testid="select-nfl-team"><SelectValue placeholder="Select NFL team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {NFL_TEAMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">NBA</label>
                  <Select value={selectedTeams.nba || ""} onValueChange={(v) => setSelectedTeams(prev => ({ ...prev, nba: v || undefined }))}>
                    <SelectTrigger data-testid="select-nba-team"><SelectValue placeholder="Select NBA team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {NBA_TEAMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">MLB</label>
                  <Select value={selectedTeams.mlb || ""} onValueChange={(v) => setSelectedTeams(prev => ({ ...prev, mlb: v || undefined }))}>
                    <SelectTrigger data-testid="select-mlb-team"><SelectValue placeholder="Select MLB team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {MLB_TEAMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">NHL</label>
                  <Select value={selectedTeams.nhl || ""} onValueChange={(v) => setSelectedTeams(prev => ({ ...prev, nhl: v || undefined }))}>
                    <SelectTrigger data-testid="select-nhl-team"><SelectValue placeholder="Select NHL team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {NHL_TEAMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditingTeams(false); setSelectedTeams((profile.favoriteTeams as FavoriteTeams) || {}); }} data-testid="button-cancel-teams">
                  Cancel
                </Button>
                <Button size="sm" onClick={() => saveTeams.mutate()} disabled={saveTeams.isPending} data-testid="button-save-teams">
                  <Check className="h-3 w-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          ) : hasTeams ? (
            <div className="flex flex-wrap gap-2" data-testid="div-favorite-teams">
              {favTeams.nfl && favTeams.nfl !== "none" && (
                <Badge variant="secondary" className="gap-1" data-testid="badge-nfl-team">
                  <span className="text-xs text-muted-foreground">NFL:</span> {favTeams.nfl}
                </Badge>
              )}
              {favTeams.nba && favTeams.nba !== "none" && (
                <Badge variant="secondary" className="gap-1" data-testid="badge-nba-team">
                  <span className="text-xs text-muted-foreground">NBA:</span> {favTeams.nba}
                </Badge>
              )}
              {favTeams.mlb && favTeams.mlb !== "none" && (
                <Badge variant="secondary" className="gap-1" data-testid="badge-mlb-team">
                  <span className="text-xs text-muted-foreground">MLB:</span> {favTeams.mlb}
                </Badge>
              )}
              {favTeams.nhl && favTeams.nhl !== "none" && (
                <Badge variant="secondary" className="gap-1" data-testid="badge-nhl-team">
                  <span className="text-xs text-muted-foreground">NHL:</span> {favTeams.nhl}
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-no-teams">
              {isOwnProfile ? "No favorite teams set. Click Edit to add yours!" : "No favorite teams set."}
            </p>
          )}
        </CardContent>
      </Card>

      {profile.stats ? (
        <Card data-testid="grid-stats">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xl font-bold" data-testid="text-championships">{profile.stats.championships}</div>
                <p className="text-xs text-muted-foreground">Titles</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xl font-bold" data-testid="text-record">{profile.stats.totalWins}-{profile.stats.totalLosses}</div>
                <p className="text-xs text-muted-foreground">{winPct}% Win Rate</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xl font-bold" data-testid="text-playoffs">{profile.stats.playoffAppearances}</div>
                <p className="text-xs text-muted-foreground">Playoffs</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xl font-bold" data-testid="text-points">{profile.stats.totalPointsFor.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Career Pts</p>
              </div>
            </div>
            {isOwnProfile && (
              <div className="mt-3 pt-3 border-t border-border/50 text-center">
                <Link href="/" className="text-xs text-primary hover:underline" data-testid="link-career-dashboard">
                  View full career stats on Dashboard
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
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
