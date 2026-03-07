import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { format } from "date-fns";

type Transaction = {
  id: string;
  agentId: string;
  type: "purchase" | "payment";
  amount: number;
  description?: string;
  subscriberId?: string;
  createdAt: string;
};

export default function TransactionsPage() {
  useEffect(() => { document.title = "Transactions | MoHmmeD VPN"; }, []);
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: agents = [] } = useQuery<any[]>({ queryKey: ["/api/agents"] });

  const agentMap = Object.fromEntries(agents.map((a: any) => [a.id, a.username]));

  const totalPurchases = transactions.filter(t => t.type === "purchase").reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0);

  return (
    <Layout title="Transactions">
      <div className="space-y-5 max-w-4xl">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Transactions</h2>
          <p className="text-muted-foreground text-sm mt-0.5">All financial records</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Codes Sold</CardTitle>
              <TrendingDown className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">{totalPurchases.toLocaleString()} IQD</div>
              <p className="text-xs text-muted-foreground mt-0.5">Outstanding agent debt</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">{totalPayments.toLocaleString()} IQD</div>
              <p className="text-xs text-muted-foreground mt-0.5">Payments received</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><CardContent className="py-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CreditCard className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No transactions yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <Card key={tx.id} data-testid={`card-tx-${tx.id}`}>
                <CardContent className="flex flex-wrap items-center gap-4 py-3">
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
                        {tx.type === "purchase" ? "Code Sale" : "Payment"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>Agent: {agentMap[tx.agentId] || tx.agentId.substring(0, 8)}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                      </span>
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
      </div>
    </Layout>
  );
}
