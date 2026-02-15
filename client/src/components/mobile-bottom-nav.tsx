import { useLocation, useSearch } from "wouter";
import { Home, Swords, Users, CalendarDays, Bot, UserSearch, Newspaper, BarChart3 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

const leagueNavItems = [
  { icon: Home, label: "Home", path: "/league", matchPath: "/league" },
  { icon: Users, label: "Roster", path: "/league/roster", matchPath: "/league/roster" },
  { icon: Swords, label: "Matchups", path: "/league/matchups", matchPath: "/league/matchups" },
  { icon: CalendarDays, label: "Schedule", path: "/league/schedule", matchPath: "/league/schedule" },
  { icon: Bot, label: "AI Chat", path: "/league/ai-chat", matchPath: "/league/ai-chat" },
];

const globalNavItems = [
  { icon: Home, label: "Home", path: "/league", matchPath: "/league" },
  { icon: UserSearch, label: "Players", path: "/league/players", matchPath: "/league/players" },
  { icon: Newspaper, label: "News", path: "/league/news", matchPath: "/league/news" },
  { icon: BarChart3, label: "Leaders", path: "/league/stat-leaders", matchPath: "/league/stat-leaders" },
  { icon: Bot, label: "AI Chat", path: "/league/ai-chat", matchPath: "/league/ai-chat" },
];

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const leagueId = params.get("id");

  if (!isMobile) return null;

  const isLeaguePage = location.startsWith("/league");
  if (!isLeaguePage) return null;

  const hasSpecificLeague = !!leagueId && leagueId !== "all";
  const navItems = hasSpecificLeague ? leagueNavItems : globalNavItems;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border flex items-center justify-around px-1 safe-area-bottom"
      data-testid="mobile-bottom-nav"
    >
      {navItems.map((item) => {
        const isActive = location === item.matchPath || (item.matchPath === "/league" && location === "/league" && !location.includes("/league/"));
        const href = leagueId ? `${item.path}?id=${leagueId}` : item.path;

        return (
          <Button
            key={item.path}
            variant="ghost"
            onClick={() => setLocation(href)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 rounded-none no-default-hover-elevate no-default-active-elevate ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`}
            data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
