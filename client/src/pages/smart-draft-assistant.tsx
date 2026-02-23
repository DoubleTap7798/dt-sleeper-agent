import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SmartDraftAssistantPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/league/live-draft");
  }, [setLocation]);

  return null;
}
