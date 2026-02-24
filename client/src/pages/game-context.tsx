import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, ShieldAlert } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import SchedulePage from "./schedule";
import InjuryTrackerPage from "./injury-tracker";

const tabs = [
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "injuries", label: "Injury Report", icon: ShieldAlert },
] as const;

type TabId = typeof tabs[number]["id"];

export default function GameContextPage() {
  usePageTitle("Game Context");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const tabFromUrl = urlParams.get("tab") as TabId | null;
  const validTabs: TabId[] = ["schedule", "injuries"];
  const resolvedTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "schedule";
  const [activeTab, setActiveTab] = useState<TabId>(resolvedTab);

  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight" data-testid="text-game-context-title">Game Context</h1>
        <p className="text-xs text-muted-foreground mt-1">Schedule overview and injury impact analysis</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <TabsList className="w-full justify-start h-auto gap-1 py-1 bg-muted/30" data-testid="game-context-tabs">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_8px_rgba(217,169,78,0.2)]"
              data-testid={`tab-context-${tab.id}`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="schedule" className="mt-4" data-testid="content-schedule">
          <SchedulePage />
        </TabsContent>
        <TabsContent value="injuries" className="mt-4" data-testid="content-injuries">
          <InjuryTrackerPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
