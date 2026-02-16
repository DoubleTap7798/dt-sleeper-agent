import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GraduationCap, Filter, Trophy } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { ExportButton } from "@/components/export-button";

interface CollegeStatLeader {
  player: string;
  team: string;
  conference: string;
  position: string;
  stats: Record<string, number>;
}

interface CollegeStatsData {
  passing: CollegeStatLeader[];
  rushing: CollegeStatLeader[];
  receiving: CollegeStatLeader[];
}

type StatCategory = "passing" | "rushing" | "receiving";

function getMostRecentCFBSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 8) return year;
  return year - 1;
}

export default function CollegeStatsPage() {
  usePageTitle("College Stat Leaders");
  const currentSeason = getMostRecentCFBSeason();
  const [year, setYear] = useState<string>(String(currentSeason));
  const [conference, setConference] = useState<string>("all");
  const [category, setCategory] = useState<StatCategory>("passing");

  const queryParams = new URLSearchParams();
  queryParams.set("year", year);
  if (conference !== "all") queryParams.set("conference", conference);

  const { data, isLoading, error } = useQuery<CollegeStatsData>({
    queryKey: [`/api/college/stat-leaders?${queryParams.toString()}`],
    ...CACHE_TIMES.NORMAL,
  });

  const conferences = ["SEC", "Big Ten", "Big 12", "ACC", "Pac-12", "American", "Mountain West", "Sun Belt", "Conference USA", "MAC"];
  const years = [currentSeason, currentSeason - 1, currentSeason - 2];

  const leaders = data?.[category] || [];

  const categoryColumns: Record<StatCategory, { key: string; label: string; computed?: (s: Record<string, number>) => string }[]> = {
    passing: [
      { key: "YDS", label: "YDS" },
      { key: "TD", label: "TD" },
      { key: "INT", label: "INT" },
      { key: "COMPLETIONS", label: "CMP" },
      { key: "ATT", label: "ATT" },
      { key: "PCT", label: "PCT", computed: (s) => s.ATT > 0 ? ((s.COMPLETIONS / s.ATT) * 100).toFixed(1) + "%" : "-" },
    ],
    rushing: [
      { key: "YDS", label: "YDS" },
      { key: "TD", label: "TD" },
      { key: "CAR", label: "CAR" },
      { key: "AVG", label: "AVG", computed: (s) => s.CAR > 0 ? (s.YDS / s.CAR).toFixed(1) : "-" },
      { key: "LONG", label: "LONG" },
    ],
    receiving: [
      { key: "YDS", label: "YDS" },
      { key: "TD", label: "TD" },
      { key: "REC", label: "REC" },
      { key: "AVG", label: "AVG", computed: (s) => s.REC > 0 ? (s.YDS / s.REC).toFixed(1) : "-" },
      { key: "LONG", label: "LONG" },
    ],
  };

  const columns = categoryColumns[category];

  return (
    <PremiumGate featureName="College Stats">
      <div className="space-y-6 min-w-0 overflow-x-hidden" data-testid="college-stats-page">
        <div className="relative overflow-hidden rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/40 via-stone-950/80 to-stone-950/60 p-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-700/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-700/20 border border-amber-700/30 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-amber-100" data-testid="text-college-stats-title">
                  College Stat Leaders
                </h1>
                <p className="text-sm text-amber-200/60">
                  {year} Season - Top performers by category
                </p>
              </div>
            </div>
            <ExportButton
              data={leaders.map((l, i) => ({
                Rank: i + 1,
                Player: l.player,
                Team: l.team,
                Conference: l.conference,
                ...Object.fromEntries(columns.map(c => [c.label, c.computed ? c.computed(l.stats) : (l.stats[c.key] || 0)])),
              }))}
              filename={`college-${category}-leaders-${year}`}
              shareText={`College ${category} leaders ${year}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap" data-testid="college-stats-filters">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={conference} onValueChange={setConference}>
            <SelectTrigger className="w-[140px]" data-testid="select-conference">
              <SelectValue placeholder="Conference" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Conferences</SelectItem>
              {conferences.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-1 p-1 rounded-lg bg-stone-900/60 border border-amber-800/20 w-fit" data-testid="category-tabs">
          {(["passing", "rushing", "receiving"] as StatCategory[]).map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? "default" : "ghost"}
              size="sm"
              onClick={() => setCategory(cat)}
              className="capitalize"
              data-testid={`tab-${cat}`}
            >
              {cat}
            </Button>
          ))}
        </div>

        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-stat-leaders">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-amber-100 capitalize flex items-center gap-2" data-testid="text-category-title">
              <Trophy className="h-5 w-5 text-amber-500" />
              {category} Leaders
              {leaders.length > 0 && <Badge variant="secondary">{leaders.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-muted-foreground" data-testid="text-error">
                Failed to load college stat leaders. The CFBD API may be unavailable.
              </div>
            ) : leaders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground" data-testid="text-no-data">
                No stat data available for this selection
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full" data-testid="table-stat-leaders">
                    <thead className="border-b border-amber-800/20">
                      <tr className="text-left text-sm text-amber-200/50">
                        <th className="p-3 w-12">#</th>
                        <th className="p-3">Player</th>
                        <th className="p-3">Team</th>
                        <th className="p-3 w-24">Conf</th>
                        {columns.map((col) => (
                          <th key={col.key} className="p-3 w-20 text-right">{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leaders.map((leader, i) => (
                        <tr
                          key={`${leader.player}-${leader.team}`}
                          className={`${i % 2 === 0 ? "bg-amber-900/5" : ""}`}
                          data-testid={`row-leader-${i}`}
                        >
                          <td className="p-3 font-medium text-muted-foreground">{i + 1}</td>
                          <td className="p-3 font-medium">{leader.player}</td>
                          <td className="p-3 text-sm text-muted-foreground">{leader.team}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{leader.conference || "-"}</Badge>
                          </td>
                          {columns.map((col) => (
                            <td key={col.key} className="p-3 text-right font-mono text-sm">
                              {col.computed ? col.computed(leader.stats) : (leader.stats[col.key]?.toLocaleString() ?? "-")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden p-3 space-y-2" data-testid="mobile-stat-leaders">
                  {leaders.slice(0, 25).map((leader, i) => (
                    <div
                      key={`${leader.player}-${leader.team}`}
                      className="p-3 rounded-lg bg-amber-900/10 border border-amber-800/15"
                      data-testid={`card-leader-${i}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base font-bold shrink-0 w-8 text-right text-muted-foreground">#{i + 1}</span>
                          <div className="min-w-0">
                            <span className="font-semibold truncate block">{leader.player}</span>
                            <span className="text-xs text-muted-foreground">{leader.team} - {leader.conference || "N/A"}</span>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-amber-400 shrink-0">
                          {leader.stats["YDS"]?.toLocaleString() ?? "-"}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                        {columns.filter(c => c.key !== "YDS").map(col => (
                          <span key={col.key}>
                            {col.label}: <span className="font-medium text-foreground">{col.computed ? col.computed(leader.stats) : (leader.stats[col.key] ?? "-")}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PremiumGate>
  );
}
