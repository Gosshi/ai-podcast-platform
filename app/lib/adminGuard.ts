import { redirect } from "next/navigation";
import { getViewerFromCookies } from "./viewer";
import { hasValidAdminAccessCookie, isAdminAccessGateEnabled, normalizeAdminNextPath } from "./adminAccess";

/**
 * Resolves the set of admin emails from the ADMIN_EMAILS environment variable.
 * Expects a comma-separated list: "alice@example.com,bob@example.com"
 */
export const resolveAdminEmails = (): Set<string> => {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
};

export const requireAdminIdentity = async () => {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    redirect("/login");
  }

  const adminEmails = resolveAdminEmails();
  if (!viewer.email || !adminEmails.has(viewer.email.toLowerCase())) {
    redirect("/decisions");
  }

  return viewer;
};

/**
 * Guard for admin pages (Server Components).
 * Redirects to /login if not authenticated, to /decisions if not an admin.
 * Returns the authenticated viewer on success.
 */
export const requireAdmin = async (nextPath = "/admin/trends") => {
  const viewer = await requireAdminIdentity();

  if (isAdminAccessGateEnabled()) {
    const hasAccess = await hasValidAdminAccessCookie(viewer.userId);
    if (!hasAccess) {
      redirect(`/admin/access?next=${encodeURIComponent(normalizeAdminNextPath(nextPath))}`);
    }
  }

  return viewer;
};

/**
 * Guard for admin API routes.
 * Returns the viewer if admin, null otherwise (caller should return 401/403).
 */
export const verifyAdmin = async () => {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return null;
  }

  const adminEmails = resolveAdminEmails();
  if (!viewer.email || !adminEmails.has(viewer.email.toLowerCase())) {
    return null;
  }

  if (isAdminAccessGateEnabled()) {
    const hasAccess = await hasValidAdminAccessCookie(viewer.userId);
    if (!hasAccess) {
      return null;
    }
  }

  return viewer;
};
