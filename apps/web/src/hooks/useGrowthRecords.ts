import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  getGrowthRecordsApi,
  createGrowthRecordApi,
  deleteGrowthRecordApi,
} from "@/api/spaces.api";
import { spaceKeys } from "./useSpaces";

export function useGrowthRecords(slug: string) {
  return useQuery({
    queryKey: spaceKeys.growthRecords(slug),
    queryFn: () => getGrowthRecordsApi(slug),
    enabled: !!slug,
  });
}

export function useCreateGrowthRecord(slug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      date: string;
      heightCm?: number;
      weightKg?: number;
      headCircumferenceCm?: number;
    }) => createGrowthRecordApi(slug, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: spaceKeys.growthRecords(slug) });
      toast.success(i18n.t("spaces:growth.addSuccess"));
    },
    onError: () => {
      toast.error(i18n.t("spaces:growth.addError"));
    },
  });
}

export function useDeleteGrowthRecord(slug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (recordId: string) => deleteGrowthRecordApi(slug, recordId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: spaceKeys.growthRecords(slug) });
      toast.success(i18n.t("spaces:growth.deleteSuccess"));
    },
  });
}
