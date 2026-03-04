import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Key, Copy, Check, Power, QrCode, Wifi } from "lucide-react";
import { format } from "date-fns";

type VpnCode = {
  id: string;
  code: string;
  deviceId?: string;
  cloudConfigUrl?: string;
  configData?: string;
  agentId?: string;
  assignedTo?: string;
  isActive: boolean;
  expiresAt: string;
  planName: string;
  pricePaid: number;
  createdAt: string;
};

function CodeCard({ code, onDeactivate, onCopy, copied }: {
  code: VpnCode;
  onDeactivate: (id: string) => void;
  onCopy: (text: string) => void;
  copied: string | null;
}) {
  const [showConfig, setShowConfig] = useState(false);

  return (
    <Card data-testid={`card-code-${code.id}`}>
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
            <Key className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-foreground text-sm">{code.code}</span>
              <Badge variant={code.isActive ? "secondary" : "destructive"} className="text-xs">
                {code.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline" className="text-xs">{code.planName}</Badge>
            </div>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
              <span>Expires: {format(new Date(code.expiresAt), "MMM d, yyyy")}</span>
              {code.deviceId && <span className="truncate max-w-[200px]">Device: {code.deviceId.substring(0, 16)}...</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCopy(code.code)}
              data-testid={`button-copy-code-${code.id}`}
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
            {code.isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => onDeactivate(code.id)}
                data-testid={`button-deactivate-${code.id}`}
              >
                <Power className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {showConfig && code.cloudConfigUrl && (
          <div className="mt-2 p-3 bg-muted rounded-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">Cloud Config URL (NPV Tunnel)</span>
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
            <p className="font-mono text-xs text-muted-foreground break-all leading-relaxed">
              {code.cloudConfigUrl}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CodesPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: codes = [], isLoading } = useQuery<VpnCode[]>({ queryKey: ["/api/codes"] });

  const form = useForm({
    defaultValues: { deviceId: "", planName: "Monthly" },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/codes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setCreateOpen(false);
      form.reset();
      toast({ title: "VPN Code generated successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/codes/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/codes"] });
      toast({ title: "Code deactivated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const filtered = codes.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.deviceId && c.deviceId.toLowerCase().includes(search.toLowerCase()))
  );

  const activeCount = codes.filter(c => c.isActive).length;

  return (
    <Layout title="VPN Codes">
      <div className="space-y-5 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">VPN Codes</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {activeCount} active / {codes.length} total
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                        Copy Device ID from NPV Tunnel app → More tab
                      </p>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="planName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Monthly" />
                      </FormControl>
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-confirm-generate">
                      {createMutation.isPending ? "Generating..." : "Generate Code"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Input
          placeholder="Search by code or device ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-codes"
          className="max-w-sm"
        />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="py-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Key className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No codes found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((code) => (
              <CodeCard
                key={code.id}
                code={code}
                onDeactivate={(id) => deactivateMutation.mutate(id)}
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
