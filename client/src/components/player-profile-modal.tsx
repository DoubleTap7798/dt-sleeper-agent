import { useState, useMemo } from "react";
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
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Shield,
  Target,
  Zap,
  BarChart3,
  Activity,
  MapPin,
  GraduationCap,
  AlertTriangle,
  LineChart,
  ChevronUp,
  ChevronDown,
  Flame,
  Thermometer,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { getNFLTeamLogo } from "@/lib/team-logos";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Bar,
} from "recharts";

interface PlayerProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  playerName: string;
  position?: string;
  team?: string;
}

interface DynastyCardResponse {
  playerId: string;
  name: string;
  position: string;
  age: number;
  team: string;
  yearsExp: number;
  dynastySnapshot: {
    dynastyScore: number;
    tier: string;
    tierRank: number;
    positionalRank: number;
    ageCurveIndicator: 'ascending' | 'peak' | 'declining' | 'twilight';
    threeYearOutlook: string;
    contenderGrade: string;
    rebuildGrade: string;
    archetypeCluster: string;
    dynastyValue: number;
    injuryRiskScore: number;
    longevityScore: number;
    productionTrajectory: string;
  };
  multiSeasonStats: Record<string, {
    gp: number;
    pts: number;
    ppg: number;
    pass_yd: number;
    pass_td: number;
    pass_int: number;
    rush_yd: number;
    rush_td: number;
    rush_att: number;
    rec: number;
    rec_yd: number;
    rec_td: number;
    rec_tgt: number;
    fum_lost: number;
    snp: number;
    tm_snp: number;
    snp_pct: number;
    rz_tgt: number;
    rz_att: number;
  }>;
  careerAggregates: {
    gp: number;
    pts: number;
    ppg: number;
    threeYearAvgPPG: number;
  };
  trendData: {
    ppg: { season: number; value: number }[];
    targets: { season: number; value: number }[];
    redZoneUsage: { season: number; value: number }[];
    snapPct: { season: number; value: number }[];
  };
  contractTeamContext: {
    team: string;
    depthChartOrder: number | null;
    depthChartPosition: string | null;
    injuryStatus: string | null;
    contractYear: boolean;
    number: string | null;
    height: string | null;
    weight: string | null;
    college: string | null;
  };
  projection: {
    year1: { ppg: number; totalPoints: number; confidenceLow: number; confidenceHigh: number };
    year2: { ppg: number; totalPoints: number; confidenceLow: number; confidenceHigh: number };
    year3: { ppg: number; totalPoints: number; confidenceLow: number; confidenceHigh: number };
    trajectory: 'ascending' | 'stable' | 'declining';
  };
  distribution: {
    median: number;
    floor: number;
    ceiling: number;
    mean: number;
    stdDev: number;
    coefficientOfVariation: number;
  };
  ufasComponents: Record<string, number>;
  dnpv: {
    dnpv: number;
    annualizedValue: number;
    peakYearValue: number;
  };
}

interface MarketPsychologyData {
  playerId: string;
  playerName: string | null;
  position: string | null;
  team: string | null;
  sentimentScore: number;
  hypeVelocity: number;
  demandIndex: number;
  supplyIndex: number;
  hypePremiumPct: number;
  adjustedMarketValue: number;
  baseDynastyValue: number;
  marketHeatLevel: string;
}

const HEAT_CONFIG: Record<string, { icon: any; label: string; color: string; badgeClass: string }> = {
  HOT: { icon: Flame, label: "Hot", color: "text-red-500 dark:text-red-400", badgeClass: "bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/30" },
  HEATING: { icon: TrendingUp, label: "Heating", color: "text-amber-500 dark:text-amber-400", badgeClass: "bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/30" },
  NEUTRAL: { icon: Thermometer, label: "Neutral", color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-border" },
  COLD: { icon: TrendingDown, label: "Cold", color: "text-blue-500 dark:text-blue-400", badgeClass: "bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/30" },
};

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-red-500/20 text-red-400 dark:text-red-300 border-red-500/30",
  RB: "bg-green-500/20 text-green-400 dark:text-green-300 border-green-500/30",
  WR: "bg-blue-500/20 text-blue-400 dark:text-blue-300 border-blue-500/30",
  TE: "bg-orange-500/20 text-orange-400 dark:text-orange-300 border-orange-500/30",
};

const OUTLOOK_COLORS: Record<string, string> = {
  'A+': "text-green-400",
  'A': "text-green-400",
  'B+': "text-amber-400",
  'B': "text-amber-400",
  'B-': "text-amber-500",
  'C+': "text-orange-400",
  'C': "text-orange-400",
  'C-': "text-orange-500",
  'D': "text-red-400",
  'F': "text-red-500",
};

const GRADE_COLORS: Record<string, string> = {
  'A+': "text-green-400 bg-green-500/10 border-green-500/30",
  'A': "text-green-400 bg-green-500/10 border-green-500/30",
  'B+': "text-amber-400 bg-amber-500/10 border-amber-500/30",
  'B': "text-amber-400 bg-amber-500/10 border-amber-500/30",
  'B-': "text-amber-500 bg-amber-500/10 border-amber-500/30",
  'C+': "text-orange-400 bg-orange-500/10 border-orange-500/30",
  'C': "text-orange-400 bg-orange-500/10 border-orange-500/30",
  'C-': "text-orange-500 bg-orange-500/10 border-orange-500/30",
  'D': "text-red-400 bg-red-500/10 border-red-500/30",
  'F': "text-red-500 bg-red-500/10 border-red-500/30",
};

const CURVE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  ascending: { icon: TrendingUp, label: "Ascending", color: "text-green-400" },
  peak: { icon: Crown, label: "Peak", color: "text-amber-400" },
  declining: { icon: TrendingDown, label: "Declining", color: "text-red-400" },
  twilight: { icon: ChevronDown, label: "Twilight", color: "text-red-500" },
};

function getSeasonStatColumns(pos: string) {
  const p = pos?.toUpperCase() || "WR";
  if (p === "QB") return [
    { key: "pass_yd", label: "PaY" },
    { key: "pass_td", label: "PaTD" },
    { key: "pass_int", label: "INT" },
    { key: "rush_yd", label: "RuY" },
  ];
  if (p === "RB") return [
    { key: "rush_yd", label: "RuY" },
    { key: "rush_td", label: "RuTD" },
    { key: "rec", label: "Rec" },
    { key: "rec_yd", label: "ReY" },
  ];
  if (p === "TE") return [
    { key: "rec", label: "Rec" },
    { key: "rec_yd", label: "ReY" },
    { key: "rec_td", label: "ReTD" },
    { key: "rec_tgt", label: "Tgt" },
  ];
  return [
    { key: "rec", label: "Rec" },
    { key: "rec_yd", label: "ReY" },
    { key: "rec_td", label: "ReTD" },
    { key: "rec_tgt", label: "Tgt" },
  ];
}

export function PlayerProfileModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  position = "",
  team = "",
}: PlayerProfileModalProps) {
  const { data: card, isLoading, error } = useQuery<DynastyCardResponse>({
    queryKey: ["/api/engine/v3/player-card", playerId],
    queryFn: async () => {
      const res = await fetch(`/api/engine/v3/player-card/${playerId}`);
      if (!res.ok) throw new Error("Failed to fetch player card");
      return res.json();
    },
    enabled: open && !!playerId,
    staleTime: 5 * 60 * 1000,
  });

  const displayPosition = card?.position || position;
  const displayTeam = card?.team || team;
  const displayName = card?.name || playerName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-hidden" data-testid="player-profile-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={getNFLTeamLogo(displayTeam) || undefined} alt={displayTeam} />
              <AvatarFallback className="text-lg">
                {(displayTeam || "??").slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg truncate" data-testid="text-player-name">
                  {displayName}
                </span>
                {card?.contractTeamContext?.number && (
                  <Badge variant="outline" className="shrink-0">#{card.contractTeamContext.number}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Badge variant="outline" className={`text-xs ${POSITION_COLORS[displayPosition?.toUpperCase()] || ""}`} data-testid="badge-position">
                  {displayPosition}
                </Badge>
                <span>{displayTeam}</span>
                {card?.contractTeamContext?.injuryStatus && (
                  <Badge variant="secondary" className="text-xs">{card.contractTeamContext.injuryStatus}</Badge>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-muted-foreground" data-testid="error-message">
            Unable to load player data. Please try again.
          </div>
        ) : card ? (
          <div className="space-y-3 overflow-hidden">
            <DynastySnapshotHeader card={card} />
            <DynastyTabs card={card} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DynastySnapshotHeader({ card }: { card: DynastyCardResponse }) {
  const snap = card.dynastySnapshot;
  const curveConfig = CURVE_CONFIG[snap.ageCurveIndicator] || CURVE_CONFIG.peak;
  const CurveIcon = curveConfig.icon;

  return (
    <Card className="p-3 border-amber-500/20" data-testid="dynasty-snapshot">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-center" data-testid="dynasty-score-display">
            <div className="text-3xl font-bold text-amber-400">{Math.round(snap.dynastyScore)}</div>
            <div className="text-[10px] text-muted-foreground">Dynasty Score</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={`text-xs ${POSITION_COLORS[card.position?.toUpperCase()] || ""}`} data-testid="badge-pos-rank">
                {card.position}{snap.positionalRank}
              </Badge>
              <div className={`flex items-center gap-0.5 text-xs ${curveConfig.color}`} data-testid="age-curve-indicator">
                <CurveIcon className="h-3 w-3" />
                <span>{curveConfig.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground">3Y Outlook:</span>
              <span className={`text-xs font-bold ${OUTLOOK_COLORS[snap.threeYearOutlook] || "text-muted-foreground"}`} data-testid="text-outlook">
                {snap.threeYearOutlook}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="text-center" data-testid="contender-grade">
            <Badge variant="outline" className={`text-xs ${GRADE_COLORS[snap.contenderGrade] || ""}`}>
              {snap.contenderGrade}
            </Badge>
            <div className="text-[10px] text-muted-foreground mt-0.5">Contender</div>
          </div>
          <div className="text-center" data-testid="rebuild-grade">
            <Badge variant="outline" className={`text-xs ${GRADE_COLORS[snap.rebuildGrade] || ""}`}>
              {snap.rebuildGrade}
            </Badge>
            <div className="text-[10px] text-muted-foreground mt-0.5">Rebuild</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DynastyTabs({ card }: { card: DynastyCardResponse }) {
  const [activeTab, setActiveTab] = useState("overview");

  const seasons = Object.keys(card.multiSeasonStats).sort();

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full gap-1" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }} data-testid="dynasty-tabs">
        <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview">
          <Crown className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Overview</span>
        </TabsTrigger>
        <TabsTrigger value="stats" className="text-xs" data-testid="tab-stats">
          <BarChart3 className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Stats</span>
        </TabsTrigger>
        <TabsTrigger value="trends" className="text-xs" data-testid="tab-trends">
          <Activity className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Trends</span>
        </TabsTrigger>
        <TabsTrigger value="projection" className="text-xs" data-testid="tab-projection">
          <LineChart className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Projection</span>
        </TabsTrigger>
        <TabsTrigger value="market" className="text-xs" data-testid="tab-market">
          <Flame className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Market</span>
        </TabsTrigger>
        <TabsTrigger value="context" className="text-xs" data-testid="tab-context">
          <MapPin className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Context</span>
        </TabsTrigger>
      </TabsList>

      <div className="h-[370px] mt-3 overflow-y-auto">
        <TabsContent value="overview" className="mt-0">
          <OverviewTab card={card} />
        </TabsContent>
        <TabsContent value="stats" className="mt-0">
          <StatsTab card={card} seasons={seasons} />
        </TabsContent>
        <TabsContent value="trends" className="mt-0">
          <TrendsTab card={card} />
        </TabsContent>
        <TabsContent value="projection" className="mt-0">
          <ProjectionTab card={card} />
        </TabsContent>
        <TabsContent value="market" className="mt-0">
          <MarketPsychologyTab playerId={card.playerId} />
        </TabsContent>
        <TabsContent value="context" className="mt-0">
          <ContextTab card={card} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

function OverviewTab({ card }: { card: DynastyCardResponse }) {
  const snap = card.dynastySnapshot;
  const dist = card.distribution;
  const dnpv = card.dnpv;
  const comps = card.ufasComponents || {};

  const componentEntries = Object.entries(comps).filter(([, v]) => typeof v === "number" && !isNaN(v));

  return (
    <div className="space-y-3" data-testid="overview-tab">
      <Card className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Shield className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Dynasty Asset Grades</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <GradeRow label="Dynasty Value" value={(snap.dynastyValue / 1000).toFixed(1) + "k"} />
          <GradeRow label="DNPV" value={(dnpv.dnpv / 1000).toFixed(1) + "k"} />
          <GradeRow label="Injury Risk" value={Math.round(snap.injuryRiskScore * 100) + "%"} color={snap.injuryRiskScore > 0.5 ? "text-red-400" : "text-green-400"} />
          <GradeRow label="Longevity" value={Math.round(snap.longevityScore * 100) + "%"} color={snap.longevityScore > 0.6 ? "text-green-400" : "text-amber-400"} />
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Distribution</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-xs font-mono text-red-400" data-testid="dist-floor">{dist.floor?.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">Floor</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-mono text-amber-400" data-testid="dist-median">{dist.median?.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">Median</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-mono text-green-400" data-testid="dist-ceiling">{dist.ceiling?.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">Ceiling</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-mono" data-testid="dist-cv">{dist.coefficientOfVariation?.toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground">CV</div>
          </div>
        </div>
      </Card>

      {componentEntries.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold">UFAS Components</span>
          </div>
          <div className="space-y-1.5">
            {componentEntries.map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-24 text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</div>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${(val as number) >= 70 ? "bg-green-500" : (val as number) >= 45 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min((val as number), 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-8 text-right">{Math.round(val as number)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function GradeRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${color || ""}`}>{value}</span>
    </div>
  );
}

function StatsTab({ card, seasons }: { card: DynastyCardResponse; seasons: string[] }) {
  const [selectedView, setSelectedView] = useState<string>("all");
  const cols = getSeasonStatColumns(card.position);
  const career = card.careerAggregates;

  const viewOptions = ["all", ...seasons, "career", "3y-avg"];

  return (
    <div className="space-y-3" data-testid="stats-tab">
      <div className="flex flex-wrap gap-1" data-testid="stats-season-selector">
        {viewOptions.map(v => (
          <Button
            key={v}
            variant={selectedView === v ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedView(v)}
            data-testid={`stats-btn-${v}`}
          >
            {v === "all" ? "All" : v === "career" ? "Career" : v === "3y-avg" ? "3Y Avg" : v}
          </Button>
        ))}
      </div>

      {selectedView === "all" ? (
        <Card className="p-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs px-1.5 w-12">Year</TableHead>
                  <TableHead className="text-xs px-1.5 w-8">GP</TableHead>
                  <TableHead className="text-right text-xs px-1.5">PPG</TableHead>
                  {cols.map(c => (
                    <TableHead key={c.key} className="text-right text-xs px-1.5">{c.label}</TableHead>
                  ))}
                  <TableHead className="text-right text-xs px-1.5">Snap%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasons.map(yr => {
                  const s = card.multiSeasonStats[yr];
                  if (!s) return null;
                  return (
                    <TableRow key={yr}>
                      <TableCell className="font-medium text-xs px-1.5">{yr}</TableCell>
                      <TableCell className="text-xs px-1.5">{s.gp}</TableCell>
                      <TableCell className="text-right text-xs px-1.5 font-semibold text-amber-400">{s.ppg.toFixed(1)}</TableCell>
                      {cols.map(c => (
                        <TableCell key={c.key} className="text-right text-xs px-1.5">
                          {formatNum((s as any)[c.key])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-xs px-1.5">{s.snp_pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold text-xs px-1.5">Career</TableCell>
                  <TableCell className="text-xs px-1.5 font-semibold">{career.gp}</TableCell>
                  <TableCell className="text-right text-xs px-1.5 font-bold text-amber-400">{career.ppg.toFixed(1)}</TableCell>
                  {cols.map(c => {
                    const total = seasons.reduce((sum, yr) => sum + ((card.multiSeasonStats[yr] as any)?.[c.key] || 0), 0);
                    return (
                      <TableCell key={c.key} className="text-right text-xs px-1.5 font-semibold">{formatNum(total)}</TableCell>
                    );
                  })}
                  <TableCell className="text-right text-xs px-1.5">-</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : selectedView === "career" ? (
        <CareerSummary card={card} cols={cols} />
      ) : selectedView === "3y-avg" ? (
        <ThreeYearAvgView card={card} />
      ) : (
        <SingleSeasonView card={card} season={selectedView} cols={cols} />
      )}
    </div>
  );
}

function CareerSummary({ card, cols }: { card: DynastyCardResponse; cols: { key: string; label: string }[] }) {
  const career = card.careerAggregates;
  const seasons = Object.keys(card.multiSeasonStats);

  return (
    <Card className="p-4" data-testid="career-summary">
      <h4 className="font-semibold mb-3 text-sm">Career Summary</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBlock label="Games" value={String(career.gp)} />
        <StatBlock label="Total Pts" value={career.pts.toFixed(0)} />
        <StatBlock label="Career PPG" value={career.ppg.toFixed(1)} highlight />
        <StatBlock label="3Y Avg PPG" value={career.threeYearAvgPPG.toFixed(1)} highlight />
        {cols.map(c => {
          const total = seasons.reduce((sum, yr) => sum + ((card.multiSeasonStats[yr] as any)?.[c.key] || 0), 0);
          return <StatBlock key={c.key} label={c.label} value={formatNum(total)} />;
        })}
      </div>
    </Card>
  );
}

function ThreeYearAvgView({ card }: { card: DynastyCardResponse }) {
  const seasons = Object.keys(card.multiSeasonStats).sort().slice(-3);
  const cols = getSeasonStatColumns(card.position);

  const avgStats: Record<string, number> = {};
  let totalGP = 0;
  let totalPts = 0;

  for (const yr of seasons) {
    const s = card.multiSeasonStats[yr];
    if (!s) continue;
    totalGP += s.gp;
    totalPts += s.pts;
    for (const c of cols) {
      avgStats[c.key] = (avgStats[c.key] || 0) + ((s as any)[c.key] || 0);
    }
  }

  const avgGP = seasons.length > 0 ? Math.round(totalGP / seasons.length) : 0;

  return (
    <Card className="p-4" data-testid="three-year-avg">
      <h4 className="font-semibold mb-3 text-sm">3-Year Average ({seasons.join(", ")})</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBlock label="Avg GP/yr" value={String(avgGP)} />
        <StatBlock label="3Y Avg PPG" value={card.careerAggregates.threeYearAvgPPG.toFixed(1)} highlight />
        {cols.map(c => {
          const avg = seasons.length > 0 ? Math.round((avgStats[c.key] || 0) / seasons.length) : 0;
          return <StatBlock key={c.key} label={`Avg ${c.label}`} value={formatNum(avg)} />;
        })}
      </div>
    </Card>
  );
}

function SingleSeasonView({ card, season, cols }: { card: DynastyCardResponse; season: string; cols: { key: string; label: string }[] }) {
  const s = card.multiSeasonStats[season];
  if (!s) return <div className="text-center text-muted-foreground py-8">No data for {season}</div>;

  return (
    <Card className="p-4" data-testid={`season-view-${season}`}>
      <h4 className="font-semibold mb-3 text-sm">{season} Season</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBlock label="Games" value={String(s.gp)} />
        <StatBlock label="Total Pts" value={s.pts.toFixed(0)} />
        <StatBlock label="PPG" value={s.ppg.toFixed(1)} highlight />
        <StatBlock label="Snap%" value={s.snp_pct.toFixed(1) + "%"} />
        {cols.map(c => (
          <StatBlock key={c.key} label={c.label} value={formatNum((s as any)[c.key])} />
        ))}
        <StatBlock label="RZ Targets" value={String(s.rz_tgt)} />
        <StatBlock label="RZ Attempts" value={String(s.rz_att)} />
        <StatBlock label="Fumbles Lost" value={String(s.fum_lost)} />
      </div>
    </Card>
  );
}

function StatBlock({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-amber-400" : ""}`}>{value}</p>
    </div>
  );
}

function TrendsTab({ card }: { card: DynastyCardResponse }) {
  const [metric, setMetric] = useState<"ppg" | "targets" | "redZoneUsage" | "snapPct">("ppg");

  const chartData = useMemo(() => {
    const trend = card.trendData[metric] || [];
    return trend.map(t => ({ season: String(t.season), value: t.value }));
  }, [card.trendData, metric]);

  const metricLabels: Record<string, string> = {
    ppg: "PPG (PPR)",
    targets: "Targets",
    redZoneUsage: "Red Zone Usage",
    snapPct: "Snap %",
  };

  const metricColors: Record<string, string> = {
    ppg: "#d4a040",
    targets: "#3b82f6",
    redZoneUsage: "#ef4444",
    snapPct: "#22c55e",
  };

  return (
    <div className="space-y-3" data-testid="trends-tab">
      <div className="flex flex-wrap gap-1">
        {(["ppg", "targets", "redZoneUsage", "snapPct"] as const).map(m => (
          <Button
            key={m}
            variant={metric === m ? "default" : "outline"}
            size="sm"
            onClick={() => setMetric(m)}
            data-testid={`trend-btn-${m}`}
          >
            {metricLabels[m]}
          </Button>
        ))}
      </div>

      <Card className="p-3">
        <h4 className="font-semibold mb-2 text-sm">{metricLabels[metric]} Trend</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.15)" />
              <XAxis dataKey="season" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground) / 0.5)" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground) / 0.5)" width={40} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" fill={metricColors[metric]} opacity={0.3} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="value" stroke={metricColors[metric]} strokeWidth={2} dot={{ fill: metricColors[metric], r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-3">
        <h4 className="font-semibold mb-2 text-sm">All Trends Summary</h4>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs px-1.5">Season</TableHead>
                <TableHead className="text-right text-xs px-1.5">PPG</TableHead>
                <TableHead className="text-right text-xs px-1.5">Tgt</TableHead>
                <TableHead className="text-right text-xs px-1.5">RZ</TableHead>
                <TableHead className="text-right text-xs px-1.5">Snap%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {card.trendData.ppg.map((t, i) => (
                <TableRow key={t.season}>
                  <TableCell className="font-medium text-xs px-1.5">{t.season}</TableCell>
                  <TableCell className="text-right text-xs px-1.5 text-amber-400 font-semibold">{t.value.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-xs px-1.5">{card.trendData.targets[i]?.value || 0}</TableCell>
                  <TableCell className="text-right text-xs px-1.5">{card.trendData.redZoneUsage[i]?.value || 0}</TableCell>
                  <TableCell className="text-right text-xs px-1.5">{card.trendData.snapPct[i]?.value.toFixed(1) || 0}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function ProjectionTab({ card }: { card: DynastyCardResponse }) {
  const proj = card.projection;
  const currentYear = new Date().getFullYear();

  const trajectoryConfig: Record<string, { icon: any; label: string; color: string }> = {
    ascending: { icon: TrendingUp, label: "Ascending", color: "text-green-400" },
    stable: { icon: Minus, label: "Stable", color: "text-amber-400" },
    declining: { icon: TrendingDown, label: "Declining", color: "text-red-400" },
  };

  const traj = trajectoryConfig[proj.trajectory] || trajectoryConfig.stable;
  const TrajIcon = traj.icon;

  const chartData = [
    {
      year: `${currentYear + 1}`,
      ppg: proj.year1.ppg,
      low: proj.year1.confidenceLow,
      high: proj.year1.confidenceHigh,
      range: [proj.year1.confidenceLow, proj.year1.confidenceHigh],
    },
    {
      year: `${currentYear + 2}`,
      ppg: proj.year2.ppg,
      low: proj.year2.confidenceLow,
      high: proj.year2.confidenceHigh,
      range: [proj.year2.confidenceLow, proj.year2.confidenceHigh],
    },
    {
      year: `${currentYear + 3}`,
      ppg: proj.year3.ppg,
      low: proj.year3.confidenceLow,
      high: proj.year3.confidenceHigh,
      range: [proj.year3.confidenceLow, proj.year3.confidenceHigh],
    },
  ];

  return (
    <div className="space-y-3" data-testid="projection-tab">
      <Card className="p-3 border-amber-500/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <LineChart className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold">3-Year Forecast</span>
          </div>
          <div className={`flex items-center gap-1 text-xs ${traj.color}`} data-testid="trajectory-indicator">
            <TrajIcon className="h-3 w-3" />
            <span className="font-semibold">{traj.label}</span>
          </div>
        </div>

        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.15)" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground) / 0.5)" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground) / 0.5)" width={40} domain={['auto', 'auto']} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                formatter={(value: any, name: string) => {
                  if (name === "ppg") return [`${value.toFixed(1)} PPG`, "Projected"];
                  if (name === "range") return [`${value[0].toFixed(1)} - ${value[1].toFixed(1)}`, "Confidence"];
                  return [value, name];
                }}
              />
              <Area
                type="monotone"
                dataKey="range"
                fill="#d4a040"
                fillOpacity={0.1}
                stroke="none"
              />
              <Line type="monotone" dataKey="ppg" stroke="#d4a040" strokeWidth={3} dot={{ fill: "#d4a040", r: 5, stroke: "#000", strokeWidth: 1 }} />
              <Line type="monotone" dataKey="high" stroke="#22c55e" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="low" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              <Legend
                wrapperStyle={{ fontSize: "10px" }}
                formatter={(value: string) => {
                  if (value === "ppg") return "Projected PPG";
                  if (value === "high") return "Ceiling";
                  if (value === "low") return "Floor";
                  return value;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-3">
        <h4 className="font-semibold mb-2 text-sm">Year-by-Year Projections</h4>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs px-1.5">Year</TableHead>
                <TableHead className="text-right text-xs px-1.5">PPG</TableHead>
                <TableHead className="text-right text-xs px-1.5">Total Pts</TableHead>
                <TableHead className="text-right text-xs px-1.5">Floor</TableHead>
                <TableHead className="text-right text-xs px-1.5">Ceiling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: `Y1 (${currentYear + 1})`, data: proj.year1 },
                { label: `Y2 (${currentYear + 2})`, data: proj.year2 },
                { label: `Y3 (${currentYear + 3})`, data: proj.year3 },
              ].map(row => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium text-xs px-1.5">{row.label}</TableCell>
                  <TableCell className="text-right text-xs px-1.5 font-bold text-amber-400">{row.data.ppg.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-xs px-1.5">{row.data.totalPoints.toFixed(0)}</TableCell>
                  <TableCell className="text-right text-xs px-1.5 text-red-400">{row.data.confidenceLow.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-xs px-1.5 text-green-400">{row.data.confidenceHigh.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function ContextTab({ card }: { card: DynastyCardResponse }) {
  const ctx = card.contractTeamContext;

  const contextItems = [
    { icon: MapPin, label: "Team", value: ctx.team || "Free Agent" },
    { icon: Target, label: "Depth Chart", value: ctx.depthChartPosition ? `${ctx.depthChartPosition}${ctx.depthChartOrder ? ` #${ctx.depthChartOrder}` : ""}` : null },
    { icon: GraduationCap, label: "College", value: ctx.college },
    { icon: Activity, label: "Height", value: ctx.height },
    { icon: Activity, label: "Weight", value: ctx.weight ? `${ctx.weight} lbs` : null },
    { icon: AlertTriangle, label: "Injury Status", value: ctx.injuryStatus || "Healthy" },
  ].filter(item => item.value);

  return (
    <div className="space-y-3" data-testid="context-tab">
      <Card className="p-3">
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Team & Contract Context</span>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={getNFLTeamLogo(ctx.team) || undefined} alt={ctx.team} />
            <AvatarFallback>{(ctx.team || "FA").slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold text-sm">{ctx.team || "Free Agent"}</div>
            <div className="text-xs text-muted-foreground">
              {card.age} years old
              {card.yearsExp > 0 && ` | ${card.yearsExp} yrs exp`}
            </div>
          </div>
          {ctx.contractYear && (
            <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/30 ml-auto" data-testid="badge-contract-year">
              Contract Year
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {contextItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/30">
              <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{item.label}:</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <ChevronUp className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Dynasty Profile</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Archetype</span>
            <span className="font-medium capitalize">{card.dynastySnapshot.archetypeCluster?.replace(/_/g, " ") || "Unknown"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tier</span>
            <span className="font-medium">{card.dynastySnapshot.tier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Trajectory</span>
            <span className="font-medium capitalize">{card.dynastySnapshot.productionTrajectory || "Unknown"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">DNPV (Ann.)</span>
            <span className="font-mono font-medium">{(card.dnpv.annualizedValue / 1000).toFixed(1)}k</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MarketPsychologyTab({ playerId }: { playerId: string }) {
  const { data: metrics, isLoading } = useQuery<MarketPsychologyData>({
    queryKey: ["/api/market-psychology", playerId],
    queryFn: async () => {
      const res = await fetch(`/api/market-psychology/${playerId}`);
      if (!res.ok) throw new Error("Failed to fetch market data");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="market-tab-loading">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm" data-testid="market-tab-empty">
        No market psychology data available for this player.
      </div>
    );
  }

  const heatCfg = HEAT_CONFIG[metrics.marketHeatLevel] || HEAT_CONFIG.NEUTRAL;
  const HeatIcon = heatCfg.icon;

  const premiumLabel = metrics.hypePremiumPct > 0.15
    ? "Overhyped"
    : metrics.hypePremiumPct < -0.10
      ? "Discount"
      : "Fair";
  const premiumColor = metrics.hypePremiumPct > 0.15
    ? "text-red-500 dark:text-red-400"
    : metrics.hypePremiumPct < -0.10
      ? "text-green-500 dark:text-green-400"
      : "text-muted-foreground";

  return (
    <div className="space-y-3" data-testid="market-tab">
      <Card className="p-3" data-testid="market-heat-card">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold">Market Psychology</span>
          </div>
          <Badge variant="outline" className={`text-xs ${heatCfg.badgeClass}`} data-testid="badge-market-heat">
            <HeatIcon className="h-3 w-3 mr-1" />
            {heatCfg.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="text-center" data-testid="market-adjusted-value">
            <div className="text-2xl font-bold text-amber-400">{Math.round(metrics.adjustedMarketValue).toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">Adjusted Market Value</div>
          </div>
          <div className="text-center" data-testid="market-hype-premium">
            <div className={`text-2xl font-bold ${premiumColor}`}>
              {metrics.hypePremiumPct >= 0 ? "+" : ""}{(metrics.hypePremiumPct * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground">
              Hype Premium
              <span className={`ml-1 font-semibold ${premiumColor}`}>({premiumLabel})</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-3" data-testid="market-sentiment-card">
        <div className="flex items-center gap-1.5 mb-3">
          <Thermometer className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Sentiment & Velocity</span>
        </div>

        <div className="space-y-3">
          <MetricBar
            label="Sentiment Score"
            value={metrics.sentimentScore}
            min={0}
            max={100}
            testId="market-sentiment-score"
          />
          <HypeVelocityBar
            value={metrics.hypeVelocity}
            testId="market-hype-velocity"
          />
        </div>
      </Card>

      <Card className="p-3" data-testid="market-supply-demand-card">
        <div className="flex items-center gap-1.5 mb-3">
          <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Supply & Demand</span>
        </div>

        <div className="space-y-3">
          <MetricBar
            label="Demand Index"
            value={metrics.demandIndex}
            min={0}
            max={100}
            color="bg-green-500"
            testId="market-demand-index"
          />
          <MetricBar
            label="Supply Index"
            value={metrics.supplyIndex}
            min={0}
            max={100}
            color="bg-blue-500"
            testId="market-supply-index"
          />
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Base Dynasty Value</span>
          <span className="font-mono font-semibold" data-testid="market-base-value">
            {Math.round(metrics.baseDynastyValue).toLocaleString()}
          </span>
        </div>
      </Card>
    </div>
  );
}

function MetricBar({ label, value, min, max, color = "bg-amber-500", testId }: {
  label: string;
  value: number;
  min: number;
  max: number;
  color?: string;
  testId: string;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const barColor = color === "bg-amber-500"
    ? value >= 70 ? "bg-green-500" : value >= 40 ? "bg-amber-500" : "bg-red-500"
    : color;

  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono font-semibold">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function HypeVelocityBar({ value, testId }: { value: number; testId: string }) {
  const normalizedPct = ((value + 100) / 200) * 100;
  const isPositive = value >= 0;

  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Hype Velocity</span>
        <div className="flex items-center gap-1">
          {isPositive ? (
            <ArrowUpRight className="h-3 w-3 text-green-500 dark:text-green-400" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500 dark:text-red-400" />
          )}
          <span className={`text-xs font-mono font-semibold ${isPositive ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
            {value >= 0 ? "+" : ""}{value.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />
        {isPositive ? (
          <div
            className="absolute top-0 bottom-0 bg-green-500 rounded-r-full"
            style={{ left: "50%", width: `${(value / 100) * 50}%` }}
          />
        ) : (
          <div
            className="absolute top-0 bottom-0 bg-red-500 rounded-l-full"
            style={{ right: "50%", width: `${(Math.abs(value) / 100) * 50}%` }}
          />
        )}
      </div>
    </div>
  );
}

function formatNum(val: number | undefined | null): string {
  if (val == null) return "-";
  return val % 1 === 0 ? val.toLocaleString() : val.toFixed(1);
}
