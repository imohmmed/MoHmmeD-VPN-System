import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Wifi } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-muted-foreground" />
            {title && (
              <div className="flex items-center gap-2 min-w-0">
                <Wifi className="w-4 h-4 text-primary flex-shrink-0" />
                <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
              </div>
            )}
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
