import { useQuery } from "@tanstack/react-query";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown, Zap, Shield, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface BoomBustCard {
  playerId: string;
  name: string;
  position: string;
  team: string;
  age: number;
  yearsExp: number;
  dynastyValue: number;
  boomPct: number;
  bustPct: number;
  ceiling: number;
  floor: number;
  riskLevel: string;
  outlook: string;
  headshot: string | null;
}

const POS_COLORS: Record<string, string> = {
  QB: "text-red-400",
  RB: "text-emerald-400",
  WR: "text-blue-400",
  TE: "text-amber-400",
};

const POS_BG: Record<string, string> = {
  QB: "bg-red-400/10 border-red-400/30",
  RB: "bg-emerald-400/10 border-emerald-400/30",
  WR: "bg-blue-400/10 border-blue-400/30",
  TE: "bg-amber-400/10 border-amber-400/30",
};

const RISK_CONFIG: Record<string, { color: string; icon: any }> = {
  "High Risk": { color: "text-red-400", icon: AlertTriangle },
  "Moderate": { color: "text-amber-400", icon: Shield },
  "Safe": { color: "text-emerald-400", icon: Shield },
};

type FilterPos = "ALL" | "QB" | "RB" | "WR" | "TE";
type SortBy = "value" | "boom" | "bust" | "ceiling";

export default function BoomBustPage() {
  usePageTitle("Boom/Bust Cards");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;

  const [filterPos, setFilterPos] = useState<FilterPos>("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("value");

  const { data, isLoading } = useQuery<{ cards: BoomBustCard[] }>({
    queryKey: ["/api/fantasy/boom-bust", leagueId],
    enabled: !!leagueId,
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to view boom/bust cards</p>
      </div>
    );
  }

  const cards = (data?.cards || [])
    .filter(c => filterPos === "ALL" || c.position === filterPos)
    .sort((a, b) => {
      if (sortBy === "boom") return b.boomPct - a.boomPct;
      if (sortBy === "bust") return b.bustPct - a.bustPct;
      if (sortBy === "ceiling") return b.ceiling - a.ceiling;
      return b.dynastyValue - a.dynastyValue;
    });

  return (
    <PremiumGate featureName="Boom/Bust Analysis">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Boom / Bust Cards</h1>
            <p className="text-sm text-muted-foreground">Upside ceiling vs downside floor for your roster</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            {(["ALL", "QB", "RB", "WR", "TE"] as FilterPos[]).map(pos => (
              <Button
                key={pos}
                variant={filterPos === pos ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterPos(pos)}
                data-testid={`button-filter-${pos}`}
              >
                {pos}
              </Button>
            ))}
          </div>
          <div className="flex gap-1 ml-auto">
            {([
              { key: "value", label: "Value" },
              { key: "boom", label: "Boom %" },
              { key: "bust", label: "Bust %" },
              { key: "ceiling", label: "Ceiling" },
            ] as { key: SortBy; label: string }[]).map(s => (
              <Button
                key={s.key}
                variant={sortBy === s.key ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSortBy(s.key)}
                data-testid={`button-sort-${s.key}`}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => {
              const riskConfig = RISK_CONFIG[card.riskLevel] || RISK_CONFIG["Moderate"];
              const RiskIcon = riskConfig.icon;
              return (
                <Card key={card.playerId} className="overflow-visible" data-testid={`card-player-${card.playerId}`}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={card.headshot || undefined} />
                        <AvatarFallback className="text-xs">{card.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" data-testid={`text-player-name-${card.playerId}`}>{card.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${POS_BG[card.position] || ""}`}>
                            <span className={POS_COLORS[card.position] || ""}>{card.position}</span>
                          </Badge>
                          <span className="text-xs text-muted-foreground">{card.team}</span>
                          <span className="text-xs text-muted-foreground">Age {card.age}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                        <TrendingUp className="h-4 w-4 mx-auto mb-1 text-emerald-400" />
                        <p className="text-lg font-bold text-emerald-400">{card.boomPct}%</p>
                        <p className="text-xs text-muted-foreground">Boom</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-red-500/10 border border-red-500/20">
                        <TrendingDown className="h-4 w-4 mx-auto mb-1 text-red-400" />
                        <p className="text-lg font-bold text-red-400">{card.bustPct}%</p>
                        <p className="text-xs text-muted-foreground">Bust</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Floor</span>
                        <span className="text-muted-foreground">Ceiling</span>
                      </div>
                      <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, (card.ceiling / (cards[0]?.ceiling || 10000)) * 100)}%` }}
                        />
                        <div
                          className="absolute top-0 h-full w-0.5 bg-foreground"
                          style={{ left: `${Math.min(100, (card.dynastyValue / (cards[0]?.ceiling || 10000)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-red-400">{card.floor.toLocaleString()}</span>
                        <span className="text-muted-foreground">{card.dynastyValue.toLocaleString()}</span>
                        <span className="text-emerald-400">{card.ceiling.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <RiskIcon className={`h-3.5 w-3.5 ${riskConfig.color}`} />
                        <span className={`text-xs font-medium ${riskConfig.color}`}>{card.riskLevel}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {card.outlook}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PremiumGate>
  );
}
