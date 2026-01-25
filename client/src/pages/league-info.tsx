import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { CACHE_TIMES } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Users, Trophy, Calendar, DollarSign, Target, Shuffle, Shield, Zap, Crown, CircleDot, Footprints, Goal } from "lucide-react";

interface LeagueInfo {
  leagueId: string;
  name: string;
  season: string;
  status: string;
  avatar: string | null;
  format: string;
  totalTeams: number;
  rosterSettings: {
    starterPositions: string[];
    positionCounts: Record<string, number>;
    benchCount: number;
    totalStarters: number;
    totalRoster: number;
  };
  leagueSettings: {
    playoffTeams: number;
    playoffWeekStart: number;
    tradeDeadline: number;
    waiverSystem: string;
    waiverBudget: number;
  };
  scoringCategories: {
    passing: Record<string, number>;
    rushing: Record<string, number>;
    receiving: Record<string, number>;
    bonuses: Record<string, number>;
    misc: Record<string, number>;
    dst: Record<string, number>;
    idp: Record<string, number>;
    kicking: Record<string, number>;
    specialTeams: Record<string, number>;
  };
  unmappedScoring: Record<string, number>;
  rawScoring: Record<string, number>;
}

function LeagueInfoSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function ScoringRow({ label, value, unit = "" }: { label: string; value: number; unit?: string }) {
  if (value === 0) return null;
  const displayValue = value > 0 ? `+${value}` : value.toString();
  return (
    <div className="flex justify-between gap-2 text-muted-foreground">
      <span className="truncate">{label}</span>
      <span className="font-medium text-foreground whitespace-nowrap">{displayValue}{unit}</span>
    </div>
  );
}

function ScoringSection({ title, icon, items }: { title: string; icon?: React.ReactNode; items: Array<{ label: string; value: number; unit?: string }> }) {
  const nonZeroItems = items.filter(item => item.value !== 0);
  if (nonZeroItems.length === 0) return null;
  
  return (
    <div data-testid={`scoring-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
        {icon} {title}
      </h4>
      <div className="space-y-1 text-sm">
        {nonZeroItems.map((item, i) => (
          <ScoringRow key={i} label={item.label} value={item.value} unit={item.unit} />
        ))}
      </div>
    </div>
  );
}

export default function LeagueInfoPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const leagueId = urlParams.get("id");

  const { data, isLoading, error } = useQuery<LeagueInfo>({
    queryKey: ["/api/sleeper/league-info", leagueId],
    enabled: !!leagueId && leagueId !== "all",
    ...CACHE_TIMES.STABLE,
  });

  if (!leagueId || leagueId === "all") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a specific league to view its settings</p>
      </div>
    );
  }

  if (isLoading) {
    return <LeagueInfoSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load league info</p>
      </div>
    );
  }

  const { rosterSettings, leagueSettings, scoringCategories, unmappedScoring } = data;

  const getSlotDisplayName = (pos: string): string => {
    const names: Record<string, string> = {
      QB: "Quarterback",
      RB: "Running Back",
      WR: "Wide Receiver",
      TE: "Tight End",
      FLEX: "Flex (RB/WR/TE)",
      SUPER_FLEX: "Superflex (QB/RB/WR/TE)",
      REC_FLEX: "Rec Flex (WR/TE)",
      K: "Kicker",
      DEF: "Defense/ST",
      IDP_FLEX: "IDP Flex",
      DL: "Defensive Line",
      LB: "Linebacker",
      DB: "Defensive Back",
      BN: "Bench",
    };
    return names[pos] || pos;
  };

  const formatScoringKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/Td/g, 'TD')
      .replace(/Yd/g, 'Yd')
      .replace(/Fd/g, 'First Down')
      .replace(/2pt/g, '2PT')
      .replace(/40p/g, '40+')
      .replace(/50p/g, '50+');
  };

  const starterSlotCounts: Record<string, number> = {};
  rosterSettings.starterPositions.forEach(pos => {
    starterSlotCounts[pos] = (starterSlotCounts[pos] || 0) + 1;
  });

  const passing = scoringCategories.passing || {};
  const rushing = scoringCategories.rushing || {};
  const receiving = scoringCategories.receiving || {};
  const bonuses = scoringCategories.bonuses || {};
  const misc = scoringCategories.misc || {};
  const dst = scoringCategories.dst || {};
  const idp = scoringCategories.idp || {};
  const kicking = scoringCategories.kicking || {};
  const specialTeams = scoringCategories.specialTeams || {};

  const hasIdpScoring = Object.values(idp).some(v => v !== 0);
  const hasDstScoring = Object.values(dst).some(v => v !== 0);
  const hasKickingScoring = Object.values(kicking).some(v => v !== 0);
  const hasSpecialTeamsScoring = Object.values(specialTeams).some(v => v !== 0);
  const hasBonuses = Object.values(bonuses).some(v => v !== 0);
  const hasUnmappedScoring = unmappedScoring && Object.keys(unmappedScoring).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-league-info-title">
            League Info
          </h2>
          <p className="text-muted-foreground">
            {data.name} - {data.season} Season
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="badge-format">{data.format}</Badge>
          <Badge variant="outline" data-testid="badge-teams">{data.totalTeams} Teams</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-roster-settings">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Roster Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Starting Lineup ({rosterSettings.totalStarters} slots)</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(starterSlotCounts).map(([pos, count]) => (
                  <Badge key={pos} variant="outline" className="text-xs" data-testid={`badge-slot-${pos.toLowerCase()}`}>
                    {count}x {pos}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="border-t pt-3">
              <h4 className="text-sm font-medium mb-2">Full Roster Breakdown</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(rosterSettings.positionCounts)
                  .sort(([a], [b]) => {
                    const order = ["QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX", "REC_FLEX", "K", "DEF", "DL", "LB", "DB", "IDP_FLEX", "BN"];
                    return order.indexOf(a) - order.indexOf(b);
                  })
                  .map(([pos, count]) => (
                    <div key={pos} className="flex justify-between gap-2 text-muted-foreground" data-testid={`row-position-${pos.toLowerCase()}`}>
                      <span>{getSlotDisplayName(pos)}</span>
                      <span className="font-medium text-foreground">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="border-t pt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{rosterSettings.totalRoster}</span> total roster spots
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-league-settings">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              League Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-sm" data-testid="row-playoff-teams">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="h-4 w-4" />
                Playoff Teams
              </div>
              <span className="font-medium">{leagueSettings.playoffTeams}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm" data-testid="row-playoff-start">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Playoffs Start
              </div>
              <span className="font-medium">Week {leagueSettings.playoffWeekStart}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm" data-testid="row-trade-deadline">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shuffle className="h-4 w-4" />
                Trade Deadline
              </div>
              <span className="font-medium">
                {leagueSettings.tradeDeadline === 0 ? "None" : `Week ${leagueSettings.tradeDeadline}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm" data-testid="row-waiver-system">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" />
                Waiver System
              </div>
              <span className="font-medium">{leagueSettings.waiverSystem}</span>
            </div>
            {leagueSettings.waiverSystem === "FAAB" && (
              <div className="flex items-center justify-between gap-2 text-sm" data-testid="row-faab-budget">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  FAAB Budget
                </div>
                <span className="font-medium">${leagueSettings.waiverBudget}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 text-sm" data-testid="row-status">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4" />
                Status
              </div>
              <Badge variant="secondary" className="text-xs capitalize">{data.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2" data-testid="card-scoring-settings">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Scoring Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <ScoringSection 
                title="Passing" 
                icon={<Crown className="h-3 w-3" />}
                items={[
                  { label: "Passing Yards", value: passing.passYards, unit: " per yd" },
                  { label: "Passing TD", value: passing.passTd },
                  { label: "Interception", value: passing.passInt },
                  { label: "2-Pt Conversion", value: passing.pass2pt },
                  { label: "First Down", value: passing.passFd },
                  { label: "Pass Attempt", value: passing.passAtt },
                  { label: "Completion", value: passing.passCmp },
                  { label: "Incomplete Pass", value: passing.passInc },
                  { label: "Sacked", value: passing.passSack },
                  { label: "40+ Yd Completion", value: passing.passCmp40p },
                  { label: "Pick-6 Thrown", value: passing.passIntTd },
                ]}
              />

              <ScoringSection 
                title="Rushing" 
                icon={<Footprints className="h-3 w-3" />}
                items={[
                  { label: "Rushing Yards", value: rushing.rushYards, unit: " per yd" },
                  { label: "Rushing TD", value: rushing.rushTd },
                  { label: "2-Pt Conversion", value: rushing.rush2pt },
                  { label: "First Down", value: rushing.rushFd },
                  { label: "Rush Attempt", value: rushing.rushAtt },
                  { label: "40+ Yd Rush", value: rushing.rush40p },
                ]}
              />

              <ScoringSection 
                title="Receiving" 
                icon={<CircleDot className="h-3 w-3" />}
                items={[
                  { label: "Reception (PPR)", value: receiving.reception },
                  { label: "Receiving Yards", value: receiving.recYards, unit: " per yd" },
                  { label: "Receiving TD", value: receiving.recTd },
                  { label: "2-Pt Conversion", value: receiving.rec2pt },
                  { label: "First Down", value: receiving.recFd },
                  { label: "40+ Yd Rec", value: receiving.rec40p },
                  { label: "TE Premium", value: receiving.bonusRecTe },
                  { label: "RB Bonus", value: receiving.bonusRecRb },
                  { label: "WR Bonus", value: receiving.bonusRecWr },
                ]}
              />

              <ScoringSection 
                title="Turnovers" 
                items={[
                  { label: "Fumble", value: misc.fumble },
                  { label: "Fumble Lost", value: misc.fumbleLost },
                  { label: "Fumble Recovery", value: misc.fumbleRec },
                  { label: "Fumble Recovery TD", value: misc.fumbleRecTd },
                ]}
              />
            </div>

            {hasBonuses && (
              <div className="mt-6 pt-4 border-t" data-testid="scoring-bonuses">
                <h4 className="text-sm font-medium mb-3">Yardage & Big Play Bonuses</h4>
                <div className="flex flex-wrap gap-2">
                  {bonuses.bonus100RushYards !== 0 && (
                    <Badge variant="outline" className="text-xs">100+ Rush Yds: {bonuses.bonus100RushYards > 0 ? '+' : ''}{bonuses.bonus100RushYards}</Badge>
                  )}
                  {bonuses.bonus200RushYards !== 0 && (
                    <Badge variant="outline" className="text-xs">200+ Rush Yds: {bonuses.bonus200RushYards > 0 ? '+' : ''}{bonuses.bonus200RushYards}</Badge>
                  )}
                  {bonuses.bonus100RecYards !== 0 && (
                    <Badge variant="outline" className="text-xs">100+ Rec Yds: {bonuses.bonus100RecYards > 0 ? '+' : ''}{bonuses.bonus100RecYards}</Badge>
                  )}
                  {bonuses.bonus200RecYards !== 0 && (
                    <Badge variant="outline" className="text-xs">200+ Rec Yds: {bonuses.bonus200RecYards > 0 ? '+' : ''}{bonuses.bonus200RecYards}</Badge>
                  )}
                  {bonuses.bonus300PassYards !== 0 && (
                    <Badge variant="outline" className="text-xs">300+ Pass Yds: {bonuses.bonus300PassYards > 0 ? '+' : ''}{bonuses.bonus300PassYards}</Badge>
                  )}
                  {bonuses.bonus400PassYards !== 0 && (
                    <Badge variant="outline" className="text-xs">400+ Pass Yds: {bonuses.bonus400PassYards > 0 ? '+' : ''}{bonuses.bonus400PassYards}</Badge>
                  )}
                  {bonuses.bonus40RushTd !== 0 && (
                    <Badge variant="outline" className="text-xs">40+ Yd Rush TD: {bonuses.bonus40RushTd > 0 ? '+' : ''}{bonuses.bonus40RushTd}</Badge>
                  )}
                  {bonuses.bonus50RushTd !== 0 && (
                    <Badge variant="outline" className="text-xs">50+ Yd Rush TD: {bonuses.bonus50RushTd > 0 ? '+' : ''}{bonuses.bonus50RushTd}</Badge>
                  )}
                  {bonuses.bonus40RecTd !== 0 && (
                    <Badge variant="outline" className="text-xs">40+ Yd Rec TD: {bonuses.bonus40RecTd > 0 ? '+' : ''}{bonuses.bonus40RecTd}</Badge>
                  )}
                  {bonuses.bonus50RecTd !== 0 && (
                    <Badge variant="outline" className="text-xs">50+ Yd Rec TD: {bonuses.bonus50RecTd > 0 ? '+' : ''}{bonuses.bonus50RecTd}</Badge>
                  )}
                  {bonuses.bonus40PassTd !== 0 && (
                    <Badge variant="outline" className="text-xs">40+ Yd Pass TD: {bonuses.bonus40PassTd > 0 ? '+' : ''}{bonuses.bonus40PassTd}</Badge>
                  )}
                  {bonuses.bonus50PassTd !== 0 && (
                    <Badge variant="outline" className="text-xs">50+ Yd Pass TD: {bonuses.bonus50PassTd > 0 ? '+' : ''}{bonuses.bonus50PassTd}</Badge>
                  )}
                </div>
              </div>
            )}

            {hasDstScoring && (
              <div className="mt-6 pt-4 border-t" data-testid="scoring-dst">
                <h4 className="text-sm font-medium mb-3">Defense / Special Teams</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                  <ScoringRow label="Sack" value={dst.sack} />
                  <ScoringRow label="Interception" value={dst.interception} />
                  <ScoringRow label="Fumble Recovery" value={dst.fumbleRecovery} />
                  <ScoringRow label="Forced Fumble" value={dst.forcedFumble} />
                  <ScoringRow label="Defensive TD" value={dst.td} />
                  <ScoringRow label="Safety" value={dst.safety} />
                  <ScoringRow label="Blocked Kick" value={dst.blockedKick} />
                  <ScoringRow label="0 Pts Allowed" value={dst.ptsAllow0} />
                  <ScoringRow label="1-6 Pts Allowed" value={dst.ptsAllow1_6} />
                  <ScoringRow label="7-13 Pts Allowed" value={dst.ptsAllow7_13} />
                  <ScoringRow label="14-20 Pts Allowed" value={dst.ptsAllow14_20} />
                  <ScoringRow label="21-27 Pts Allowed" value={dst.ptsAllow21_27} />
                  <ScoringRow label="28-34 Pts Allowed" value={dst.ptsAllow28_34} />
                  <ScoringRow label="35+ Pts Allowed" value={dst.ptsAllow35p} />
                </div>
              </div>
            )}

            {hasIdpScoring && (
              <div className="mt-6 pt-4 border-t" data-testid="scoring-idp">
                <h4 className="text-sm font-medium mb-3">Individual Defensive Player (IDP)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                  <ScoringRow label="Tackle" value={idp.idpTkl} />
                  <ScoringRow label="Solo Tackle" value={idp.idpTklSolo} />
                  <ScoringRow label="Assist Tackle" value={idp.idpTklAst} />
                  <ScoringRow label="Tackle for Loss" value={idp.idpTklLoss} />
                  <ScoringRow label="Sack" value={idp.idpSack} />
                  <ScoringRow label="QB Hit" value={idp.idpQbHit} />
                  <ScoringRow label="Interception" value={idp.idpInt} />
                  <ScoringRow label="Pass Defended" value={idp.idpPassDef} />
                  <ScoringRow label="Forced Fumble" value={idp.idpFf} />
                  <ScoringRow label="Fumble Recovery" value={idp.idpFumRec} />
                  <ScoringRow label="Defensive TD" value={idp.idpTd} />
                  <ScoringRow label="Safety" value={idp.idpSafe} />
                </div>
              </div>
            )}

            {hasKickingScoring && (
              <div className="mt-6 pt-4 border-t" data-testid="scoring-kicking">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-1">
                  <Goal className="h-3 w-3" /> Kicking
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                  <ScoringRow label="FG Made" value={kicking.fgMade} />
                  <ScoringRow label="FG Missed" value={kicking.fgMissed} />
                  <ScoringRow label="FG 0-19 Yds" value={kicking.fgMade0_19} />
                  <ScoringRow label="FG 20-29 Yds" value={kicking.fgMade20_29} />
                  <ScoringRow label="FG 30-39 Yds" value={kicking.fgMade30_39} />
                  <ScoringRow label="FG 40-49 Yds" value={kicking.fgMade40_49} />
                  <ScoringRow label="FG 50+ Yds" value={kicking.fgMade50p} />
                  <ScoringRow label="XP Made" value={kicking.xpMade} />
                  <ScoringRow label="XP Missed" value={kicking.xpMissed} />
                </div>
              </div>
            )}

            {hasSpecialTeamsScoring && (
              <div className="mt-6 pt-4 border-t" data-testid="scoring-special-teams">
                <h4 className="text-sm font-medium mb-3">Special Teams</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                  <ScoringRow label="Kick Return TD" value={specialTeams.krTd} />
                  <ScoringRow label="Punt Return TD" value={specialTeams.prTd} />
                  <ScoringRow label="Special Teams TD" value={specialTeams.stTd} />
                  <ScoringRow label="ST Forced Fumble" value={specialTeams.stFf} />
                  <ScoringRow label="ST Fumble Rec" value={specialTeams.stFumRec} />
                </div>
              </div>
            )}

            {hasUnmappedScoring && (
              <div className="mt-6 pt-4 border-t" data-testid="scoring-custom">
                <h4 className="text-sm font-medium mb-3">Additional Custom Scoring</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(unmappedScoring).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {formatScoringKey(key)}: {value > 0 ? '+' : ''}{value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
