import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PremiumGate } from "@/components/premium-gate";
import { Zap, Target, Gauge, Trophy } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import LineupOptimizerPage from "./lineup-optimizer";
import LineupAdvicePage from "./lineup-advice";
import BoomBustPage from "./boom-bust";
import WeeklyPredictionsPage from "./weekly-predictions";

const tabs = [
  { id: "optimizer", label: "Optimizer", icon: Zap },
  { id: "advice", label: "Advice", icon: Target },
  { id: "boom-bust", label: "Boom/Bust", icon: Gauge },
  { id: "predictions", label: "Predictions", icon: Trophy },
] as const;

type TabId = typeof tabs[number]["id"];

export default function LineupLabPage() {
  usePageTitle("Lineup Lab");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const tabFromUrl = urlParams.get("tab") as TabId | null;
  const validTabs: TabId[] = ["optimizer", "advice", "boom-bust", "predictions"];
  const resolvedTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "optimizer";
  const [activeTab, setActiveTab] = useState<TabId>(resolvedTab);

  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  return (
    <PremiumGate featureName="Lineup Lab">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-lineup-lab-title">Lineup Lab</h1>
          <p className="text-xs text-muted-foreground mt-1">Optimize, analyze, and predict your lineup performance</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
          <TabsList className="w-full justify-start h-auto flex-wrap gap-1 py-1 bg-muted/30" data-testid="lineup-lab-tabs">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_8px_rgba(217,169,78,0.2)]"
                data-testid={`tab-lineup-${tab.id}`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="optimizer" className="mt-4" data-testid="content-optimizer">
            <LineupOptimizerPage />
          </TabsContent>
          <TabsContent value="advice" className="mt-4" data-testid="content-advice">
            <LineupAdvicePage />
          </TabsContent>
          <TabsContent value="boom-bust" className="mt-4" data-testid="content-boom-bust">
            <BoomBustPage />
          </TabsContent>
          <TabsContent value="predictions" className="mt-4" data-testid="content-predictions">
            <WeeklyPredictionsPage />
          </TabsContent>
        </Tabs>
      </div>
    </PremiumGate>
  );
}
