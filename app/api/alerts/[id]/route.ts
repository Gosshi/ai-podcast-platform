import { updateUserAlertState } from "@/app/lib/alerts";
import { getViewerFromCookies } from "@/app/lib/viewer";

export const runtime = "nodejs";

type UpdateAlertRequest = {
  action?: unknown;
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
};

const isAlertAction = (value: unknown): value is "read" | "unread" | "dismiss" => {
  return value === "read" || value === "unread" || value === "dismiss";
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const { id } = await params;
  if (!id.trim()) {
    return jsonResponse({ ok: false, error: "alert_id_required" }, 400);
  }

  const body = (await request.json().catch(() => ({}))) as UpdateAlertRequest;
  if (!isAlertAction(body.action)) {
    return jsonResponse({ ok: false, error: "invalid_alert_action" }, 400);
  }

  const { alert, error } = await updateUserAlertState({
    userId: viewer.userId,
    alertId: id,
    action: body.action
  });

  if (error) {
    return jsonResponse({ ok: false, error }, error === "alert_not_found" ? 404 : 500);
  }

  return jsonResponse({
    ok: true,
    alert
  });
}
