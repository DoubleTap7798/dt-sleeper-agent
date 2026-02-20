import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  backTo?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, icon, backTo, actions }: PageHeaderProps) {
  const [, navigate] = useLocation();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      window.history.back();
    }
  };

  return (
    <div className="flex items-start gap-3 mb-4 md:mb-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBack}
        className="shrink-0 mt-0.5 h-8 w-8"
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {icon}
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">{title}</h1>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-page-subtitle">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
