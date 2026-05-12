import {
  findProtectedWorkspaceRoute,
  findSitePageByRoute,
  protectedWorkspaceRoutes,
} from "./sitePageConfig";

export const APP_ROUTE_BY_PAGE = {
  capture: "/app/capture",
  workspace: "/app/workspace",
  materials: "/app/materials",
  collaboration: "/app/collaboration",
  admin: "/admin/dashboard",
};

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

export function resolveAppRouteForPage(currentPage = "", authSessionMode = "user") {
  if (currentPage === "admin") {
    return authSessionMode === "admin" ? APP_ROUTE_BY_PAGE.admin : "";
  }
  return APP_ROUTE_BY_PAGE[currentPage] || "";
}

export function resolveCurrentPageFromRoute(route = "/") {
  const normalized = normalizeRoutePath(route);
  const match = Object.entries(APP_ROUTE_BY_PAGE).find(([, value]) => value === normalized);
  return match?.[0] || "";
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

