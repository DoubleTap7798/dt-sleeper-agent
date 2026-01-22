import dtLogo from "@assets/1768235453036_1769043440542.jpeg";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-10 h-10",
  md: "w-16 h-16",
  lg: "w-28 h-28",
  xl: "w-48 h-48",
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
      <img 
        src={dtLogo} 
        alt="DT Sleeper Agent Logo" 
        className={`${sizeClasses[size]} rounded-full object-cover`}
        data-testid="logo-icon"
      />
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
