import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, LogIn, LogOut, UserPlus, Key, Ban, DollarSign, Trash, Wifi } from "lucide-react";
import { format } from "date-fns";

type Log = {
  id: string;
  accountId: string;
  action: string;
  details?: string;
  targetId?: string;
  createdAt: string;
};

const actionConfig: Record<string, { icon: any; color: string; label: string }> = {
  login: { icon: LogIn, color: "text-green-500", label: "Login" },
  logout: { icon: LogOut, color: "text-muted-foreground", label: "Logout" },
  create_agent: { icon: UserPlus, color: "text-primary", label: "Create Agent" },
  create_user: { icon: UserPlus, color: "text-blue-500", label: "Create User" },
  create_code: { icon: Key, color: "text-primary", label: "Create Code" },
  assign_code: { icon: Wifi, color: "text-primary", label: "Assign Code" },
  deactivate_code: { icon: Key, color: "text-destructive", label: "Deactivate Code" },
  suspend_agent: { icon: Ban, color: "text-orange-500", label: "Suspend Agent" },
  delete_agent: { icon: Trash, color: "text-destructive", label: "Delete Agent" },
  record_payment: { icon: DollarSign, color: "text-green-500", label: "Payment" },
  delete_user: { icon: Trash, color: "text-destructive", label: "Delete User" },
};

export default function LogsPage() {
  useEffect(() => { document.title = "Activity Logs | MoHmmeD VPN"; }, []);
  const { data: logs = [], isLoading } = useQuery<Log[]>({ queryKey: ["/api/logs"] });
  const { data: agents = [] } = useQuery<any[]>({ queryKey: ["/api/agents"] });

  const accountMap: Record<string, string> = {};
  agents.forEach((a: any) => { accountMap[a.id] = a.username; });

  return (
    <Layout title="Activity Logs">
      <div className="space-y-5 max-w-4xl">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Activity Logs</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{logs.length} total activities</p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><CardContent className="py-3"><Skeleton className="h-10 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No activity logs yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => {
              const cfg = actionConfig[log.action] || { icon: ScrollText, color: "text-muted-foreground", label: log.action };
              const IconComp = cfg.icon;
              return (
                <Card key={log.id} data-testid={`card-log-${log.id}`}>
                  <CardContent className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className={`flex-shrink-0 ${cfg.color}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
                        <span className="text-xs text-foreground truncate">{log.details}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(log.createdAt), "MMM d, HH:mm")}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
