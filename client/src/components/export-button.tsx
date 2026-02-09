import { Download, Copy, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, copyToClipboard } from "@/lib/export-utils";

interface ExportButtonProps {
  data: Record<string, any>[];
  filename: string;
  shareText?: string;
  label?: string;
}

export function ExportButton({ data, filename, shareText, label }: ExportButtonProps) {
  const { toast } = useToast();

  const handleCSVExport = () => {
    if (!data.length) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    exportToCSV(data, filename);
    toast({ title: "CSV downloaded" });
  };

  const handleCopyToClipboard = async () => {
    if (!shareText) {
      toast({ title: "Nothing to copy", variant: "destructive" });
      return;
    }
    const success = await copyToClipboard(shareText);
    if (success) {
      toast({ title: "Copied to clipboard" });
    } else {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-export">
          <Download className="h-4 w-4" />
          {label || "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {shareText && (
          <DropdownMenuItem onClick={handleCopyToClipboard} data-testid="button-copy-clipboard">
            <Copy className="h-4 w-4" />
            Copy to Clipboard
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleCSVExport} data-testid="button-download-csv">
          <FileDown className="h-4 w-4" />
          Download CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
