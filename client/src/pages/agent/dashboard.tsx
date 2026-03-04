import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, Key, CreditCard, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type AgentStats = {
  codesCount: number;
  usersCount: number;
  balance: number;
  transactionsCount: number;
};

function StatCard({ title, value, icon: Icon, sub }: {
  title: string; value: string | number; icon: any; sub?: string;
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
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AgentDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery<AgentStats>({ queryKey: ["/api/stats"] });
  const { data: codes = [] } = useQuery<any[]>({ queryKey: ["/api/codes"] });

  return (
    <Layout title="Agent Dashboard">
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Welcome, {user?.username}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Agent dashboard overview</p>
        </div>

        {stats?.balance && stats.balance > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">Outstanding Balance</p>
                <p className="text-xs text-muted-foreground">
                  You owe <span className="font-bold text-destructive">{stats.balance.toLocaleString()} IQD</span> for generated codes
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              title="VPN Codes Generated"
              value={stats?.codesCount ?? 0}
              icon={Key}
              sub="Total codes issued"
            />
            <StatCard
              title="My Users"
              value={stats?.usersCount ?? 0}
              icon={Users}
              sub="Active subscribers"
            />
            <StatCard
              title="Total Debt"
              value={`${(stats?.balance ?? 0).toLocaleString()} IQD`}
              icon={AlertTriangle}
              sub="Amount to be paid"
            />
            <StatCard
              title="Transactions"
              value={stats?.transactionsCount ?? 0}
              icon={CreditCard}
              sub="Total records"
            />
          </div>
        )}

        {codes.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Recent Codes</h3>
            <div className="space-y-2">
              {codes.slice(0, 5).map((code: any) => (
                <Card key={code.id} data-testid={`card-recent-code-${code.id}`}>
                  <CardContent className="flex items-center gap-3 py-3">
                    <Key className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-mono text-sm font-bold text-foreground flex-1">{code.code}</span>
                    <Badge variant={code.isActive ? "secondary" : "destructive"} className="text-xs">
                      {code.isActive ? "Active" : "Inactive"}
                    </Badge>
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
