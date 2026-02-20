import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { PageHeader } from "@/components/page-header";

interface LeagueData {
  leagueName: string;
  totalDues: number;
  totalWinnings: number;
  entries: any[];
}

interface AccountingSummary {
  leagues: Record<string, LeagueData>;
  totalDues: number;
  totalWinnings: number;
  net: number;
}

export default function AllLeaguesAccountingPage() {
  usePageTitle("All-Leagues Accounting");

  const { data, isLoading } = useQuery<AccountingSummary>({
    queryKey: ["/api/fantasy/accounting-summary"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  const totalDues = data?.totalDues || 0;
  const totalWinnings = data?.totalWinnings || 0;
  const net = data?.net || 0;
  
  // Convert leagues Record to array for rendering
  const leagues = data?.leagues
    ? Object.entries(data.leagues).map(([leagueId, leagueData]) => ({
        leagueId,
        leagueName: leagueData.leagueName,
        totalDues: leagueData.totalDues,
        totalWinnings: leagueData.totalWinnings,
        netBalance: leagueData.totalWinnings - leagueData.totalDues,
        entryCount: leagueData.entries.length,
      }))
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="All-Leagues Accounting"
        subtitle="Financial summary across all your leagues"
        icon={<PiggyBank className="h-6 w-6 text-primary" />}
        backTo="/"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-invested">
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingDown className="h-6 w-6 mx-auto mb-1 text-red-400" />
            <div className="text-2xl font-bold text-red-400" data-testid="text-total-invested">
              ${(totalDues / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total Invested</p>
          </CardContent>
        </Card>
        <Card data-testid="card-total-won">
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-1 text-emerald-400" />
            <div className="text-2xl font-bold text-emerald-400" data-testid="text-total-won">
              ${(totalWinnings / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total Won</p>
          </CardContent>
        </Card>
        <Card data-testid="card-net-profit-loss">
          <CardContent className="pt-4 pb-4 text-center">
            <DollarSign className="h-6 w-6 mx-auto mb-1 text-primary" />
            <div
              className={`text-2xl font-bold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}
              data-testid="text-net-profit-loss"
            >
              {net >= 0 ? "+" : ""}${(net / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Net Profit / Loss</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-leagues-table">
        <CardHeader>
          <CardTitle className="text-base">Per-League Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {leagues.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>League</TableHead>
                  <TableHead className="text-center">Entries</TableHead>
                  <TableHead className="text-right">Invested</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leagues.map((league) => (
                  <TableRow key={league.leagueId} data-testid={`row-league-${league.leagueId}`}>
                    <TableCell>
                      <span className="font-medium text-sm" data-testid={`text-league-name-${league.leagueId}`}>
                        {league.leagueName}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">{league.entryCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono text-red-400">
                      ${(league.totalDues / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono text-emerald-400">
                      ${(league.totalWinnings / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-mono ${league.netBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {league.netBalance >= 0 ? "+" : ""}${(league.netBalance / 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <PiggyBank className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No financial data yet. Add entries in your league accounting pages.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
