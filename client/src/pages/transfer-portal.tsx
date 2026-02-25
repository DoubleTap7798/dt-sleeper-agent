import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, Filter, ArrowRight, Star, Search, GraduationCap, TrendingUp, TrendingDown, Zap, ShieldAlert } from "lucide-react";
import { getPositionColorClass } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import { ExportButton } from "@/components/export-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TransferPortalEntry {
  season: number;
  firstName: string;
  lastName: string;
  position: string;
  origin: string;
  destination: string | null;
  transferDate: string;
  rating: number | null;
  stars: number | null;
  eligibility: string | null;
}

interface TransferData {
  transfers: TransferPortalEntry[];
  year: number;
}

const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE", "ATH"];

const POWER_CONFERENCES = ["SEC", "Big Ten", "Big 12", "ACC"];
const MID_CONFERENCES = ["Pac-12", "American", "Mountain West"];

function getMostRecentCFBSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 8) return year;
  return year - 1;
}

function normalizePosition(pos: string): string {
  const upper = pos?.toUpperCase() || "";
  if (upper.includes("QB")) return "QB";
  if (upper.includes("RB") || upper === "APB" || upper === "TB") return "RB";
  if (upper.includes("WR") || upper === "SLOT") return "WR";
  if (upper.includes("TE")) return "TE";
  return upper;
}

function getSchoolTier(school: string | null): number {
  if (!school) return 0;
  const s = school.toLowerCase();
  const tier1 = ["alabama", "georgia", "ohio state", "michigan", "texas", "usc", "clemson", "lsu", "oklahoma", "oregon", "penn state", "florida", "notre dame", "tennessee"];
  const tier2 = ["auburn", "wisconsin", "iowa", "miami", "florida state", "washington", "utah", "ole miss", "south carolina", "arkansas", "michigan state", "arizona", "baylor", "kansas state", "colorado"];
  if (tier1.some(t => s.includes(t))) return 3;
  if (tier2.some(t => s.includes(t))) return 2;
  return 1;
}

function computeTransferImpactScore(t: TransferPortalEntry): number {
  const destTier = getSchoolTier(t.destination);
  const originTier = getSchoolTier(t.origin);
  let score = 50;
  score += (destTier - originTier) * 15;
  if (t.stars) score += (t.stars - 3) * 8;
  if (t.rating) score += (t.rating - 0.85) * 100;
  const normPos = normalizePosition(t.position);
  if (normPos === "QB" || normPos === "WR") score += 5;
  return Math.round(Math.min(100, Math.max(0, score)));
}

function computeOffensiveEnvScore(t: TransferPortalEntry): { score: number; label: string } {
  const destTier = getSchoolTier(t.destination);
  const originTier = getSchoolTier(t.origin);
  const diff = destTier - originTier;
  if (diff > 0) return { score: Math.min(100, 60 + diff * 15), label: "Upgrade" };
  if (diff < 0) return { score: Math.max(0, 40 + diff * 15), label: "Downgrade" };
  return { score: 50, label: "Lateral" };
}

function computeBreakoutProb(t: TransferPortalEntry): number {
  let prob = 20;
  if (t.stars && t.stars >= 4) prob += 25;
  else if (t.stars && t.stars >= 3) prob += 10;
  if (t.rating && t.rating >= 0.9) prob += 20;
  else if (t.rating && t.rating >= 0.85) prob += 10;
  const destTier = getSchoolTier(t.destination);
  prob += destTier * 8;
  return Math.min(95, Math.max(5, prob));
}

function computeDraftCapitalProjection(t: TransferPortalEntry): string {
  let score = 0;
  if (t.stars) score += t.stars * 15;
  if (t.rating) score += (t.rating - 0.8) * 200;
  const destTier = getSchoolTier(t.destination);
  score += destTier * 10;
  if (score >= 80) return "R1-R2";
  if (score >= 60) return "R2-R3";
  if (score >= 40) return "R3-R5";
  return "Day 3+";
}

function computeDVIReactionDelta(t: TransferPortalEntry): number {
  const destTier = getSchoolTier(t.destination);
  const originTier = getSchoolTier(t.origin);
  let delta = (destTier - originTier) * 5;
  if (t.stars && t.stars >= 4) delta += 3;
  return delta;
}

type SortField = "default" | "impact" | "breakout" | "draftCapital";

export default function TransferPortalPage() {
  usePageTitle("Transfer Portal");
  const currentSeason = getMostRecentCFBSeason();
  const [year, setYear] = useState<string>(String(currentSeason));
  const [posFilter, setPosFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [fantasyOnly, setFantasyOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortField>("default");

  const { data, isLoading, error } = useQuery<TransferData>({
    queryKey: [`/api/college/transfer-portal?year=${year}`],
    ...CACHE_TIMES.NORMAL,
  });

  const years = [currentSeason, currentSeason - 1, currentSeason - 2];

  const transfers = useMemo(() => {
    if (!data?.transfers) return [];
    let filtered = data.transfers.filter((t) => {
      const normPos = normalizePosition(t.position);
      if (posFilter !== "all" && normPos !== posFilter) return false;
      if (fantasyOnly && !FANTASY_POSITIONS.includes(normPos)) return false;
      if (searchTerm) {
        const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
        const origin = (t.origin || "").toLowerCase();
        const dest = (t.destination || "").toLowerCase();
        const term = searchTerm.toLowerCase();
        if (!fullName.includes(term) && !origin.includes(term) && !dest.includes(term)) return false;
      }
      return true;
    });

    if (sortBy === "impact") {
      filtered = [...filtered].sort((a, b) => computeTransferImpactScore(b) - computeTransferImpactScore(a));
    } else if (sortBy === "breakout") {
      filtered = [...filtered].sort((a, b) => computeBreakoutProb(b) - computeBreakoutProb(a));
    } else if (sortBy === "draftCapital") {
      filtered = [...filtered].sort((a, b) => {
        const order: Record<string, number> = { "R1-R2": 1, "R2-R3": 2, "R3-R5": 3, "Day 3+": 4 };
        return (order[computeDraftCapitalProjection(a)] || 5) - (order[computeDraftCapitalProjection(b)] || 5);
      });
    }

    return filtered;
  }, [data?.transfers, posFilter, fantasyOnly, searchTerm, sortBy]);

  const topDestinations = useMemo(() => {
    if (!transfers.length) return [];
    const counts = new Map<string, number>();
    transfers.forEach(t => {
      if (t.destination) counts.set(t.destination, (counts.get(t.destination) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transfers]);

  return (
    <PremiumGate featureName="Transfer Portal">
      <div className="space-y-6 min-w-0 overflow-x-hidden" data-testid="transfer-portal-page">
        <div className="relative overflow-hidden rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/40 via-stone-950/80 to-stone-950/60 p-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-700/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-700/20 border border-amber-700/30 flex items-center justify-center">
                <ArrowLeftRight className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-amber-100" data-testid="text-portal-title">
                  Transfer Portal
                </h1>
                <p className="text-sm text-amber-200/60">
                  {year} transfers - {transfers.length} players
                </p>
              </div>
            </div>
            <ExportButton
              data={transfers.map((t, i) => ({
                "#": i + 1,
                Player: `${t.firstName} ${t.lastName}`,
                Position: t.position,
                From: t.origin,
                To: t.destination || "Undecided",
                Stars: t.stars || "-",
                Rating: t.rating || "-",
                "Impact Score": computeTransferImpactScore(t),
                "Breakout %": computeBreakoutProb(t),
                "Draft Capital": computeDraftCapitalProjection(t),
                Date: t.transferDate ? new Date(t.transferDate).toLocaleDateString() : "-",
              }))}
              filename={`transfer-portal-${year}`}
              shareText={`Transfer Portal ${year} - ${transfers.length} transfers`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap" data-testid="portal-filters">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]" data-testid="select-portal-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={posFilter} onValueChange={setPosFilter}>
            <SelectTrigger className="w-[100px]" data-testid="select-portal-position">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pos</SelectItem>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={fantasyOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFantasyOnly(!fantasyOnly)}
            className="gap-1.5 toggle-elevate"
            data-testid="button-fantasy-only"
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Fantasy Only
          </Button>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortField)}>
            <SelectTrigger className="w-[140px]" data-testid="select-sort-by">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="impact">Impact Score</SelectItem>
              <SelectItem value="breakout">Breakout Prob</SelectItem>
              <SelectItem value="draftCapital">Draft Capital</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search player or school..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-[200px]"
              data-testid="input-portal-search"
            />
          </div>
        </div>

        {topDestinations.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap" data-testid="top-destinations">
            <span className="text-xs text-muted-foreground">Top Destinations:</span>
            {topDestinations.map(([school, count]) => (
              <Badge key={school} variant="outline" className="text-xs gap-1" data-testid={`badge-dest-${school}`}>
                {school} <span className="text-amber-400">{count}</span>
              </Badge>
            ))}
          </div>
        )}

        <Card className="border-amber-800/20 bg-stone-950/60" data-testid="card-transfers">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-amber-100 flex items-center gap-2" data-testid="text-transfers-title">
              <ArrowLeftRight className="h-5 w-5 text-amber-500" />
              Transfers
              {transfers.length > 0 && <Badge variant="secondary">{transfers.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-muted-foreground" data-testid="text-portal-error">
                Failed to load transfer portal data. The CFBD API may be unavailable.
              </div>
            ) : transfers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground" data-testid="text-no-transfers">
                No transfers match the selected filters
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full" data-testid="table-transfers">
                    <thead className="border-b border-amber-800/20">
                      <tr className="text-left text-sm text-amber-200/50">
                        <th className="p-3 w-12">#</th>
                        <th className="p-3">Player</th>
                        <th className="p-3 w-16">Pos</th>
                        <th className="p-3">From</th>
                        <th className="p-3 w-8"></th>
                        <th className="p-3">To</th>
                        <th className="p-3 w-16 text-center">Stars</th>
                        <th className="p-3 w-20 text-center">Impact</th>
                        <th className="p-3 w-16 text-center">Env</th>
                        <th className="p-3 w-20 text-center">Breakout</th>
                        <th className="p-3 w-20 text-center">Draft</th>
                        <th className="p-3 w-16 text-center">DVI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.slice(0, 100).map((t, i) => {
                        const normPos = normalizePosition(t.position);
                        const isFantasyRelevant = FANTASY_POSITIONS.includes(normPos);
                        const impactScore = computeTransferImpactScore(t);
                        const envScore = computeOffensiveEnvScore(t);
                        const breakoutProb = computeBreakoutProb(t);
                        const draftCap = computeDraftCapitalProjection(t);
                        const dviDelta = computeDVIReactionDelta(t);
                        return (
                          <tr
                            key={`${t.firstName}-${t.lastName}-${t.origin}-${i}`}
                            className={`${i % 2 === 0 ? "bg-amber-900/5" : ""} ${isFantasyRelevant ? "" : "opacity-60"}`}
                            data-testid={`row-transfer-${i}`}
                          >
                            <td className="p-3 text-muted-foreground">{i + 1}</td>
                            <td className="p-3 font-medium">{t.firstName} {t.lastName}</td>
                            <td className="p-3">
                              <Badge variant="outline" className={`text-xs ${getPositionColorClass(normPos)}`}>
                                {t.position}
                              </Badge>
                            </td>
                            <td className="p-3 text-sm">{t.origin}</td>
                            <td className="p-3"><ArrowRight className="h-3.5 w-3.5 text-amber-500" /></td>
                            <td className="p-3 text-sm font-medium">{t.destination || <span className="text-muted-foreground italic">Undecided</span>}</td>
                            <td className="p-3 text-center">
                              {t.stars ? (
                                <div className="flex items-center justify-center gap-0.5">
                                  {Array.from({ length: t.stars }).map((_, si) => (
                                    <Star key={si} className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  ))}
                                </div>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </td>
                            <td className="p-3 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`text-sm font-bold ${impactScore >= 70 ? "text-green-400" : impactScore >= 45 ? "text-amber-400" : "text-red-400"}`}>
                                    {impactScore}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Transfer Impact Score (0-100)</TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${envScore.label === "Upgrade" ? "text-green-400 border-green-600/30" : envScore.label === "Downgrade" ? "text-red-400 border-red-600/30" : "text-amber-400 border-amber-600/30"}`}
                              >
                                {envScore.label === "Upgrade" && <TrendingUp className="h-2.5 w-2.5 mr-0.5" />}
                                {envScore.label === "Downgrade" && <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                                {envScore.label}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`text-sm font-medium ${breakoutProb >= 50 ? "text-green-400" : breakoutProb >= 30 ? "text-amber-400" : "text-muted-foreground"}`}>
                                {breakoutProb}%
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="secondary" className="text-[10px]">{draftCap}</Badge>
                            </td>
                            <td className="p-3 text-center">
                              {dviDelta !== 0 ? (
                                <span className={`text-sm font-medium ${dviDelta > 0 ? "text-green-400" : "text-red-400"}`}>
                                  {dviDelta > 0 ? "+" : ""}{dviDelta}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden p-3 space-y-2" data-testid="mobile-transfers">
                  {transfers.slice(0, 50).map((t, i) => {
                    const normPos = normalizePosition(t.position);
                    const isFantasyRelevant = FANTASY_POSITIONS.includes(normPos);
                    const impactScore = computeTransferImpactScore(t);
                    const envScore = computeOffensiveEnvScore(t);
                    const breakoutProb = computeBreakoutProb(t);
                    const draftCap = computeDraftCapitalProjection(t);
                    const dviDelta = computeDVIReactionDelta(t);
                    return (
                      <div
                        key={`${t.firstName}-${t.lastName}-${t.origin}-${i}`}
                        className={`p-3 rounded-lg bg-amber-900/10 border border-amber-800/15 ${isFantasyRelevant ? "" : "opacity-60"}`}
                        data-testid={`card-transfer-${i}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className={`text-xs shrink-0 ${getPositionColorClass(normPos)}`}>
                              {t.position}
                            </Badge>
                            <span className="font-semibold truncate">{t.firstName} {t.lastName}</span>
                          </div>
                          <span className={`text-sm font-bold shrink-0 ${impactScore >= 70 ? "text-green-400" : impactScore >= 45 ? "text-amber-400" : "text-red-400"}`}>
                            {impactScore}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm mb-1.5">
                          <span className="text-muted-foreground">{t.origin}</span>
                          <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="font-medium">{t.destination || <span className="text-muted-foreground italic">TBD</span>}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {t.stars && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              {Array.from({ length: t.stars }).map((_, si) => (
                                <Star key={si} className="h-3 w-3 fill-amber-400 text-amber-400" />
                              ))}
                            </div>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${envScore.label === "Upgrade" ? "text-green-400 border-green-600/30" : envScore.label === "Downgrade" ? "text-red-400 border-red-600/30" : "text-amber-400 border-amber-600/30"}`}
                          >
                            {envScore.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Breakout: <span className="font-medium text-foreground">{breakoutProb}%</span></span>
                          <Badge variant="secondary" className="text-[10px]">{draftCap}</Badge>
                          {dviDelta !== 0 && (
                            <span className={`text-xs font-medium ${dviDelta > 0 ? "text-green-400" : "text-red-400"}`}>
                              DVI {dviDelta > 0 ? "+" : ""}{dviDelta}
                            </span>
                          )}
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
