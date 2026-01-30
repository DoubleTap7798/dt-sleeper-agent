import { useState } from "react";
import { Download, Share, Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/use-pwa-install";

export function PwaInstallButton() {
  const { isInstalled, canPromptInstall, platform, promptInstall } = usePwaInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (canPromptInstall) {
      await promptInstall();
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        title="Install App"
        data-testid="button-pwa-install"
      >
        <Download className="h-5 w-5" />
      </Button>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install DT Sleeper Agent</DialogTitle>
            <DialogDescription>
              Add this app to your home screen for the best experience
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {platform === "ios" ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm font-medium">1</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Tap the Share button</p>
                    <p className="text-sm text-muted-foreground">
                      Look for the <Share className="inline h-4 w-4" /> icon at the bottom of Safari
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm font-medium">2</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Scroll down and tap "Add to Home Screen"</p>
                    <p className="text-sm text-muted-foreground">
                      Look for the <Plus className="inline h-4 w-4" /> Add to Home Screen option
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm font-medium">3</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Tap "Add"</p>
                    <p className="text-sm text-muted-foreground">
                      The app will appear on your home screen
                    </p>
                  </div>
                </div>
              </div>
            ) : platform === "android" ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm font-medium">1</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Tap the menu button</p>
                    <p className="text-sm text-muted-foreground">
                      Look for the <MoreVertical className="inline h-4 w-4" /> icon in Chrome's top right corner
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm font-medium">2</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Tap "Add to Home screen" or "Install app"</p>
                    <p className="text-sm text-muted-foreground">
                      You may see either option depending on your browser
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm font-medium">3</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Tap "Install" or "Add"</p>
                    <p className="text-sm text-muted-foreground">
                      The app will appear on your home screen
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm font-medium">1</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Look for the install icon</p>
                    <p className="text-sm text-muted-foreground">
                      In Chrome or Edge, look for the <Download className="inline h-4 w-4" /> icon in the address bar
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm font-medium">2</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Click "Install"</p>
                    <p className="text-sm text-muted-foreground">
                      The app will open in its own window
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowInstructions(false)} data-testid="button-pwa-install-close">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
