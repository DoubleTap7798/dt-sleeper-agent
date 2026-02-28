import dtLogo from "@assets/dt-sleeper-agent-logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-36 h-36",
  xl: "w-[20rem] h-[20rem]",
  "2xl": "w-[28rem] h-[28rem]",
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
      <div className={`${sizeClasses[size]} flex-shrink-0`}>
        <img 
          src={dtLogo} 
          alt="DT Sleeper Agent Logo" 
          className="w-full h-full object-contain"
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
