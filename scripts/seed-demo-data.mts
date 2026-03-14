import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

type DemoUserKey = "free" | "paid";

type DemoUserConfig = {
  key: DemoUserKey;
  email: string;
  name: string;
  planType: string;
  status: string;
  currentPeriodEndDays: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  checkoutSessionId: string | null;
  preferences: {
    interest_topics: string[];
    active_subscriptions: string[];
    decision_priority: string;
    daily_available_time: string;
    budget_sensitivity: string | null;
  };
};

type LocalEnv = {
  apiUrl: string;
  serviceRoleKey: string;
  dbUrl: string;
};

const DEMO_PASSWORD = "local-demo-pass";
const BASE_SEED_PATH = "supabase/seed.sql";

const DEMO_USERS: DemoUserConfig[] = [
  {
    key: "free",
    email: "demo-free@local.test",
    name: "Local Demo Free",
    planType: "free_preview",
    status: "inactive",
    currentPeriodEndDays: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    checkoutSessionId: null,
    preferences: {
      interest_topics: ["games", "streaming"],
      active_subscriptions: ["prime", "youtube"],
      decision_priority: "save_time",
      daily_available_time: "under_30m",
      budget_sensitivity: "medium"
    }
  },
  {
    key: "paid",
    email: "demo-paid@local.test",
    name: "Local Demo Paid",
    planType: "pro_monthly",
    status: "active",
    currentPeriodEndDays: 24,
    stripeCustomerId: "cus_demo_paid_local",
    stripeSubscriptionId: "sub_demo_paid_local",
    checkoutSessionId: "cs_demo_paid_local",
    preferences: {
      interest_topics: ["games", "streaming", "tech"],
      active_subscriptions: ["netflix", "prime", "chatgpt"],
      decision_priority: "avoid_regret",
      daily_available_time: "1_to_2h",
      budget_sensitivity: "high"
    }
  }
];

const DEMO_DECISIONS = [
  {
    id: "30000000-0000-0000-0000-000000000001",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000001",
    episode_id: "10000000-0000-0000-0000-000000000001",
    decision_type: "use_now",
    outcome: "success",
    createdAtDaysAgo: 8,
    updatedAtDaysAgo: 6
  },
  {
    id: "30000000-0000-0000-0000-000000000002",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000004",
    episode_id: "10000000-0000-0000-0000-000000000002",
    decision_type: "use_now",
    outcome: "success",
    createdAtDaysAgo: 7,
    updatedAtDaysAgo: 5
  },
  {
    id: "30000000-0000-0000-0000-000000000003",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000010",
    episode_id: "10000000-0000-0000-0000-000000000004",
    decision_type: "use_now",
    outcome: "neutral",
    createdAtDaysAgo: 6,
    updatedAtDaysAgo: 4
  },
  {
    id: "30000000-0000-0000-0000-000000000004",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000008",
    episode_id: "10000000-0000-0000-0000-000000000003",
    decision_type: "watch",
    outcome: "regret",
    createdAtDaysAgo: 5,
    updatedAtDaysAgo: 3
  },
  {
    id: "30000000-0000-0000-0000-000000000005",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000011",
    episode_id: "10000000-0000-0000-0000-000000000004",
    decision_type: "watch",
    outcome: "regret",
    createdAtDaysAgo: 4,
    updatedAtDaysAgo: 2
  },
  {
    id: "30000000-0000-0000-0000-000000000006",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000014",
    episode_id: "10000000-0000-0000-0000-000000000005",
    decision_type: "watch",
    outcome: "neutral",
    createdAtDaysAgo: 3.5,
    updatedAtDaysAgo: 2.5
  },
  {
    id: "30000000-0000-0000-0000-000000000007",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000013",
    episode_id: "10000000-0000-0000-0000-000000000005",
    decision_type: "use_now",
    outcome: null,
    createdAtDaysAgo: 5,
    updatedAtDaysAgo: 5
  },
  {
    id: "30000000-0000-0000-0000-000000000101",
    user: "free",
    judgment_card_id: "20000000-0000-0000-0000-000000000002",
    episode_id: "10000000-0000-0000-0000-000000000001",
    decision_type: "watch",
    outcome: "neutral",
    createdAtDaysAgo: 5,
    updatedAtDaysAgo: 4
  },
  {
    id: "30000000-0000-0000-0000-000000000102",
    user: "free",
    judgment_card_id: "20000000-0000-0000-0000-000000000005",
    episode_id: "10000000-0000-0000-0000-000000000002",
    decision_type: "watch",
    outcome: "regret",
    createdAtDaysAgo: 4.5,
    updatedAtDaysAgo: 3
  },
  {
    id: "30000000-0000-0000-0000-000000000103",
    user: "free",
    judgment_card_id: "20000000-0000-0000-0000-000000000007",
    episode_id: "10000000-0000-0000-0000-000000000003",
    decision_type: "use_now",
    outcome: "success",
    createdAtDaysAgo: 3,
    updatedAtDaysAgo: 2
  },
  {
    id: "30000000-0000-0000-0000-000000000104",
    user: "free",
    judgment_card_id: "20000000-0000-0000-0000-000000000009",
    episode_id: "10000000-0000-0000-0000-000000000003",
    decision_type: "skip",
    outcome: "neutral",
    createdAtDaysAgo: 2.5,
    updatedAtDaysAgo: 2
  },
  {
    id: "30000000-0000-0000-0000-000000000105",
    user: "free",
    judgment_card_id: "20000000-0000-0000-0000-000000000012",
    episode_id: "10000000-0000-0000-0000-000000000004",
    decision_type: "skip",
    outcome: "neutral",
    createdAtDaysAgo: 2,
    updatedAtDaysAgo: 1.5
  },
  {
    id: "30000000-0000-0000-0000-000000000106",
    user: "free",
    judgment_card_id: "20000000-0000-0000-0000-000000000010",
    episode_id: "10000000-0000-0000-0000-000000000004",
    decision_type: "use_now",
    outcome: null,
    createdAtDaysAgo: 4,
    updatedAtDaysAgo: 4
  }
] as const;

const DEMO_WATCHLIST = [
  {
    id: "40000000-0000-0000-0000-000000000001",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000007",
    episode_id: "10000000-0000-0000-0000-000000000003",
    status: "watching",
    createdAtHoursAgo: 48,
    updatedAtHoursAgo: 20
  },
  {
    id: "40000000-0000-0000-0000-000000000002",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000011",
    episode_id: "10000000-0000-0000-0000-000000000004",
    status: "saved",
    createdAtHoursAgo: 40,
    updatedAtHoursAgo: 18
  },
  {
    id: "40000000-0000-0000-0000-000000000003",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000013",
    episode_id: "10000000-0000-0000-0000-000000000005",
    status: "watching",
    createdAtHoursAgo: 30,
    updatedAtHoursAgo: 10
  },
  {
    id: "40000000-0000-0000-0000-000000000004",
    user: "paid",
    judgment_card_id: "20000000-0000-0000-0000-000000000006",
    episode_id: "10000000-0000-0000-0000-000000000002",
    status: "archived",
    createdAtHoursAgo: 216,
    updatedAtHoursAgo: 192
  },
  {
    id: "40000000-0000-0000-0000-000000000101",
    user: "free",
    judgment_card_id: "20000000-0000-0000-0000-000000000004",
    episode_id: "10000000-0000-0000-0000-000000000002",
    status: "saved",
    createdAtHoursAgo: 30,
    updatedAtHoursAgo: 24
  },
  {
    id: "40000000-0000-0000-0000-000000000102",
    user: "free",
    judgment_card_id: "20000000-0000-0000-0000-000000000010",
    episode_id: "10000000-0000-0000-0000-000000000004",
    status: "watching",
    createdAtHoursAgo: 96,
    updatedAtHoursAgo: 96
  },
  {
    id: "40000000-0000-0000-0000-000000000103",
    user: "free",
    judgment_card_id: "20000000-0000-0000-0000-000000000014",
    episode_id: "10000000-0000-0000-0000-000000000005",
    status: "saved",
    createdAtHoursAgo: 48,
    updatedAtHoursAgo: 48
  }
] as const;

const parseEnvFileOutput = (output: string): Record<string, string> => {
  return output
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes("="))
    .reduce<Record<string, string>>((acc, line) => {
      const separatorIndex = line.indexOf("=");
      const key = line.slice(0, separatorIndex);
      const rawValue = line.slice(separatorIndex + 1);
      acc[key] = rawValue.replace(/^"/, "").replace(/"$/, "");
      return acc;
    }, {});
};

const resolveLocalEnv = (): LocalEnv => {
  const apiUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.SUPABASE_DB_URL;

  if (apiUrl && serviceRoleKey && dbUrl) {
    return {
      apiUrl,
      serviceRoleKey,
      dbUrl
    };
  }

  const statusEnv = parseEnvFileOutput(execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" }));
  return {
    apiUrl: apiUrl ?? statusEnv.API_URL,
    serviceRoleKey: serviceRoleKey ?? statusEnv.SERVICE_ROLE_KEY,
    dbUrl: dbUrl ?? statusEnv.DB_URL
  };
};

const shiftIso = (amount: number, unit: "days" | "hours"): string => {
  const date = new Date();
  const delta = unit === "days" ? amount * 24 * 60 * 60 * 1000 : amount * 60 * 60 * 1000;
  return new Date(date.getTime() - delta).toISOString();
};

const futureIso = (amount: number, unit: "days" | "hours"): string => {
  const date = new Date();
  const delta = unit === "days" ? amount * 24 * 60 * 60 * 1000 : amount * 60 * 60 * 1000;
  return new Date(date.getTime() + delta).toISOString();
};

const runBaseSqlSeed = (dbUrl: string): void => {
  execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", BASE_SEED_PATH], {
    stdio: "inherit"
  });
};

const main = async () => {
  const env = resolveLocalEnv();
  runBaseSqlSeed(env.dbUrl);

  const supabase = createClient(env.apiUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: usersPage, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200
  });
  if (listError) {
    throw listError;
  }

  const existingUsers = usersPage.users.filter((user) => DEMO_USERS.some((demoUser) => demoUser.email === user.email));
  for (const user of existingUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      throw error;
    }
  }

  const createdUsers = new Map<DemoUserKey, { id: string; email: string }>();
  for (const demoUser of DEMO_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: demoUser.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: demoUser.name
      }
    });
    if (error || !data.user) {
      throw error ?? new Error(`failed_to_create_${demoUser.key}_user`);
    }

    createdUsers.set(demoUser.key, {
      id: data.user.id,
      email: demoUser.email
    });
  }

  const profileRows = DEMO_USERS.map((demoUser) => ({
    user_id: createdUsers.get(demoUser.key)?.id,
    email: demoUser.email,
    stripe_customer_id: demoUser.stripeCustomerId
  }));
  const { error: profileError } = await supabase.from("profiles").upsert(profileRows);
  if (profileError) {
    throw profileError;
  }

  const subscriptionRows = DEMO_USERS.map((demoUser, index) => ({
    id: `50000000-0000-0000-0000-00000000000${index + 1}`,
    user_id: createdUsers.get(demoUser.key)?.id,
    plan_type: demoUser.planType,
    status: demoUser.status,
    current_period_end:
      demoUser.currentPeriodEndDays === null ? null : futureIso(demoUser.currentPeriodEndDays, "days"),
    stripe_customer_id: demoUser.stripeCustomerId,
    stripe_subscription_id: demoUser.stripeSubscriptionId,
    checkout_session_id: demoUser.checkoutSessionId,
    cancel_at_period_end: false
  }));
  const { error: subscriptionError } = await supabase.from("subscriptions").upsert(subscriptionRows);
  if (subscriptionError) {
    throw subscriptionError;
  }

  const preferenceRows = DEMO_USERS.map((demoUser) => ({
    user_id: createdUsers.get(demoUser.key)?.id,
    ...demoUser.preferences
  }));
  const { error: preferenceError } = await supabase.from("user_preferences").upsert(preferenceRows);
  if (preferenceError) {
    throw preferenceError;
  }

  const notificationRows = DEMO_USERS.map((demoUser) => ({
    user_id: createdUsers.get(demoUser.key)?.id,
    weekly_digest_enabled: true,
    deadline_alert_enabled: true,
    outcome_reminder_enabled: true
  }));
  const { error: notificationError } = await supabase
    .from("user_notification_preferences")
    .upsert(notificationRows);
  if (notificationError) {
    throw notificationError;
  }

  const decisionRows = DEMO_DECISIONS.map((decision) => ({
    id: decision.id,
    user_id: createdUsers.get(decision.user)?.id,
    judgment_card_id: decision.judgment_card_id,
    episode_id: decision.episode_id,
    decision_type: decision.decision_type,
    outcome: decision.outcome,
    created_at: shiftIso(decision.createdAtDaysAgo, "days"),
    updated_at: shiftIso(decision.updatedAtDaysAgo, "days")
  }));
  const { error: decisionError } = await supabase.from("user_decisions").insert(decisionRows);
  if (decisionError) {
    throw decisionError;
  }

  const watchlistRows = DEMO_WATCHLIST.map((item) => ({
    id: item.id,
    user_id: createdUsers.get(item.user)?.id,
    judgment_card_id: item.judgment_card_id,
    episode_id: item.episode_id,
    status: item.status,
    created_at: shiftIso(item.createdAtHoursAgo, "hours"),
    updated_at: shiftIso(item.updatedAtHoursAgo, "hours")
  }));
  const { error: watchlistError } = await supabase.from("user_watchlist_items").insert(watchlistRows);
  if (watchlistError) {
    throw watchlistError;
  }

  console.log("Demo users seeded:");
  for (const demoUser of DEMO_USERS) {
    const created = createdUsers.get(demoUser.key);
    console.log(`- ${demoUser.key}: ${demoUser.email} (${created?.id ?? "missing"})`);
  }
};

await main();
