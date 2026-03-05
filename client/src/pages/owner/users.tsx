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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Users, Trash2, Calendar, Copy, Check,
  Power, Smartphone, Link2, UserCheck,
} from "lucide-react";
import { format } from "date-fns";

const createSubSchema = z.object({
  name: z.string().min(1, "Name is required"),
  deviceId: z.string().optional(),
  notes: z.string().optional(),
  durationMonths: z.number().min(1).max(12).default(1),
});

type Subscriber = {
  id: string;
  name: string;
  deviceId?: string;
  notes?: string;
  code: string;
  cloudConfigUrl?: string;
  marzbanUsername?: string;
  subscriptionUrl?: string;
  isActive: boolean;
  durationMonths: number;
  expiresAt: string;
  createdAt: string;
  agentId?: string;
  agentName?: string;
  configUsed?: boolean;
};

function SubscriberCard({ sub, onDelete, onToggle, onCopy, onResetConfig, copied }: {
  sub: Subscriber;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onCopy: (text: string) => void;
  onResetConfig: (id: string) => void;
  copied: string | null;
}) {
  const isExpired = new Date(sub.expiresAt) < new Date();

  return (
    <Card data-testid={`card-sub-${sub.id}`}>
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
            <span className="text-sm font-bold text-primary">{sub.name[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{sub.name}</span>
              <Badge variant={sub.isActive && !isExpired ? "secondary" : "destructive"} className="text-xs">
                {!sub.isActive ? "Inactive" : isExpired ? "Expired" : "Active"}
              </Badge>
              <Badge variant="outline" className="text-xs">{sub.durationMonths} month{sub.durationMonths > 1 ? "s" : ""}</Badge>
            </div>
            <span className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              Expires: {format(new Date(sub.expiresAt), "MMM d, yyyy")}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => onCopy(sub.code)} data-testid={`button-copy-code-${sub.id}`}>
              {copied === sub.code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={sub.isActive ? "text-destructive" : "text-green-600"}
              onClick={() => onToggle(sub.id)}
              data-testid={`button-toggle-${sub.id}`}
            >
              <Power className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(sub.id)} data-testid={`button-delete-${sub.id}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="pl-[52px] space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <UserCheck className="w-3 h-3 text-purple-500" />
            <span className="font-medium text-purple-600 dark:text-purple-400">{sub.agentName || "Owner"}</span>
          </div>
          {sub.marzbanUsername && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <Link2 className="w-3 h-3 text-blue-500" />
              <span className="font-mono text-blue-600 dark:text-blue-400 text-[11px]">Cloud Config</span>
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-blue-600" data-testid={`button-copy-link-${sub.id}`} onClick={() => onCopy(`https://mohmmedvpn.com/configs/${sub.code}.json`)}>
                {copied === `https://mohmmedvpn.com/configs/${sub.code}.json` ? "Copied!" : "Copy Link"}
              </Button>
              {sub.configUsed && (
                <Badge variant="outline" className="text-xs text-orange-500 border-orange-300">Used</Badge>
              )}
              {sub.configUsed && (
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-orange-600" onClick={() => onResetConfig(sub.id)} data-testid={`button-reset-config-${sub.id}`}>
                  Reset
                </Button>
              )}
            </div>
          )}
          {sub.deviceId && (
            <div className="flex items-center gap-2 text-xs" data-testid={`text-deviceid-${sub.id}`}>
              <Smartphone className="w-3 h-3 text-muted-foreground" />
              <span className="font-mono text-foreground break-all">{sub.deviceId}</span>
            </div>
          )}
          {sub.notes && (
            <p className="text-xs text-muted-foreground" data-testid={`text-notes-${sub.id}`}>{sub.notes}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OwnerUsersPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: subs = [], isLoading } = useQuery<Subscriber[]>({ queryKey: ["/api/subscribers"] });

  const form = useForm({
    resolver: zodResolver(createSubSchema),
    defaultValues: { name: "", deviceId: "", notes: "", durationMonths: 1 },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/subscribers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setCreateOpen(false);
      form.reset();
      toast({ title: "Subscriber added successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/subscribers/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscribers"] });
      toast({ title: "Status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetConfigMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/subscribers/${id}/reset-config`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscribers"] });
      toast({ title: "Config reset - can be used again" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/subscribers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDeleteId(null);
      toast({ title: "Subscriber deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const filtered = subs.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    (s.deviceId && s.deviceId.toLowerCase().includes(search.toLowerCase()))
  );

  const activeCount = subs.filter(s => s.isActive && new Date(s.expiresAt) >= new Date()).length;

  return (
    <Layout title="Users">
      <div className="space-y-5 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Users</h2>
            <p className="text-muted-foreground text-sm mt-0.5">{activeCount} active / {subs.length} total</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-subscriber">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Add New User
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl><Input {...field} placeholder="Subscriber name" data-testid="input-sub-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="deviceId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Device ID (NPV Tunnel)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0564022E-FC5A-46D8-B82C-E06C4BBE31A0" data-testid="input-device-id" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">From NPV Tunnel → More → Device ID</p>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="durationMonths" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-duration">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 Month</SelectItem>
                          <SelectItem value="2">2 Months</SelectItem>
                          <SelectItem value="3">3 Months</SelectItem>
                          <SelectItem value="6">6 Months</SelectItem>
                          <SelectItem value="12">12 Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Any notes..." /></FormControl>
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-confirm-add">
                      {createMutation.isPending ? "Adding..." : "Add User"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Input
          placeholder="Search by name, code, or device ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search"
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
              <Users className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">No users found</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first user above</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((sub) => (
              <SubscriberCard
                key={sub.id}
                sub={sub}
                onDelete={(id) => setDeleteId(id)}
                onToggle={(id) => toggleMutation.mutate(id)}
                onCopy={handleCopy}
                onResetConfig={(id) => resetConfigMutation.mutate(id)}
                copied={copied}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this user and their VPN code.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
