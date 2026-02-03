import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function abbreviateName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return `${firstName.charAt(0)}. ${lastName}`;
}

export function getPositionColorClass(position?: string): string {
  if (!position) return "";
  const pos = position.toUpperCase();
  
  switch (pos) {
    case "QB":
      return "position-qb";
    case "RB":
    case "FB":
      return "position-rb";
    case "WR":
      return "position-wr";
    case "TE":
      return "position-te";
    case "K":
    case "PK":
      return "position-k";
    case "DEF":
    case "DL":
    case "DE":
    case "DT":
    case "LB":
    case "ILB":
    case "OLB":
    case "DB":
    case "CB":
    case "S":
    case "FS":
    case "SS":
      return "position-def";
    case "FLEX":
    case "REC_FLEX":
    case "WRRB_FLEX":
      return "position-flex";
    case "SUPER_FLEX":
    case "SF":
    case "SUPERFLEX":
      return "position-sf";
    case "PICK":
      return "position-pick";
    default:
      return "";
  }
}
