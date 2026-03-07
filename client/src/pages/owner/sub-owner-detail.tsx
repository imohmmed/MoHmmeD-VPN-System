import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Users, CreditCard, TrendingUp, TrendingDown,
  AlertTriangle, Calendar, Mail, Key, Trash2, Power,
  Smartphone, Ban, CheckCircle, Crown, UserCog,
} from "lucide-react";
import { format } from "date-fns";

type SubOwnerDetail = {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  notes?: string;
  serverAddress?: string;
  prefix?: string;
  allowedConfigs?: string[];
  balance: number;
  totalPurchases: number;
  totalPayments: number;
  agentsCount: number;
  subscribersCount: number;
  activeSubscribers: number;
  agents: Array<{
    id: string;
    username: string;
    email: string;
    isActive: boolean;
    subscribersCount: number;
    balance: number;
  }>;
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
    agentUsername?: string;
  }>;
  transactions: Array<{
    id: string;
    type: "purchase" | "payment";
    amount: number;
    description?: string;
    createdAt: string;
  }>;
};

export default function SubOwnerDetailPage() {
  useEffect(() => { document.title = "Sub-Owner Details | MoHmmeD VPN"; }, []);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/owner/sub-owners/:id");
  const subOwnerId = params?.id;
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null);
  const { data: subOwner, isLoading } = useQuery<SubOwnerDetail>({
    queryKey: ["/api/sub-owners", subOwnerId],
    enabled: !!subOwnerId,
  });

  const suspendMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/sub-owners/${subOwnerId}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-owners", subOwnerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-owners"] });
      toast({ title: "Sub-owner status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteSubMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/subscribers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-owners", subOwnerId] });
      setDeleteSubId(null);
      toast({ title: "Subscriber deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleSubMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/subscribers/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-owners", subOwnerId] });
      toast({ title: "Subscriber status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const configsMutation = useMutation({
    mutationFn: (allowedConfigs: string[]) => apiRequest("PATCH", `/api/sub-owners/${subOwnerId}/configs`, { allowedConfigs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-owners", subOwnerId] });
      toast({ title: "Config types updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleConfig = (configType: string) => {
    if (!subOwner) return;
    const current = subOwner.allowedConfigs || ["ws", "ws_p80", "hu_p80"];
    const updated = current.includes(configType)
      ? current.filter(c => c !== configType)
      : [...current, configType];
    configsMutation.mutate(updated);
  };

  if (isLoading) {
    return (
      <Layout title="Owner Details">
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

  if (!subOwner) {
    return (
      <Layout title="Owner Not Found">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Sub-owner not found</p>
          <Button variant="ghost" className="mt-4" onClick={() => setLocation("/owner/sub-owners")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Owners
          </Button>
        </div>
      </Layout>
    );
  }

  const formatCurrency = (n: number) => `${n.toLocaleString()} IQD`;

  return (
    <Layout title={`Owner: ${subOwner.username}`}>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/owner/sub-owners")} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
                <span className="text-lg font-bold text-primary">{subOwner.username[0].toUpperCase()}</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-foreground">{subOwner.username}</h2>
                  <Badge variant={subOwner.isActive ? "secondary" : "destructive"}>
                    {subOwner.isActive ? "Active" : "Suspended"}
                  </Badge>
                  {subOwner.serverAddress && <Badge variant="outline">{subOwner.serverAddress}</Badge>}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" />
                  {subOwner.email}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => suspendMutation.mutate()} data-testid="button-toggle-suspend">
              {subOwner.isActive
                ? <><Ban className="w-4 h-4 mr-2" />Suspend</>
                : <><CheckCircle className="w-4 h-4 mr-2" />Activate</>
              }
            </Button>
          </div>
        </div>

        {subOwner.notes && (
          <Card>
            <CardContent className="py-3">
              <p className="text-sm text-muted-foreground">{subOwner.notes}</p>
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
              const active = (subOwner.allowedConfigs || ["ws", "ws_p80", "hu_p80"]).includes(key);
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Agents</CardTitle>
              <UserCog className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground" data-testid="text-agents-count">{subOwner.agentsCount}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{subOwner.subscribersCount} total subscribers</p>
            </CardContent>
          </Card>

          <Card className={subOwner.balance > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Agents Total Debt</CardTitle>
              <AlertTriangle className={`w-4 h-4 ${subOwner.balance > 0 ? "text-destructive" : "text-green-500"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${subOwner.balance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-balance">
                {subOwner.balance > 0 ? formatCurrency(subOwner.balance) : "Settled"}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Total debt from agents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Charges</CardTitle>
              <TrendingDown className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground" data-testid="text-total-purchases">{formatCurrency(subOwner.totalPurchases)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">From agents' purchases</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-payments">{formatCurrency(subOwner.totalPayments)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Payments received</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="agents" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="agents" data-testid="tab-agents">
              <UserCog className="w-4 h-4 mr-2" />Agents ({subOwner.agentsCount})
            </TabsTrigger>
            <TabsTrigger value="subscribers" data-testid="tab-subscribers">
              <Users className="w-4 h-4 mr-2" />Subscribers ({subOwner.subscribersCount})
            </TabsTrigger>
            <TabsTrigger value="transactions" data-testid="tab-transactions">
              <CreditCard className="w-4 h-4 mr-2" />Transactions ({subOwner.transactions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="mt-4">
            {subOwner.agents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <UserCog className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No agents yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {subOwner.agents.map((agent) => (
                  <Card key={agent.id} data-testid={`card-agent-${agent.id}`}>
                    <CardContent className="flex flex-wrap items-center gap-3 py-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{agent.username[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground text-sm">{agent.username}</span>
                          <Badge variant={agent.isActive ? "secondary" : "destructive"} className="text-xs">
                            {agent.isActive ? "Active" : "Suspended"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">{agent.email}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 text-center flex-shrink-0">
                        <div>
                          <p className="text-xs text-muted-foreground">Subscribers</p>
                          <p className="font-bold text-foreground text-sm">{agent.subscribersCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Owes</p>
                          <p className={`font-bold text-sm ${agent.balance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                            {agent.balance > 0 ? `${agent.balance.toLocaleString()} IQD` : "Settled"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="subscribers" className="mt-4">
            {subOwner.subscribers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No subscribers yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {subOwner.subscribers.map((sub) => {
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
                            {sub.agentUsername && (
                              <Badge variant="outline" className="text-xs">Agent: {sub.agentUsername}</Badge>
                            )}
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
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right mr-2">
                            <p className="text-sm font-bold text-foreground">{sub.pricePaid.toLocaleString()} IQD</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(sub.createdAt), "MMM d")}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={sub.isActive ? "text-destructive" : "text-green-600"}
                            onClick={() => toggleSubMutation.mutate(sub.id)}
                            data-testid={`button-toggle-sub-${sub.id}`}
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeleteSubId(sub.id)}
                            data-testid={`button-delete-sub-${sub.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="mt-4">
            {subOwner.transactions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CreditCard className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No transactions yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {subOwner.transactions.map((tx) => (
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
        </Tabs>
      </div>

      <AlertDialog open={!!deleteSubId} onOpenChange={(o) => !o && setDeleteSubId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscriber</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this subscriber and their VPN access.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSubId && deleteSubMutation.mutate(deleteSubId)} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
