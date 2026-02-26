import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Search,
  ChevronLeft,
  ChevronRight,
  Target,
  Layers,
  Activity,
  Crosshair,
  ArrowUpDown,
  Users,
  Database,
  Globe,
  CircleDot,
} from "lucide-react";
import { PremiumGate } from "@/components/premium-gate";
import { usePageTitle } from "@/hooks/use-page-title";
import { useIsMobile } from "@/hooks/use-mobile";
import { PlayerProfileModal } from "@/components/player-profile-modal";

interface ADPPlayer {
  id: string;
  player_id: string;
  player_name: string;
  position: string;
  adp_overall: number | null;
  adp_1qb: number | null;
  adp_sf: number | null;
  adp_tep: number | null;
  sample_size: number;
  sample_1qb: number;
  sample_sf: number;
  sample_tep: number;
  rookie_pick_eq: string | null;
  startup_pick_eq: string | null;
  ecr_1qb: number | null;
  ecr_sf: number | null;
  consensus_rank: number | null;
  data_sources: string | null;
}

interface ADPResponse {
  players: ADPPlayer[];
  total: number;
}

interface PickCurveEntry {
  id: string;
  pickNumber: number;
  draftType: string;
  avgDynastyValue: number;
  sampleSize: number;
}

interface DataSource {
  source: string;
  playerCount: number;
  matchedCount: number;
  lastUpdated: string | null;
  description: string;
}

type TabKey = "adp" | "curve" | "overview";

const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "adp", label: "ADP Rankings", icon: ArrowUpDown },
  { key: "curve", label: "Pick Value Curve", icon: TrendingDown },
  { key: "overview", label: "Draft Overview", icon: BarChart3 },
];

const SOURCE_COLORS: Record<string, { dot: string; bg: string; label: string }> = {
  sleeper: { dot: "bg-amber-500", bg: "bg-amber-500/10 border-amber-500/30", label: "Sleeper Community" },
  dynastyprocess: { dot: "bg-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30", label: "DynastyProcess ECR" },
};

function getPositionColor(pos: string | null) {
  switch (pos) {
    case "QB": return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
    case "RB": return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "WR": return "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30";
    case "TE": return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

function formatADP(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(1);
}

function formatECR(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(1);
}

function PickEquivalentBadge({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono font-semibold text-amber-500 dark:text-amber-400">{value}</span>
    </span>
  );
}

function SourceDots({ sources }: { sources: string | null }) {
  if (!sources) return null;
  const sourceList = sources.split(",");
  return (
    <div className="flex items-center gap-0.5">
      {sourceList.map((s) => {
        const config = SOURCE_COLORS[s.trim()];
        if (!config) return null;
        return (
          <div
            key={s}
            className={`w-1.5 h-1.5 rounded-full ${config.dot}`}
            title={config.label}
          />
        );
      })}
    </div>
  );
}

function DataSourcesBanner() {
  const { data: sources } = useQuery<DataSource[]>({
    queryKey: ["/api/draft-intelligence/sources"],
    queryFn: async () => {
      const res = await fetch("/api/draft-intelligence/sources", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!sources || sources.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="data-sources-banner">
      <Database className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Sources:</span>
      {sources.map((s) => {
        const config = SOURCE_COLORS[s.source] || { dot: "bg-gray-500", bg: "bg-gray-500/10 border-gray-500/30", label: s.source };
        return (
          <Badge
            key={s.source}
            variant="outline"
            className={`text-[10px] px-2 py-0.5 ${config.bg}`}
            data-testid={`badge-source-${s.source}`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${config.dot} mr-1.5`} />
            {config.label} ({s.playerCount.toLocaleString()})
          </Badge>
        );
      })}
    </div>
  );
}

function ValueBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct > 70 ? "bg-green-500 dark:bg-green-400" : pct > 40 ? "bg-amber-500 dark:bg-amber-400" : "bg-red-500 dark:bg-red-400";
  return (
    <div className="w-full h-2 rounded-full bg-muted">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ADPTable({
  format,
  onFormatChange,
  position,
  onPositionChange,
  onPlayerClick,
}: {
  format: string;
  onFormatChange: (v: string) => void;
  position: string;
  onPositionChange: (v: string) => void;
  onPlayerClick: (id: string, name: string, pos: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("consensus");
  const limit = 30;
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery<ADPResponse>({
    queryKey: ["/api/draft-intelligence/adp", { format, position: position === "ALL" ? undefined : position, search: search || undefined, page, limit, sort }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("format", format);
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      params.set("sort", sort);
      if (position !== "ALL") params.set("position", position);
      if (search) params.set("search", search);
      const res = await fetch(`/api/draft-intelligence/adp?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ADP");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const totalPages = Math.ceil((data?.total || 0) / limit);

  const getAdpForFormat = (player: ADPPlayer) => {
    if (format === "1QB") return player.adp_1qb;
    if (format === "SF") return player.adp_sf;
    if (format === "TEP") return player.adp_tep;
    return player.adp_overall;
  };

  const getSampleForFormat = (player: ADPPlayer) => {
    if (format === "1QB") return player.sample_1qb;
    if (format === "SF") return player.sample_sf;
    if (format === "TEP") return player.sample_tep;
    return player.sample_size;
  };

  const getEcrForFormat = (player: ADPPlayer) => {
    if (format === "SF") return player.ecr_sf;
    return player.ecr_1qb;
  };

  return (
    <div className="space-y-4">
      <DataSourcesBanner />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-adp-search"
          />
        </div>
        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]" data-testid="select-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="consensus" data-testid="option-sort-consensus">Consensus Rank</SelectItem>
            <SelectItem value="sleeper" data-testid="option-sort-sleeper">Sleeper ADP</SelectItem>
            <SelectItem value="ecr" data-testid="option-sort-ecr">Expert ECR</SelectItem>
          </SelectContent>
        </Select>
        <Select value={format} onValueChange={(v) => { onFormatChange(v); setPage(1); }}>
          <SelectTrigger className="w-[120px]" data-testid="select-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-format-all">All Formats</SelectItem>
            <SelectItem value="SF" data-testid="option-format-sf">Superflex</SelectItem>
            <SelectItem value="1QB" data-testid="option-format-1qb">1QB</SelectItem>
            <SelectItem value="TEP" data-testid="option-format-tep">TEP</SelectItem>
          </SelectContent>
        </Select>
        <Select value={position} onValueChange={(v) => { onPositionChange(v); setPage(1); }}>
          <SelectTrigger className="w-[100px]" data-testid="select-position">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" data-testid="option-pos-all">All Pos</SelectItem>
            <SelectItem value="QB" data-testid="option-pos-qb">QB</SelectItem>
            <SelectItem value="RB" data-testid="option-pos-rb">RB</SelectItem>
            <SelectItem value="WR" data-testid="option-pos-wr">WR</SelectItem>
            <SelectItem value="TE" data-testid="option-pos-te">TE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-8" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-10 w-20" />
            </div>
          ))}
        </div>
      ) : !data?.players?.length ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground" data-testid="text-adp-empty">No ADP data available yet. The pipeline processes drafts from all connected Sleeper leagues and external ranking sources.</p>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground">
                  <th className="text-left p-3 w-10">#</th>
                  <th className="text-left p-3">Player</th>
                  <th className="text-center p-3 w-8" title="Data Sources">
                    <CircleDot className="h-3 w-3 mx-auto" />
                  </th>
                  <th className="text-right p-3">ADP</th>
                  <th className="text-right p-3 hidden sm:table-cell">ECR</th>
                  <th className="text-right p-3 hidden sm:table-cell">Samples</th>
                  <th className="text-right p-3 hidden md:table-cell">Rookie Eq</th>
                  <th className="text-right p-3 hidden md:table-cell">Startup Eq</th>
                  {!isMobile && format === "all" && (
                    <>
                      <th className="text-right p-3 hidden lg:table-cell">1QB</th>
                      <th className="text-right p-3 hidden lg:table-cell">SF</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.players.map((player, idx) => {
                  const rank = (page - 1) * limit + idx + 1;
                  const adp = getAdpForFormat(player);
                  const ecr = getEcrForFormat(player);
                  const hasSleeperData = player.data_sources?.includes("sleeper");
                  return (
                    <tr
                      key={player.id}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => onPlayerClick(player.player_id, player.player_name || "", player.position || "")}
                      data-testid={`row-adp-player-${player.player_id}`}
                    >
                      <td className="p-3 text-xs text-muted-foreground font-mono">{rank}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] px-1.5 ${getPositionColor(player.position)}`} data-testid={`badge-pos-${player.player_id}`}>
                            {player.position || "—"}
                          </Badge>
                          <span className="font-medium text-sm truncate" data-testid={`text-name-${player.player_id}`}>
                            {player.player_name || "Unknown"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <SourceDots sources={player.data_sources} />
                      </td>
                      <td className="p-3 text-right">
                        {hasSleeperData ? (
                          <span className="font-mono font-bold text-sm text-amber-500 dark:text-amber-400" data-testid={`text-adp-${player.player_id}`}>
                            {formatADP(adp)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic" data-testid={`text-adp-${player.player_id}`}>—</span>
                        )}
                      </td>
                      <td className="p-3 text-right hidden sm:table-cell">
                        {ecr != null ? (
                          <span className="font-mono text-sm text-emerald-500 dark:text-emerald-400" data-testid={`text-ecr-${player.player_id}`}>
                            {formatECR(ecr)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{getSampleForFormat(player) || "—"}</span>
                      </td>
                      <td className="p-3 text-right hidden md:table-cell">
                        <span className="font-mono text-xs text-green-500 dark:text-green-400">{player.rookie_pick_eq || "—"}</span>
                      </td>
                      <td className="p-3 text-right hidden md:table-cell">
                        <span className="font-mono text-xs text-blue-500 dark:text-blue-400">{player.startup_pick_eq || "—"}</span>
                      </td>
                      {!isMobile && format === "all" && (
                        <>
                          <td className="p-3 text-right hidden lg:table-cell text-xs text-muted-foreground">{formatADP(player.adp_1qb)}</td>
                          <td className="p-3 text-right hidden lg:table-cell text-xs text-muted-foreground">{formatADP(player.adp_sf)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground" data-testid="text-adp-count">
              {data.total.toLocaleString()} players
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-muted-foreground text-xs" data-testid="text-page-info">
                {page} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PickValueCurvePanel() {
  const [curveType, setCurveType] = useState<string>("rookie");

  const { data: curveData, isLoading } = useQuery<PickCurveEntry[]>({
    queryKey: ["/api/draft-intelligence/pick-value-curve", { type: curveType }],
    queryFn: async () => {
      const res = await fetch(`/api/draft-intelligence/pick-value-curve?type=${curveType}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch curve");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredData = (curveData || []).filter(d => d.draftType === curveType);
  const maxValue = Math.max(...filteredData.map(d => d.avgDynastyValue), 1);

  const formatPickLabel = (pickNum: number) => {
    const round = Math.ceil(pickNum / 12);
    const pick = ((pickNum - 1) % 12) + 1;
    return `${round}.${pick.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={curveType} onValueChange={setCurveType}>
          <SelectTrigger className="w-[160px]" data-testid="select-curve-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rookie" data-testid="option-curve-rookie">Rookie Drafts</SelectItem>
            <SelectItem value="startup" data-testid="option-curve-startup">Startup Drafts</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground" data-testid="text-curve-count">
          {filteredData.length} pick slots
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : filteredData.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground" data-testid="text-curve-empty">No pick value curve data available for {curveType} drafts.</p>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground">
                <th className="text-left p-3 w-16">Pick</th>
                <th className="text-left p-3 w-20">Label</th>
                <th className="text-right p-3 w-24">Value</th>
                <th className="p-3">Dynasty Value Distribution</th>
                <th className="text-right p-3 w-20 hidden sm:table-cell">Samples</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((entry) => (
                <tr key={entry.id} className="border-t border-border" data-testid={`row-curve-${entry.pickNumber}`}>
                  <td className="p-3 font-mono text-sm text-muted-foreground">{entry.pickNumber}</td>
                  <td className="p-3">
                    <span className="font-mono text-sm font-semibold text-amber-500 dark:text-amber-400">
                      {formatPickLabel(entry.pickNumber)}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-mono text-sm font-bold" data-testid={`text-value-${entry.pickNumber}`}>
                      {Math.round(entry.avgDynastyValue).toLocaleString()}
                    </span>
                  </td>
                  <td className="p-3">
                    <ValueBar value={entry.avgDynastyValue} max={maxValue} />
                  </td>
                  <td className="p-3 text-right hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">{entry.sampleSize}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OverviewPanel() {
  const { data: adpData, isLoading: adpLoading } = useQuery<ADPResponse>({
    queryKey: ["/api/draft-intelligence/adp", { format: "all", page: 1, limit: 5 }],
    queryFn: async () => {
      const res = await fetch("/api/draft-intelligence/adp?format=all&page=1&limit=5", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: rookieCurve, isLoading: curveLoading } = useQuery<PickCurveEntry[]>({
    queryKey: ["/api/draft-intelligence/pick-value-curve", { type: "rookie" }],
    queryFn: async () => {
      const res = await fetch("/api/draft-intelligence/pick-value-curve?type=rookie", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: sources } = useQuery<DataSource[]>({
    queryKey: ["/api/draft-intelligence/sources"],
    queryFn: async () => {
      const res = await fetch("/api/draft-intelligence/sources", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = adpLoading || curveLoading;
  const totalPlayers = adpData?.total || 0;
  const topPlayers = adpData?.players || [];
  const curveEntries = (rookieCurve || []).filter(c => c.draftType === "rookie");
  const avgCurveSamples = curveEntries.length > 0
    ? Math.round(curveEntries.reduce((s, c) => s + c.sampleSize, 0) / curveEntries.length)
    : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
        ))}
      </div>
    );
  }

  const statsCards = [
    { label: "Players Tracked", value: totalPlayers.toLocaleString(), icon: Users, color: "text-amber-500 dark:text-amber-400" },
    { label: "Rookie Curve Slots", value: curveEntries.length.toString(), icon: TrendingDown, color: "text-green-500 dark:text-green-400" },
    { label: "Avg Samples / Pick", value: avgCurveSamples.toString(), icon: Layers, color: "text-blue-500 dark:text-blue-400" },
    { label: "Data Sources", value: (sources?.length || 0).toString(), icon: Globe, color: "text-purple-500 dark:text-purple-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statsCards.map((card) => (
          <Card key={card.label} className="p-4 border-border" data-testid={`card-stat-${card.label.toLowerCase().replace(/ /g, "-")}`}>
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className={`text-lg font-bold truncate ${card.color}`}>{card.value}</p>
          </Card>
        ))}
      </div>

      {sources && sources.length > 0 && (
        <Card className="p-4 border-border" data-testid="card-data-sources">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-amber-500" />
            Data Sources
          </h3>
          <div className="space-y-3">
            {sources.map((s) => {
              const config = SOURCE_COLORS[s.source] || { dot: "bg-gray-500", bg: "bg-gray-500/10 border-gray-500/30", label: s.source };
              return (
                <div key={s.source} className={`rounded-lg border p-3 ${config.bg}`} data-testid={`source-detail-${s.source}`}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${config.dot}`} />
                      <span className="text-sm font-semibold">{config.label}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {s.playerCount.toLocaleString()} players
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                  {s.lastUpdated && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Last updated: {new Date(s.lastUpdated).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-4 border-border">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-500" />
          Top 5 by Consensus Rank
        </h3>
        <div className="space-y-2">
          {topPlayers.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 text-sm" data-testid={`row-top-${i}`}>
              <span className="font-mono text-muted-foreground w-6 text-right">{i + 1}.</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 ${getPositionColor(p.position)}`}>
                {p.position}
              </Badge>
              <span className="font-medium flex-1 truncate">{p.player_name}</span>
              <SourceDots sources={p.data_sources} />
              {p.adp_overall != null && (
                <span className="font-mono text-xs text-amber-500 dark:text-amber-400">
                  ADP {formatADP(p.adp_overall)}
                </span>
              )}
              {p.ecr_1qb != null && (
                <span className="font-mono text-xs text-emerald-500 dark:text-emerald-400 hidden sm:inline">
                  ECR {formatECR(p.ecr_1qb)}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 border-border">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-500" />
          How It Works
        </h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>The Draft Intelligence Engine combines multiple data sources to build institutional-grade draft pricing. Sleeper community ADP grows as more users connect their accounts, while DynastyProcess provides expert consensus rankings updated weekly.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-semibold text-foreground mb-1">Consensus Rank</p>
              <p>Blended rank combining Sleeper community ADP with expert ECR, weighted by sample size for accuracy.</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-semibold text-foreground mb-1">Sleeper ADP</p>
              <p>Average Draft Position from real drafts across all connected Sleeper leagues, by format.</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-semibold text-foreground mb-1">Expert ECR</p>
              <p>Expert Consensus Ranking from DynastyProcess aggregating industry expert opinions.</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-semibold text-foreground mb-1">Pick Equivalents</p>
              <p>Each player mapped to their closest rookie and startup pick based on dynasty value.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DraftIntelligenceContent() {
  const [activeTab, setActiveTab] = useState<TabKey>("adp");
  const [format, setFormat] = useState("all");
  const [position, setPosition] = useState("ALL");
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [profilePlayerName, setProfilePlayerName] = useState("");
  const [profilePosition, setProfilePosition] = useState("");

  const handlePlayerClick = (id: string, name: string, pos: string) => {
    setProfilePlayerId(id);
    setProfilePlayerName(name);
    setProfilePosition(pos);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Crosshair className="h-6 w-6 text-amber-500" />
          Draft Intelligence Engine
        </h1>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-subtitle">
          Multi-source draft pricing from Sleeper community data and expert consensus rankings
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 whitespace-nowrap"
            data-testid={`tab-${tab.key}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "adp" && (
        <ADPTable
          format={format}
          onFormatChange={setFormat}
          position={position}
          onPositionChange={setPosition}
          onPlayerClick={handlePlayerClick}
        />
      )}

      {activeTab === "curve" && <PickValueCurvePanel />}

      {activeTab === "overview" && <OverviewPanel />}

      {profilePlayerId && (
        <PlayerProfileModal
          isOpen={!!profilePlayerId}
          onClose={() => setProfilePlayerId(null)}
          playerId={profilePlayerId}
          playerName={profilePlayerName}
          position={profilePosition}
          team=""
        />
      )}
    </div>
  );
}

export default function DraftIntelligencePage() {
  usePageTitle("Draft Intelligence Engine");

  return (
    <PremiumGate featureName="Draft Intelligence Engine">
      <DraftIntelligenceContent />
    </PremiumGate>
  );
}
