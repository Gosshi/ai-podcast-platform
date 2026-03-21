import { TwitterApi } from "twitter-api-v2";

type XCredentials = {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
};

const REQUIRED_ENV_KEYS = [
  "TWITTER_API_KEY",
  "TWITTER_API_SECRET",
  "TWITTER_ACCESS_TOKEN",
  "TWITTER_ACCESS_SECRET"
] as const;

const readEnv = (key: string): string => {
  return process.env[key]?.trim() ?? "";
};

export const resolveXAutoPostEnabled = (value = process.env.X_AUTO_POST_ENABLED): boolean => {
  return value?.trim().toLowerCase() === "true";
};

export const resolveXCredentials = (): {
  credentials: XCredentials | null;
  missingKeys: string[];
} => {
  const credentials = {
    appKey: readEnv("TWITTER_API_KEY"),
    appSecret: readEnv("TWITTER_API_SECRET"),
    accessToken: readEnv("TWITTER_ACCESS_TOKEN"),
    accessSecret: readEnv("TWITTER_ACCESS_SECRET")
  };

  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !readEnv(key));
  if (missingKeys.length > 0) {
    return {
      credentials: null,
      missingKeys
    };
  }

  return {
    credentials,
    missingKeys: []
  };
};

export const resolveXAutoPostStatus = () => {
  const enabled = resolveXAutoPostEnabled();
  const { credentials, missingKeys } = resolveXCredentials();

  return {
    enabled,
    configured: Boolean(credentials),
    missingKeys
  };
};

export const publishPostToX = async (text: string): Promise<{
  id: string;
  text: string;
}> => {
  const { credentials, missingKeys } = resolveXCredentials();
  if (!credentials) {
    throw new Error(`x_credentials_not_configured:${missingKeys.join(",")}`);
  }

  const client = new TwitterApi(credentials);
  const response = await client.v2.tweet(text);

  return {
    id: response.data.id,
    text: response.data.text
  };
};
