import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/app/lib/authCookies";
import { createAnonClient } from "@/app/lib/supabaseClients";

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

const redirectWithError = (request: Request, message: string) => {
  const url = new URL("/dev/demo-login", resolveBaseUrl(request));
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
};

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const demoUser = resolveDemoUser(formData?.get("user") ?? null);
  if (!demoUser) {
    return redirectWithError(request, "invalid_demo_user");
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: DEMO_USERS[demoUser],
    password: DEMO_PASSWORD
  });

  if (error || !data.session) {
    return redirectWithError(request, error?.message ?? "demo_login_failed");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, data.session.access_token, buildCookieOptions());
  cookieStore.set(REFRESH_TOKEN_COOKIE, data.session.refresh_token, buildCookieOptions());

  const url = new URL("/account", resolveBaseUrl(request));
  url.searchParams.set("demo", demoUser);
  return NextResponse.redirect(url);
}
