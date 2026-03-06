import { useLocation, Link } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, CreditCard, ScrollText, UserCog,
  Shield, LogOut, ChevronRight, FlaskConical,
} from "lucide-react";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";

const ownerNav = [
  { title: "Dashboard", url: "/owner", icon: LayoutDashboard },
  { title: "Agents", url: "/owner/agents", icon: UserCog },
  { title: "Users", url: "/owner/users", icon: Users },
  { title: "Transactions", url: "/owner/transactions", icon: CreditCard },
  { title: "Activity Logs", url: "/owner/logs", icon: ScrollText },
  { title: "Config Tester", url: "/owner/config-tester", icon: FlaskConical },
];

const agentNav = [
  { title: "Dashboard", url: "/agent", icon: LayoutDashboard },
  { title: "Users", url: "/agent/users", icon: Users },
  { title: "Transactions", url: "/agent/transactions", icon: CreditCard },
];

export function AppSidebar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { mutate: logout } = useLogout();
  const { data: siteConfig } = useQuery<{ siteName: string }>({ queryKey: ["/api/site-config"] });

  const navItems = user?.role === "owner" ? ownerNav : agentNav;
  const siteName = siteConfig?.siteName || "MoHmmeD VPN";

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sidebar-foreground text-sm leading-tight truncate">{siteName}</p>
            <p className="text-xs text-muted-foreground leading-tight">Management System</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}>
                      <Link
                        href={item.url}
                        className={isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground"}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                        {isActive && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 space-y-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-sidebar-accent/50">
            <Avatar className="w-7 h-7">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                {user?.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.username}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {user?.role === "owner" ? "Owner" : "Agent"}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
