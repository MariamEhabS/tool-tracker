import type {
  AxiosAdapter,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import {
  COMPANY_ID,
  STATIC_ACCESS_TOKEN,
  STATIC_ADMIN_COMPANIES,
  STATIC_COMPANY,
  STATIC_INSPECTION_ITEMS,
  STATIC_INSPECTION_TEMPLATES,
  STATIC_NOTIFICATION_PREFERENCES,
  STATIC_ONLINE_PRESENCE,
  STATIC_PLATFORM_STATS,
  STATIC_PROCORE_ITEMS,
  STATIC_PUNCH_ASSIGNEES,
  STATIC_QR_STYLE_PRESETS,
  STATIC_USER,
  cloneMockValue,
  computeDashboardStats,
  computeStorageStats,
  createProjectCompanyAggregation,
  createProcoreDocumentData,
  createQrProcoreToolsResponse,
  createScannedQrAggregate,
  createStaticApiState,
} from "./staticData";

type MockApiResponse = {
  status?: number;
  data?: unknown;
  headers?: Record<string, string>;
};

const staticApiState = createStaticApiState();
const jobState = new Map<
  string,
  {
    jobId: string;
    total: number;
    status: "queued" | "running" | "completed" | "failed";
  }
>();

let fetchMockInstalled = false;
let sequence = 100;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function buildUrl(
  url: string,
  baseURL?: string,
  params?: unknown,
): URL {
  const requestUrl = new URL(url, baseURL || "http://static.taliho.local");

  if (params && typeof params === "object") {
    Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
      requestUrl.searchParams.delete(key);
      if (value == null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((item) => requestUrl.searchParams.append(key, String(item)));
        return;
      }
      requestUrl.searchParams.set(key, String(value));
    });
  }

  return requestUrl;
}

function parseBody(data: unknown): Record<string, unknown> {
  if (!data) return {};

  if (typeof FormData !== "undefined" && data instanceof FormData) {
    return Object.fromEntries(data.entries());
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (typeof data === "object") {
    return data as Record<string, unknown>;
  }

  return {};
}

function ok(data: unknown, status = 200): MockApiResponse {
  return { status, data };
}

function empty(status = 204): MockApiResponse {
  return { status, data: null };
}

function successEnvelope(data: unknown, message = "Static mock success") {
  return ok({ success_message: message, data });
}

function paginated<T>(items: T[], page: number, perPage: number) {
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePerPage = Number.isFinite(perPage) && perPage > 0 ? perPage : 20;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
  const start = (safePage - 1) * safePerPage;
  const data = items.slice(start, start + safePerPage);

  return {
    success_message: "Static paginated result",
    total_pages: totalPages,
    current_page: safePage,
    total_items: totalItems,
    has_next: safePage < totalPages,
    has_prev: safePage > 1,
    data,
  };
}

function filterBySearch<T>(
  items: T[],
  search: string,
  getText: (item: T) => string,
): T[] {
  const term = search.trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) => getText(item).toLowerCase().includes(term));
}

function getOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:5173";
}

function buildRedirectUrl(value: unknown, fallbackPath: string): string {
  const raw = typeof value === "string" && value.length > 0 ? value : fallbackPath;
  return raw.replace("{CHECKOUT_SESSION_ID}", "static-checkout-session");
}

function getProject(projectId: string) {
  return (
    staticApiState.projects.find((project) => project._id === projectId) ||
    staticApiState.projects[0]
  );
}

function getGroup(groupId: string) {
  return (
    staticApiState.groups.find((group) => group._id === groupId) ||
    staticApiState.groups[0]
  );
}

function getQrCode(qrCodeId: string) {
  return (
    staticApiState.qrCodes.find((qrCode) => qrCode._id === qrCodeId) ||
    staticApiState.qrCodes[0]
  );
}

function getToolItemsFromPath(pathname: string): unknown {
  switch (pathname) {
    case "/procore/drawings":
      return cloneMockValue(STATIC_PROCORE_ITEMS.drawings);
    case "/procore/rfis":
      return cloneMockValue(STATIC_PROCORE_ITEMS.rfis);
    case "/procore/submittals":
      return cloneMockValue(STATIC_PROCORE_ITEMS.submittals);
    case "/procore/inspections":
      return cloneMockValue(STATIC_PROCORE_ITEMS.inspections);
    case "/procore/punch-list":
      return cloneMockValue(STATIC_PROCORE_ITEMS.punchLists);
    case "/procore/photos":
      return cloneMockValue(STATIC_PROCORE_ITEMS.photos);
    case "/procore/observations":
      return cloneMockValue(STATIC_PROCORE_ITEMS.observations);
    case "/procore/incidents":
      return cloneMockValue(STATIC_PROCORE_ITEMS.incidents);
    case "/procore/instructions":
      return cloneMockValue(STATIC_PROCORE_ITEMS.instructions);
    case "/procore/tasks":
      return cloneMockValue(STATIC_PROCORE_ITEMS.tasks);
    case "/procore/forms":
      return cloneMockValue(STATIC_PROCORE_ITEMS.forms);
    case "/procore/specifications":
      return cloneMockValue(STATIC_PROCORE_ITEMS.specifications);
    case "/procore/coordination-issues":
      return cloneMockValue(STATIC_PROCORE_ITEMS.coordinationIssues);
    case "/procore/directory":
      return cloneMockValue(STATIC_PROCORE_ITEMS.directory);
    case "/procore/documents":
      return createProcoreDocumentData();
    case "/procore/folders":
      return {
        data: {
          folders: cloneMockValue(STATIC_PROCORE_ITEMS.documents.folders),
          files: cloneMockValue(STATIC_PROCORE_ITEMS.documents.files),
        },
        hiddenIds: [],
      };
    default:
      return [];
  }
}

function handleStaticRequest(
  method: string,
  url: URL,
  body: Record<string, unknown>,
): MockApiResponse {
  const pathname = url.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const search = url.searchParams;

  if (pathname === "/auth/login" && method === "POST") {
    return ok({
      ...STATIC_USER,
      company: STATIC_COMPANY.companyName,
      accessToken: STATIC_ACCESS_TOKEN,
    });
  }

  if (pathname === "/auth/refresh" && method === "POST") {
    return ok({ accessToken: STATIC_ACCESS_TOKEN });
  }

  if (pathname === "/auth/logout" && method === "POST") {
    return ok({ message: "Static session reset" });
  }

  if (pathname === "/auth/procore-login" && method === "GET") {
    return ok({
      url: `${getOrigin()}/procore/oauth-success?userId=${STATIC_USER._id}`,
    });
  }

  if (pathname === "/oauth/procore/logout" && method === "POST") {
    return ok({ success: true });
  }

  if (pathname === "/oauth/procore/success" && method === "POST") {
    return ok({
      ...STATIC_USER,
      company: STATIC_COMPANY.companyName,
      accessToken: STATIC_ACCESS_TOKEN,
    });
  }

  if (
    pathname === "/oauth/procore/select-company" ||
    pathname === "/oauth/refresh-token" ||
    pathname.startsWith("/auth/signup") ||
    pathname.startsWith("/auth/verify-otp") ||
    pathname.startsWith("/auth/resend-otp") ||
    pathname.startsWith("/auth/complete-signup") ||
    pathname.startsWith("/auth/forgot-password") ||
    pathname.startsWith("/auth/verify-email-token") ||
    pathname.startsWith("/auth/complete-invited-signup")
  ) {
    return ok({
      success: true,
      message: "Static auth flow completed",
      accessToken: STATIC_ACCESS_TOKEN,
      userId: STATIC_USER._id,
    });
  }

  if (pathname === "/stripe/products" && method === "GET") {
    return ok({
      data: [
        {
          id: "prod_standard_static",
          name: "Standard",
          default_price: {
            id: "price_standard_static",
            unit_amount: 2900,
            currency: "usd",
            recurring: { interval: "month" },
          },
        },
        {
          id: "prod_professional_static",
          name: "Professional",
          default_price: {
            id: "price_professional_static",
            unit_amount: 6900,
            currency: "usd",
            recurring: { interval: "month" },
          },
        },
        {
          id: STATIC_COMPANY.stripeProductID,
          name: "Business",
          default_price: {
            id: STATIC_COMPANY.stripePriceID,
            unit_amount: 18900,
            currency: "usd",
            recurring: { interval: "month" },
          },
        },
      ],
    });
  }

  if (pathname.startsWith("/stripe/products/") && method === "GET") {
    return ok({
      data: {
        id: segments[2],
        name: "Static Plan",
        default_price: {
          id: STATIC_COMPANY.stripePriceID,
          unit_amount: 18900,
          currency: "usd",
          recurring: { interval: "month" },
        },
      },
    });
  }

  if (pathname === "/stripe/checkout/sessions" && method === "POST") {
    return ok({
      url: buildRedirectUrl(body.successUrl, `${getOrigin()}/settings`),
    });
  }

  if (pathname === "/stripe/billing-portal/sessions" && method === "POST") {
    return ok({
      url: buildRedirectUrl(body.return_url, `${getOrigin()}/settings`),
    });
  }

  if (pathname === "/stripe/checkout/storage-extension" && method === "POST") {
    return ok({
      url: buildRedirectUrl(
        body.success_url,
        `${getOrigin()}/storage/success?session_id=static-checkout-session`,
      ),
    });
  }

  if (pathname === "/stripe/checkout/verify" && method === "POST") {
    return ok({
      success: true,
      message: "Static checkout verified",
      companyId: COMPANY_ID,
      customerId: STATIC_COMPANY.stripeCustomerID,
      subscriptionId: STATIC_COMPANY.stripeSubscriptionID,
      productId: STATIC_COMPANY.stripeProductID,
      priceId: STATIC_COMPANY.stripePriceID,
    });
  }

  if (segments[0] === "company" && segments[2] === "dashboard-stats") {
    return ok({ data: computeDashboardStats(staticApiState.qrCodes) });
  }

  if (segments[0] === "company" && segments[2] === "storage-stats") {
    return ok({ data: computeStorageStats() });
  }

  if (segments[0] === "company" && segments[2] === "activity-log") {
    const page = Number(search.get("page") || "1");
    const limit = Number(search.get("limit") || "20");
    return ok(paginated(cloneMockValue(staticApiState.activityLog), page, limit));
  }

  if (segments[0] === "company" && segments[2] === "procore-status") {
    return ok({
      isConnected: true,
      procoreEmail: "integrations@taliho.design",
      editProcoreItemsAllowed: true,
    });
  }

  if (segments[0] === "company" && segments[2] === "procore-integration-details") {
    return ok({
      connected: true,
      integrationOwner: {
        userId: STATIC_USER._id,
        email: STATIC_USER.email,
        firstName: STATIC_USER.firstName,
        lastName: STATIC_USER.lastName,
      },
      connectedUsers: staticApiState.users.map((user, index) => ({
        userId: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        connectedAt: user.createdAt,
        isIntegrationOwner: index === 0,
      })),
      lastSyncTime: staticApiState.activityLog[1]?.createdAt,
      syncHealth: "healthy",
      accessStatus: {
        allowed: true,
        reason: "paid_subscription",
      },
    });
  }

  if (segments[0] === "company" && segments[2] === "procore-integration-owner" && method === "PUT") {
    return ok({
      success: true,
      previousOwnerId: STATIC_USER._id,
      newOwnerId: String(body.newOwnerUserId || STATIC_USER._id),
      message: "Static integration owner updated",
    });
  }

  if (segments[0] === "company" && segments[2] === "procore-settings" && method === "PATCH") {
    staticApiState.company.editProcoreItemsAllowed = Boolean(
      body.editProcoreItemsAllowed,
    );
    return successEnvelope(staticApiState.company, "Static Procore settings updated");
  }

  if (pathname === "/procore/status" && method === "GET") {
    return ok({
      connected: true,
      companyName: STATIC_COMPANY.companyName,
      lastSyncTime: staticApiState.activityLog[1]?.createdAt,
      projectsCount: staticApiState.projects.length,
      documentsCount: staticApiState.documents.length,
      inspectionsCount: STATIC_PROCORE_ITEMS.inspections.length,
      syncHealthStatus: "healthy",
      procoreEmail: "integrations@taliho.design",
      editProcoreItemsAllowed: true,
    });
  }

  if (segments[0] === "company" && segments[2] === "qr-style" && method === "GET") {
    if (segments[3] === "logo") {
      return ok({
        data: {
          logoUrl:
            staticApiState.qrStyleConfig.qrStyleConfig?.logo?.logoUrl ||
            STATIC_COMPANY.companyLogo,
          awsKey: "static/qr-style/logo.png",
          awsId: "qr-style-logo-static",
        },
      });
    }
    return ok({ data: cloneMockValue(staticApiState.qrStyleConfig) });
  }

  if (segments[0] === "company" && segments[2] === "qr-style" && method === "PATCH") {
    staticApiState.qrStyleConfig = {
      useStyledQRCodes: Boolean(body.useStyledQRCodes),
      qrStyleConfig: {
        presetName:
          typeof body.presetName === "string"
            ? body.presetName
            : staticApiState.qrStyleConfig.qrStyleConfig?.presetName,
        logo: staticApiState.qrStyleConfig.qrStyleConfig?.logo,
      },
    };
    return ok({ data: cloneMockValue(staticApiState.qrStyleConfig) });
  }

  if (
    segments[0] === "company" &&
    segments[2] === "qr-style" &&
    segments[3] === "logo" &&
    method === "POST"
  ) {
    staticApiState.qrStyleConfig.qrStyleConfig = {
      ...(staticApiState.qrStyleConfig.qrStyleConfig || {}),
      logo: {
        logoUrl: STATIC_COMPANY.companyLogo,
        awsKey: "static/qr-style/logo.png",
        awsId: "qr-style-logo-static",
      },
    };
    return ok({
      data: {
        logoUrl: STATIC_COMPANY.companyLogo,
        awsKey: "static/qr-style/logo.png",
        awsId: "qr-style-logo-static",
      },
    });
  }

  if (segments[0] === "company" && segments.length === 2 && method === "GET") {
    return ok({ data: cloneMockValue(staticApiState.company) });
  }

  if (segments[0] === "company" && segments.length === 2 && method === "PATCH") {
    staticApiState.company = {
      ...staticApiState.company,
      ...(body as Partial<typeof staticApiState.company>),
    };
    return ok({ data: cloneMockValue(staticApiState.company) });
  }

  if (segments[0] === "company" && segments[2] === "addons" && method === "POST") {
    return ok({ data: cloneMockValue(staticApiState.company) });
  }

  if (pathname === "/qr-code/admin/presets" && method === "GET") {
    return ok({ data: cloneMockValue(STATIC_QR_STYLE_PRESETS) });
  }

  if (pathname === "/qr-code/admin/preview" && method === "POST") {
    return ok({
      data: {
        dataUri: getQrCode("qr-static-001").qrImageUrl,
        svgString: "<svg><!-- static preview --></svg>",
        text: String(body.text || "STATIC"),
      },
    });
  }

  if (pathname === "/qr-code/admin/batch-regenerate" && method === "POST") {
    return ok({
      data: {
        total: staticApiState.qrCodes.length,
        success: staticApiState.qrCodes.length,
        failed: 0,
        errors: [],
      },
    });
  }

  if (
    pathname === "/qr-code/admin/batch-regenerate-async" &&
    method === "POST"
  ) {
    const jobId = nextId("job");
    jobState.set(jobId, {
      jobId,
      total: staticApiState.qrCodes.length,
      status: "completed",
    });
    return ok({
      data: {
        jobId,
        message: "Static batch job completed instantly",
        total: staticApiState.qrCodes.length,
      },
    });
  }

  if (
    pathname.startsWith("/qr-code/admin/regenerate-count/") &&
    method === "GET"
  ) {
    return ok({ data: { count: staticApiState.qrCodes.length } });
  }

  if (pathname.startsWith("/aggregation/qr-company-project/")) {
    return ok(createProjectCompanyAggregation(segments[2]));
  }

  if (pathname.startsWith("/aggregation/qr-folder/")) {
    return ok(createProjectCompanyAggregation(segments[2]));
  }

  if (pathname.startsWith("/aggregation/quick-codes/")) {
    return ok({
      data: cloneMockValue(staticApiState.qrCodes.slice(0, 4)),
    });
  }

  if (pathname.startsWith("/aggregation/all-projects/")) {
    return ok(cloneMockValue(staticApiState.projects));
  }

  if (pathname === "/aggregation/project-qrcodes" && method === "GET") {
    const projectId = search.get("projectId") || "";
    const projectItems = staticApiState.qrCodes
      .filter((qrCode) => qrCode.project === projectId)
      .map((qrCode) => ({
        _id: qrCode._id,
        qrcodeName: qrCode.qrcodeName,
        type: qrCode.type,
        groupingType: qrCode.groupingType,
        project: qrCode.project,
        createdAt: qrCode.createdAt?.toString(),
        mobileScanCount: qrCode.mobileScanCount,
        qrImageUrl: qrCode.qrImageUrl,
        qrimage: qrCode.qrimage,
      }));
    return ok({
      success_message: "Static project QR list",
      current_page: 1,
      per_page: projectItems.length,
      total_items: projectItems.length,
      data: projectItems,
    });
  }

  if (pathname === "/project" && method === "GET") {
    const page = Number(search.get("current_page") || search.get("page") || "1");
    const perPage = Number(search.get("per_page") || search.get("perPage") || "20");
    const status = search.get("status") || "";
    const searchTerm = search.get("search") || "";

    let items = cloneMockValue(staticApiState.projects);
    if (status) {
      items = items.filter(
        (project) => (project.projectStatus || "").toLowerCase() === status.toLowerCase(),
      );
    }
    items = filterBySearch(
      items,
      searchTerm,
      (project) => `${project.projectName} ${project.clientName}`,
    );
    return ok(paginated(items, page, perPage));
  }

  if (pathname === "/project" && method === "POST") {
    const project = {
      _id: nextId("project"),
      name: String(body.projectName || "New Static Project"),
      projectName: String(body.projectName || "New Static Project"),
      clientName: String(body.clientName || "Static Client"),
      location: `${String(body.projectAddress || "200 Prototype Way")}, ${String(body.projectCity || "Boston")}, ${String(body.projectState || "MA")} ${String(body.projectZIP || "02110")}`,
      projectAddress: String(body.projectAddress || "200 Prototype Way"),
      projectCity: String(body.projectCity || "Boston"),
      projectState: String(body.projectState || "MA"),
      projectZIP: String(body.projectZIP || "02110"),
      projectStatus: String(body.projectStatus || "active"),
      qrCodes: 0,
      groups: 0,
      mobileScanCount: 0,
      createdAt: new Date().toISOString(),
      company: COMPANY_ID,
      archived: false,
      procoreCompanyID: STATIC_COMPANY.procoreCompanyID?.toString(),
      procoreProjectID: `static-procore-${sequence}`,
    };
    staticApiState.projects.unshift(project);
    return successEnvelope(project, "Static project created");
  }

  if (pathname === "/project/bulk" && method === "DELETE") {
    const projectIds = Array.isArray(body.projectIds)
      ? (body.projectIds as string[])
      : [];
    staticApiState.projects = staticApiState.projects.filter(
      (project) => !projectIds.includes(project._id),
    );
    return ok({
      success_message: "Static projects removed",
      total_items: projectIds.length,
      data: [],
    });
  }

  if (segments[0] === "project" && segments[1] === "by-id" && method === "GET") {
    const project = getProject(segments[2]);
    return successEnvelope(cloneMockValue(project));
  }

  if (segments[0] === "project" && segments[1] && method === "GET") {
    return ok(cloneMockValue(getProject(segments[1])));
  }

  if (segments[0] === "project" && segments[1] && method === "PATCH") {
    staticApiState.projects = staticApiState.projects.map((project) =>
      project._id === segments[1]
        ? {
            ...project,
            ...(body as Partial<typeof project>),
          }
        : project,
    );
    return successEnvelope(cloneMockValue(getProject(segments[1])), "Static project updated");
  }

  if (segments[0] === "project" && segments[1] && method === "DELETE") {
    const project = getProject(segments[1]);
    staticApiState.projects = staticApiState.projects.filter(
      (item) => item._id !== segments[1],
    );
    return successEnvelope(cloneMockValue(project), "Static project deleted");
  }

  if (pathname === "/groups" && method === "GET") {
    const page = Number(search.get("current_page") || "1");
    const perPage = Number(search.get("per_page") || "20");
    const searchTerm = search.get("search") || "";
    const projectId = search.get("projectId") || "";
    const type = search.get("type") || "";
    const types = search.getAll("types");

    let items = cloneMockValue(staticApiState.groups);
    if (projectId) {
      items = items.filter((group) => group.project === projectId);
    }
    if (type) {
      items = items.filter((group) => group.type === type);
    }
    if (types.length > 0) {
      items = items.filter((group) => types.includes(group.type));
    }
    items = filterBySearch(
      items,
      searchTerm,
      (group) =>
        `${group.groupName} ${group.arrangementName || ""} ${group.equipmentName || ""}`,
    );
    return ok(paginated(items, page, perPage));
  }

  if (pathname === "/groups" && method === "POST") {
    const type: "arrangement" | "equipment" =
      body.type === "equipment" ? "equipment" : "arrangement";
    const group = {
      _id: nextId("group"),
      type,
      arrangementName:
        type === "arrangement" ? String(body.groupName || "New Arrangement") : undefined,
      arrangementType:
        type === "arrangement"
          ? String(body.arrangementType || "Static Review")
          : undefined,
      equipmentID: type === "equipment" ? String(body.equipmentID || "EQ-NEW") : undefined,
      equipmentName:
        type === "equipment" ? String(body.groupName || "New Equipment Group") : undefined,
      groupName: String(body.groupName || "New Group"),
      project: String(body.projectId || staticApiState.projects[0]._id),
      numberOfCodes: 0,
      mobileScanCount: 0,
      createdAt: new Date().toISOString(),
      company: COMPANY_ID,
      categories: [],
      description: String(body.description || ""),
    };
    staticApiState.groups.unshift(group);
    return successEnvelope(group, "Static group created");
  }

  if (pathname === "/groups/bulk" && method === "DELETE") {
    const groupIds = Array.isArray(body.groupIds) ? (body.groupIds as string[]) : [];
    staticApiState.groups = staticApiState.groups.filter(
      (group) => !groupIds.includes(group._id),
    );
    return ok({
      success_message: "Static groups removed",
      total_items: groupIds.length,
      data: [],
    });
  }

  if (segments[0] === "groups" && segments[1] && method === "GET") {
    return successEnvelope(cloneMockValue(getGroup(segments[1])));
  }

  if (segments[0] === "groups" && segments[1] && method === "PATCH") {
    staticApiState.groups = staticApiState.groups.map((group) =>
      group._id === segments[1]
        ? {
            ...group,
            ...(body as Partial<typeof group>),
          }
        : group,
    );
    return successEnvelope(cloneMockValue(getGroup(segments[1])), "Static group updated");
  }

  if (segments[0] === "groups" && segments[1] && method === "DELETE") {
    const group = getGroup(segments[1]);
    staticApiState.groups = staticApiState.groups.filter(
      (item) => item._id !== segments[1],
    );
    return successEnvelope(cloneMockValue(group), "Static group deleted");
  }

  if (pathname === "/qr-code" && method === "GET") {
    const page = Number(search.get("current_page") || "1");
    const perPage = Number(search.get("per_page") || "20");
    const projectId = search.get("projectId") || "";
    const groupingId = search.get("groupingId") || "";
    const searchTerm = search.get("search") || "";
    const types = search.getAll("types");

    let items = cloneMockValue(staticApiState.qrCodes);
    if (projectId) {
      items = items.filter((qrCode) => qrCode.project === projectId);
    }
    if (groupingId) {
      items = items.filter((qrCode) => qrCode.group === groupingId);
    }
    if (types.length > 0) {
      items = items.filter((qrCode) => types.includes(String(qrCode.type || "")));
    }
    items = filterBySearch(items, searchTerm, (qrCode) => qrCode.qrcodeName);
    return ok(paginated(items, page, perPage));
  }

  if (pathname === "/qr-code" && method === "POST") {
    const qrCode = {
      _id: nextId("qr"),
      groupingType: "group",
      qrcodeName: String(body.qrcodeName || body.name || "New Static QR"),
      company: COMPANY_ID,
      project: String(body.projectId || staticApiState.projects[0]._id),
      projectName: getProject(String(body.projectId || staticApiState.projects[0]._id))
        .projectName,
      type: String(body.type || "folder"),
      group: typeof body.groupingId === "string" ? body.groupingId : undefined,
      qrimage: getQrCode("qr-static-001").qrimage,
      qrImageUrl: getQrCode("qr-static-001").qrImageUrl,
      mobileScanCount: 0,
      passwordActivated: false,
      procoreConnect: false,
      procoreFetch: false,
      createdBy: STATIC_USER._id,
      createdAt: new Date(),
    };
    staticApiState.qrCodes.unshift(qrCode);
    return successEnvelope(qrCode, "Static QR code created");
  }

  if (pathname === "/qr-code/bulk" && method === "POST") {
    const numberOfCodes = Number(body.numberOfCodes || 3);
    const created = Array.from({ length: numberOfCodes }, (_, index) => ({
      id: nextId("qrbulk"),
      name: `Bulk Static QR ${index + 1}`,
      url: `${getOrigin()}/scannedQR?qrcodeId=qr-static-001`,
      qrImageUrl: getQrCode("qr-static-001").qrImageUrl,
    }));
    return ok(created);
  }

  if (
    (pathname === "/qr-code/bulk-async" || pathname === "/qr-code/bulk-items-async") &&
    method === "POST"
  ) {
    const total =
      pathname === "/qr-code/bulk-items-async" && Array.isArray(body.items)
        ? body.items.length
        : Number(body.numberOfCodes || 5);
    const jobId = nextId("job");
    jobState.set(jobId, { jobId, total, status: "completed" });
    return ok({
      jobId,
      message: "Static job completed instantly",
    });
  }

  if (pathname === "/qr-code/bulk-delete-async" && method === "POST") {
    const jobId = nextId("job");
    const total = Array.isArray(body.qrcodeIds) ? body.qrcodeIds.length : 0;
    jobState.set(jobId, { jobId, total, status: "completed" });
    return ok({ jobId, message: "Static delete job completed" });
  }

  if (pathname === "/qr-code/download" && method === "POST") {
    return ok({
      success: true,
      url: `${getOrigin()}/images/taliho-logo.png`,
    });
  }

  if (pathname === "/qr-code/bulk-assign" && method === "POST") {
    return ok({
      success_message: "Static QR codes assigned to group",
      total_items: Array.isArray(body.qrcodeIds) ? body.qrcodeIds.length : 0,
      data: [],
    });
  }

  if (pathname === "/qr-code/bulk-assign-project" && method === "POST") {
    return ok({
      success_message: "Static QR codes assigned to project",
      total_items: Array.isArray(body.qrcodeIds) ? body.qrcodeIds.length : 0,
      data: [],
    });
  }

  if (pathname === "/qr-code/bulk-password" && method === "POST") {
    return ok({
      success_message: "Static passwords updated",
      total_items: Array.isArray(body.qrcodeIds) ? body.qrcodeIds.length : 0,
      data: [],
    });
  }

  if (segments[0] === "qr-code" && segments[1] === "jobs" && method === "GET") {
    if (segments[3] === "dead-letter") {
      return ok({ items: [] });
    }
    const job = jobState.get(segments[2]) || {
      jobId: segments[2],
      total: 1,
      status: "completed" as const,
    };
    return ok({
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: {
          processedCount: job.total,
          successCount: job.total,
          failedCount: 0,
          totalRequested: job.total,
        },
        estimatedRemainingMs: 0,
        deadLetterCount: 0,
        startedAt: new Date().toISOString(),
        avgItemTimeMs: 10,
      },
    });
  }

  if (segments[0] === "qr-code" && segments[1] === "jobs") {
    return ok({ success: true });
  }

  if (segments[0] === "qr-code" && segments[1] === "image" && method === "GET") {
    return ok({
      signedUrl: getQrCode(segments[2]).qrImageUrl,
      exists: true,
    });
  }

  if (
    segments[0] === "qr-code" &&
    segments[1] === "scanned" &&
    segments[3] === "verify-password" &&
    method === "POST"
  ) {
    return ok({
      valid: true,
      requiredBy: "none",
      verifyToken: "static-qr-verify-token",
    });
  }

  if (segments[0] === "qr-code" && segments[1] === "scanned" && method === "POST") {
    return ok({ success: true });
  }

  if (segments[0] === "qr-code" && segments[1] === "scanned" && method === "GET") {
    return ok(createScannedQrAggregate(segments[2]));
  }

  if (
    segments[0] === "qr-code" &&
    segments[2] === "procore-tools" &&
    method === "GET"
  ) {
    return ok(createQrProcoreToolsResponse(segments[1]));
  }

  if (segments[0] === "qr-code" && segments[2] === "link" && method === "POST") {
    const newDocument = {
      _id: nextId("doc"),
      documentName: String(body.documentName || "New Static Link"),
      documentFile: String(body.referenceLink || "https://www.taliho.com"),
      documentSize: 0,
      folder: String(body.folderId || staticApiState.folders[0]._id),
      openToPage: 1,
      project: String(body.projectId || staticApiState.projects[0]._id),
      qrcode: segments[1],
      createdAt: new Date().toISOString(),
      addedLink: true,
    };
    staticApiState.documents.unshift(newDocument);
    return successEnvelope(newDocument, "Static link added");
  }

  if (segments[0] === "qr-code" && segments[1] && method === "GET") {
    return ok(cloneMockValue(getQrCode(segments[1])));
  }

  if (segments[0] === "qr-code" && segments[1] && method === "PATCH") {
    staticApiState.qrCodes = staticApiState.qrCodes.map((qrCode) =>
      qrCode._id === segments[1]
        ? {
            ...qrCode,
            ...(body as Partial<typeof qrCode>),
          }
        : qrCode,
    );
    return successEnvelope(cloneMockValue(getQrCode(segments[1])), "Static QR updated");
  }

  if (segments[0] === "qr-code" && segments[1] && method === "DELETE") {
    const qrCode = getQrCode(segments[1]);
    staticApiState.qrCodes = staticApiState.qrCodes.filter(
      (item) => item._id !== segments[1],
    );
    return successEnvelope(cloneMockValue(qrCode), "Static QR deleted");
  }

  if (pathname.startsWith("/procore/")) {
    if (pathname === "/procore/punch-list-assignee-options" && method === "GET") {
      return ok(cloneMockValue(STATIC_PUNCH_ASSIGNEES));
    }
    if (pathname === "/procore/inspection-templates" && method === "GET") {
      return ok(cloneMockValue(STATIC_INSPECTION_TEMPLATES));
    }
    if (pathname === "/procore/inspection-items" && method === "GET") {
      return ok(cloneMockValue(STATIC_INSPECTION_ITEMS));
    }
    if (method === "POST") {
      return ok({
        success: true,
        data: {
          id: nextId("procore"),
          title: String(body.name || body.identifier || "Static Procore Item"),
          status: "created",
        },
      });
    }
    return ok(getToolItemsFromPath(pathname));
  }

  if (pathname === "/procore-item" && method === "POST") {
    return successEnvelope(body, "Static Procore item linked");
  }

  if (pathname === "/procore-item/bulk" && method === "POST") {
    return ok({ success_message: "Static Procore items linked", total_items: 0, data: [] });
  }

  if (pathname === "/procore-item/delete/single" && method === "DELETE") {
    return ok({ success_message: "Static Procore item removed", data: body });
  }

  if (pathname === "/procore-item/bulk" && method === "DELETE") {
    return ok({ success_message: "Static Procore items removed", total_items: 0, data: [] });
  }

  if (pathname.startsWith("/procore-item/toggle-visibility") && method === "PATCH") {
    return ok({ success_message: "Static visibility updated", data: body });
  }

  if (pathname === "/user" || pathname === "/user/") {
    if (method === "GET") {
      const page = Number(search.get("current_page") || "1");
      const perPage = Number(search.get("per_page") || "20");
      const searchTerm = search.get("search") || "";
      const users = filterBySearch(
        cloneMockValue(staticApiState.users),
        searchTerm,
        (user) => `${user.firstName} ${user.lastName} ${user.email}`,
      );
      return ok({
        ...paginated(users, page, perPage),
      });
    }
  }

  if (pathname === "/user/add-user" && method === "POST") {
    const permission: "admin" | "pm" | "user" =
      body.permission === "admin" ||
      body.permission === "pm" ||
      body.permission === "user"
        ? body.permission
        : "user";
    const user = {
      _id: nextId("user"),
      email: String(body.email || "new@static.local"),
      firstName: String(body.firstName || "New"),
      lastName: String(body.lastName || "Reviewer"),
      permission,
      isVerified: false,
      phoneNumber: "",
      createdAt: new Date().toISOString(),
      lastLoggedIn: undefined,
    };
    staticApiState.users.push(user);
    return successEnvelope(user, "Static invite sent");
  }

  if (segments[0] === "user" && segments[2] === "notification-preferences") {
    if (method === "GET") {
      return ok({ data: cloneMockValue(STATIC_NOTIFICATION_PREFERENCES) });
    }
    if (method === "PATCH") {
      return ok({ data: { ...STATIC_NOTIFICATION_PREFERENCES, ...body } });
    }
  }

  if (segments[0] === "user" && segments[2] === "procore-status" && method === "GET") {
    return ok({
      connected: true,
      procoreUserId: 44001,
      procoreEmail: STATIC_USER.email,
      connectedAt: staticApiState.activityLog[1]?.createdAt,
      isIntegrationOwner: segments[1] === STATIC_USER._id,
    });
  }

  if (
    segments[0] === "user" &&
    segments[2] === "procore-disconnect" &&
    method === "POST"
  ) {
    return ok({
      success: true,
      message: "Static Procore account disconnected",
    });
  }

  if (
    segments[0] === "user" &&
    (segments[2] === "email-change-otp" ||
      segments[2] === "email-change-verify" ||
      segments[2] === "password-change-otp" ||
      segments[2] === "password-change-verify")
  ) {
    return ok({ success: true, message: "Static verification accepted" });
  }

  if (segments[0] === "user" && segments[1] === "switch-admin" && method === "PATCH") {
    return ok({ data: cloneMockValue(staticApiState.users[1] || staticApiState.users[0]) });
  }

  if (segments[0] === "user" && segments[1] === "resend-invite" && method === "POST") {
    return ok({ success: true, message: "Static invite resent" });
  }

  if (segments[0] === "user" && segments[2] === "password" && method === "PATCH") {
    return ok({ success: true, message: "Static password updated" });
  }

  if (segments[0] === "user" && segments[1] && method === "PATCH") {
    staticApiState.users = staticApiState.users.map((user) =>
      user._id === segments[1]
        ? {
            ...user,
            ...(body as Partial<typeof user>),
          }
        : user,
    );
    return ok({ data: cloneMockValue(staticApiState.users.find((user) => user._id === segments[1])) });
  }

  if (segments[0] === "user" && segments[1] === "bulk" && method === "DELETE") {
    const userIds = Array.isArray(body.userIds) ? (body.userIds as string[]) : [];
    staticApiState.users = staticApiState.users.filter(
      (user) => !userIds.includes(user._id),
    );
    return ok({ success_message: "Static users removed", total_items: userIds.length, data: [] });
  }

  if (segments[0] === "user" && segments[1] && method === "DELETE") {
    const deleted = staticApiState.users.find((user) => user._id === segments[1]);
    staticApiState.users = staticApiState.users.filter(
      (user) => user._id !== segments[1],
    );
    return ok({ success_message: "Static user removed", data: deleted });
  }

  if (pathname === "/categories" && method === "GET") {
    const companyId = search.get("companyId") || COMPANY_ID;
    return ok({
      data: cloneMockValue(
        staticApiState.categories.filter((category) => category.company === companyId),
      ),
    });
  }

  if (pathname === "/categories/classes" && method === "GET") {
    const classes = Array.from(
      new Set(staticApiState.categories.map((category) => category.categoryClass)),
    );
    return ok({ data: classes });
  }

  if (pathname === "/categories" && method === "POST") {
    const category = {
      _id: nextId("category"),
      categoryName: String(body.categoryName || "New Category"),
      categoryClass: String(body.categoryClass || "General"),
      company: String(body.companyId || COMPANY_ID),
      procoreTool: typeof body.procoreTool === "string" ? body.procoreTool : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    staticApiState.categories.push(category);
    return ok({ data: category });
  }

  if (segments[0] === "categories" && segments[1] && method === "GET") {
    const category =
      staticApiState.categories.find((item) => item._id === segments[1]) ||
      staticApiState.categories[0];
    return ok({ data: cloneMockValue(category) });
  }

  if (segments[0] === "categories" && segments[1] && method === "PATCH") {
    staticApiState.categories = staticApiState.categories.map((category) =>
      category._id === segments[1]
        ? {
            ...category,
            ...(body as Partial<typeof category>),
            updatedAt: new Date().toISOString(),
          }
        : category,
    );
    const category =
      staticApiState.categories.find((item) => item._id === segments[1]) ||
      staticApiState.categories[0];
    return ok({ data: cloneMockValue(category) });
  }

  if (segments[0] === "categories" && segments[1] && method === "DELETE") {
    const category =
      staticApiState.categories.find((item) => item._id === segments[1]) ||
      staticApiState.categories[0];
    staticApiState.categories = staticApiState.categories.filter(
      (item) => item._id !== segments[1],
    );
    return ok({ data: cloneMockValue(category) });
  }

  if (segments[0] === "admin" && segments[1] === "customers") {
    if (segments[2] === "companies" && method === "GET" && !segments[3]) {
      const searchTerm = search.get("search") || "";
      const companies = filterBySearch(
        cloneMockValue(staticApiState.adminCompanies),
        searchTerm,
        (company) => company.companyName,
      );
      return ok({
        data: {
          companies,
          total: companies.length,
          page: Number(search.get("page") || "1"),
          limit: Number(search.get("limit") || "20"),
        },
      });
    }

    if (segments[2] === "companies" && segments[4] === "users" && method === "GET") {
      return ok({
        data: {
          users: cloneMockValue(staticApiState.users),
        },
      });
    }

    if (segments[2] === "companies" && segments[3] && method === "GET") {
      const base =
        cloneMockValue(
          staticApiState.adminCompanies.find((company) => company._id === segments[3]) ||
            STATIC_ADMIN_COMPANIES[0],
        ) || cloneMockValue(STATIC_ADMIN_COMPANIES[0]);
      return ok({
        data: {
          ...base,
          companyAddress: STATIC_COMPANY.companyAddress,
          companyCity: STATIC_COMPANY.companyCity,
          companyState: STATIC_COMPANY.companyState,
          companyZIP: STATIC_COMPANY.companyZIP,
          companyWebsite: STATIC_COMPANY.companyWebsite,
          companyIndustry: STATIC_COMPANY.companyIndustry,
          usersCount: staticApiState.users.length,
          projectsCount: staticApiState.projects.length,
          qrCodesCount: staticApiState.qrCodes.length,
          documentsCount: staticApiState.documents.length,
          qrGroupsCount: staticApiState.groups.length,
          qrScansCount: computeDashboardStats(staticApiState.qrCodes).qrScansCount,
          documentStorageUsed: STATIC_COMPANY.documentStorageUsed,
          documentStorageCapacity: STATIC_COMPANY.documentStorageCapacity,
          qrCodeStorageUsed: STATIC_COMPANY.qrCodeStorageUsed,
          qrCodeStorageCapacity: STATIC_COMPANY.qrCodeStorageCapacity,
          pendingDomainReview: ["prototype.review"],
          stripeCustomerID: STATIC_COMPANY.stripeCustomerID,
          stripeSubscriptionID: STATIC_COMPANY.stripeSubscriptionID,
          stripePriceID: STATIC_COMPANY.stripePriceID,
          stripeSubscriptionStatus: STATIC_COMPANY.stripeSubscriptionStatus,
          procoreCompanyID: STATIC_COMPANY.procoreCompanyID,
          procoreLastSyncTime: staticApiState.activityLog[1]?.createdAt,
          procoreSyncErrorCount: 0,
        },
      });
    }

    if (segments[2] === "impersonation" && segments[3] === "candidates") {
      return ok({
        data: staticApiState.users.map((user) => ({
          userId: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          permission: user.permission,
          companyId: COMPANY_ID,
          companyName: STATIC_COMPANY.companyName,
          isVerified: user.isVerified,
          lastLoggedIn: user.lastLoggedIn,
        })),
      });
    }

    if (segments[2] === "stats") {
      return ok({ data: cloneMockValue(STATIC_PLATFORM_STATS) });
    }

    if (segments[2] === "online" && segments[3] === "ping" && method === "POST") {
      return empty();
    }

    return ok({ success: true, message: "Static admin action completed" });
  }

  if (segments[0] === "ball-in-court" && segments[1] === "qr" && method === "GET") {
    return ok({ data: [] });
  }

  if (segments[0] === "ball-in-court" && method === "GET") {
    return ok({
      data: {
        workflow: {
          _id: segments[1],
          name: "Static Workflow",
        },
        tasks: [],
      },
    });
  }

  if (segments[0] === "ball-in-court") {
    return ok({ data: { success: true } });
  }

  if (segments[0] === "document") {
    if (pathname === "/document/procore" && method === "POST") {
      return ok(STATIC_COMPANY.companyLogo);
    }
    return ok({
      success_message: "Static document action completed",
      data: cloneMockValue(staticApiState.documents[0] || null),
    });
  }

  if (segments[0] === "folder") {
    return ok({
      success_message: "Static folder action completed",
      data: cloneMockValue(staticApiState.folders[0] || null),
    });
  }

  if (segments[0] === "nfc") {
    return ok({
      targetUrl: `${getOrigin()}/scannedQR?qrcodeId=qr-static-001`,
    });
  }

  return ok({
    success: true,
    success_message: "Static mock response",
    data: {},
  });
}

export const staticAxiosAdapter: AxiosAdapter = async (
  config: InternalAxiosRequestConfig,
) => {
  const method = (config.method || "get").toUpperCase();
  const requestUrl = buildUrl(
    config.url || "/",
    config.baseURL || undefined,
    config.params,
  );
  const body = parseBody(config.data);
  const mockResponse = handleStaticRequest(method, requestUrl, body);

  return {
    data: cloneMockValue(mockResponse.data),
    status: mockResponse.status || 200,
    statusText: "OK",
    headers: mockResponse.headers || {},
    config: config as AxiosRequestConfig,
    request: {},
  } as AxiosResponse;
};

export function installStaticFetchMock() {
  if (fetchMockInstalled || typeof window === "undefined") return;

  const originalFetch = window.fetch.bind(window);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "";

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const shouldMock =
      (backendUrl.length > 0 && rawUrl.startsWith(backendUrl)) ||
      rawUrl.startsWith("/api/") ||
      rawUrl.startsWith("/auth/") ||
      rawUrl.startsWith("/admin/") ||
      rawUrl.startsWith("/ball-in-court/") ||
      rawUrl.startsWith("/categories") ||
      rawUrl.startsWith("/company/") ||
      rawUrl.startsWith("/folder") ||
      rawUrl.startsWith("/groups") ||
      rawUrl.startsWith("/nfc") ||
      rawUrl.startsWith("/project") ||
      rawUrl.startsWith("/procore/") ||
      rawUrl.startsWith("/stripe/") ||
      rawUrl.startsWith("/user/") ||
      rawUrl.startsWith("/qr-code/") ||
      rawUrl.startsWith("/document/");

    if (!shouldMock) {
      return originalFetch(input, init);
    }

    const requestUrl = buildUrl(
      rawUrl.replace(backendUrl, "") || "/",
      backendUrl || undefined,
    );
    const method = (init?.method || "GET").toUpperCase();
    const body = parseBody(init?.body);
    const response = handleStaticRequest(method, requestUrl, body);

    return new Response(JSON.stringify(response.data ?? {}), {
      status: response.status || 200,
      headers: {
        "Content-Type": "application/json",
        ...(response.headers || {}),
      },
    });
  };

  fetchMockInstalled = true;
}

export { STATIC_ONLINE_PRESENCE };
