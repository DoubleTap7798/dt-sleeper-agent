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

type TabKey = "adp" | "curve" | "overview";

const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "adp", label: "ADP Rankings", icon: ArrowUpDown },
  { key: "curve", label: "Pick Value Curve", icon: TrendingDown },
  { key: "overview", label: "Draft Overview", icon: BarChart3 },
];

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

function PickEquivalentBadge({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono font-semibold text-amber-500 dark:text-amber-400">{value}</span>
    </span>
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
  const limit = 30;
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery<ADPResponse>({
    queryKey: ["/api/draft-intelligence/adp", { format, position: position === "ALL" ? undefined : position, search: search || undefined, page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("format", format);
      params.set("page", page.toString());
      params.set("limit", limit.toString());
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

  return (
    <div className="space-y-4">
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
          <p className="text-muted-foreground" data-testid="text-adp-empty">No ADP data available yet. The pipeline processes drafts from all connected Sleeper leagues.</p>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground">
                  <th className="text-left p-3 w-10">#</th>
                  <th className="text-left p-3">Player</th>
                  <th className="text-right p-3">ADP</th>
                  <th className="text-right p-3 hidden sm:table-cell">Samples</th>
                  <th className="text-right p-3 hidden md:table-cell">Rookie Eq</th>
                  <th className="text-right p-3 hidden md:table-cell">Startup Eq</th>
                  {!isMobile && format === "all" && (
                    <>
                      <th className="text-right p-3 hidden lg:table-cell">1QB</th>
                      <th className="text-right p-3 hidden lg:table-cell">SF</th>
                      <th className="text-right p-3 hidden lg:table-cell">TEP</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.players.map((player, idx) => {
                  const rank = (page - 1) * limit + idx + 1;
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
                      <td className="p-3 text-right">
                        <span className="font-mono font-bold text-sm text-amber-500 dark:text-amber-400" data-testid={`text-adp-${player.player_id}`}>
                          {formatADP(getAdpForFormat(player))}
                        </span>
                      </td>
                      <td className="p-3 text-right hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{getSampleForFormat(player)}</span>
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
                          <td className="p-3 text-right hidden lg:table-cell text-xs text-muted-foreground">{formatADP(player.adp_tep)}</td>
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
    { label: "Top ADP", value: topPlayers[0]?.player_name || "—", icon: Crosshair, color: "text-purple-500 dark:text-purple-400" },
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

      <Card className="p-4 border-border">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-500" />
          Top 5 by Overall ADP
        </h3>
        <div className="space-y-2">
          {topPlayers.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 text-sm" data-testid={`row-top-${i}`}>
              <span className="font-mono text-muted-foreground w-6 text-right">{i + 1}.</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 ${getPositionColor(p.position)}`}>
                {p.position}
              </Badge>
              <span className="font-medium flex-1 truncate">{p.player_name}</span>
              <span className="font-mono font-bold text-amber-500 dark:text-amber-400">
                {formatADP(p.adp_overall)}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                ({p.sample_size} samples)
              </span>
              {p.rookie_pick_eq && (
                <PickEquivalentBadge label="R" value={p.rookie_pick_eq} />
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
          <p>The Draft Intelligence Engine ingests real draft data from all connected Sleeper leagues to build institutional-grade draft pricing.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-semibold text-foreground mb-1">ADP Rankings</p>
              <p>Average Draft Position computed across all completed drafts, segmented by format (1QB, Superflex, TEP).</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-semibold text-foreground mb-1">Pick Value Curve</p>
              <p>Average dynasty value of players selected at each pick slot, showing how value decays across rounds.</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-semibold text-foreground mb-1">Pick Equivalents</p>
              <p>Each player mapped to their closest rookie and startup pick equivalent based on dynasty value.</p>
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
          Institutional-grade draft pricing from real Sleeper draft data
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
