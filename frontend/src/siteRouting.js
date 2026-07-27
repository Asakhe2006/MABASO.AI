import {
  findProtectedWorkspaceRoute,
  findSitePageByRoute,
  protectedWorkspaceRoutes,
} from "./sitePageConfig";

export const APP_ROUTE_BY_PAGE = {
  capture: "/app/capture",
  workspace: "/app/workspace",
  materials: "/app/materials",
  payments: "/app/payments",
  timetable: "/app/timetable",
  collaboration: "/app/collaboration",
  voice: "/app/chat",
  "study-session": "/study-session",
  admin: "/admin/dashboard",
};

const IDENTIFIED_APP_PAGES = new Set([
  "capture",
  "workspace",
  "materials",
  "payments",
  "timetable",
  "collaboration",
  "voice",
]);

export function normalizeProtectedResourceId(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .slice(0, 96);
}

const APP_ROUTE_METADATA = protectedWorkspaceRoutes.reduce((accumulator, route) => {
  accumulator[route.route] = {
    title: `${route.title} | Mabaso AI`,
    description: route.description,
  };
  return accumulator;
}, {});

export function normalizeRoutePath(path = "/") {
  const value = String(path || "").trim();
  if (!value) return "/";
  try {
    const url = value.startsWith("http://") || value.startsWith("https://")
      ? new URL(value)
      : new URL(value, "https://mabaso.ai");
    const pathname = url.pathname || "/";
    return pathname === "/" ? "/" : pathname.replace(/\/+$/, "") || "/";
  } catch {
    return value === "/" ? "/" : value.replace(/\/+$/, "") || "/";
  }
}

export function resolveBrowserPath() {
  if (typeof window === "undefined") return "/";
  return normalizeRoutePath(window.location.pathname || "/");
}

export function resolveAppRouteForPage(currentPage = "", authSessionMode = "user", resourceId = "") {
  if (currentPage === "admin") {
    return authSessionMode === "admin" ? APP_ROUTE_BY_PAGE.admin : "";
  }
  const baseRoute = APP_ROUTE_BY_PAGE[currentPage] || "";
  const normalizedResourceId = normalizeProtectedResourceId(resourceId);
  if (!baseRoute || !normalizedResourceId || !IDENTIFIED_APP_PAGES.has(currentPage)) return baseRoute;
  return `${baseRoute}/${normalizedResourceId}`;
}

export function resolveCurrentPageFromRoute(route = "/") {
  const normalized = normalizeRoutePath(route);
  if (normalized === "/study-session" || normalized.startsWith("/study-session/")) return "study-session";
  if (normalized === "/app/voice-study") return "workspace";
  const match = Object.entries(APP_ROUTE_BY_PAGE).find(([, value]) => (
    value === normalized || normalized.startsWith(`${value}/`)
  ));
  return match?.[0] || "";
}

export function resolveProtectedResourceIdFromRoute(route = "/") {
  const normalized = normalizeRoutePath(route);
  const match = Object.entries(APP_ROUTE_BY_PAGE).find(([pageId, value]) => (
    IDENTIFIED_APP_PAGES.has(pageId) && normalized.startsWith(`${value}/`)
  ));
  if (!match) return "";
  return normalizeProtectedResourceId(normalized.slice(match[1].length + 1).split("/")[0]);
}

export function resolveEnterpriseRoute(path = "/") {
  const normalized = normalizeRoutePath(path);
  return {
    path: normalized,
    sitePage: findSitePageByRoute(normalized),
    protectedWorkspaceRoute: findProtectedWorkspaceRoute(normalized),
  };
}

export function resolveMetadataForRoute({
  path = "/",
  authToken = "",
  currentPage = "",
  authSessionMode = "user",
}) {
  const normalized = normalizeRoutePath(path);
  const sitePage = findSitePageByRoute(normalized);
  if (sitePage?.metadata) return sitePage.metadata;

  const protectedRoute = findProtectedWorkspaceRoute(normalized);
  if (protectedRoute) {
    return {
      title: `${protectedRoute.title} | Mabaso AI`,
      description: protectedRoute.description,
    };
  }

  if (authToken) {
    const appRoute = resolveAppRouteForPage(currentPage, authSessionMode);
    if (appRoute && APP_ROUTE_METADATA[appRoute]) return APP_ROUTE_METADATA[appRoute];
  }

  return {
    title: "Mabaso AI | Lecture-to-Study Workspace",
    description: "Mabaso AI turns lectures, notes, slides, and past papers into transcripts, study guides, tests, collaboration rooms, presentations, podcasts, and AI study support.",
  };
}
