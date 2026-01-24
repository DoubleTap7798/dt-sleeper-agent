import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  BarChart3,
  Calendar,
  SplitSquareHorizontal,
  GraduationCap,
  MapPin,
  Hash,
  Ruler,
  Scale,
  Activity,
} from "lucide-react";

interface PlayerProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  playerName: string;
  position?: string;
  team?: string;
}

interface PlayerBio {
  name: string;
  fullName: string;
  position: string;
  team: string;
  teamAbbr: string;
  jersey: string;
  height: string;
  weight: string;
  age: number | null;
  birthDate: string | null;
  birthPlace: string | null;
  college: string | null;
  draftInfo: string | null;
  experience: number | null;
  headshot: string | null;
  status: string;
  injuryStatus: string | null;
}

interface GameLog {
  week: number;
  date: string;
  opponent: string;
  homeAway: "home" | "away";
  result: string;
  score: string;
  stats: Record<string, number | string>;
  season: string;
}

interface PlayerProfile {
  bio: PlayerBio;
  careerStats: {
    games: number;
    gamesStarted: number;
    stats: Record<string, number | string>;
  } | null;
  seasonStats: {
    season: string;
    team: string;
    games: number;
    gamesStarted: number;
    stats: Record<string, number | string>;
  }[];
  recentGameLogs: GameLog[];
  splits: {
    home: Record<string, number | string>;
    away: Record<string, number | string>;
    wins: Record<string, number | string>;
    losses: Record<string, number | string>;
    byMonth: Record<string, Record<string, number | string>>;
  } | null;
  espnId: string | null;
}

const positionStatLabels: Record<string, Record<string, string>> = {
  QB: {
    passingYards: "Pass Yds",
    passingTouchdowns: "Pass TD",
    interceptions: "INT",
    completions: "Comp",
    passingAttempts: "Att",
    QBRating: "Rating",
    rushingYards: "Rush Yds",
    rushingTouchdowns: "Rush TD",
  },
  RB: {
    rushingYards: "Rush Yds",
    rushingTouchdowns: "Rush TD",
    rushingAttempts: "Att",
    yardsPerRushAttempt: "YPC",
    receivingYards: "Rec Yds",
    receptions: "Rec",
    receivingTouchdowns: "Rec TD",
  },
  WR: {
    receivingYards: "Rec Yds",
    receptions: "Rec",
    receivingTouchdowns: "Rec TD",
    targets: "Tgt",
    yardsPerReception: "YPR",
    rushingYards: "Rush Yds",
  },
  TE: {
    receivingYards: "Rec Yds",
    receptions: "Rec",
    receivingTouchdowns: "Rec TD",
    targets: "Tgt",
    yardsPerReception: "YPR",
  },
};

function getPositionStats(position: string): string[] {
  const pos = position?.toUpperCase() || "WR";
  return Object.keys(positionStatLabels[pos] || positionStatLabels.WR);
}

function getStatLabel(position: string, stat: string): string {
  const pos = position?.toUpperCase() || "WR";
  return positionStatLabels[pos]?.[stat] || positionStatLabels.WR?.[stat] || stat;
}

function formatStatValue(value: number | string): string {
  if (typeof value === "number") {
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  }
  return value?.toString() || "-";
}

export function PlayerProfileModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  position = "",
  team = "",
}: PlayerProfileModalProps) {
  const { data: profile, isLoading, error } = useQuery<PlayerProfile>({
    queryKey: ["/api/player", playerId, "profile", playerName],
    queryFn: async () => {
      const res = await fetch(`/api/player/${playerId}/profile?playerName=${encodeURIComponent(playerName)}`);
      if (!res.ok) throw new Error("Failed to fetch player profile");
      return res.json();
    },
    enabled: open && !!playerId && !!playerName,
    staleTime: 5 * 60 * 1000,
  });

  const bio = profile?.bio;
  const displayPosition = bio?.position || position;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden" data-testid="player-profile-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={bio?.headshot || undefined} alt={playerName} />
              <AvatarFallback className="text-lg">
                {playerName.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg truncate" data-testid="text-player-name">
                  {bio?.fullName || playerName}
                </span>
                {bio?.jersey && (
                  <Badge variant="outline" className="shrink-0">#{bio.jersey}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span>{bio?.position || position}</span>
                <span>-</span>
                <span>{bio?.team || team}</span>
                {bio?.injuryStatus && (
                  <Badge variant="secondary" className="text-xs">{bio.injuryStatus}</Badge>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-muted-foreground">
            Unable to load player data. Please try again.
          </div>
        ) : (
          <Tabs defaultValue="bio" className="w-full">
            <TabsList className="grid w-full grid-cols-4" data-testid="player-profile-tabs">
              <TabsTrigger value="bio" className="text-xs sm:text-sm" data-testid="tab-bio">
                <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Bio</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="text-xs sm:text-sm" data-testid="tab-stats">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="games" className="text-xs sm:text-sm" data-testid="tab-games">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Games</span>
              </TabsTrigger>
              <TabsTrigger value="splits" className="text-xs sm:text-sm" data-testid="tab-splits">
                <SplitSquareHorizontal className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Splits</span>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] mt-4">
              <TabsContent value="bio" className="mt-0 space-y-4">
                <BioTab bio={bio} />
              </TabsContent>

              <TabsContent value="stats" className="mt-0 space-y-4">
                <StatsTab 
                  careerStats={profile?.careerStats || null} 
                  seasonStats={profile?.seasonStats || []}
                  position={displayPosition}
                />
              </TabsContent>

              <TabsContent value="games" className="mt-0">
                <GameLogsTab 
                  gameLogs={profile?.recentGameLogs || []} 
                  position={displayPosition}
                />
              </TabsContent>

              <TabsContent value="splits" className="mt-0 space-y-4">
                <SplitsTab 
                  splits={profile?.splits || null} 
                  position={displayPosition}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BioTab({ bio }: { bio: PlayerBio | undefined }) {
  if (!bio) {
    return <div className="text-center text-muted-foreground py-4">No bio data available</div>;
  }

  const bioItems = [
    { icon: Ruler, label: "Height", value: bio.height },
    { icon: Scale, label: "Weight", value: bio.weight },
    { icon: User, label: "Age", value: bio.age ? `${bio.age} years old` : null },
    { icon: MapPin, label: "Birthplace", value: bio.birthPlace },
    { icon: GraduationCap, label: "College", value: bio.college },
    { icon: Hash, label: "Draft", value: bio.draftInfo },
    { icon: Activity, label: "Experience", value: bio.experience ? `${bio.experience} years` : null },
  ].filter(item => item.value);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {bioItems.map((item, i) => (
        <Card key={i} className="p-3 flex items-center gap-3">
          <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium truncate">{item.value}</p>
          </div>
        </Card>
      ))}
      {bioItems.length === 0 && (
        <div className="col-span-2 text-center text-muted-foreground py-4">
          No detailed bio information available
        </div>
      )}
    </div>
  );
}

function StatsTab({ 
  careerStats, 
  seasonStats, 
  position 
}: { 
  careerStats: PlayerProfile["careerStats"]; 
  seasonStats: PlayerProfile["seasonStats"];
  position: string;
}) {
  const statsToShow = getPositionStats(position);

  return (
    <div className="space-y-4">
      {careerStats && (
        <Card className="p-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Career Stats
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Games</p>
              <p className="text-lg font-bold">{careerStats.games}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Starts</p>
              <p className="text-lg font-bold">{careerStats.gamesStarted}</p>
            </div>
            {statsToShow.slice(0, 6).map(stat => {
              const value = careerStats.stats[stat];
              if (value === undefined) return null;
              return (
                <div key={stat}>
                  <p className="text-xs text-muted-foreground">{getStatLabel(position, stat)}</p>
                  <p className="text-lg font-bold">{formatStatValue(value)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {seasonStats.length > 0 ? (
        <Card className="p-4">
          <h4 className="font-semibold mb-3">Season History</h4>
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-xs">Year</TableHead>
                  <TableHead className="w-10 text-xs">Tm</TableHead>
                  <TableHead className="w-8 text-xs">G</TableHead>
                  {statsToShow.slice(0, 4).map(stat => (
                    <TableHead key={stat} className="text-right text-xs whitespace-nowrap">
                      {getStatLabel(position, stat)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasonStats.slice(0, 10).map((season, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{season.season}</TableCell>
                    <TableCell className="text-sm">{season.team}</TableCell>
                    <TableCell className="text-sm">{season.games}</TableCell>
                    {statsToShow.slice(0, 4).map(stat => (
                      <TableCell key={stat} className="text-right text-sm">
                        {formatStatValue(season.stats[stat] ?? "-")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : !careerStats && (
        <div className="text-center text-muted-foreground py-8">
          No stats available for this player
        </div>
      )}
    </div>
  );
}

function GameLogsTab({ gameLogs, position }: { gameLogs: GameLog[]; position: string }) {
  const statsToShow = getPositionStats(position).slice(0, 5);
  
  // Get unique seasons from game logs, sorted descending
  const seasons = useMemo(() => {
    const uniqueSeasons = Array.from(new Set(gameLogs.map(g => g.season).filter(Boolean)));
    return uniqueSeasons.sort((a, b) => parseInt(b) - parseInt(a));
  }, [gameLogs]);
  
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  
  // Sync selectedSeason when seasons data loads
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeason) {
      setSelectedSeason(seasons[0]);
    }
  }, [seasons, selectedSeason]);
  
  // Filter game logs by selected season
  const filteredGameLogs = useMemo(() => {
    if (!selectedSeason) return gameLogs;
    return gameLogs.filter(g => g.season === selectedSeason);
  }, [gameLogs, selectedSeason]);

  if (gameLogs.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No game logs available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {seasons.length > 1 && (
        <div className="flex flex-wrap gap-1" data-testid="season-selector">
          {seasons.map(season => (
            <Button
              key={season}
              variant={selectedSeason === season ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSeason(season)}
              data-testid={`season-btn-${season}`}
            >
              {season}
            </Button>
          ))}
        </div>
      )}
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 text-xs">Wk</TableHead>
              <TableHead className="w-12 text-xs">Opp</TableHead>
              <TableHead className="w-8 text-xs">Res</TableHead>
              {statsToShow.map(stat => (
                <TableHead key={stat} className="text-right text-xs whitespace-nowrap">
                  {getStatLabel(position, stat).slice(0, 6)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGameLogs.map((game, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-sm">{game.week}</TableCell>
                <TableCell className="text-sm">
                  <span className="text-xs text-muted-foreground mr-0.5">
                    {game.homeAway === "away" ? "@" : ""}
                  </span>
                  {game.opponent}
                </TableCell>
                <TableCell className="text-xs">{game.result || game.score}</TableCell>
                {statsToShow.map(stat => (
                  <TableCell key={stat} className="text-right text-xs">
                    {formatStatValue(game.stats[stat] ?? "-")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {filteredGameLogs.length === 0 && selectedSeason && (
        <div className="text-center text-muted-foreground py-4 text-sm">
          No games found for {selectedSeason} season
        </div>
      )}
    </div>
  );
}

function SplitsTab({ splits, position }: { splits: PlayerProfile["splits"]; position: string }) {
  const statsToShow = getPositionStats(position).slice(0, 4);

  if (!splits) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No splits data available
      </div>
    );
  }

  const splitCategories = [
    { label: "Home", data: splits.home },
    { label: "Away", data: splits.away },
    { label: "Wins", data: splits.wins },
    { label: "Losses", data: splits.losses },
  ].filter(s => Object.keys(s.data || {}).length > 0);

  if (splitCategories.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No splits data available
      </div>
    );
  }

  return (
    <Card className="p-4">
      <h4 className="font-semibold mb-3">Performance Splits</h4>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Split</TableHead>
              {statsToShow.map(stat => (
                <TableHead key={stat} className="text-right text-xs whitespace-nowrap">
                  {getStatLabel(position, stat)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {splitCategories.map((split, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-sm">{split.label}</TableCell>
                {statsToShow.map(stat => (
                  <TableCell key={stat} className="text-right text-sm">
                    {formatStatValue(split.data?.[stat] ?? "-")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
