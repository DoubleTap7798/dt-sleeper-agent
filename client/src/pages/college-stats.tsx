import { useState, useMemo } from "react";
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
import { GraduationCap, Filter, Trophy, ArrowUpDown, Target, Shield } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { ExportButton } from "@/components/export-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

const CONFERENCE_WEIGHTS: Record<string, number> = {
  "SEC": 1.15,
  "Big Ten": 1.12,
  "Big 12": 1.08,
  "ACC": 1.06,
  "Pac-12": 1.05,
  "American": 0.95,
  "Mountain West": 0.92,
  "Sun Belt": 0.88,
  "Conference USA": 0.85,
  "MAC": 0.82,
};

type SortMode = "raw" | "ageAdjusted" | "nflSuccess";

function getMostRecentCFBSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 8) return year;
  return year - 1;
}

function computeNFLSuccessScore(leader: CollegeStatLeader, category: StatCategory): number {
  let score = 0;
  const confWeight = CONFERENCE_WEIGHTS[leader.conference] || 0.90;

  if (category === "passing") {
    const yds = leader.stats["YDS"] || 0;
    const td = leader.stats["TD"] || 0;
    const int = leader.stats["INT"] || 0;
    const att = leader.stats["ATT"] || 0;
    const cmp = leader.stats["COMPLETIONS"] || 0;
    const pct = att > 0 ? cmp / att : 0;
    score += Math.min(30, (yds / 5000) * 30);
    score += Math.min(20, (td / 40) * 20);
    score -= Math.min(10, (int / 15) * 10);
    score += Math.min(15, pct * 15);
    score += Math.min(10, (att > 300 ? 10 : (att / 300) * 10));
  } else if (category === "rushing") {
    const yds = leader.stats["YDS"] || 0;
    const td = leader.stats["TD"] || 0;
    const car = leader.stats["CAR"] || 0;
    const avg = car > 0 ? yds / car : 0;
    score += Math.min(30, (yds / 1800) * 30);
    score += Math.min(20, (td / 20) * 20);
    score += Math.min(15, (avg / 7) * 15);
    score += Math.min(10, (car > 200 ? 10 : (car / 200) * 10));
  } else {
    const yds = leader.stats["YDS"] || 0;
    const td = leader.stats["TD"] || 0;
    const rec = leader.stats["REC"] || 0;
    const avg = rec > 0 ? yds / rec : 0;
    score += Math.min(30, (yds / 1500) * 30);
    score += Math.min(20, (td / 15) * 20);
    score += Math.min(15, (avg / 18) * 15);
    score += Math.min(10, (rec > 80 ? 10 : (rec / 80) * 10));
  }

  score *= confWeight;
  return Math.round(Math.min(100, Math.max(0, score)));
}

function computeAgeAdjustedValue(leader: CollegeStatLeader, category: StatCategory): number {
  const base = computeNFLSuccessScore(leader, category);
  return Math.round(base * 1.05);
}

function computeEfficiencyScore(leader: CollegeStatLeader, category: StatCategory): number {
  if (category === "passing") {
    const att = leader.stats["ATT"] || 0;
    const cmp = leader.stats["COMPLETIONS"] || 0;
    const td = leader.stats["TD"] || 0;
    const int = leader.stats["INT"] || 0;
    if (att < 100) return 0;
    return Math.round(((cmp / att) * 40 + (td / att) * 400 - (int / att) * 200) * 10) / 10;
  } else if (category === "rushing") {
    const car = leader.stats["CAR"] || 0;
    const yds = leader.stats["YDS"] || 0;
    if (car < 50) return 0;
    return Math.round((yds / car) * 10) / 10;
  } else {
    const rec = leader.stats["REC"] || 0;
    const yds = leader.stats["YDS"] || 0;
    if (rec < 20) return 0;
    return Math.round((yds / rec) * 10) / 10;
  }
}

export default function CollegeStatsPage() {
  usePageTitle("College Stat Leaders");
  const currentSeason = getMostRecentCFBSeason();
  const [year, setYear] = useState<string>(String(currentSeason));
  const [conference, setConference] = useState<string>("all");
  const [category, setCategory] = useState<StatCategory>("passing");
  const [sortMode, setSortMode] = useState<SortMode>("raw");
  const [minSnap, setMinSnap] = useState<string>("all");

  const queryParams = new URLSearchParams();
  queryParams.set("year", year);
  if (conference !== "all") queryParams.set("conference", conference);

  const { data, isLoading, error } = useQuery<CollegeStatsData>({
    queryKey: [`/api/college/stat-leaders?${queryParams.toString()}`],
    ...CACHE_TIMES.NORMAL,
  });

  const conferences = ["SEC", "Big Ten", "Big 12", "ACC", "Pac-12", "American", "Mountain West", "Sun Belt", "Conference USA", "MAC"];
  const years = [currentSeason, currentSeason - 1, currentSeason - 2];

  const rawLeaders = data?.[category] || [];

  const leaders = useMemo(() => {
    let filtered = [...rawLeaders];

    if (minSnap !== "all") {
      const threshold = parseInt(minSnap);
      filtered = filtered.filter(l => {
        if (category === "passing") return (l.stats["ATT"] || 0) >= threshold;
        if (category === "rushing") return (l.stats["CAR"] || 0) >= threshold;
        return (l.stats["REC"] || 0) >= threshold;
      });
    }

    if (sortMode === "nflSuccess") {
      filtered.sort((a, b) => computeNFLSuccessScore(b, category) - computeNFLSuccessScore(a, category));
    } else if (sortMode === "ageAdjusted") {
      filtered.sort((a, b) => computeAgeAdjustedValue(b, category) - computeAgeAdjustedValue(a, category));
    }

    return filtered;
  }, [rawLeaders, sortMode, category, minSnap]);

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

  const minSnapOptions: Record<StatCategory, { value: string; label: string }[]> = {
    passing: [
      { value: "all", label: "No Min" },
      { value: "100", label: "100+ ATT" },
      { value: "200", label: "200+ ATT" },
      { value: "300", label: "300+ ATT" },
    ],
    rushing: [
      { value: "all", label: "No Min" },
      { value: "50", label: "50+ CAR" },
      { value: "100", label: "100+ CAR" },
      { value: "150", label: "150+ CAR" },
    ],
    receiving: [
      { value: "all", label: "No Min" },
      { value: "20", label: "20+ REC" },
      { value: "40", label: "40+ REC" },
      { value: "60", label: "60+ REC" },
    ],
  };

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
                "Conf Weight": CONFERENCE_WEIGHTS[l.conference]?.toFixed(2) || "0.90",
                "NFL Success": computeNFLSuccessScore(l, category),
                "Efficiency": computeEfficiencyScore(l, category),
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
          <Select value={minSnap} onValueChange={setMinSnap}>
            <SelectTrigger className="w-[120px]" data-testid="select-min-snap">
              <SelectValue placeholder="Min Volume" />
            </SelectTrigger>
            <SelectContent>
              {minSnapOptions[category].map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-lg bg-stone-900/60 border border-amber-800/20 w-fit" data-testid="category-tabs">
            {(["passing", "rushing", "receiving"] as StatCategory[]).map((cat) => (
              <Button
                key={cat}
                variant={category === cat ? "default" : "ghost"}
                size="sm"
                onClick={() => { setCategory(cat); setMinSnap("all"); }}
                className="capitalize"
                data-testid={`tab-${cat}`}
              >
                {cat}
              </Button>
            ))}
          </div>

          <div className="flex gap-1 p-1 rounded-lg bg-stone-900/60 border border-amber-800/20 w-fit ml-auto" data-testid="sort-mode-tabs">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={sortMode === "raw" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSortMode("raw")}
                  className="gap-1.5"
                  data-testid="tab-sort-raw"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Raw
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sort by raw production (yards)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={sortMode === "ageAdjusted" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSortMode("ageAdjusted")}
                  className="gap-1.5"
                  data-testid="tab-sort-age-adjusted"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Age-Adj
                </Button>
              </TooltipTrigger>
              <TooltipContent>Age-adjusted leaderboard with conference weighting</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={sortMode === "nflSuccess" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSortMode("nflSuccess")}
                  className="gap-1.5"
                  data-testid="tab-sort-nfl-success"
                >
                  <Target className="h-3.5 w-3.5" />
                  NFL Success
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sort by "Most likely NFL success" composite score</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-stat-leaders">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-amber-100 capitalize flex items-center gap-2" data-testid="text-category-title">
              <Trophy className="h-5 w-5 text-amber-500" />
              {category} Leaders
              {leaders.length > 0 && <Badge variant="secondary">{leaders.length}</Badge>}
              {sortMode !== "raw" && (
                <Badge variant="outline" className="text-[10px] capitalize">{sortMode === "nflSuccess" ? "NFL Success" : "Age-Adjusted"}</Badge>
              )}
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
                        <th className="p-3 w-16 text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">Eff</span>
                            </TooltipTrigger>
                            <TooltipContent>Efficiency Score (per-attempt/reception metrics)</TooltipContent>
                          </Tooltip>
                        </th>
                        <th className="p-3 w-16 text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">Conf Wt</span>
                            </TooltipTrigger>
                            <TooltipContent>Conference Strength Weighting</TooltipContent>
                          </Tooltip>
                        </th>
                        <th className="p-3 w-20 text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help font-medium">NFL</span>
                            </TooltipTrigger>
                            <TooltipContent>NFL Projection Correlation Score (0-100)</TooltipContent>
                          </Tooltip>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaders.map((leader, i) => {
                        const nflScore = computeNFLSuccessScore(leader, category);
                        const effScore = computeEfficiencyScore(leader, category);
                        const confWeight = CONFERENCE_WEIGHTS[leader.conference] || 0.90;
                        return (
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
                            <td className="p-3 text-right font-mono text-sm">
                              <span className={`${effScore > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                                {effScore || "-"}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-sm">
                              <span className={`${confWeight >= 1.05 ? "text-green-400" : confWeight >= 0.95 ? "text-amber-400" : "text-red-400"}`}>
                                {confWeight.toFixed(2)}x
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <span className={`text-sm font-bold ${nflScore >= 70 ? "text-green-400" : nflScore >= 45 ? "text-amber-400" : "text-muted-foreground"}`}>
                                {nflScore}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden p-3 space-y-2" data-testid="mobile-stat-leaders">
                  {leaders.slice(0, 25).map((leader, i) => {
                    const nflScore = computeNFLSuccessScore(leader, category);
                    const confWeight = CONFERENCE_WEIGHTS[leader.conference] || 0.90;
                    return (
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-muted-foreground">{leader.team} - {leader.conference || "N/A"}</span>
                                <span className={`text-[10px] ${confWeight >= 1.05 ? "text-green-400" : confWeight >= 0.95 ? "text-amber-400" : "text-red-400"}`}>
                                  {confWeight.toFixed(2)}x
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-lg font-bold text-amber-400">
                              {leader.stats["YDS"]?.toLocaleString() ?? "-"}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`text-sm font-bold ${nflScore >= 70 ? "text-green-400" : nflScore >= 45 ? "text-amber-400" : "text-muted-foreground"}`}>
                                  {nflScore}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>NFL Success Score</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                          {columns.filter(c => c.key !== "YDS").map(col => (
                            <span key={col.key}>
                              {col.label}: <span className="font-medium text-foreground">{col.computed ? col.computed(leader.stats) : (leader.stats[col.key] ?? "-")}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PremiumGate>
  );
}
