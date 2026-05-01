import { axiosInstance } from "..";
import { logger } from "@/utils/logger";
import { rollbar, ErrorCategories } from "@/utils/rollbar";

export type GhlSampleCompany = {
  companyId: string;
  companyName: string;
  usersCount: number;
  score: number;
  hasGhlBusinessId: boolean;
};

type MigrationErrorObject =
  | { message: string; entity?: string }
  | { entity: string; message?: string };

export type MigrationErrorItem = string | MigrationErrorObject;

export interface MigrateAllToGhlResponse {
  success: boolean;
  message: string;
  data: {
    businessesMigrated: number;
    contactsMigrated: number;
    opportunitiesUpserted?: number;
    errorsCount: number;
    errors: MigrationErrorItem[];
    selectedCompanies?: GhlSampleCompany[];
    description?: string;
  };
}

export interface DevGhlSampleSelectionResponse {
  success: boolean;
  message: string;
  data: {
    enabled: boolean;
    description: string;
    selectedCompanies: GhlSampleCompany[];
  };
}

export interface GhlFieldsDiagnosticsResponse {
  success: boolean;
  message: string;
  data: {
    module: string;
    apiVersionUsed: string;
    expectedApiNames: string[];
    expectedFields: Array<{
      apiName: string;
      exists: boolean;
      dataType?: string;
      readOnly?: boolean;
      fieldLabel?: string;
    }>;
    qrRelatedFields: Array<{
      apiName: string;
      fieldLabel?: string;
      dataType?: string;
      readOnly?: boolean;
    }>;
  };
}

export interface GhlRawOpportunityFieldsDiagnosticsResponse {
  success: boolean;
  message: string;
  data: {
    locationId: string;
    fetchedAt: string;
    expectedFieldKeys: string[];
    sources: Array<{
      source: "opportunity_object_key" | "legacy_location_custom_fields";
      supported: boolean;
      count: number;
      error?: string;
    }>;
    resolvedFields: Array<{
      key: string;
      resolvedId: string;
      usesFallbackId: boolean;
      matchedSource?:
        | "opportunity_object_key"
        | "legacy_location_custom_fields";
      matchedField?: {
        source: "opportunity_object_key" | "legacy_location_custom_fields";
        id?: string;
        key?: string;
        fieldKey?: string;
        name?: string;
        fieldName?: string;
        dataType?: string;
        type?: string;
        objectKey?: string;
        inferredObjectKey?: "business" | "contact" | "opportunity" | null;
        model?: string;
        fieldFor?: string;
        locationObjectType?: string;
        parentObjectKey?: string;
        entityType?: string;
        resourceType?: string;
      };
    }>;
    opportunityObjectFields: Array<{
      source: "opportunity_object_key" | "legacy_location_custom_fields";
      id?: string;
      key?: string;
      fieldKey?: string;
      name?: string;
      fieldName?: string;
      dataType?: string;
      type?: string;
      objectKey?: string;
      inferredObjectKey?: "business" | "contact" | "opportunity" | null;
      model?: string;
      fieldFor?: string;
      locationObjectType?: string;
      parentObjectKey?: string;
      entityType?: string;
      resourceType?: string;
    }>;
    legacyRelevantFields: Array<{
      source: "opportunity_object_key" | "legacy_location_custom_fields";
      id?: string;
      key?: string;
      fieldKey?: string;
      name?: string;
      fieldName?: string;
      dataType?: string;
      type?: string;
      objectKey?: string;
      inferredObjectKey?: "business" | "contact" | "opportunity" | null;
      model?: string;
      fieldFor?: string;
      locationObjectType?: string;
      parentObjectKey?: string;
      entityType?: string;
      resourceType?: string;
    }>;
  };
}

export interface GhlUpdateCountsDiagnosticsResponse {
  success: boolean;
  message: string;
  data: {
    enabled: boolean;
    companyId: string;
    ghlBusinessId: string | null;
    ghlBusinessIdSource: "stored" | "foundByTalihoId" | "upserted" | "none";
    counts: {
      projectsCount: number;
      qrGroupsCount: number;
      usersCount: number;
      qrCodesCount: number;
      qrScansCount: number;
    } | null;
    sentFields: Record<string, unknown> | null;
    ghlResponseFirstItem: unknown | null;
    ok: boolean;
  };
}

export interface GhlPreviewOpportunityResponse {
  success: boolean;
  message: string;
  data: {
    companyId: string;
    companyName: string;
    ghlBusinessIdStored: string | null;
    ghlBusinessIdFoundByTalihoId: string | null;
    ghlBusinessIdResolved: string | null;
    ghlBusinessIdSource: "stored" | "foundByTalihoId" | "none";
    ghlOpportunityIdStored: string | null;
    counts: {
      projectsCount: number;
      qrGroupsCount: number;
      usersCount: number;
      qrCodesCount: number;
      qrScansCount: number;
    };
    selectedUser: {
      userId: string;
      email?: string;
      permission?: string;
      ghlContactIdStored: string | null;
      role: "champion" | "admin" | "fallback" | "none";
    } | null;
    opportunityContactIdResolved: string | null;
    opportunityContactIdSource: "stored" | "foundByTalihoId" | "none";
    existingOpportunityId: string | null;
    existingOpportunityMatchSource:
      | "stored"
      | "search_taliho_id"
      | "search_contact"
      | "search_unique_name"
      | "none";
    matchDiagnostics: {
      searchedByName: boolean;
      totalCandidates: number;
      exactNameCandidates: number;
    };
    opportunityName: string;
    opportunityStatus: "open" | "won" | "lost" | "abandoned";
    createIfMissingOnNormalSync: boolean;
    safeRepairWouldSkip: boolean;
    pipelineConfigForCreate: {
      pipelineId: string;
      pipelineStageId: string;
    } | null;
    customFields: Array<{
      key: string;
      id?: string;
      field_value: string | number | boolean;
      usesFallbackId: boolean;
    }>;
    updatePayload: {
      name?: string;
      status?: "open" | "won" | "lost" | "abandoned";
      contactId?: string;
      customFields?: Array<{
        id?: string;
        key?: string;
        field_value: string | number | boolean;
      }>;
    };
  };
}

export interface GhlRepairSingleOpportunityResponse {
  success: boolean;
  message: string;
  data: {
    success: boolean;
    companyId: string;
    companyName: string;
    updated: boolean;
    skipped: boolean;
    message: string;
    ghlBusinessIdResolved: string | null;
    opportunityContactIdResolved: string | null;
    existingOpportunityId: string | null;
    existingOpportunityMatchSource:
      | "stored"
      | "search_taliho_id"
      | "search_contact"
      | "search_unique_name"
      | "none";
    opportunityId: string | null;
  };
}

export type GhlBackfillCountsRequest = {
  companyIds?: string[];
  limit?: number;
  createMissing?: boolean;
  confirm: true;
};

export interface GhlBackfillCountsResponse {
  success: boolean;
  message: string;
  data: {
    success: boolean;
    processed: number;
    updated: number;
    skipped: number;
    errors: Array<{
      companyId?: string;
      ghlBusinessId?: string;
      message: string;
    }>;
  };
}

export interface GhlBulkMigrationResult {
  success: boolean;
  businessesMigrated: number;
  contactsMigrated: number;
  opportunitiesUpserted: number;
  errors: MigrationErrorItem[];
  selectedCompanies?: GhlSampleCompany[];
  description?: string;
}

export interface MigrateAllToGhlAsyncStartResponse {
  success: boolean;
  message: string;
  data: {
    jobId: string;
    totalCompanies: number;
  };
}

export interface GhlMigrationJobStatusResponse {
  success: boolean;
  message: string;
  data: {
    jobId: string;
    status: string;
    progress: number;
    total: number;
    currentOperation?: string;
    result?: GhlBulkMigrationResult;
    error?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

/**
 * Trigger bulk migration of all companies and users to GHL CRM.
 * This endpoint is protected and only accessible by admins.
 */
export const migrateAllToGhl = async (): Promise<MigrateAllToGhlResponse> => {
  try {
    const response =
      await axiosInstance.post<MigrateAllToGhlResponse>("/ghl/migrate-all");
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-migrate-all-failed",
    });
    throw error;
  }
};

/**
 * Trigger bulk migration asynchronously and return a background job ID.
 */
export const migrateAllToGhlAsync =
  async (): Promise<MigrateAllToGhlAsyncStartResponse> => {
    try {
      const response =
        await axiosInstance.post<MigrateAllToGhlAsyncStartResponse>(
          "/ghl/migrate-all-async",
        );
      return response.data;
    } catch (error) {
      rollbar.error(error instanceof Error ? error : new Error(String(error)), {
        feature: ErrorCategories.API,
        action: "ghl-migrate-all-async-failed",
      });
      throw error;
    }
  };

/**
 * Fetch status for an async GHL migration job.
 */
export const getGhlMigrationJobStatus = async (
  jobId: string,
): Promise<GhlMigrationJobStatusResponse> => {
  const id = String(jobId || "").trim();
  if (!id) {
    throw new Error("Invalid jobId");
  }

  try {
    const response = await axiosInstance.get<GhlMigrationJobStatusResponse>(
      `/ghl/jobs/${id}`,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-migration-job-status-failed",
      metadata: { jobId: id },
    });
    throw error;
  }
};

/**
 * PRODUCTION: migrate a limited sample (3 companies + users) to GHL CRM for validation.
 * This endpoint is protected and only accessible by admins.
 */
export const migrateProductionSampleToGhl =
  async (): Promise<MigrateAllToGhlResponse> => {
    try {
      const response = await axiosInstance.post<MigrateAllToGhlResponse>(
        "/ghl/migrate-sample",
      );
      return response.data;
    } catch (error) {
      rollbar.error(error instanceof Error ? error : new Error(String(error)), {
        feature: ErrorCategories.API,
        action: "ghl-migrate-sample-failed",
      });
      throw error;
    }
  };

/**
 * DEV ONLY: preview which 3 companies would be migrated to GHL for testing.
 */
export const getDevGhlSampleSelection =
  async (): Promise<DevGhlSampleSelectionResponse> => {
    try {
      const response = await axiosInstance.get<DevGhlSampleSelectionResponse>(
        "/ghl/dev/sample-selection",
      );
      return response.data;
    } catch (error) {
      rollbar.error(error instanceof Error ? error : new Error(String(error)), {
        feature: ErrorCategories.API,
        action: "ghl-dev-sample-selection-failed",
      });
      throw error;
    }
  };

/**
 * DEV ONLY: migrate a limited sample (3 companies + users) to GHL CRM for testing.
 */
export const migrateDevSampleToGhl =
  async (): Promise<MigrateAllToGhlResponse> => {
    try {
      const response = await axiosInstance.post<MigrateAllToGhlResponse>(
        "/ghl/dev/migrate-sample",
      );
      return response.data;
    } catch (error) {
      rollbar.error(error instanceof Error ? error : new Error(String(error)), {
        feature: ErrorCategories.API,
        action: "ghl-dev-migrate-sample-failed",
      });
      throw error;
    }
  };

/**
 * Admin-only: Fetch GHL field metadata and verify expected custom fields.
 */
export const getGhlFieldsDiagnostics =
  async (): Promise<GhlFieldsDiagnosticsResponse> => {
    try {
      const response = await axiosInstance.get<GhlFieldsDiagnosticsResponse>(
        "/ghl/diagnostics/fields",
      );
      return response.data;
    } catch (error) {
      rollbar.error(error instanceof Error ? error : new Error(String(error)), {
        feature: ErrorCategories.API,
        action: "ghl-fields-diagnostics-failed",
      });
      throw error;
    }
  };

export const getRawGhlOpportunityFieldsDiagnostics =
  async (): Promise<GhlRawOpportunityFieldsDiagnosticsResponse> => {
    try {
      const response =
        await axiosInstance.get<GhlRawOpportunityFieldsDiagnosticsResponse>(
          "/ghl/diagnostics/opportunity-fields-raw",
        );
      return response.data;
    } catch (error) {
      rollbar.error(error instanceof Error ? error : new Error(String(error)), {
        feature: ErrorCategories.API,
        action: "ghl-raw-opportunity-fields-diagnostics-failed",
      });
      throw error;
    }
  };

/**
 * Admin-only: Recompute counts and perform a GHL Business update, returning diagnostics.
 */
export const updateGhlCountsDiagnostics = async (
  companyId: string,
): Promise<GhlUpdateCountsDiagnosticsResponse> => {
  const id = String(companyId || "").trim();
  if (!id) {
    throw new Error("Invalid companyId");
  }
  try {
    const response =
      await axiosInstance.post<GhlUpdateCountsDiagnosticsResponse>(
        `/ghl/diagnostics/update-counts/${id}`,
      );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-update-counts-diagnostics-failed",
      metadata: { companyId: id },
    });
    throw error;
  }
};

export const previewGhlOpportunity = async (
  companyId: string,
): Promise<GhlPreviewOpportunityResponse> => {
  const id = String(companyId || "").trim();
  if (!id) {
    throw new Error("Invalid companyId");
  }

  try {
    const response = await axiosInstance.get<GhlPreviewOpportunityResponse>(
      `/ghl/preview-opportunity/${id}`,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-preview-opportunity-failed",
      metadata: { companyId: id },
    });
    throw error;
  }
};

export const repairSingleGhlOpportunity = async (payload: {
  companyId: string;
  confirm: true;
}): Promise<GhlRepairSingleOpportunityResponse> => {
  const id = String(payload.companyId || "").trim();
  if (!id) {
    throw new Error("Invalid companyId");
  }

  try {
    const response = await axiosInstance.post<GhlRepairSingleOpportunityResponse>(
      `/ghl/repair-opportunity/${id}`,
      { confirm: true },
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-repair-single-opportunity-failed",
      metadata: { companyId: id },
    });
    throw error;
  }
};

/**
 * Admin-only: One-time backfill to push ONLY count fields to GHL Businesses.
 */
export const backfillGhlCounts = async (
  payload: GhlBackfillCountsRequest,
): Promise<GhlBackfillCountsResponse> => {
  try {
    const response = await axiosInstance.post<GhlBackfillCountsResponse>(
      "/ghl/backfill-counts",
      payload,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-backfill-counts-failed",
      metadata: {
        limit: payload.limit,
        companyIdsCount: payload.companyIds?.length,
      },
    });
    throw error;
  }
};

export interface GhlRepairLinksResponse {
  success: boolean;
  message: string;
  data: {
    success: boolean;
    businessesProcessed: number;
    businessTalihoIdsRepaired: number;
    contactsProcessed: number;
    contactTalihoIdsRepaired: number;
    contactBusinessLinksRepaired: number;
    skipped: number;
    errors: Array<{
      entityType?: "company" | "user";
      entityId?: string;
      ghlId?: string;
      message: string;
    }>;
  };
}

export interface GhlRepairJobStartResponse {
  success: boolean;
  message: string;
  data: { jobId: string };
}

/**
 * Admin-only: Start an async repair-links job. Returns a jobId immediately.
 * Poll GET /ghl/jobs/:id for completion.
 */
export const startRepairLinksAsync = async (payload: {
  limit?: number;
  confirm: true;
}): Promise<GhlRepairJobStartResponse> => {
  try {
    const response = await axiosInstance.post<GhlRepairJobStartResponse>(
      "/ghl/repair-links-async",
      payload,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-repair-links-async-failed",
      metadata: { limit: payload.limit },
    });
    throw error;
  }
};

/**
 * Admin-only: Start an async repair-company-info job. Returns a jobId immediately.
 */
export const startRepairCompanyInfoAsync = async (payload: {
  limit?: number;
  confirm: true;
}): Promise<GhlRepairJobStartResponse> => {
  try {
    const response = await axiosInstance.post<GhlRepairJobStartResponse>(
      "/ghl/repair-company-info-async",
      payload,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-repair-company-info-async-failed",
      metadata: { limit: payload.limit },
    });
    throw error;
  }
};

/**
 * Admin-only: Start an async repair-contact-fields job. Returns a jobId immediately.
 */
export const startRepairContactFieldsAsync = async (payload: {
  limit?: number;
  confirm: true;
}): Promise<GhlRepairJobStartResponse> => {
  try {
    const response = await axiosInstance.post<GhlRepairJobStartResponse>(
      "/ghl/repair-contact-fields-async",
      payload,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-repair-contact-fields-async-failed",
      metadata: { limit: payload.limit },
    });
    throw error;
  }
};

/**
 * Admin-only: Start an async repair-opportunities job. Returns a jobId immediately.
 */
export const startRepairOpportunitiesAsync = async (payload: {
  limit?: number;
  confirm: true;
}): Promise<GhlRepairJobStartResponse> => {
  try {
    const response = await axiosInstance.post<GhlRepairJobStartResponse>(
      "/ghl/repair-opportunities-async",
      payload,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-repair-opportunities-async-failed",
      metadata: { limit: payload.limit },
    });
    throw error;
  }
};

/**
 * Admin-only: Repair GHL contact-business links and taliho_id custom fields.
 */
export const repairGhlLinks = async (payload: {
  limit?: number;
  confirm: true;
}): Promise<GhlRepairLinksResponse> => {
  try {
    const response = await axiosInstance.post<GhlRepairLinksResponse>(
      "/ghl/repair-links",
      payload,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-repair-links-failed",
      metadata: { limit: payload.limit },
    });
    throw error;
  }
};

export interface GhlRepairCompanyInfoResponse {
  success: boolean;
  message: string;
  data: {
    success: boolean;
    contactsProcessed: number;
    contactsUpdated: number;
    skipped: number;
    errors: Array<{
      userId?: string;
      ghlContactId?: string;
      message: string;
    }>;
  };
}

/**
 * Admin-only: Push company address/website data onto GHL Contact records.
 */
export const repairGhlCompanyInfo = async (payload: {
  limit?: number;
  confirm: true;
}): Promise<GhlRepairCompanyInfoResponse> => {
  try {
    const response = await axiosInstance.post<GhlRepairCompanyInfoResponse>(
      "/ghl/repair-company-info",
      payload,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-repair-company-info-failed",
      metadata: { limit: payload.limit },
    });
    throw error;
  }
};

export interface GhlRepairContactFieldsResponse {
  success: boolean;
  message: string;
  data: {
    success: boolean;
    contactsProcessed: number;
    contactsUpdated: number;
    skipped: number;
    errors: Array<{
      userId?: string;
      ghlContactId?: string;
      message: string;
    }>;
  };
}

/**
 * Admin-only: Write taliho_id and account_permission custom fields to GHL Contacts.
 */
export const repairGhlContactFields = async (payload: {
  limit?: number;
  confirm: true;
}): Promise<GhlRepairContactFieldsResponse> => {
  try {
    const response = await axiosInstance.post<GhlRepairContactFieldsResponse>(
      "/ghl/repair-contact-fields",
      payload,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-repair-contact-fields-failed",
      metadata: { limit: payload.limit },
    });
    throw error;
  }
};

export interface GhlRepairOpportunitiesResponse {
  success: boolean;
  message: string;
  data: {
    success: boolean;
    companiesProcessed: number;
    opportunitiesUpdated: number;
    skipped: number;
    errorsCount: number;
    skipBreakdown: {
      missingCompanyId: number;
      missingChampionContact: number;
    };
    errorBreakdown: {
      countsComputationFailed: number;
      missingExistingOpportunity: number;
      opportunityUpdateFailed: number;
      businessPrimaryContactFailed: number;
      unexpected: number;
    };
    companyIdsByCategory: {
      missingChampionContact: string[];
      countsComputationFailed: string[];
      missingExistingOpportunity: string[];
      opportunityUpdateFailed: string[];
      businessPrimaryContactFailed: string[];
      unexpected: string[];
    };
    errors: Array<{
      companyId?: string;
      reason?:
        | "missing_company_id"
        | "missing_champion_contact"
        | "counts_computation_failed"
        | "missing_existing_opportunity"
        | "opportunity_update_failed"
        | "business_primary_contact_failed"
        | "unexpected";
      step?: "precheck" | "counts" | "opportunity" | "business" | "job";
      message: string;
    }>;
  };
}

/**
 * Admin-only: Backfill lifecycle and revenue fields onto existing
 * GHL Opportunities.
 */
export const repairGhlOpportunities = async (payload: {
  limit?: number;
  confirm: true;
}): Promise<GhlRepairOpportunitiesResponse> => {
  try {
    const response = await axiosInstance.post<GhlRepairOpportunitiesResponse>(
      "/ghl/repair-opportunities",
      payload,
    );
    return response.data;
  } catch (error) {
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-repair-opportunities-failed",
      metadata: { limit: payload.limit },
    });
    throw error;
  }
};

/**
 * Fire-and-forget: submit user data to GHL CRM during signup.
 * Catches errors without re-throwing to avoid blocking the signup flow.
 */
export const submitToGhl = async (userData: {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
}) => {
  try {
    const response = await axiosInstance.post("/ghl/create-user", {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      company: userData.company,
    });
    if (response.status === 200) {
      return response.data;
    }
  } catch (error) {
    logger.error("GHL submission failed:", error);
    rollbar.error(error instanceof Error ? error : new Error(String(error)), {
      feature: ErrorCategories.API,
      action: "ghl-create-user-failed",
    });
  }
};
