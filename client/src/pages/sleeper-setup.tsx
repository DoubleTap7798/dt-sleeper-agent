import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowRight, Loader2 } from "lucide-react";

export default function SleeperSetupPage() {
  const [username, setUsername] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const setupMutation = useMutation({
    mutationFn: async (sleeperUsername: string) => {
      const res = await apiRequest("POST", "/api/sleeper/connect", { username: sleeperUsername });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connected!",
        description: "Your Sleeper account has been linked successfully.",
      });
      queryClient.setQueryData(["/api/user/profile"], (old: any) => ({
        ...old,
        sleeperUsername: data.sleeperUsername,
        sleeperUserId: data.sleeperUserId,
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/sleeper/leagues"] });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Could not find that Sleeper username. Please check and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setupMutation.mutate(username.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo size="lg" className="mb-4" />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Connect Your Sleeper Account</CardTitle>
            <CardDescription>
              Enter your Sleeper username to sync your leagues. You only need to do this once.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter your Sleeper username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={setupMutation.isPending}
                  className="text-center"
                  data-testid="input-sleeper-username"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!username.trim() || setupMutation.isPending}
                data-testid="button-connect-sleeper"
              >
                {setupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                We only access public league data through the Sleeper API.
                <br />
                Your password is never shared with us.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
