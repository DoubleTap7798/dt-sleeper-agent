import dtLogo from "@assets/5C7727FF-7D55-4538-97DE-3A329A1D5F25_1771180481564.png";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-10 h-10",
  md: "w-16 h-16",
  lg: "w-28 h-28",
  xl: "w-48 h-48",
  "2xl": "w-64 h-64",
};

const textSizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-5xl",
  "2xl": "text-6xl",
};

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const isLarge = size === "xl" || size === "2xl" || size === "lg";
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`} data-testid="logo">
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0 ${isLarge ? "shadow-[0_0_24px_rgba(217,169,78,0.2)] ring-1 ring-primary/20" : "ring-1 ring-primary/10"}`}>
        <img 
          src={dtLogo} 
          alt="DT Sleeper Agent Logo" 
          className="w-full h-full object-cover scale-110"
          data-testid="logo-icon"
        />
      </div>
      {showText && (
        <div className="text-center">
          <h1 className={`font-bold tracking-tight ${textSizeClasses[size]}`} data-testid="logo-text">
            <span className={isLarge ? "text-gradient-gold" : ""}>DT Sleeper Agent</span>
          </h1>
          {isLarge && (
            <p className="text-muted-foreground text-sm mt-1 tracking-widest uppercase">
              Fantasy Football Companion
            </p>
          )}
        </div>
      )}
    </div>
  );
}
