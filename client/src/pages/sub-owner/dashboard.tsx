import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, UserCog, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type Stats = {
  agentsCount: number;
  subscribersCount: number;
  totalOwed: number;
  totalRevenue: number;
};

function StatCard({ title, value, icon: Icon, description }: {
  title: string; value: string | number; icon: any; description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 rounded-md bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function SubOwnerDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery<Stats>({ queryKey: ["/api/stats"] });
  const { data: agents } = useQuery<any[]>({ queryKey: ["/api/my-agents"] });

  const formatCurrency = (amount: number) => `${amount.toLocaleString()} IQD`;

  return (
    <Layout title="Dashboard">
      <div className="space-y-6 max-w-6xl">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Welcome, {user?.username}</h2>
          <p className="text-muted-foreground text-sm mt-1">Sub-owner dashboard overview</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="My Agents" value={stats?.agentsCount ?? 0} icon={UserCog} description="Active resellers" />
            <StatCard title="Total Subscribers" value={stats?.subscribersCount ?? 0} icon={Users} description="Active users" />
            <StatCard title="Revenue Collected" value={formatCurrency(stats?.totalRevenue ?? 0)} icon={TrendingUp} description="Payments received" />
            <StatCard title="Outstanding" value={formatCurrency(stats?.totalOwed ?? 0)} icon={AlertTriangle} description="Owed by agents" />
          </div>
        )}

        {agents && agents.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Agent Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.slice(0, 6).map((agent: any) => (
                <Card key={agent.id} data-testid={`card-agent-${agent.id}`}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{agent.username[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{agent.username}</p>
                      <p className="text-xs text-muted-foreground">{agent.subscribersCount} subscribers</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${agent.balance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                        {agent.balance > 0 ? `${agent.balance.toLocaleString()} IQD` : "Settled"}
                      </p>
                      <div className={`text-xs mt-0.5 ${agent.isActive ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                        {agent.isActive ? "Active" : "Suspended"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
