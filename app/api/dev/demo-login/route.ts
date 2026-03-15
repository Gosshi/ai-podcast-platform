import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/app/lib/authCookies";
import { createAnonClient } from "@/app/lib/supabaseClients";
import { getViewerFromCookies } from "@/app/lib/viewer";

const DEMO_PASSWORD = "local-demo-pass";
const DEMO_USERS = {
  free: "demo-free@local.test",
  paid: "demo-paid@local.test"
} as const;

const buildCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 14
});

const resolveDemoUser = (value: FormDataEntryValue | null): keyof typeof DEMO_USERS | null => {
  return value === "free" || value === "paid" ? value : null;
};

const isJsonRequest = (request: Request): boolean => {
  const contentType = request.headers.get("content-type") ?? "";
  const accept = request.headers.get("accept") ?? "";
  return contentType.includes("application/json") || accept.includes("application/json");
};

const resolveBaseUrl = (request: Request): URL => {
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    return new URL(originHeader);
  }

  const fallback = new URL(request.url);
  if (fallback.hostname === "0.0.0.0") {
    fallback.hostname = "127.0.0.1";
  }
  return fallback;
};

const buildStatusPayload = async () => {
  const viewer = await getViewerFromCookies();
  return {
    signedIn: Boolean(viewer),
    email: viewer?.email ?? null,
    isPaid: viewer?.isPaid ?? false,
    planType: viewer?.planType ?? null,
    subscriptionStatus: viewer?.subscriptionStatus ?? null
  };
};

const jsonWithError = async (status: number, error: string, details?: string) => {
  return NextResponse.json(
    {
      ok: false,
      error,
      details: details ?? null,
      session: await buildStatusPayload()
    },
    { status }
  );
};

const redirectWithError = (request: Request, message: string, details?: string) => {
  const url = new URL("/dev/demo-login", resolveBaseUrl(request));
  url.searchParams.set("error", message);
  if (details) {
    url.searchParams.set("details", details);
  }
  return NextResponse.redirect(url, { status: 303 });
};

const signInDemoUser = async (request: Request, demoUser: keyof typeof DEMO_USERS | null) => {
  if (!demoUser) {
    if (isJsonRequest(request)) {
      return jsonWithError(400, "invalid_demo_user");
    }

    return redirectWithError(request, "invalid_demo_user");
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: DEMO_USERS[demoUser],
    password: DEMO_PASSWORD
  });

  if (error || !data.session) {
    const details = error?.message ?? "demo_login_failed";
    if (isJsonRequest(request)) {
      return jsonWithError(401, "demo_login_failed", details);
    }

    return redirectWithError(request, "demo_login_failed", details);
  }

  if (isJsonRequest(request)) {
    const response = NextResponse.json({
      ok: true,
      demoUser,
      expectedEmail: DEMO_USERS[demoUser],
      redirectTo: `/account?demo=${demoUser}`
    });
    response.cookies.set(ACCESS_TOKEN_COOKIE, data.session.access_token, buildCookieOptions());
    response.cookies.set(REFRESH_TOKEN_COOKIE, data.session.refresh_token, buildCookieOptions());
    return response;
  }

  const url = new URL("/account", resolveBaseUrl(request));
  url.searchParams.set("demo", demoUser);
  const response = NextResponse.redirect(url, { status: 303 });
  response.cookies.set(ACCESS_TOKEN_COOKIE, data.session.access_token, buildCookieOptions());
  response.cookies.set(REFRESH_TOKEN_COOKIE, data.session.refresh_token, buildCookieOptions());
  return response;
};

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("mode") === "status") {
    return NextResponse.json({
      ok: true,
      session: await buildStatusPayload()
    });
  }

  const demoUser = resolveDemoUser(url.searchParams.get("demo") ?? url.searchParams.get("user"));
  return signInDemoUser(request, demoUser);
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { user?: string; demo?: string } | null;
    const demoUser = resolveDemoUser(body?.user ?? body?.demo ?? null);
    return signInDemoUser(request, demoUser);
  }

  const formData = await request.formData().catch(() => null);
  const resolvedDemoUser = resolveDemoUser(formData?.get("user") ?? formData?.get("demo") ?? null);
  return signInDemoUser(request, resolvedDemoUser);
}
