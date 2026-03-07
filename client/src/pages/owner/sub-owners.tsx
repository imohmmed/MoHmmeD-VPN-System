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
  Plus, Crown, Mail, Users, Ban, CheckCircle,
  Trash2, MoreVertical, ChevronRight,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";

const createSubOwnerSchema = z.object({
  email: z.string().email("Invalid email"),
  username: z.string().min(3, "Min 3 characters"),
  password: z.string().min(6, "Min 6 characters"),
  prefix: z.string().min(2, "Min 2 characters").max(15, "Max 15 characters").regex(/^[a-zA-Z0-9]+$/, "English letters and numbers only"),
  serverAddress: z.string().min(1, "Server address required"),
  notes: z.string().optional(),
});

type SubOwner = {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  balance: number;
  serverAddress: string;
  agentsCount: number;
  subscribersCount: number;
  notes?: string;
};

export default function SubOwnersPage() {
  useEffect(() => { document.title = "Sub-Owners | MoHmmeD VPN"; }, []);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: subOwners = [], isLoading } = useQuery<SubOwner[]>({ queryKey: ["/api/sub-owners"] });

  const form = useForm({
    resolver: zodResolver(createSubOwnerSchema),
    defaultValues: { email: "", username: "", password: "", prefix: "", serverAddress: "", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sub-owners", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-owners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setCreateOpen(false);
      form.reset();
      toast({ title: "Sub-owner created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/sub-owners/${id}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-owners"] });
      toast({ title: "Sub-owner status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sub-owners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-owners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDeleteId(null);
      toast({ title: "Sub-owner deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = subOwners.filter(a =>
    a.username.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Manage Owners">
      <div className="space-y-5 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Owners</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Manage sub-owner accounts</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-sub-owner">
                <Plus className="w-4 h-4 mr-2" />
                New Owner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Sub-Owner Account</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="owner@email.com" data-testid="input-sub-owner-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl><Input {...field} placeholder="ownername" data-testid="input-sub-owner-username" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input {...field} type="password" placeholder="••••••••" data-testid="input-sub-owner-password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="prefix" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prefix</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. star, moon, vpn1" data-testid="input-sub-owner-prefix" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="serverAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Server Address (Domain)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. kemo.com"
                          data-testid="input-sub-owner-server-address"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Notes about this sub-owner..." /></FormControl>
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-confirm-create-sub-owner">
                      {createMutation.isPending ? "Creating..." : "Create Owner"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Input
          placeholder="Search owners..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-sub-owners"
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
              <Crown className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No owners found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((so) => (
              <Card
                key={so.id}
                data-testid={`card-sub-owner-${so.id}`}
                className="cursor-pointer transition-colors hover:bg-accent/50"
                onClick={() => setLocation(`/owner/sub-owners/${so.id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{so.username[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{so.username}</span>
                        <Badge variant={so.isActive ? "secondary" : "destructive"} className="text-xs">
                          {so.isActive ? "Active" : "Suspended"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{so.serverAddress}</Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate">{so.email}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-center">
                      <div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Crown className="w-3 h-3" />Agents
                        </div>
                        <p className="font-bold text-foreground text-sm">{so.agentsCount}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />Subscribers
                        </div>
                        <p className="font-bold text-foreground text-sm">{so.subscribersCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Agents Debt</p>
                        <p className={`font-bold text-sm ${so.balance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                          {so.balance > 0 ? `${so.balance.toLocaleString()} IQD` : "Settled"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-sub-owner-menu-${so.id}`} onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/owner/sub-owners/${so.id}`)} data-testid={`button-view-sub-owner-${so.id}`}>
                            <Users className="w-4 h-4 mr-2" />View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => suspendMutation.mutate(so.id)} data-testid={`button-suspend-sub-owner-${so.id}`}>
                            {so.isActive
                              ? <><Ban className="w-4 h-4 mr-2" />Suspend</>
                              : <><CheckCircle className="w-4 h-4 mr-2" />Activate</>
                            }
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(so.id)} data-testid={`button-delete-sub-owner-${so.id}`}>
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
            <AlertDialogTitle>Delete Sub-Owner?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this sub-owner and all their agents, subscribers, and records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-sub-owner">
              Delete Owner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}
