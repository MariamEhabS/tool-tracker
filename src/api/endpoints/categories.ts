import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "..";
import { logApiError } from "@/utils/rollbar";
import { MAX_BULK_DELETE_COUNT } from "../constants";

// ============================================
// Query Keys
// ============================================

export const categoryKeys = {
  all: ["categories"] as const,
  byCompany: (companyId: string) =>
    [...categoryKeys.all, "company", companyId] as const,
  classes: (companyId: string) =>
    [...categoryKeys.all, "classes", companyId] as const,
  single: (categoryId: string) =>
    [...categoryKeys.all, "single", categoryId] as const,
};

// ============================================
// Types
// ============================================

/** Procore tool types that can be mapped to categories */
export type ProcoreToolType =
  | "coordination-issues"
  | "directory"
  | "documents"
  | "drawings"
  | "forms"
  | "incidents"
  | "inspections"
  | "instructions"
  | "location"
  | "none"
  | "observations"
  | "photos"
  | "punch-list"
  | "rfis"
  | "specifications"
  | "submittals"
  | "tasks";

/** Procore tool options for dropdown selection */
export const PROCORE_TOOL_OPTIONS: {
  value: ProcoreToolType;
  label: string;
}[] = [
  { value: "coordination-issues", label: "Coordination Issues" },
  { value: "directory", label: "Directory" },
  { value: "documents", label: "Documents" },
  { value: "drawings", label: "Drawings" },
  { value: "forms", label: "Forms" },
  { value: "incidents", label: "Incidents" },
  { value: "inspections", label: "Inspections" },
  { value: "instructions", label: "Instructions" },
  { value: "observations", label: "Observations" },
  { value: "photos", label: "Photos" },
  { value: "punch-list", label: "Punch List" },
  { value: "rfis", label: "RFIs" },
  { value: "specifications", label: "Specifications" },
  { value: "submittals", label: "Submittals" },
  { value: "tasks", label: "Tasks" },
];

export interface Category {
  _id: string;
  categoryName: string;
  categoryClass: string;
  company: string;
  procoreTool?: ProcoreToolType;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateCategoryInput {
  categoryName: string;
  categoryClass: string;
  companyId: string;
  procoreTool?: ProcoreToolType;
}

export interface UpdateCategoryInput {
  categoryName?: string;
  categoryClass?: string;
  procoreTool?: ProcoreToolType | null;
}

// ============================================
// Queries
// ============================================

/**
 * Get all categories for a company
 */
export const useCategories = (companyId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: categoryKeys.byCompany(companyId),
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get("/categories", {
          params: { companyId },
        });
        return data.data as Category[];
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 401) {
          logApiError(
            new Error("Categories fetch returned 401 - possible session issue"),
            "categories-fetch-401",
          );
          return [];
        }
        throw error;
      }
    },
    enabled: Boolean(companyId) && enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};

/**
 * Get all unique category classes for autocomplete
 */
export const useCategoryClasses = (
  companyId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: categoryKeys.classes(companyId),
    queryFn: async () => {
      const { data } = await axiosInstance.get("/categories/classes", {
        params: { companyId },
      });
      return data.data as string[];
    },
    enabled: Boolean(companyId) && enabled,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get a single category by ID
 */
export const useCategory = (categoryId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: categoryKeys.single(categoryId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/categories/${categoryId}`);
      return data.data as Category;
    },
    enabled: Boolean(categoryId) && enabled,
  });
};

// ============================================
// Mutations
// ============================================

/**
 * Create a new category
 */
export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const { data } = await axiosInstance.post("/categories", input);
      return data.data as Category;
    },
    onSuccess: (_data, variables) => {
      // Invalidate the company's categories list
      queryClient.invalidateQueries({
        queryKey: categoryKeys.byCompany(variables.companyId),
      });
      // Also invalidate classes since a new class may have been added
      queryClient.invalidateQueries({
        queryKey: categoryKeys.classes(variables.companyId),
      });
    },
    onError: (error) => {
      logApiError(error, "create-category-failed");
    },
  });
};

/**
 * Update a category
 */
export const useUpdateCategory = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      categoryId,
      input,
    }: {
      categoryId: string;
      input: UpdateCategoryInput;
    }) => {
      const { data } = await axiosInstance.patch(
        `/categories/${categoryId}`,
        input,
      );
      return data.data as Category;
    },
    onSuccess: (_data, variables) => {
      // Invalidate the company's categories list
      queryClient.invalidateQueries({
        queryKey: categoryKeys.byCompany(companyId),
      });
      // Invalidate the single category
      queryClient.invalidateQueries({
        queryKey: categoryKeys.single(variables.categoryId),
      });
      // Also invalidate classes since a class may have changed
      queryClient.invalidateQueries({
        queryKey: categoryKeys.classes(companyId),
      });
    },
    onError: (error, variables) => {
      logApiError(error, "update-category-failed", {
        categoryId: variables.categoryId,
      });
    },
  });
};

/**
 * Delete a single category
 */
export const useDeleteCategory = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const { data } = await axiosInstance.delete(`/categories/${categoryId}`, {
        data: { companyId },
      });
      return data.data as Category;
    },
    onSuccess: () => {
      // Invalidate the company's categories list
      queryClient.invalidateQueries({
        queryKey: categoryKeys.byCompany(companyId),
      });
      // Also invalidate classes since a class may have been removed
      queryClient.invalidateQueries({
        queryKey: categoryKeys.classes(companyId),
      });
    },
    onError: (error) => {
      logApiError(error, "delete-category-failed");
    },
  });
};

/**
 * Delete multiple categories
 */
export const useDeleteManyCategories = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryIds: string[]) => {
      if (categoryIds.length > MAX_BULK_DELETE_COUNT) {
        throw new Error(
          `Cannot delete more than ${MAX_BULK_DELETE_COUNT} items at once. Got ${categoryIds.length}.`,
        );
      }
      const { data } = await axiosInstance.delete("/categories/bulk", {
        data: { companyId, categoryIds },
      });
      return data;
    },
    onSuccess: () => {
      // Invalidate the company's categories list
      queryClient.invalidateQueries({
        queryKey: categoryKeys.byCompany(companyId),
      });
      // Also invalidate classes
      queryClient.invalidateQueries({
        queryKey: categoryKeys.classes(companyId),
      });
    },
    onError: (error, variables) => {
      logApiError(error, "delete-categories-bulk-failed", {
        count: variables.length,
      });
    },
  });
};
