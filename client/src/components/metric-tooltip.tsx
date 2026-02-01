import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const metricDefinitions = {
  dynastyValue: {
    title: "Dynasty Value",
    description: "Custom 0-100 score combining production, age, role security, and market consensus. Higher = more valuable in dynasty leagues.",
  },
  vor: {
    title: "Value Over Replacement",
    description: "Points scored above a baseline replacement player at the same position. Measures relative fantasy value.",
  },
  fitScore: {
    title: "Fit Score",
    description: "How well this player fills your team's needs. Combines dynasty value with position scarcity on your roster.",
  },
  rosterStrength: {
    title: "Roster Strength",
    description: "Your position group's total dynasty value compared to other teams. 100% = best in league.",
  },
  valueChange: {
    title: "Value Change",
    description: "Difference between current dynasty value and value when you added this player to your watchlist.",
  },
  snapShare: {
    title: "Snap %",
    description: "Percentage of offensive plays this player was on the field. Higher snap share typically means more opportunity.",
  },
  targetShare: {
    title: "Target Share",
    description: "Percentage of team passing targets going to this player. Key indicator for receiver value.",
  },
  redZoneShare: {
    title: "Red Zone Share",
    description: "Percentage of team's red zone opportunities going to this player. Correlates with touchdown potential.",
  },
  ageMultiplier: {
    title: "Age Factor",
    description: "Dynasty value adjustment based on player age relative to position peak. Young players get a boost, older players a penalty.",
  },
  productionCeiling: {
    title: "Production Ceiling",
    description: "Multiplier based on weekly PPG percentile. Elite producers get up to 1.5x boost.",
  },
};

type MetricKey = keyof typeof metricDefinitions;

interface MetricTooltipProps {
  metric: MetricKey;
  className?: string;
  children?: React.ReactNode;
}

export function MetricTooltip({ metric, className, children }: MetricTooltipProps) {
  const definition = metricDefinitions[metric];
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 cursor-help bg-transparent border-none p-0 text-inherit font-inherit ${className || ""}`}
          aria-label={`${definition.title}: ${definition.description}`}
        >
          {children || definition.title}
          <Info className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">{definition.title}</p>
        <p className="text-xs text-muted-foreground">{definition.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface SimpleTooltipProps {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}

export function SimpleTooltip({ title, description, className, children }: SimpleTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 cursor-help bg-transparent border-none p-0 text-inherit font-inherit ${className || ""}`}
          aria-label={`${title}: ${description}`}
        >
          {children}
          <Info className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
