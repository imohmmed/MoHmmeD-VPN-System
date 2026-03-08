import { useState, useEffect } from "react";
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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, UserCog, Mail, Users, Ban, CheckCircle,
  Trash2, DollarSign, MoreVertical, ChevronRight,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";

const createAgentSchema = z.object({
  email: z.string().email("Invalid email"),
  username: z.string().min(3, "Min 3 characters"),
  password: z.string().min(6, "Min 6 characters"),
  prefix: z.string().min(2, "Min 2 characters").max(15, "Max 15 characters").regex(/^[a-zA-Z0-9]+$/, "English letters and numbers only"),
  notes: z.string().optional(),
});

const paymentSchema = z.object({
  amount: z.number().min(1, "Amount must be positive"),
  description: z.string().optional(),
});

type Agent = {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  balance: number;
  subscribersCount: number;
  notes?: string;
};

export default function AgentsPage() {
  useEffect(() => { document.title = "Agents | AlAli Plus"; }, []);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paymentAgentId, setPaymentAgentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: agents = [], isLoading } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });

  const form = useForm({
    resolver: zodResolver(createAgentSchema),
    defaultValues: { email: "", username: "", password: "", prefix: "", notes: "" },
  });

  const payForm = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, description: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/agents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setCreateOpen(false);
      form.reset();
      toast({ title: "Agent created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/agents/${id}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDeleteId(null);
      toast({ title: "Agent deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("POST", `/api/agents/${id}/payment`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setPaymentAgentId(null);
      payForm.reset();
      toast({ title: "Payment recorded" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = agents.filter(a =>
    a.username.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Manage Agents">
      <div className="space-y-5 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Agents</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Manage reseller accounts</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-agent">
                <Plus className="w-4 h-4 mr-2" />
                New Agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Agent Account</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="agent@email.com" data-testid="input-agent-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl><Input {...field} placeholder="agentname" data-testid="input-agent-username" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input {...field} type="password" placeholder="••••••••" data-testid="input-agent-password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="prefix" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prefix (بادئة اسم المشتركين)</FormLabel>
                      <FormControl><Input {...field} placeholder="مثال: star, moon, vpn1" data-testid="input-agent-prefix" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Notes about this agent..." /></FormControl>
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-confirm-create-agent">
                      {createMutation.isPending ? "Creating..." : "Create Agent"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-agents"
          className="max-w-sm"
        />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="py-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <UserCog className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No agents found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((agent) => (
              <Card
                key={agent.id}
                data-testid={`card-agent-${agent.id}`}
                className="cursor-pointer transition-colors hover:bg-accent/50"
                onClick={() => setLocation(`/owner/agents/${agent.id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{agent.username[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{agent.username}</span>
                        <Badge variant={agent.isActive ? "secondary" : "destructive"} className="text-xs">
                          {agent.isActive ? "Active" : "Suspended"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate">{agent.email}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-center">
                      <div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />Subscribers
                        </div>
                        <p className="font-bold text-foreground text-sm">{agent.subscribersCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Owes</p>
                        <p className={`font-bold text-sm ${agent.balance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                          {agent.balance > 0 ? `${agent.balance.toLocaleString()} IQD` : "Settled"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-agent-menu-${agent.id}`} onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/owner/agents/${agent.id}`)} data-testid={`button-view-${agent.id}`}>
                            <Users className="w-4 h-4 mr-2" />View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPaymentAgentId(agent.id)} data-testid={`button-payment-${agent.id}`}>
                            <DollarSign className="w-4 h-4 mr-2" />Record Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => suspendMutation.mutate(agent.id)} data-testid={`button-suspend-${agent.id}`}>
                            {agent.isActive
                              ? <><Ban className="w-4 h-4 mr-2" />Suspend</>
                              : <><CheckCircle className="w-4 h-4 mr-2" />Activate</>
                            }
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(agent.id)} data-testid={`button-delete-${agent.id}`}>
                            <Trash2 className="w-4 h-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this agent and all their records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete">
              Delete Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!paymentAgentId} onOpenChange={(o) => !o && setPaymentAgentId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <Form {...payForm}>
            <form onSubmit={payForm.handleSubmit((d) =>
              paymentAgentId && paymentMutation.mutate({ id: paymentAgentId, data: d })
            )} className="space-y-4">
              <FormField control={payForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (IQD)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="5000" data-testid="input-payment-amount" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={payForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl><Input {...field} placeholder="Payment notes..." /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={paymentMutation.isPending} data-testid="button-confirm-payment">
                  {paymentMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
