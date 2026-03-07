import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

import LoginPage from "@/pages/login";
import OwnerDashboard from "@/pages/owner/dashboard";
import AgentsPage from "@/pages/owner/agents";
import AgentDetailPage from "@/pages/owner/agent-detail";
import SubOwnersPage from "@/pages/owner/sub-owners";
import SubOwnerDetailPage from "@/pages/owner/sub-owner-detail";
import OwnerUsersPage from "@/pages/owner/users";
import TransactionsPage from "@/pages/owner/transactions";
import LogsPage from "@/pages/owner/logs";
import AgentDashboard from "@/pages/agent/dashboard";
import AgentUsersPage from "@/pages/agent/users";
import AgentTransactionsPage from "@/pages/agent/transactions";
import ConfigTester from "@/pages/owner/config-tester";
import SubOwnerDashboard from "@/pages/sub-owner/dashboard";
import SubOwnerAgentsPage from "@/pages/sub-owner/agents";
import SubOwnerAgentDetailPage from "@/pages/sub-owner/agent-detail";
import SubOwnerUsersPage from "@/pages/sub-owner/users";
import SubOwnerTransactionsPage from "@/pages/sub-owner/transactions";
import NotFound from "@/pages/not-found";

function AuthGuard({ children, roles }: { children: React.ReactNode; roles: Array<"owner" | "sub_owner" | "agent" | "user"> }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!roles.includes(user.role)) {
    if (user.role === "owner") return <Redirect to="/owner" />;
    if (user.role === "sub_owner") return <Redirect to="/sub-owner" />;
    if (user.role === "agent") return <Redirect to="/agent" />;
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (user.role === "owner") return <Redirect to="/owner" />;
  if (user.role === "sub_owner") return <Redirect to="/sub-owner" />;
  if (user.role === "agent") return <Redirect to="/agent" />;
  return <Redirect to="/login" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={HomeRedirect} />

      <Route path="/owner">
        <AuthGuard roles={["owner"]}>
          <OwnerDashboard />
        </AuthGuard>
      </Route>
      <Route path="/owner/sub-owners/:id">
        <AuthGuard roles={["owner"]}>
          <SubOwnerDetailPage />
        </AuthGuard>
      </Route>
      <Route path="/owner/sub-owners">
        <AuthGuard roles={["owner"]}>
          <SubOwnersPage />
        </AuthGuard>
      </Route>
      <Route path="/owner/agents/:id">
        <AuthGuard roles={["owner"]}>
          <AgentDetailPage />
        </AuthGuard>
      </Route>
      <Route path="/owner/agents">
        <AuthGuard roles={["owner"]}>
          <AgentsPage />
        </AuthGuard>
      </Route>
      <Route path="/owner/users">
        <AuthGuard roles={["owner"]}>
          <OwnerUsersPage />
        </AuthGuard>
      </Route>
      <Route path="/owner/transactions">
        <AuthGuard roles={["owner"]}>
          <TransactionsPage />
        </AuthGuard>
      </Route>
      <Route path="/owner/logs">
        <AuthGuard roles={["owner"]}>
          <LogsPage />
        </AuthGuard>
      </Route>
      <Route path="/owner/config-tester">
        <AuthGuard roles={["owner"]}>
          <ConfigTester />
        </AuthGuard>
      </Route>

      <Route path="/sub-owner">
        <AuthGuard roles={["sub_owner"]}>
          <SubOwnerDashboard />
        </AuthGuard>
      </Route>
      <Route path="/sub-owner/agents/:id">
        <AuthGuard roles={["sub_owner"]}>
          <SubOwnerAgentDetailPage />
        </AuthGuard>
      </Route>
      <Route path="/sub-owner/agents">
        <AuthGuard roles={["sub_owner"]}>
          <SubOwnerAgentsPage />
        </AuthGuard>
      </Route>
      <Route path="/sub-owner/users">
        <AuthGuard roles={["sub_owner"]}>
          <SubOwnerUsersPage />
        </AuthGuard>
      </Route>
      <Route path="/sub-owner/transactions">
        <AuthGuard roles={["sub_owner"]}>
          <SubOwnerTransactionsPage />
        </AuthGuard>
      </Route>

      <Route path="/agent">
        <AuthGuard roles={["agent"]}>
          <AgentDashboard />
        </AuthGuard>
      </Route>
      <Route path="/agent/users">
        <AuthGuard roles={["agent"]}>
          <AgentUsersPage />
        </AuthGuard>
      </Route>
      <Route path="/agent/transactions">
        <AuthGuard roles={["agent"]}>
          <AgentTransactionsPage />
        </AuthGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
