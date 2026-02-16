import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Globe, ListOrdered, Newspaper, Shield } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import NewsFeedPage from "./news-feed";

function NFLKeyDatesSection() {
  const { data, isLoading } = useQuery<{ season: string; dates: Array<{ date: string; event: string; description: string; category: string }> }>({
    queryKey: ["/api/nfl/key-dates"],
    staleTime: 1000 * 60 * 60 * 24,
  });

  const categoryConfig: Record<string, { color: string; label: string }> = {
    postseason: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Postseason" },
    offseason: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Offseason" },
    draft: { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Draft" },
    preseason: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "Preseason" },
    regular: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Regular Season" },
    fantasy: { color: "bg-pink-500/20 text-pink-400 border-pink-500/30", label: "Fantasy" },
  };

  const isPast = (dateStr: string) => new Date(dateStr + "T00:00:00") < new Date();
  const nextUpIdx = data?.dates?.findIndex(d => !isPast(d.date)) ?? -1;

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-5 w-5" />Key Dates</CardTitle></CardHeader>
        <CardContent><div className="space-y-3">{Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-16" />)}</div></CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-key-dates">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Key Dates
          {data && <Badge variant="outline" className="text-xs ml-auto">{data.season}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data?.dates?.map((item, idx) => {
            const past = isPast(item.date);
            const isNext = idx === nextUpIdx;
            const cat = categoryConfig[item.category] || categoryConfig.regular;
            const dateObj = new Date(item.date + "T00:00:00");
            const formatted = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            
            return (
              <div 
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border ${isNext ? "border-primary/50 bg-primary/5" : "border-border/50 bg-muted/30"} ${past ? "opacity-50" : ""}`}
                data-testid={`key-date-${idx}`}
              >
                <div className="text-center shrink-0 w-14">
                  <p className="text-xs text-muted-foreground">{dateObj.toLocaleDateString("en-US", { month: "short" })}</p>
                  <p className="text-lg font-bold">{dateObj.getDate()}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{item.event}</span>
                    {isNext && <Badge variant="default" className="text-[10px]">Up Next</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatted}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${cat.color}`}>
                  {cat.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function NFLScheduleSection() {
  const [selectedWeek, setSelectedWeek] = useState("1");
  const { data, isLoading, error } = useQuery<{
    season: number;
    week: number;
    games: Array<{
      id: string;
      date: string;
      name: string;
      shortName: string;
      homeTeam: { name: string; abbreviation: string; logo: string; score: string; record: string };
      awayTeam: { name: string; abbreviation: string; logo: string; score: string; record: string };
      status: { completed: boolean; inProgress: boolean; detail: string; period: number; clock: string };
      broadcast: string;
      venue: string;
    }>;
  }>({
    queryKey: [`/api/nfl/schedule?week=${selectedWeek}`],
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-5 w-5" />NFL Schedule</CardTitle>
        </CardHeader>
        <CardContent><div className="space-y-3">{Array.from({length:8}).map((_,i) => <Skeleton key={i} className="h-20" />)}</div></CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-nfl-schedule">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-5 w-5" />
            NFL Schedule
          </CardTitle>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-[120px]" data-testid="select-nfl-week">
              <SelectValue placeholder="Week" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({length: 18}, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>Week {i + 1}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground text-center py-4">Unable to load schedule. Try again later.</p>
        ) : data?.games?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No games scheduled for Week {selectedWeek}.</p>
        ) : (
          <div className="space-y-2">
            {data?.games?.map((game, idx) => (
              <div
                key={game.id || idx}
                className={`p-3 rounded-lg border ${game.status.inProgress ? "border-primary/50 bg-primary/5" : "border-border/50 bg-muted/30"}`}
                data-testid={`schedule-game-${idx}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <img
                        src={game.awayTeam.logo}
                        alt={game.awayTeam.abbreviation}
                        className="h-6 w-6 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="min-w-0">
                        <span className="text-sm font-semibold">{game.awayTeam.abbreviation}</span>
                        {game.awayTeam.record && <span className="text-[10px] text-muted-foreground ml-1">({game.awayTeam.record})</span>}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">@</span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <img
                        src={game.homeTeam.logo}
                        alt={game.homeTeam.abbreviation}
                        className="h-6 w-6 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="min-w-0">
                        <span className="text-sm font-semibold">{game.homeTeam.abbreviation}</span>
                        {game.homeTeam.record && <span className="text-[10px] text-muted-foreground ml-1">({game.homeTeam.record})</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {(game.status.completed || game.status.inProgress) ? (
                      <p className="text-sm font-bold">{game.awayTeam.score} - {game.homeTeam.score}</p>
                    ) : null}
                    <div className="flex items-center gap-1 justify-end">
                      {game.status.inProgress && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                      <span className="text-[10px] text-muted-foreground">{game.status.detail}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {game.broadcast && <Badge variant="outline" className="text-[10px]">{game.broadcast}</Badge>}
                  {game.venue && <span className="text-[10px] text-muted-foreground truncate">{game.venue}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NFLStandingsSection() {
  const { data, isLoading, error } = useQuery<{
    season: number;
    divisions: Array<{
      conference: string;
      division: string;
      teams: Array<{
        name: string;
        abbreviation: string;
        logo: string;
        wins: number;
        losses: number;
        ties: number;
        pct: string;
        pointsFor: number;
        pointsAgainst: number;
        streak: string;
        divisionRecord: string;
        conferenceRecord: string;
      }>;
    }>;
  }>({
    queryKey: ["/api/nfl/standings"],
    staleTime: 1000 * 60 * 30,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ListOrdered className="h-5 w-5" />NFL Standings</CardTitle></CardHeader>
        <CardContent><div className="space-y-3">{Array.from({length:8}).map((_,i) => <Skeleton key={i} className="h-12" />)}</div></CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card data-testid="card-nfl-standings-error">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ListOrdered className="h-5 w-5" />NFL Standings</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground text-center py-4">Unable to load standings. Try again later.</p></CardContent>
      </Card>
    );
  }

  const conferences = Array.from(new Set(data.divisions.map(d => d.conference)));

  return (
    <Card data-testid="card-nfl-standings">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            NFL Standings
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">{data.season} Season</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={conferences[0] || "AFC"}>
          <TabsList className="w-full justify-start gap-1">
            {conferences.map(conf => (
              <TabsTrigger key={conf} value={conf} className="text-xs" data-testid={`tab-standings-${conf}`}>
                {conf}
              </TabsTrigger>
            ))}
          </TabsList>
          {conferences.map(conf => {
            const confDivisions = data.divisions.filter(d => d.conference === conf);
            return (
              <TabsContent key={conf} value={conf} className="mt-4 space-y-6">
                {confDivisions.map(div => (
                  <div key={div.division} data-testid={`standings-division-${div.division.replace(/\s+/g, '-').toLowerCase()}`}>
                    <h4 className="text-sm font-semibold mb-2">{div.division}</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left py-1.5 px-1 font-medium text-muted-foreground">Team</th>
                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground">W</th>
                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground">L</th>
                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground">T</th>
                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground">PCT</th>
                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground hidden sm:table-cell">PF</th>
                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground hidden sm:table-cell">PA</th>
                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground hidden md:table-cell">STRK</th>
                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground hidden md:table-cell">DIV</th>
                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground hidden lg:table-cell">CONF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {div.teams.map((team) => (
                            <tr key={team.abbreviation} className="border-b border-border/20" data-testid={`standings-team-${team.abbreviation}`}>
                              <td className="py-2 px-1">
                                <div className="flex items-center gap-1.5">
                                  <img
                                    src={team.logo}
                                    alt={team.abbreviation}
                                    className="h-5 w-5 object-contain"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                  <span className="font-medium hidden sm:inline">{team.name}</span>
                                  <span className="font-medium sm:hidden">{team.abbreviation}</span>
                                </div>
                              </td>
                              <td className="text-center py-2 px-1 font-medium">{team.wins}</td>
                              <td className="text-center py-2 px-1">{team.losses}</td>
                              <td className="text-center py-2 px-1">{team.ties}</td>
                              <td className="text-center py-2 px-1 font-medium">{team.pct}</td>
                              <td className="text-center py-2 px-1 hidden sm:table-cell">{team.pointsFor}</td>
                              <td className="text-center py-2 px-1 hidden sm:table-cell">{team.pointsAgainst}</td>
                              <td className="text-center py-2 px-1 hidden md:table-cell">{team.streak}</td>
                              <td className="text-center py-2 px-1 hidden md:table-cell">{team.divisionRecord}</td>
                              <td className="text-center py-2 px-1 hidden lg:table-cell">{team.conferenceRecord}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function NFLPage() {
  usePageTitle("NFL");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          NFL
        </h1>
        <p className="text-muted-foreground text-sm">News, schedule, standings & key dates</p>
      </div>

      <Tabs defaultValue="news" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 py-1">
          <TabsTrigger value="news" className="text-xs gap-1" data-testid="tab-nfl-news">
            <Newspaper className="h-3 w-3" />
            News
          </TabsTrigger>
          <TabsTrigger value="key-dates" className="text-xs gap-1" data-testid="tab-nfl-key-dates">
            <Calendar className="h-3 w-3" />
            Key Dates
          </TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs gap-1" data-testid="tab-nfl-schedule">
            <Globe className="h-3 w-3" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="standings" className="text-xs gap-1" data-testid="tab-nfl-standings">
            <ListOrdered className="h-3 w-3" />
            Standings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="news" className="mt-4">
          <NewsFeedPage embedded />
        </TabsContent>

        <TabsContent value="key-dates" className="mt-4">
          <NFLKeyDatesSection />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <NFLScheduleSection />
        </TabsContent>

        <TabsContent value="standings" className="mt-4">
          <NFLStandingsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
