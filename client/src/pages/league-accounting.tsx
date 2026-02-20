import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Plus, Trash2, TrendingUp, TrendingDown, Wallet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FinanceEntry {
  id: string;
  leagueId: string;
  leagueName: string;
  season: string;
  type: string;
  description: string;
  amount: number;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  dues: { label: "Dues", color: "text-red-400 bg-red-400/10 border-red-400/30" },
  prize: { label: "Prize", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  penalty: { label: "Penalty", color: "text-red-400 bg-red-400/10 border-red-400/30" },
  other: { label: "Other", color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
};

function isIncome(type: string): boolean {
  return type === "prize";
}

export default function LeagueAccountingPage() {
  usePageTitle("League Accounting");
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const { toast } = useToast();

  const [type, setType] = useState("dues");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [season, setSeason] = useState("2025");
  const [showForm, setShowForm] = useState(false);

  const { data: entries, isLoading } = useQuery<FinanceEntry[]>({
    queryKey: ["/api/fantasy/accounting", leagueId],
    enabled: !!leagueId,
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const res = await apiRequest("POST", `/api/fantasy/accounting/${leagueId}`, {
        type,
        description,
        amount: amountCents,
        season,
        leagueName: league?.name || "Unknown League",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Entry added!" });
      queryClient.invalidateQueries({ queryKey: ["/api/fantasy/accounting", leagueId] });
      setDescription("");
      setAmount("");
      setShowForm(false);
    },
    onError: (err: any) => toast({ title: "Failed to add entry", description: err.message, variant: "destructive" }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/fantasy/accounting/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Entry removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/fantasy/accounting", leagueId] });
    },
    onError: (err: any) => toast({ title: "Failed to remove entry", description: err.message, variant: "destructive" }),
  });

  if (!leagueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a league to view accounting</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  const totalDues = (entries || [])
    .filter((e) => !isIncome(e.type))
    .reduce((sum, e) => sum + e.amount, 0);
  const totalWinnings = (entries || [])
    .filter((e) => isIncome(e.type))
    .reduce((sum, e) => sum + e.amount, 0);
  const netBalance = totalWinnings - totalDues;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">League Accounting</h1>
            <p className="text-sm text-muted-foreground">Track dues, winnings, and expenses</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-toggle-form">
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-dues">
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingDown className="h-6 w-6 mx-auto mb-1 text-red-400" />
            <div className="text-2xl font-bold text-red-400" data-testid="text-total-dues">
              ${(totalDues / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total Dues / Expenses</p>
          </CardContent>
        </Card>
        <Card data-testid="card-total-winnings">
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-1 text-emerald-400" />
            <div className="text-2xl font-bold text-emerald-400" data-testid="text-total-winnings">
              ${(totalWinnings / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total Winnings</p>
          </CardContent>
        </Card>
        <Card data-testid="card-net-balance">
          <CardContent className="pt-4 pb-4 text-center">
            <DollarSign className="h-6 w-6 mx-auto mb-1 text-primary" />
            <div
              className={`text-2xl font-bold ${netBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}
              data-testid="text-net-balance"
            >
              {netBalance >= 0 ? "+" : ""}${(netBalance / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Net Balance</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card data-testid="card-add-entry-form">
          <CardHeader>
            <CardTitle className="text-base">Add Financial Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dues">Dues</SelectItem>
                    <SelectItem value="prize">Prize</SelectItem>
                    <SelectItem value="penalty">Penalty</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Season</label>
                <Select value={season} onValueChange={setSeason}>
                  <SelectTrigger data-testid="select-season">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    {["2020", "2021", "2022", "2023", "2024", "2025", "2026"].map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Description</label>
              <Input
                placeholder="e.g. Annual league dues"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Amount ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-amount"
              />
            </div>
            <Button
              onClick={() => addEntry.mutate()}
              disabled={!description || !amount || addEntry.isPending}
              className="w-full"
              data-testid="button-submit-entry"
            >
              {addEntry.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-entries-table">
        <CardHeader>
          <CardTitle className="text-base">Financial Entries</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {entries && entries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Season</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const income = isIncome(entry.type);
                  const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.other;
                  return (
                    <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${config.color}`}>
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-desc-${entry.id}`}>
                        {entry.description}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.season}</TableCell>
                      <TableCell className={`text-right text-sm font-mono ${income ? "text-emerald-400" : "text-red-400"}`} data-testid={`text-amount-${entry.id}`}>
                        {income ? "+" : "-"}${(entry.amount / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteEntry.mutate(entry.id)}
                          disabled={deleteEntry.isPending}
                          data-testid={`button-delete-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No financial entries yet. Add your first entry above!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
