import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { CACHE_TIMES } from "@/lib/queryClient";
import { abbreviateName } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Search, TrendingUp, AlertCircle, Loader2, BarChart3 } from "lucide-react";
import { PlayerProfileModal } from "@/components/player-profile-modal";
import { getNFLTeamLogo } from "@/lib/team-logos";
import { MetricTooltip } from "@/components/metric-tooltip";
import { usePageTitle } from "@/hooks/use-page-title";

interface Player {
  id: string;
  name: string;
  fullName: string;
  position: string;
  team: string;
  age: number | null;
  yearsExp: number;
  fantasyPoints: number;
  pointsPerGame: number;
  gamesPlayed: number;
  dynastyValue: number;
  overallRank: number;
  positionRank: number;
  injuryStatus: string | null;
  number: number | null;
  college: string | null;
  height: string | null;
  weight: string | null;
  snapPct: number | null;
  headshot?: string | null;
  isIDP?: boolean;
  stats: {
    passYd: number;
    passTd: number;
    passInt: number;
    passAtt: number;
    passCmp: number;
    passFd: number;
    rushYd: number;
    rushTd: number;
    rushAtt: number;
    rushFd: number;
    rec: number;
    recYd: number;
    recTd: number;
    recTgt: number;
    recFd: number;
  };
  idpStats?: {
    tackles: number;
    soloTackles: number;
    assistTackles: number;
    tacklesForLoss: number;
    sacks: number;
    qbHits: number;
    interceptions: number;
    passesDefended: number;
    forcedFumbles: number;
    fumbleRecoveries: number;
    tds: number;
    safeties: number;
  } | null;
}

interface PlayersData {
  players: Player[];
  totalCount: number;
  season: string;
  scoringType: string;
  isCustomScoring?: boolean;
  isIDPLeague?: boolean;
  lastUpdated: string;
}

interface PlayerInsights {
  player: {
    id: string;
    name: string;
    position: string;
    team: string;
    age: number | null;
    yearsExp: number;
    value: number;
    injuryStatus: string | null;
    number: number | null;
    college: string | null;
    height: string | null;
    weight: string | null;
  };
  insights: string;
  generatedAt: string;
}

const positionStyles: Record<string, string> = {
  QB: "bg-muted text-foreground",
  RB: "bg-muted text-foreground",
  WR: "bg-muted text-foreground",
  TE: "bg-muted text-foreground",
  DL: "bg-muted text-foreground",
  LB: "bg-muted text-foreground",
  DB: "bg-muted text-foreground",
};

const POSITION_TABS = ["ALL", "QB", "RB", "WR", "TE"];
const IDP_POSITION_TABS = ["IDP", "DL", "LB", "DB"];

function getPositionStats(player: Player, leagueId: string | null) {
  if (player.isIDP && player.idpStats) {
    return [
      { label: "TKL", value: player.idpStats.tackles },
      { label: "SOLO", value: player.idpStats.soloTackles },
      { label: "SACK", value: player.idpStats.sacks },
      { label: "INT", value: player.idpStats.interceptions },
      { label: "PD", value: player.idpStats.passesDefended },
      { label: "FF", value: player.idpStats.forcedFumbles },
    ];
  }

  switch (player.position) {
    case "QB":
      return leagueId ? [
        { label: "SNP %", value: player.snapPct !== null ? player.snapPct : "-" },
        { label: "PASS YD", value: player.stats.passYd.toLocaleString() },
        { label: "RUSH YD", value: player.stats.rushYd },
        { label: "PASS TD", value: player.stats.passTd },
        { label: "RUSH TD", value: player.stats.rushTd },
        { label: "PASS ATT", value: player.stats.passAtt },
        { label: "INT", value: player.stats.passInt },
      ] : [
        { label: "PASS YD", value: player.stats.passYd.toLocaleString() },
        { label: "PASS TD", value: player.stats.passTd },
        { label: "RUSH YD", value: player.stats.rushYd },
        { label: "RUSH TD", value: player.stats.rushTd },
        { label: "INT", value: player.stats.passInt },
        { label: "CMP", value: player.stats.passCmp },
      ];
    case "RB":
      return leagueId ? [
        { label: "SNP %", value: player.snapPct !== null ? player.snapPct : "-" },
        { label: "RUSH YD", value: player.stats.rushYd.toLocaleString() },
        { label: "REC YD", value: player.stats.recYd },
        { label: "RUSH TD", value: player.stats.rushTd },
        { label: "REC TD", value: player.stats.recTd },
        { label: "RUSH", value: player.stats.rushAtt },
        { label: "REC", value: player.stats.rec },
      ] : [
        { label: "RUSH YD", value: player.stats.rushYd.toLocaleString() },
        { label: "RUSH TD", value: player.stats.rushTd },
        { label: "REC YD", value: player.stats.recYd },
        { label: "REC TD", value: player.stats.recTd },
        { label: "RUSH", value: player.stats.rushAtt },
        { label: "REC", value: player.stats.rec },
      ];
    case "WR":
      return leagueId ? [
        { label: "SNP %", value: player.snapPct !== null ? player.snapPct : "-" },
        { label: "REC", value: player.stats.rec },
        { label: "REC YD", value: player.stats.recYd.toLocaleString() },
        { label: "REC TD", value: player.stats.recTd },
        { label: "TAR", value: player.stats.recTgt },
        { label: "YD/REC", value: player.stats.rec > 0 ? (player.stats.recYd / player.stats.rec).toFixed(1) : "0" },
        { label: "YD/TAR", value: player.stats.recTgt > 0 ? (player.stats.recYd / player.stats.recTgt).toFixed(1) : "0" },
      ] : [
        { label: "REC YD", value: player.stats.recYd.toLocaleString() },
        { label: "REC TD", value: player.stats.recTd },
        { label: "REC", value: player.stats.rec },
        { label: "TAR", value: player.stats.recTgt },
        { label: "RUSH YD", value: player.stats.rushYd },
        { label: "RUSH TD", value: player.stats.rushTd },
      ];
    case "TE":
      return leagueId ? [
        { label: "SNP %", value: player.snapPct !== null ? player.snapPct : "-" },
        { label: "REC", value: player.stats.rec },
        { label: "REC YD", value: player.stats.recYd.toLocaleString() },
        { label: "REC TD", value: player.stats.recTd },
        { label: "TAR", value: player.stats.recTgt },
        { label: "YD/REC", value: player.stats.rec > 0 ? (player.stats.recYd / player.stats.rec).toFixed(1) : "0" },
      ] : [
        { label: "REC YD", value: player.stats.recYd.toLocaleString() },
        { label: "REC TD", value: player.stats.recTd },
        { label: "REC", value: player.stats.rec },
        { label: "TAR", value: player.stats.recTgt },
      ];
    default:
      return leagueId ? [
        { label: "SNP %", value: player.snapPct !== null ? player.snapPct : "-" },
        { label: "REC YD", value: player.stats.recYd.toLocaleString() },
        { label: "REC TD", value: player.stats.recTd },
        { label: "RUSH YD", value: player.stats.rushYd },
      ] : [
        { label: "REC YD", value: player.stats.recYd.toLocaleString() },
        { label: "REC TD", value: player.stats.recTd },
        { label: "RUSH YD", value: player.stats.rushYd },
        { label: "RUSH TD", value: player.stats.rushTd },
      ];
  }
}

const AVAILABLE_YEARS = ["2025", "2024", "2023", "2022"];

export default function PlayersPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  usePageTitle("NFL Players");
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("2025");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);

  const playersUrl = leagueId 
    ? `/api/sleeper/players?leagueId=${leagueId}&year=${selectedYear}` 
    : `/api/sleeper/players?year=${selectedYear}`;
  const { data, isLoading, error } = useQuery<PlayersData>({
    queryKey: [playersUrl],
    ...CACHE_TIMES.STABLE,
  });

  const insightsUrl = selectedPlayer ? `/api/sleeper/players/${selectedPlayer.id}/insights` : null;
  const { data: insightsData, isLoading: insightsLoading } = useQuery<PlayerInsights>({
    queryKey: [insightsUrl],
    enabled: !!selectedPlayer && !!insightsUrl,
  });

  const showIDPOptions = data?.isIDPLeague || !leagueId;
  
  useEffect(() => {
    if (!showIDPOptions && IDP_POSITION_TABS.includes(positionFilter)) {
      setPositionFilter("ALL");
    }
  }, [showIDPOptions, positionFilter]);

  if (isLoading) {
    return <PlayersSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load players</p>
      </div>
    );
  }

  const idpPositions = ["DL", "LB", "DB"];
  
  const filteredPlayers = data.players.filter((player) => {
    const matchesSearch = 
      player.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesPosition = false;
    if (positionFilter === "ALL") {
      matchesPosition = true;
    } else if (positionFilter === "IDP") {
      matchesPosition = idpPositions.includes(player.position);
    } else {
      matchesPosition = player.position === positionFilter;
    }
    
    return matchesSearch && matchesPosition;
  });

  const allTabs = showIDPOptions ? [...POSITION_TABS, ...IDP_POSITION_TABS] : POSITION_TABS;

  return (
    <div className="space-y-4" data-testid="page-players">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" />
            NFL Players
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.season} Season • {data.scoringType} Scoring
            {data.isCustomScoring && " (approximate)"}
          </p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[90px]" data-testid="select-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_YEARS.map((year) => (
              <SelectItem key={year} value={year} data-testid={`option-year-${year}`}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for a player..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search-players"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {allTabs.map((tab) => (
          <Button
            key={tab}
            variant={positionFilter === tab ? "default" : "ghost"}
            size="sm"
            onClick={() => setPositionFilter(tab)}
            className={`shrink-0 glass ${positionFilter === tab ? "glass-active" : ""}`}
            data-testid={`tab-position-${tab.toLowerCase()}`}
          >
            {tab}
          </Button>
        ))}
      </div>

      <div className="text-xs text-muted-foreground flex items-center justify-between">
        <span>Leaders</span>
        <span>{leagueId ? "SEASON STATS" : "NFL STATS"}</span>
      </div>

      <div className="space-y-2">
        {filteredPlayers.slice(0, 200).map((player) => {
          const stats = getPositionStats(player, leagueId);
          
          return (
            <Card
              key={player.id}
              className="cursor-pointer hover-elevate p-3"
              onClick={() => setSelectedPlayer(player)}
              data-testid={`player-card-${player.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                    {player.overallRank}
                  </span>
                  <Avatar className="h-10 w-10" data-testid={`avatar-${player.id}`}>
                    <AvatarImage 
                      src={getNFLTeamLogo(player.team) || undefined} 
                      alt={player.team}
                    />
                    <AvatarFallback className="text-xs bg-muted">
                      {player.team}
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm truncate">
                      <span className="sm:hidden">{abbreviateName(player.fullName)}</span>
                      <span className="hidden sm:inline">{player.fullName}</span>
                    </span>
                    {player.injuryStatus && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        {player.injuryStatus}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className={positionStyles[player.position] ? "font-medium" : ""}>
                      {player.position}
                    </span>
                    <span>•</span>
                    <span>{player.team}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Ranking</div>
                  <div className="text-lg font-bold font-mono text-primary">
                    {player.position}{player.positionRank}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 sm:gap-4 overflow-x-auto text-xs">
                {stats.slice(0, 7).map((stat, idx) => (
                  <div key={idx} className="shrink-0 text-center min-w-[40px]">
                    <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                    <div className="font-mono font-medium">{stat.value}</div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {filteredPlayers.length > 200 && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Showing first 200 of {filteredPlayers.length} players. Use search to find specific players.
        </div>
      )}

      <Sheet open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
        <SheetContent className="w-full sm:w-[540px] max-w-full overflow-y-auto overflow-x-hidden">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedPlayer && (
                <>
                  <Badge
                    variant="outline"
                    className={`${positionStyles[selectedPlayer.position] || ""}`}
                  >
                    {selectedPlayer.position}
                  </Badge>
                  <span>{selectedPlayer.fullName}</span>
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          {selectedPlayer && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {leagueId ? (
                  <>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Total Points</p>
                      <p className="text-lg font-bold font-mono">{selectedPlayer.fantasyPoints.toFixed(1)}</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Points/Game</p>
                      <p className="text-lg font-bold font-mono">{selectedPlayer.pointsPerGame.toFixed(1)}</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Games Played</p>
                      <p className="text-lg font-bold">{selectedPlayer.gamesPlayed}</p>
                    </Card>
                    <Card className="p-3">
                      <MetricTooltip metric="dynastyValue" className="text-xs text-muted-foreground" />
                      <p className="text-lg font-bold font-mono text-primary">{selectedPlayer.dynastyValue.toLocaleString()}</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Overall Rank</p>
                      <p className="text-lg font-bold">#{selectedPlayer.overallRank}</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Position Rank</p>
                      <p className="text-lg font-bold">{selectedPlayer.position}{selectedPlayer.positionRank}</p>
                    </Card>
                  </>
                ) : (
                  <>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Games Played</p>
                      <p className="text-lg font-bold">{selectedPlayer.gamesPlayed}</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">
                        {selectedPlayer.isIDP ? "Tackles" : "Total Yards"}
                      </p>
                      <p className="text-lg font-bold font-mono">
                        {selectedPlayer.isIDP 
                          ? (selectedPlayer.idpStats?.tackles || 0).toLocaleString()
                          : (selectedPlayer.stats.passYd + selectedPlayer.stats.rushYd + selectedPlayer.stats.recYd).toLocaleString()}
                      </p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">
                        {selectedPlayer.isIDP ? "Sacks" : "Touchdowns"}
                      </p>
                      <p className="text-lg font-bold font-mono">
                        {selectedPlayer.isIDP
                          ? selectedPlayer.idpStats?.sacks || 0
                          : selectedPlayer.stats.passTd + selectedPlayer.stats.rushTd + selectedPlayer.stats.recTd}
                      </p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Position Rank</p>
                      <p className="text-lg font-bold">{selectedPlayer.position}{selectedPlayer.positionRank}</p>
                    </Card>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Season Stats</h4>
                {selectedPlayer.position === "QB" ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 text-center">
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Pass Att</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.passAtt}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Comp</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.passCmp}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Pass Yds</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.passYd.toLocaleString()}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Pass TDs</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.passTd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">INTs</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.passInt}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">1st Downs</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.passFd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rush Att</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rushAtt}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rush Yds</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rushYd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rush TDs</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rushTd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rush 1st</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rushFd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Snap %</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.snapPct !== null ? `${selectedPlayer.snapPct}%` : "-"}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Games</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.gamesPlayed}</p>
                    </Card>
                  </div>
                ) : selectedPlayer.position === "RB" ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 text-center">
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rush Att</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rushAtt}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rush Yds</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rushYd.toLocaleString()}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rush TDs</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rushTd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rush 1st</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rushFd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Targets</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.recTgt}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rec</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rec}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rec Yds</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.recYd.toLocaleString()}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rec TDs</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.recTd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rec 1st</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.recFd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Total 1st</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rushFd + selectedPlayer.stats.recFd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Snap %</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.snapPct !== null ? `${selectedPlayer.snapPct}%` : "-"}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Games</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.gamesPlayed}</p>
                    </Card>
                  </div>
                ) : selectedPlayer.isIDP && selectedPlayer.idpStats ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 text-center">
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Tackles</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.tackles}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Solo</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.soloTackles}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Assists</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.assistTackles}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">TFL</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.tacklesForLoss}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Sacks</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.sacks}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">QB Hits</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.qbHits}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">INTs</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.interceptions}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">PD</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.passesDefended}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">FF</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.forcedFumbles}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">FR</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.fumbleRecoveries}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">TDs</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.idpStats.tds}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Games</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.gamesPlayed}</p>
                    </Card>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 text-center">
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Targets</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.recTgt}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rec</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rec}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rec Yds</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.recYd.toLocaleString()}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rec TDs</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.recTd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rec 1st</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.recFd}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Snap %</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.snapPct !== null ? `${selectedPlayer.snapPct}%` : "-"}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Games</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.gamesPlayed}</p>
                    </Card>
                    <Card className="p-1.5 sm:p-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Rush Yds</p>
                      <p className="font-mono font-medium text-sm">{selectedPlayer.stats.rushYd}</p>
                    </Card>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span>{selectedPlayer.team}</span>
                {selectedPlayer.age && <span>Age: {selectedPlayer.age}</span>}
                {selectedPlayer.college && <span>College: {selectedPlayer.college}</span>}
                <span>Exp: {selectedPlayer.yearsExp} yr{selectedPlayer.yearsExp !== 1 ? "s" : ""}</span>
              </div>

              {selectedPlayer.injuryStatus && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">Injury Status: {selectedPlayer.injuryStatus}</span>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setProfilePlayer(selectedPlayer)}
                data-testid="button-view-full-stats"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View Full Stats & Game Logs
              </Button>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Player Insights
                </h3>
                
                {insightsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Generating insights...</span>
                  </div>
                ) : insightsData ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {insightsData.insights}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      Generated {new Date(insightsData.generatedAt).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Click on a player to load insights.</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {profilePlayer && (
        <PlayerProfileModal
          open={!!profilePlayer}
          onOpenChange={(open) => !open && setProfilePlayer(null)}
          playerId={profilePlayer.id}
          playerName={profilePlayer.fullName}
          position={profilePlayer.position}
          team={profilePlayer.team}
        />
      )}
    </div>
  );
}

function PlayersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-12" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
