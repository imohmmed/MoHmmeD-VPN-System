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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Users, Mail, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";

const createUserSchema = z.object({
  email: z.string().email("Invalid email"),
  username: z.string().min(3, "Min 3 characters"),
  password: z.string().min(6, "Min 6 characters"),
  notes: z.string().optional(),
});

type UserAccount = {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  notes?: string;
};

export default function AgentUsersPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: users = [], isLoading } = useQuery<UserAccount[]>({ queryKey: ["/api/users"] });

  const form = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: "", username: "", password: "", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setCreateOpen(false);
      form.reset();
      toast({ title: "User created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDeleteId(null);
      toast({ title: "User deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="My Users">
      <div className="space-y-5 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">My Users</h2>
            <p className="text-muted-foreground text-sm mt-0.5">{users.length} subscribed customers</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <Plus className="w-4 h-4 mr-2" />
                New User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create User Account</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="user@email.com" data-testid="input-user-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl><Input {...field} placeholder="username" data-testid="input-user-username" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input {...field} type="password" placeholder="••••••••" data-testid="input-user-password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Notes..." /></FormControl>
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-confirm-create-user">
                      {createMutation.isPending ? "Creating..." : "Create User"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-users"
          className="max-w-sm"
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="py-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
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
          <div className="space-y-2">
            {filtered.map((user) => (
              <Card key={user.id} data-testid={`card-user-${user.id}`}>
                <CardContent className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-accent flex-shrink-0">
                    <span className="text-sm font-bold text-accent-foreground">{user.username[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{user.username}</span>
                      <Badge variant="secondary" className="text-xs">Active</Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive flex-shrink-0"
                    onClick={() => setDeleteId(user.id)}
                    data-testid={`button-delete-user-${user.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this user. This action cannot be undone.
            </AlertDialogDescription>
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
