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
  Zap,
  Target,
  TrendingUp,
} from "lucide-react";
import { getNFLTeamLogo } from "@/lib/team-logos";
import { InfoTooltip } from "@/components/metric-tooltip";

interface NFLVerseProfile {
  playerName: string;
  seasonStats: {
    player_name: string;
    position: string;
    team: string;
    season: number;
    games_played: number;
    completions: number;
    attempts: number;
    passing_yards: number;
    passing_tds: number;
    interceptions: number;
    carries: number;
    rushing_yards: number;
    rushing_tds: number;
    receptions: number;
    targets: number;
    receiving_yards: number;
    receiving_tds: number;
    target_share: number;
    air_yards_share: number;
    wopr: number;
    fantasy_points: number;
    fantasy_points_ppr: number;
    ppg: number;
    ppg_ppr: number;
    yards_per_carry: number;
    yards_per_reception: number;
    catch_rate: number;
    td_rate: number;
  } | null;
  weeklyStats: Array<{
    week: number;
    opponent_team: string;
    completions: number;
    attempts: number;
    passing_yards: number;
    passing_tds: number;
    interceptions: number;
    carries: number;
    rushing_yards: number;
    rushing_tds: number;
    receptions: number;
    targets: number;
    receiving_yards: number;
    receiving_tds: number;
    target_share: number;
    air_yards_share: number;
    wopr: number;
    fantasy_points_ppr: number;
  }>;
  dynastyProcess: {
    value_1qb: number;
    value_2qb: number;
    ecr_1qb: number | null;
    ecr_2qb: number | null;
    ecr_pos: number | null;
    age: number | null;
    team: string;
  } | null;
}

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

const positionStatLabels: Record<string, Record<string, { full: string; short: string }>> = {
  QB: {
    passingYards: { full: "Pass Yds", short: "PaY" },
    passingTouchdowns: { full: "Pass TD", short: "PaT" },
    interceptions: { full: "INT", short: "INT" },
    completions: { full: "Comp", short: "Cmp" },
    passingAttempts: { full: "Att", short: "Att" },
    QBRating: { full: "QB Rating", short: "QBR" },
    rushingYards: { full: "Rush Yds", short: "RuY" },
    rushingTouchdowns: { full: "Rush TD", short: "RuT" },
  },
  RB: {
    rushingYards: { full: "Rush Yds", short: "RuY" },
    rushingTouchdowns: { full: "Rush TD", short: "RuT" },
    rushingAttempts: { full: "Att", short: "Att" },
    yardsPerRushAttempt: { full: "YPC", short: "YPC" },
    receivingYards: { full: "Rec Yds", short: "ReY" },
    receptions: { full: "Rec", short: "Rec" },
    receivingTouchdowns: { full: "Rec TD", short: "ReT" },
  },
  WR: {
    receivingYards: { full: "Rec Yds", short: "ReY" },
    receptions: { full: "Rec", short: "Rec" },
    receivingTouchdowns: { full: "Rec TD", short: "ReT" },
    targets: { full: "Tgt", short: "Tgt" },
    yardsPerReception: { full: "YPR", short: "YPR" },
    rushingYards: { full: "Rush Yds", short: "RuY" },
  },
  TE: {
    receivingYards: { full: "Rec Yds", short: "ReY" },
    receptions: { full: "Rec", short: "Rec" },
    receivingTouchdowns: { full: "Rec TD", short: "ReT" },
    targets: { full: "Tgt", short: "Tgt" },
    yardsPerReception: { full: "YPR", short: "YPR" },
  },
  DL: {
    TOT: { full: "Tackles", short: "Tkl" },
    SOLO: { full: "Solo", short: "Solo" },
    SACK: { full: "Sacks", short: "Sck" },
    TFL: { full: "TFL", short: "TFL" },
    "QB HUR": { full: "QB Hurries", short: "QBH" },
    FF: { full: "FF", short: "FF" },
    FR: { full: "FR", short: "FR" },
    PD: { full: "PD", short: "PD" },
  },
  LB: {
    TOT: { full: "Tackles", short: "Tkl" },
    SOLO: { full: "Solo", short: "Solo" },
    SACK: { full: "Sacks", short: "Sck" },
    TFL: { full: "TFL", short: "TFL" },
    INT: { full: "INT", short: "INT" },
    PD: { full: "PD", short: "PD" },
    FF: { full: "FF", short: "FF" },
    FR: { full: "FR", short: "FR" },
  },
  DB: {
    TOT: { full: "Tackles", short: "Tkl" },
    SOLO: { full: "Solo", short: "Solo" },
    INT: { full: "INT", short: "INT" },
    PD: { full: "PD", short: "PD" },
    SACK: { full: "Sacks", short: "Sck" },
    FF: { full: "FF", short: "FF" },
    FR: { full: "FR", short: "FR" },
    TFL: { full: "TFL", short: "TFL" },
  },
};

const IDP_POSITIONS = ["DL", "LB", "DB", "DE", "DT", "CB", "S", "ILB", "OLB", "MLB", "NT", "FS", "SS", "ED"];

function isIDPPosition(position: string): boolean {
  return IDP_POSITIONS.includes(position?.toUpperCase() || "");
}

function getIDPDisplayGroup(position: string): string {
  const pos = position?.toUpperCase() || "";
  if (["DE", "DT", "NT", "ED"].includes(pos)) return "DL";
  if (["ILB", "OLB", "MLB"].includes(pos)) return "LB";
  if (["CB", "S", "FS", "SS"].includes(pos)) return "DB";
  return pos;
}

function getPositionStats(position: string): string[] {
  const pos = position?.toUpperCase() || "WR";
  if (isIDPPosition(pos)) {
    const displayGroup = getIDPDisplayGroup(pos);
    return Object.keys(positionStatLabels[displayGroup] || positionStatLabels.DL);
  }
  return Object.keys(positionStatLabels[pos] || positionStatLabels.WR);
}

function getStatLabel(position: string, stat: string, short = false): string {
  const pos = position?.toUpperCase() || "WR";
  const displayGroup = isIDPPosition(pos) ? getIDPDisplayGroup(pos) : pos;
  const labels = positionStatLabels[displayGroup]?.[stat] || positionStatLabels.WR?.[stat];
  if (labels) {
    return short ? labels.short : labels.full;
  }
  return stat;
}

function StatLegend({ position, stats }: { position: string; stats: string[] }) {
  return (
    <div className="mt-2 text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 px-2">
      {stats.map(stat => (
        <span key={stat}>
          <span className="font-medium">{getStatLabel(position, stat, true)}</span>
          <span className="mx-0.5">=</span>
          <span>{getStatLabel(position, stat, false)}</span>
        </span>
      ))}
    </div>
  );
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

  const { data: nflverseProfile } = useQuery<NFLVerseProfile>({
    queryKey: ["/api/nflverse/stats", playerName, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/nflverse/stats/${encodeURIComponent(playerName)}/profile`);
      if (!res.ok) throw new Error("Failed to fetch nflverse stats");
      return res.json();
    },
    enabled: open && !!playerName && ['QB', 'RB', 'WR', 'TE'].includes((position || '').toUpperCase()),
    staleTime: 10 * 60 * 1000,
  });

  const bio = profile?.bio;
  const displayPosition = bio?.position || position;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-hidden" data-testid="player-profile-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={getNFLTeamLogo(bio?.teamAbbr || team) || undefined} alt={bio?.teamAbbr || team} />
              <AvatarFallback className="text-lg">
                {(bio?.teamAbbr || team || "??").slice(0, 2)}
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
            {(() => {
              const safePos = (displayPosition || '').toUpperCase();
              const isOffensive = ['QB', 'RB', 'WR', 'TE'].includes(safePos);
              return (
                <TabsList className={isOffensive ? "grid w-full grid-cols-5 gap-1" : "grid w-full grid-cols-4 gap-1"} data-testid="player-profile-tabs">
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
                  {isOffensive && (
                    <TabsTrigger value="analytics" className="text-xs sm:text-sm" data-testid="tab-analytics">
                      <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden sm:inline">Analytics</span>
                    </TabsTrigger>
                  )}
                </TabsList>
              );
            })()}

            <div className="h-[400px] mt-4 overflow-y-auto">
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

              {['QB', 'RB', 'WR', 'TE'].includes((displayPosition || '').toUpperCase()) && (
                <TabsContent value="analytics" className="mt-0 space-y-4">
                  <AnalyticsTab
                    nflverseProfile={nflverseProfile || null}
                    position={displayPosition}
                  />
                </TabsContent>
              )}
            </div>
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
            {statsToShow.slice(0, 7).map(stat => {
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
        <Card className="p-3">
          <h4 className="font-semibold mb-2 text-sm">Season History</h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-11 text-xs px-1">Yr</TableHead>
                  <TableHead className="w-9 text-xs px-1">Tm</TableHead>
                  <TableHead className="w-7 text-xs px-1">G</TableHead>
                  {statsToShow.slice(0, 4).map(stat => (
                    <TableHead key={stat} className="text-right text-xs px-1">
                      {getStatLabel(position, stat, true)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasonStats.slice(0, 10).map((season, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-xs px-1">{season.season}</TableCell>
                    <TableCell className="text-xs px-1">{season.team}</TableCell>
                    <TableCell className="text-xs px-1">{season.games}</TableCell>
                    {statsToShow.slice(0, 4).map(stat => (
                      <TableCell key={stat} className="text-right text-xs px-1">
                        {formatStatValue(season.stats[stat] ?? "-")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <StatLegend position={position} stats={statsToShow.slice(0, 4)} />
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
              <TableHead className="w-7 text-xs px-1">Wk</TableHead>
              <TableHead className="w-11 text-xs px-1">Opp</TableHead>
              <TableHead className="w-6 text-xs px-1">W/L</TableHead>
              {statsToShow.map(stat => (
                <TableHead key={stat} className="text-right text-xs px-1">
                  {getStatLabel(position, stat, true)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGameLogs.map((game, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-xs px-1">{game.week}</TableCell>
                <TableCell className="text-xs px-1">
                  <span className="text-muted-foreground mr-0.5">
                    {game.homeAway === "away" ? "@" : ""}
                  </span>
                  {game.opponent}
                </TableCell>
                <TableCell className="text-xs px-1">{game.result?.charAt(0) || "-"}</TableCell>
                {statsToShow.map(stat => (
                  <TableCell key={stat} className="text-right text-xs px-1">
                    {formatStatValue(game.stats[stat] ?? "-")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <StatLegend position={position} stats={statsToShow} />
      
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
    <Card className="p-3">
      <h4 className="font-semibold mb-2 text-sm">Performance Splits</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs px-1.5">Split</TableHead>
            {statsToShow.map(stat => (
              <TableHead key={stat} className="text-right text-xs px-1.5">
                {getStatLabel(position, stat, true)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {splitCategories.map((split, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium text-xs px-1.5">{split.label}</TableCell>
              {statsToShow.map(stat => (
                <TableCell key={stat} className="text-right text-xs px-1.5">
                  {formatStatValue(split.data?.[stat] ?? "-")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <StatLegend position={position} stats={statsToShow} />
    </Card>
  );
}

function AnalyticsTab({
  nflverseProfile,
  position,
}: {
  nflverseProfile: NFLVerseProfile | null;
  position: string;
}) {
  if (!nflverseProfile?.seasonStats) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No advanced analytics available for this player
      </div>
    );
  }

  const s = nflverseProfile.seasonStats;
  const dp = nflverseProfile.dynastyProcess;
  const pos = (position || '').toUpperCase();

  const formatPct = (val: number | null | undefined) => val != null ? `${(val * 100).toFixed(1)}%` : "-";
  const formatNum = (val: number | null | undefined, decimals = 1) => val != null ? val.toFixed(decimals) : "-";

  const getQBMetrics = () => [
    { label: "Fantasy PPG (PPR)", value: formatNum(s.ppg_ppr), icon: Zap, tip: "Average fantasy points per game in PPR scoring. Key indicator of weekly production." },
    { label: "Total Fantasy Pts", value: formatNum(s.fantasy_points_ppr, 0), icon: TrendingUp },
    { label: "Pass Yards", value: s.passing_yards.toLocaleString(), icon: BarChart3 },
    { label: "Pass TD", value: String(s.passing_tds), icon: Target },
    { label: "INT", value: String(s.interceptions), icon: Activity },
    { label: "Rush Yards", value: s.rushing_yards.toLocaleString(), icon: BarChart3 },
    { label: "Rush TD", value: String(s.rushing_tds), icon: Target },
    { label: "Games", value: String(s.games_played), icon: Calendar },
  ];

  const getRBMetrics = () => [
    { label: "Fantasy PPG (PPR)", value: formatNum(s.ppg_ppr), icon: Zap, tip: "Average fantasy points per game in PPR scoring. Key indicator of weekly production." },
    { label: "Total Fantasy Pts", value: formatNum(s.fantasy_points_ppr, 0), icon: TrendingUp },
    { label: "Yards/Carry", value: formatNum(s.yards_per_carry), icon: BarChart3, tip: "Average rushing yards per carry attempt. Measures rushing efficiency." },
    { label: "Target Share", value: formatPct(s.target_share), icon: Target, tip: "Percentage of team passing targets going to this player. Higher share = more passing game involvement." },
    { label: "Catch Rate", value: formatPct(s.catch_rate), icon: Activity, tip: "Percentage of targets caught. Measures hands and route running reliability." },
    { label: "WOPR", value: formatNum(s.wopr, 3), icon: Zap, tip: "Weighted Opportunity Rating. Combines target share (1.5x weight) and air yards share (0.7x weight). Higher WOPR = more valuable role in the passing game." },
    { label: "TD Rate", value: formatPct(s.td_rate), icon: Target, tip: "Percentage of touches resulting in touchdowns. High TD rate may regress to the mean." },
    { label: "Games", value: String(s.games_played), icon: Calendar },
  ];

  const getWRTEMetrics = () => [
    { label: "Fantasy PPG (PPR)", value: formatNum(s.ppg_ppr), icon: Zap, tip: "Average fantasy points per game in PPR scoring. Key indicator of weekly production." },
    { label: "Total Fantasy Pts", value: formatNum(s.fantasy_points_ppr, 0), icon: TrendingUp },
    { label: "Target Share", value: formatPct(s.target_share), icon: Target, tip: "Percentage of team passing targets going to this player. Higher share = more receiving opportunity." },
    { label: "Air Yards Share", value: formatPct(s.air_yards_share), icon: TrendingUp, tip: "Percentage of team air yards directed at this player. Measures downfield usage and big-play potential." },
    { label: "WOPR", value: formatNum(s.wopr, 3), icon: Zap, tip: "Weighted Opportunity Rating. Combines target share (1.5x weight) and air yards share (0.7x weight). Higher WOPR = more valuable role in the passing game." },
    { label: "Catch Rate", value: formatPct(s.catch_rate), icon: Activity, tip: "Percentage of targets caught. Measures hands and route running reliability." },
    { label: "Yards/Reception", value: formatNum(s.yards_per_reception), icon: BarChart3, tip: "Average yards gained per reception. Higher values indicate big-play ability." },
    { label: "Games", value: String(s.games_played), icon: Calendar },
  ];

  const metrics = pos === 'QB' ? getQBMetrics() :
    pos === 'RB' ? getRBMetrics() : getWRTEMetrics();

  const weeklyStats = nflverseProfile.weeklyStats || [];

  return (
    <div className="space-y-4" data-testid="container-analytics">
      <Card className="p-4" data-testid="card-advanced-analytics">
        <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4" /> {s.season} Advanced Analytics
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map((m, i) => (
            <div key={i} data-testid={`stat-${m.label.replace(/\s+/g, '-').toLowerCase()}`}>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {m.label}
                {m.tip && (
                  <InfoTooltip title={m.label} description={m.tip} />
                )}
              </p>
              <p className="text-lg font-bold" data-testid={`value-${m.label.replace(/\s+/g, '-').toLowerCase()}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {dp && (
        <Card className="p-4" data-testid="card-dynasty-market-value">
          <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" /> Dynasty Market Value
            <InfoTooltip
              title="Dynasty Market Value"
              description="Trade values from Dynasty Process, an open-source dynasty ranking system. Values represent what the market consensus says a player is worth in dynasty trades."
            />
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                1QB Value
                <InfoTooltip title="1QB Value" description="Dynasty trade value in standard 1-QB leagues. Higher number = more valuable in trades." />
              </p>
              <p className="text-lg font-bold" data-testid="value-1qb">{dp.value_1qb.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                SF Value
                <InfoTooltip title="Superflex Value" description="Dynasty trade value in Superflex/2QB leagues. QBs are worth significantly more in this format." />
              </p>
              <p className="text-lg font-bold" data-testid="value-2qb">{dp.value_2qb.toLocaleString()}</p>
            </div>
            {dp.ecr_1qb && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  ECR (1QB)
                  <InfoTooltip title="Expert Consensus Ranking" description="Average ranking from fantasy experts aggregated by FantasyPros. Lower number = higher ranked player." />
                </p>
                <p className="text-lg font-bold">#{Math.round(dp.ecr_1qb)}</p>
              </div>
            )}
            {dp.ecr_pos && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Pos Rank
                  <InfoTooltip title="Position Rank" description="Player's ranking among others at the same position. e.g., WR5 means the 5th-ranked wide receiver." />
                </p>
                <p className="text-lg font-bold">{pos}{Math.round(dp.ecr_pos)}</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">Source: dynastyprocess.com</p>
        </Card>
      )}

      {weeklyStats.length > 0 && (
        <Card className="p-3" data-testid="card-weekly-efficiency">
          <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
            <Target className="h-4 w-4" /> Weekly Efficiency ({s.season})
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-7 text-xs px-1.5">Wk</TableHead>
                <TableHead className="w-9 text-xs px-1.5">Opp</TableHead>
                <TableHead className="text-right text-xs px-1.5">PPR</TableHead>
                {(pos === 'WR' || pos === 'TE') && (
                  <>
                    <TableHead className="text-right text-xs px-1.5">Tgt%</TableHead>
                    <TableHead className="text-right text-xs px-1.5">AY%</TableHead>
                  </>
                )}
                {pos === 'RB' && (
                  <>
                    <TableHead className="text-right text-xs px-1.5">Tgt%</TableHead>
                    <TableHead className="text-right text-xs px-1.5">YPC</TableHead>
                  </>
                )}
                {pos === 'QB' && (
                  <>
                    <TableHead className="text-right text-xs px-1.5">C/A</TableHead>
                    <TableHead className="text-right text-xs px-1.5">PY</TableHead>
                  </>
                )}
                <TableHead className="text-right text-xs px-1.5">WOPR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyStats.slice(0, 18).map((w, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-xs px-1.5">{w.week}</TableCell>
                  <TableCell className="text-xs px-1.5">{w.opponent_team}</TableCell>
                  <TableCell className="text-right text-xs px-1.5 font-medium">
                    {w.fantasy_points_ppr?.toFixed(1) || "-"}
                  </TableCell>
                  {(pos === 'WR' || pos === 'TE') && (
                    <>
                      <TableCell className="text-right text-xs px-1.5">
                        {formatPct(w.target_share)}
                      </TableCell>
                      <TableCell className="text-right text-xs px-1.5">
                        {formatPct(w.air_yards_share)}
                      </TableCell>
                    </>
                  )}
                  {pos === 'RB' && (
                    <>
                      <TableCell className="text-right text-xs px-1.5">
                        {formatPct(w.target_share)}
                      </TableCell>
                      <TableCell className="text-right text-xs px-1.5">
                        {w.carries > 0 ? (w.rushing_yards / w.carries).toFixed(1) : "-"}
                      </TableCell>
                    </>
                  )}
                  {pos === 'QB' && (
                    <>
                      <TableCell className="text-right text-xs px-1.5">
                        {w.completions}/{w.attempts}
                      </TableCell>
                      <TableCell className="text-right text-xs px-1.5">
                        {w.passing_yards}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-right text-xs px-1.5">
                    {w.wopr ? w.wopr.toFixed(3) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-2 text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 px-2">
            <span><span className="font-medium">PPR</span> = Fantasy Points (PPR)</span>
            <span><span className="font-medium">Tgt%</span> = Target Share</span>
            {(pos === 'WR' || pos === 'TE') && (
              <span><span className="font-medium">AY%</span> = Air Yards Share</span>
            )}
            {pos === 'RB' && (
              <span><span className="font-medium">YPC</span> = Yards Per Carry</span>
            )}
            <span><span className="font-medium">WOPR</span> = Weighted Opportunity Rating</span>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center italic">
        Data from nflverse (open-source NFL data) and dynastyprocess.com
      </p>
    </div>
  );
}
