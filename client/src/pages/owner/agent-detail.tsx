import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Users, CreditCard, TrendingUp, TrendingDown,
  AlertTriangle, Calendar, Key, Mail, ScrollText,
  DollarSign, Smartphone, Ban, CheckCircle,
} from "lucide-react";
import { format } from "date-fns";

const paymentSchema = z.object({
  amount: z.number().min(1, "Amount must be positive"),
  description: z.string().optional(),
});

type AgentDetail = {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  notes?: string;
  allowedConfigs?: string[];
  balance: number;
  totalPurchases: number;
  totalPayments: number;
  subscribersCount: number;
  activeSubscribers: number;
  subscribers: Array<{
    id: string;
    name: string;
    deviceId?: string;
    code: string;
    isActive: boolean;
    durationMonths: number;
    pricePaid: number;
    expiresAt: string;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    type: "purchase" | "payment";
    amount: number;
    description?: string;
    createdAt: string;
  }>;
  logs: Array<{
    id: string;
    action: string;
    details?: string;
    createdAt: string;
  }>;
};

export default function AgentDetailPage() {
  useEffect(() => { document.title = "Agent Details | MoHmmeD VPN"; }, []);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/owner/agents/:id");
  const agentId = params?.id;
  const [payOpen, setPayOpen] = useState(false);

  const { data: agent, isLoading } = useQuery<AgentDetail>({
    queryKey: ["/api/agents", agentId],
    enabled: !!agentId,
  });

  const payForm = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, description: "" },
  });

  const paymentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/agents/${agentId}/payment`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setPayOpen(false);
      payForm.reset();
      toast({ title: "Payment recorded successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const configsMutation = useMutation({
    mutationFn: (allowedConfigs: string[]) => apiRequest("PATCH", `/api/agents/${agentId}/configs`, { allowedConfigs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId] });
      toast({ title: "Config types updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleConfig = (configType: string) => {
    if (!agent) return;
    const current = agent.allowedConfigs || ["ws", "ws_p80", "hu_p80"];
    const updated = current.includes(configType)
      ? current.filter(c => c !== configType)
      : [...current, configType];
    configsMutation.mutate(updated);
  };

  const suspendMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/agents/${agentId}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Layout title="Agent Details">
        <div className="space-y-4 max-w-5xl">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!agent) {
    return (
      <Layout title="Agent Not Found">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Agent not found</p>
          <Button variant="ghost" className="mt-4" onClick={() => setLocation("/owner/agents")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Agents
          </Button>
        </div>
      </Layout>
    );
  }

  const formatCurrency = (n: number) => `${n.toLocaleString()} IQD`;

  return (
    <Layout title={`Agent: ${agent.username}`}>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/owner/agents")} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
                <span className="text-lg font-bold text-primary">{agent.username[0].toUpperCase()}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-foreground">{agent.username}</h2>
                  <Badge variant={agent.isActive ? "secondary" : "destructive"}>
                    {agent.isActive ? "Active" : "Suspended"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" />
                  {agent.email}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => suspendMutation.mutate()} data-testid="button-toggle-suspend">
              {agent.isActive
                ? <><Ban className="w-4 h-4 mr-2" />Suspend</>
                : <><CheckCircle className="w-4 h-4 mr-2" />Activate</>
              }
            </Button>
            <Button onClick={() => setPayOpen(true)} data-testid="button-record-payment">
              <DollarSign className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </div>

        {agent.notes && (
          <Card>
            <CardContent className="py-3">
              <p className="text-sm text-muted-foreground">{agent.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Allowed Config Types</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[
              { key: "ws", label: "WS 443", color: "bg-green-500" },
              { key: "ws_p80", label: "WS P80", color: "bg-orange-500" },
              { key: "hu_p80", label: "HU P80", color: "bg-purple-500" },
            ].map(({ key, label, color }) => {
              const active = (agent.allowedConfigs || ["ws", "ws_p80", "hu_p80"]).includes(key);
              return (
                <Button
                  key={key}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className={active ? `${color} text-white hover:opacity-80` : ""}
                  onClick={() => toggleConfig(key)}
                  disabled={configsMutation.isPending}
                  data-testid={`button-toggle-config-${key}`}
                >
                  {active ? "✓ " : ""}{label}
                </Button>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subscribers</CardTitle>
              <Users className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground" data-testid="text-subscribers-count">{agent.subscribersCount}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{agent.activeSubscribers} active</p>
            </CardContent>
          </Card>

          <Card className={agent.balance > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Debt</CardTitle>
              <AlertTriangle className={`w-4 h-4 ${agent.balance > 0 ? "text-destructive" : "text-green-500"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${agent.balance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-balance">
                {agent.balance > 0 ? formatCurrency(agent.balance) : "Settled"}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Amount owed to you</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Charges</CardTitle>
              <TrendingDown className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground" data-testid="text-total-purchases">{formatCurrency(agent.totalPurchases)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Code purchases</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-payments">{formatCurrency(agent.totalPayments)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Payments received</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="subscribers" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="subscribers" data-testid="tab-subscribers">
              <Users className="w-4 h-4 mr-2" />Subscribers ({agent.subscribersCount})
            </TabsTrigger>
            <TabsTrigger value="transactions" data-testid="tab-transactions">
              <CreditCard className="w-4 h-4 mr-2" />Transactions ({agent.transactions.length})
            </TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">
              <ScrollText className="w-4 h-4 mr-2" />Logs ({agent.logs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscribers" className="mt-4">
            {agent.subscribers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No subscribers yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {agent.subscribers.map((sub) => {
                  const isExpired = new Date(sub.expiresAt) < new Date();
                  return (
                    <Card key={sub.id} data-testid={`card-sub-${sub.id}`}>
                      <CardContent className="flex flex-wrap items-center gap-3 py-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">{sub.name[0].toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground text-sm">{sub.name}</span>
                            <Badge variant={sub.isActive && !isExpired ? "secondary" : "destructive"} className="text-xs">
                              {!sub.isActive ? "Inactive" : isExpired ? "Expired" : "Active"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{sub.durationMonths} mo</Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Key className="w-3 h-3" />{sub.code}
                            </span>
                            {sub.deviceId && (
                              <span className="flex items-center gap-1">
                                <Smartphone className="w-3 h-3" />
                                {sub.deviceId.length > 16 ? sub.deviceId.substring(0, 16) + "..." : sub.deviceId}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(sub.expiresAt), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-foreground">{sub.pricePaid.toLocaleString()} IQD</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(sub.createdAt), "MMM d")}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="mt-4">
            {agent.transactions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CreditCard className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No transactions yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {agent.transactions.map((tx) => (
                  <Card key={tx.id} data-testid={`card-tx-${tx.id}`}>
                    <CardContent className="flex flex-wrap items-center gap-3 py-3">
                      <div className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 ${
                        tx.type === "purchase"
                          ? "bg-destructive/10 border border-destructive/20"
                          : "bg-green-500/10 border border-green-500/20"
                      }`}>
                        {tx.type === "purchase"
                          ? <TrendingDown className="w-4 h-4 text-destructive" />
                          : <TrendingUp className="w-4 h-4 text-green-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground text-sm">{tx.description || "Transaction"}</span>
                          <Badge variant={tx.type === "purchase" ? "destructive" : "secondary"} className="text-xs">
                            {tx.type === "purchase" ? "Charge" : "Payment"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                        </div>
                      </div>
                      <div className={`font-bold text-sm flex-shrink-0 ${
                        tx.type === "purchase" ? "text-destructive" : "text-green-600 dark:text-green-400"
                      }`}>
                        {tx.type === "purchase" ? "+" : "-"}{tx.amount.toLocaleString()} IQD
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            {agent.logs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <ScrollText className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No activity logs</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {agent.logs.map((log) => (
                  <Card key={log.id} data-testid={`card-log-${log.id}`}>
                    <CardContent className="flex flex-wrap items-center gap-3 py-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <ScrollText className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">{log.action}</Badge>
                        </div>
                        {log.details && <p className="text-sm text-foreground mt-0.5">{log.details}</p>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Record Payment from {agent.username}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted rounded-md p-3 mb-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Debt:</span>
              <span className={`font-bold ${agent.balance > 0 ? "text-destructive" : "text-green-600"}`}>
                {formatCurrency(agent.balance)}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Total Paid So Far:</span>
              <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(agent.totalPayments)}</span>
            </div>
          </div>
          <Form {...payForm}>
            <form onSubmit={payForm.handleSubmit((d) => paymentMutation.mutate(d))} className="space-y-4">
              <FormField control={payForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount Received (IQD)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="5000"
                      data-testid="input-payment-amount"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                  {field.value > 0 && agent.balance > 0 && (
                    <p className="text-xs text-muted-foreground">
                      After payment: debt will be <span className="font-bold">{formatCurrency(Math.max(0, agent.balance - field.value))}</span>
                    </p>
                  )}
                </FormItem>
              )} />
              <FormField control={payForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl><Input {...field} placeholder="Cash payment, bank transfer..." /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={paymentMutation.isPending} data-testid="button-confirm-payment">
                  {paymentMutation.isPending ? "Recording..." : "Confirm Payment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
