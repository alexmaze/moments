import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { toast } from "sonner";
import i18n from "@/i18n";
import { loginApi, registerApi } from "@/api/auth.api";
import { useAuthStore } from "@/store/auth.store";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
      queryClient.clear();
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: registerApi,
    onSuccess: () => {
      toast.success(i18n.t("auth:register.success"));
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(() => {
    clearAuth();
    queryClient.clear();
    navigate("/login");
  }, [clearAuth, navigate, queryClient]);
}
