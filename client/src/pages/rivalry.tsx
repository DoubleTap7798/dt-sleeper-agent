import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Swords, Trophy, TrendingUp, Calendar } from "lucide-react";

interface MatchupResult {
  season: string;
  week: number;
  roster1Points: number;
  roster2Points: number;
  winner: number;
}

interface RivalryRecord {
  rosterId1: number;
  rosterId2: number;
  owner1Name: string;
  owner2Name: string;
  owner1Avatar: string | null;
  owner2Avatar: string | null;
  owner1Wins: number;
  owner2Wins: number;
  ties: number;
  totalGames: number;
  owner1TotalPoints: number;
  owner2TotalPoints: number;
  matchups: MatchupResult[];
}

interface RivalryData {
  rivalries: RivalryRecord[];
  leagueName: string;
  totalSeasons: number;
  seasons: string[];
}

export default function RivalryPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const [selectedRivalry, setSelectedRivalry] = useState<RivalryRecord | null>(null);

  const { data, isLoading } = useQuery<RivalryData>({
    queryKey: [`/api/sleeper/rivalries/${leagueId}`],
    enabled: !!leagueId,
  });

  if (isLoading) {
    return <RivalrySkeleton />;
  }

  if (!data || data.rivalries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center" data-testid="empty-state-rivalry">
        <Swords className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2" data-testid="text-empty-title">No Rivalry Data</h2>
        <p className="text-muted-foreground" data-testid="text-empty-description">
          Head-to-head matchup data will appear here once games are played.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Swords className="h-6 w-6" />
          Rivalries
        </h1>
        <p className="text-muted-foreground" data-testid="text-page-subtitle">
          Head-to-head records across {data.totalSeasons} season{data.totalSeasons !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-matchups">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Swords className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-matchups">
                  {data.rivalries.reduce((sum, r) => sum + r.totalGames, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Matchups</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-biggest-rivalry">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold truncate" data-testid="text-biggest-rivalry">
                  {data.rivalries[0]?.owner1Name} vs {data.rivalries[0]?.owner2Name}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-most-games">Most Games ({data.rivalries[0]?.totalGames})</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-seasons-tracked">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-seasons-tracked">
                  {data.totalSeasons}
                </p>
                <p className="text-sm text-muted-foreground">Seasons Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Head-to-Head Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matchup</TableHead>
                <TableHead className="text-center">Record</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Games</TableHead>
                <TableHead className="text-right hidden md:table-cell">Avg Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rivalries.map((rivalry: RivalryRecord, index: number) => (
                <TableRow
                  key={`${rivalry.rosterId1}-${rivalry.rosterId2}`}
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedRivalry(rivalry)}
                  data-testid={`rivalry-row-${index}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        <Avatar className="h-8 w-8 border-2 border-background">
                          <AvatarImage src={rivalry.owner1Avatar || undefined} />
                          <AvatarFallback className="text-xs">
                            {rivalry.owner1Name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <Avatar className="h-8 w-8 border-2 border-background">
                          <AvatarImage src={rivalry.owner2Avatar || undefined} />
                          <AvatarFallback className="text-xs">
                            {rivalry.owner2Name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate" data-testid={`text-rivalry-names-${index}`}>
                          {rivalry.owner1Name} vs {rivalry.owner2Name}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Badge 
                        variant={rivalry.owner1Wins > rivalry.owner2Wins ? "default" : "secondary"}
                        className="font-mono text-xs"
                        data-testid={`badge-owner1-wins-${index}`}
                      >
                        {rivalry.owner1Wins}
                      </Badge>
                      <span className="text-muted-foreground">-</span>
                      <Badge 
                        variant={rivalry.owner2Wins > rivalry.owner1Wins ? "default" : "secondary"}
                        className="font-mono text-xs"
                        data-testid={`badge-owner2-wins-${index}`}
                      >
                        {rivalry.owner2Wins}
                      </Badge>
                      {rivalry.ties > 0 && (
                        <>
                          <span className="text-muted-foreground">-</span>
                          <Badge variant="outline" className="font-mono text-xs" data-testid={`badge-ties-${index}`}>
                            {rivalry.ties}
                          </Badge>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    <span className="font-mono text-sm" data-testid={`text-total-games-${index}`}>
                      {rivalry.totalGames}
                    </span>
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    <div className="text-sm">
                      <span className="font-mono">
                        {(rivalry.owner1TotalPoints / rivalry.totalGames).toFixed(1)}
                      </span>
                      <span className="text-muted-foreground mx-1">-</span>
                      <span className="font-mono">
                        {(rivalry.owner2TotalPoints / rivalry.totalGames).toFixed(1)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selectedRivalry} onOpenChange={(open) => !open && setSelectedRivalry(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-rivalry-detail">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3" data-testid="text-rivalry-title">
              {selectedRivalry && (
                <>
                  <div className="flex -space-x-2">
                    <Avatar className="h-10 w-10 border-2 border-background">
                      <AvatarImage src={selectedRivalry.owner1Avatar || undefined} />
                      <AvatarFallback>
                        {selectedRivalry.owner1Name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Avatar className="h-10 w-10 border-2 border-background">
                      <AvatarImage src={selectedRivalry.owner2Avatar || undefined} />
                      <AvatarFallback>
                        {selectedRivalry.owner2Name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <p>{selectedRivalry.owner1Name} vs {selectedRivalry.owner2Name}</p>
                    <p className="text-sm font-normal text-muted-foreground">
                      {selectedRivalry.totalGames} games played
                    </p>
                  </div>
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          {selectedRivalry && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center" data-testid="card-owner1-wins">
                  <p className="text-xs text-muted-foreground truncate">{selectedRivalry.owner1Name}</p>
                  <p className="text-2xl font-bold font-mono">{selectedRivalry.owner1Wins}</p>
                  <p className="text-xs text-muted-foreground">Wins</p>
                </Card>
                <Card className="p-3 text-center" data-testid="card-ties">
                  <p className="text-xs text-muted-foreground">Ties</p>
                  <p className="text-2xl font-bold font-mono">{selectedRivalry.ties}</p>
                </Card>
                <Card className="p-3 text-center" data-testid="card-owner2-wins">
                  <p className="text-xs text-muted-foreground truncate">{selectedRivalry.owner2Name}</p>
                  <p className="text-2xl font-bold font-mono">{selectedRivalry.owner2Wins}</p>
                  <p className="text-xs text-muted-foreground">Wins</p>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3" data-testid="card-owner1-points">
                  <p className="text-xs text-muted-foreground">Total Points</p>
                  <p className="text-lg font-bold font-mono">{selectedRivalry.owner1TotalPoints.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">
                    Avg: {(selectedRivalry.owner1TotalPoints / selectedRivalry.totalGames).toFixed(1)}
                  </p>
                </Card>
                <Card className="p-3" data-testid="card-owner2-points">
                  <p className="text-xs text-muted-foreground">Total Points</p>
                  <p className="text-lg font-bold font-mono">{selectedRivalry.owner2TotalPoints.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">
                    Avg: {(selectedRivalry.owner2TotalPoints / selectedRivalry.totalGames).toFixed(1)}
                  </p>
                </Card>
              </div>

              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4" />
                  Matchup History
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedRivalry.matchups
                    .sort((a, b) => b.season.localeCompare(a.season) || b.week - a.week)
                    .map((matchup, idx) => (
                      <div
                        key={`${matchup.season}-${matchup.week}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-accent/30"
                        data-testid={`matchup-row-${idx}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {matchup.season} W{matchup.week}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span 
                            className={`font-mono ${matchup.winner === selectedRivalry.rosterId1 ? 'font-bold' : 'text-muted-foreground'}`}
                          >
                            {matchup.roster1Points.toFixed(1)}
                          </span>
                          <span className="text-muted-foreground">-</span>
                          <span 
                            className={`font-mono ${matchup.winner === selectedRivalry.rosterId2 ? 'font-bold' : 'text-muted-foreground'}`}
                          >
                            {matchup.roster2Points.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RivalrySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
