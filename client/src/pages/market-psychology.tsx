import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Snowflake,
  ThermometerSun,
  Minus,
  ArrowUp,
  ArrowDown,
  Brain,
  Clock,
} from "lucide-react";
import { PlayerProfileModal } from "@/components/player-profile-modal";
import { PremiumGate } from "@/components/premium-gate";
import { usePageTitle } from "@/hooks/use-page-title";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PlayerMarketMetrics } from "@shared/schema";

interface CategoriesResponse {
  overhyped: PlayerMarketMetrics[];
  undervalued: PlayerMarketMetrics[];
  risingFast: PlayerMarketMetrics[];
  panicSells: PlayerMarketMetrics[];
  artificialScarcity: PlayerMarketMetrics[];
  lastUpdated: string | null;
}

type CategoryKey = "overhyped" | "undervalued" | "risingFast" | "panicSells" | "artificialScarcity";

const TABS: { key: CategoryKey; label: string; description: string }[] = [
  { key: "overhyped", label: "Most Overhyped", description: "Players with the highest hype premium — market values exceed fundamentals" },
  { key: "undervalued", label: "Undervalued", description: "Players trading below their fundamental value — potential buy-low targets" },
  { key: "risingFast", label: "Rising Fast", description: "Players with the highest upward momentum in market sentiment" },
  { key: "panicSells", label: "Panic Sells", description: "Players losing value rapidly with declining demand — potential overreactions" },
  { key: "artificialScarcity", label: "Artificial Scarcity", description: "Low supply with high demand — owners holding tight while buyers chase" },
];

function getHeatBadge(level: string) {
  switch (level) {
    case "HOT":
      return <Badge variant="destructive" data-testid="badge-heat-hot"><Flame className="h-3 w-3 mr-1" />HOT</Badge>;
    case "HEATING":
      return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" data-testid="badge-heat-heating"><ThermometerSun className="h-3 w-3 mr-1" />HEATING</Badge>;
    case "COLD":
      return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" data-testid="badge-heat-cold"><Snowflake className="h-3 w-3 mr-1" />COLD</Badge>;
    default:
      return <Badge variant="secondary" data-testid="badge-heat-neutral"><Minus className="h-3 w-3 mr-1" />NEUTRAL</Badge>;
  }
}

function getHypePremiumDisplay(pct: number) {
  const formatted = (pct * 100).toFixed(1);
  if (pct > 0.15) return <span className="text-red-500 dark:text-red-400 font-semibold">+{formatted}%</span>;
  if (pct < -0.10) return <span className="text-green-500 dark:text-green-400 font-semibold">{formatted}%</span>;
  return <span className="text-muted-foreground">{formatted}%</span>;
}

function VelocityArrow({ velocity }: { velocity: number }) {
  if (velocity > 10) return <ArrowUp className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />;
  if (velocity < -10) return <ArrowDown className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function MetricBar({ value, max = 100, color = "bg-primary" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-1.5 rounded-full bg-muted">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function getPositionColor(pos: string | null) {
  switch (pos) {
    case "QB": return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
    case "RB": return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "WR": return "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30";
    case "TE": return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
    default: return "";
  }
}

function PlayerRow({ player, onClick }: { player: PlayerMarketMetrics; onClick: () => void }) {
  return (
    <tr
      className="border-b border-border/50 cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`row-market-player-${player.playerId}`}
    >
      <td className="py-2.5 pr-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate" data-testid={`text-market-name-${player.playerId}`}>
            {player.playerName || player.playerId}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {player.position && (
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getPositionColor(player.position)}`}>
                {player.position}
              </Badge>
            )}
            {player.team && <span>{player.team}</span>}
          </div>
        </div>
      </td>
      <td className="py-2.5 px-2 text-center hidden sm:table-cell">
        <span className="font-mono text-sm" data-testid={`text-sentiment-${player.playerId}`}>
          {player.sentimentScore.toFixed(0)}
        </span>
      </td>
      <td className="py-2.5 px-2 text-center hidden sm:table-cell">
        <div className="flex items-center justify-center gap-1">
          <VelocityArrow velocity={player.hypeVelocity} />
          <span className="font-mono text-sm" data-testid={`text-velocity-${player.playerId}`}>
            {player.hypeVelocity > 0 ? "+" : ""}{player.hypeVelocity.toFixed(1)}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-2 hidden md:table-cell">
        <div className="space-y-1 min-w-[80px]">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Demand</span>
            <span className="font-mono">{player.demandIndex.toFixed(0)}</span>
          </div>
          <MetricBar value={player.demandIndex} color="bg-green-500 dark:bg-green-400" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Supply</span>
            <span className="font-mono">{player.supplyIndex.toFixed(0)}</span>
          </div>
          <MetricBar value={player.supplyIndex} color="bg-blue-500 dark:bg-blue-400" />
        </div>
      </td>
      <td className="py-2.5 px-2 text-center" data-testid={`text-premium-${player.playerId}`}>
        {getHypePremiumDisplay(player.hypePremiumPct)}
      </td>
      <td className="py-2.5 px-2 text-center hidden lg:table-cell">
        {getHeatBadge(player.marketHeatLevel)}
      </td>
      <td className="py-2.5 pl-2 text-right hidden sm:table-cell">
        <span className="font-mono font-semibold text-sm" data-testid={`text-adj-value-${player.playerId}`}>
          {player.adjustedMarketValue.toFixed(0)}
        </span>
      </td>
    </tr>
  );
}

function PlayerCard({ player, onClick }: { player: PlayerMarketMetrics; onClick: () => void }) {
  return (
    <Card
      className="p-3 cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`card-market-player-${player.playerId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate" data-testid={`text-card-name-${player.playerId}`}>
            {player.playerName || player.playerId}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {player.position && (
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getPositionColor(player.position)}`}>
                {player.position}
              </Badge>
            )}
            {player.team && <span className="text-xs text-muted-foreground">{player.team}</span>}
            {getHeatBadge(player.marketHeatLevel)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground">Adj. Value</div>
          <div className="font-mono font-bold text-base">{player.adjustedMarketValue.toFixed(0)}</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Sentiment</div>
          <div className="font-mono font-medium">{player.sentimentScore.toFixed(0)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Velocity</div>
          <div className="flex items-center justify-center gap-0.5">
            <VelocityArrow velocity={player.hypeVelocity} />
            <span className="font-mono font-medium">{player.hypeVelocity.toFixed(1)}</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Demand</div>
          <div className="font-mono font-medium">{player.demandIndex.toFixed(0)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Premium</div>
          {getHypePremiumDisplay(player.hypePremiumPct)}
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-12">Demand</span>
          <MetricBar value={player.demandIndex} color="bg-green-500 dark:bg-green-400" />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-12">Supply</span>
          <MetricBar value={player.supplyIndex} color="bg-blue-500 dark:bg-blue-400" />
        </div>
      </div>
    </Card>
  );
}

function MarketPsychologyContent() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<CategoryKey>("overhyped");
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [profilePlayerName, setProfilePlayerName] = useState("");
  const [profilePosition, setProfilePosition] = useState("");
  const [profileTeam, setProfileTeam] = useState("");

  const { data, isLoading, error } = useQuery<CategoriesResponse>({
    queryKey: ["/api/market-psychology/categories"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const openProfile = useCallback((player: PlayerMarketMetrics) => {
    setProfilePlayerId(player.playerId);
    setProfilePlayerName(player.playerName || player.playerId);
    setProfilePosition(player.position || "");
    setProfileTeam(player.team || "");
  }, []);

  const activeTabConfig = TABS.find(t => t.key === activeTab)!;
  const players = data ? (data[activeTab] || []) : [];

  return (
    <div className="space-y-4" data-testid="page-market-psychology">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Market Psychology
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sentiment, hype velocity & supply/demand analytics
          </p>
        </div>
        {data?.lastUpdated && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0" data-testid="text-last-updated">
            <Clock className="h-3 w-3" />
            Updated {new Date(data.lastUpdated).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
            className="shrink-0"
            data-testid={`tab-${tab.key}`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground" data-testid="text-tab-description">
        {activeTabConfig.description}
      </p>

      {isLoading ? (
        <MarketSkeleton />
      ) : error || !data ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground" data-testid="text-error">Failed to load market data</p>
        </div>
      ) : players.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground" data-testid="text-no-data">No players in this category yet</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-2" data-testid="grid-market-players">
          {players.map((player) => (
            <PlayerCard
              key={player.playerId}
              player={player}
              onClick={() => openProfile(player)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto" data-testid="table-market-players">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-2 min-w-[140px]">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Player</span>
                </th>
                <th className="text-center py-2 px-2 hidden sm:table-cell">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Sentiment</span>
                </th>
                <th className="text-center py-2 px-2 hidden sm:table-cell">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Velocity</span>
                </th>
                <th className="text-center py-2 px-2 hidden md:table-cell">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Demand / Supply</span>
                </th>
                <th className="text-center py-2 px-2">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Hype Premium</span>
                </th>
                <th className="text-center py-2 px-2 hidden lg:table-cell">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Heat</span>
                </th>
                <th className="text-right py-2 pl-2 hidden sm:table-cell">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Adj. Value</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <PlayerRow
                  key={player.playerId}
                  player={player}
                  onClick={() => openProfile(player)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {profilePlayerId && (
        <PlayerProfileModal
          open={!!profilePlayerId}
          onOpenChange={(open) => { if (!open) setProfilePlayerId(null); }}
          playerId={profilePlayerId}
          playerName={profilePlayerName}
          position={profilePosition}
          team={profileTeam}
        />
      )}
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function MarketPsychologyPage() {
  usePageTitle("Market Psychology");

  return (
    <PremiumGate featureName="Market Psychology">
      <MarketPsychologyContent />
    </PremiumGate>
  );
}
