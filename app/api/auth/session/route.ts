import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/app/lib/authCookies";

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    accessToken?: unknown;
    refreshToken?: unknown;
  };

  if (typeof body.accessToken !== "string" || !body.accessToken.trim()) {
    return json({ ok: false, error: "access_token_required" }, 400);
  }

  const cookieStore = await cookies();
  const common = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  };

  cookieStore.set(ACCESS_TOKEN_COOKIE, body.accessToken.trim(), common);

  if (typeof body.refreshToken === "string" && body.refreshToken.trim()) {
    cookieStore.set(REFRESH_TOKEN_COOKIE, body.refreshToken.trim(), common);
  }

  return json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  return json({ ok: true });
}
