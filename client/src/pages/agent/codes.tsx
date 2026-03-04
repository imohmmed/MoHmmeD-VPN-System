import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Key, Copy, Check, Wifi, AlertCircle, QrCode } from "lucide-react";
import { format } from "date-fns";

type VpnCode = {
  id: string;
  code: string;
  deviceId?: string;
  cloudConfigUrl?: string;
  isActive: boolean;
  expiresAt: string;
  planName: string;
  createdAt: string;
};

function CodeRow({ code, onCopy, copied }: {
  code: VpnCode;
  onCopy: (text: string) => void;
  copied: string | null;
}) {
  const [showConfig, setShowConfig] = useState(false);

  return (
    <Card data-testid={`card-code-${code.id}`}>
      <CardContent className="py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Key className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-mono font-bold text-foreground text-sm flex-1 break-all">{code.code}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
            <Badge variant={code.isActive ? "secondary" : "destructive"} className="text-xs">
              {code.isActive ? "Active" : "Inactive"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCopy(code.code)}
              data-testid={`button-copy-${code.id}`}
            >
              {copied === code.code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
            {code.cloudConfigUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowConfig(!showConfig)}
                data-testid={`button-config-${code.id}`}
              >
                <QrCode className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pl-7 text-xs text-muted-foreground">
          <span>Expires: {format(new Date(code.expiresAt), "MMM d, yyyy")}</span>
          {code.deviceId && <span className="truncate max-w-[200px]">Device: {code.deviceId.substring(0, 12)}...</span>}
        </div>
        {showConfig && code.cloudConfigUrl && (
          <div className="pl-7">
            <div className="p-2.5 bg-muted rounded-md">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium">Cloud Config (NPV Tunnel)</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onCopy(code.cloudConfigUrl!)}
                >
                  {copied === code.cloudConfigUrl ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="font-mono text-xs text-muted-foreground break-all">{code.cloudConfigUrl}</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Share with user: NPV Tunnel → Configs → Import Cloud Config → paste URL
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AgentCodesPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<VpnCode | null>(null);

  const { data: codes = [], isLoading } = useQuery<VpnCode[]>({ queryKey: ["/api/codes"] });

  const form = useForm({
    defaultValues: { deviceId: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/codes", data);
      return res.json();
    },
    onSuccess: (code: VpnCode) => {
      queryClient.invalidateQueries({ queryKey: ["/api/codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setNewCode(code);
      form.reset();
      toast({ title: "VPN Code generated! 5,000 IQD charged." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied to clipboard!" });
  };

  return (
    <Layout title="My VPN Codes">
      <div className="space-y-5 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">VPN Codes</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Each code costs 5,000 IQD — {codes.length} generated</p>
          </div>
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setNewCode(null); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-generate-code">
                <Plus className="w-4 h-4 mr-2" />
                Generate Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Generate VPN Code
                </DialogTitle>
              </DialogHeader>

              {newCode ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
                      Code Generated Successfully!
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-lg font-bold text-foreground">{newCode.code}</code>
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(newCode.code)}>
                        {copied === newCode.code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {newCode.cloudConfigUrl && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Cloud Config URL</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleCopy(newCode.cloudConfigUrl!)}
                        >
                          {copied === newCode.cloudConfigUrl ? "Copied!" : "Copy URL"}
                        </Button>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground break-all leading-relaxed">
                        {newCode.cloudConfigUrl}
                      </p>
                      <div className="mt-2 p-2 bg-background rounded text-xs text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">How to connect:</p>
                        <ol className="list-decimal list-inside space-y-0.5">
                          <li>Open NPV Tunnel app</li>
                          <li>Tap Configs → + → Import Cloud Config</li>
                          <li>Paste the URL above</li>
                          <li>Connect and enjoy</li>
                        </ol>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-xs text-muted-foreground">
                    <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                    5,000 IQD has been added to your outstanding balance
                  </div>

                  <Button className="w-full" onClick={() => { setNewCode(null); setCreateOpen(false); }}>
                    Done
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                    <FormField control={form.control} name="deviceId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Device ID (from NPV Tunnel)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="0564022E-FC5A-46D8-B82C-E06C4BBE31A0"
                            data-testid="input-device-id"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Open NPV Tunnel app → More tab → copy Device ID
                        </p>
                      </FormItem>
                    )} />

                    <div className="p-3 bg-muted rounded-md">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium text-foreground">Cost: 5,000 IQD per code</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        This amount will be added to your balance owed
                      </p>
                    </div>

                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        data-testid="button-confirm-generate"
                      >
                        {createMutation.isPending ? "Generating..." : "Generate Code (5,000 IQD)"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="py-3"><Skeleton className="h-14 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : codes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Key className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">No codes yet</p>
              <p className="text-xs text-muted-foreground mt-1">Generate your first VPN code above</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {codes.map((code) => (
              <CodeRow
                key={code.id}
                code={code}
                onCopy={handleCopy}
                copied={copied}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
