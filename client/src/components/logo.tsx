import { Shield } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-20 h-20",
  xl: "w-32 h-32",
};

const textSizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-5xl",
};

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`} data-testid="logo">
      <div className={`relative ${sizeClasses[size]}`}>
        <Shield 
          className={`${sizeClasses[size]} text-foreground fill-background stroke-[1.5]`} 
          data-testid="logo-icon"
        />
        <span className={`absolute inset-0 flex items-center justify-center font-bold ${
          size === "sm" ? "text-xs" : size === "md" ? "text-sm" : size === "lg" ? "text-xl" : "text-3xl"
        }`}>
          DT
        </span>
      </div>
      {showText && (
        <div className="text-center">
          <h1 className={`font-bold tracking-tight ${textSizeClasses[size]}`} data-testid="logo-text">
            DT Sleeper Agent
          </h1>
          {size === "xl" && (
            <p className="text-muted-foreground text-sm mt-1">
              Fantasy Football Companion
            </p>
          )}
        </div>
      )}
    </div>
  );
}
