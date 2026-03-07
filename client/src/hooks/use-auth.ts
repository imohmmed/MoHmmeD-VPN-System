import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: "owner" | "sub_owner" | "agent" | "user";
  isActive: boolean;
  createdAt: string;
  notes?: string;
};

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  return { user: user ?? null, isLoading };
}

export function useLogin() {
  const [, setLocation] = useLocation();
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json ? await res.json() : res;
    },
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      if (user.role === "owner") setLocation("/owner");
      else if (user.role === "sub_owner") setLocation("/sub-owner");
      else if (user.role === "agent") setLocation("/agent");
      else setLocation("/");
    },
  });
}

export function useLogout() {
  const [, setLocation] = useLocation();
  return useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      setLocation("/login");
    },
  });
}
