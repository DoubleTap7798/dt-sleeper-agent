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
    case "WRS":
      return "position-wr";
    case "TE":
      return "position-te";
    case "K":
    case "PK":
      return "position-k";
    case "EDGE":
    case "DE":
      return "position-edge";
    case "DL":
    case "DT":
    case "DL1T":
    case "DL3T":
    case "DL5T":
    case "DEF":
      return "position-dl";
    case "LB":
    case "ILB":
    case "OLB":
      return "position-lb";
    case "CB":
    case "DB":
      return "position-cb";
    case "S":
    case "FS":
    case "SS":
      return "position-s";
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
