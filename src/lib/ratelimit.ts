import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Only initialize if env vars are set (graceful degradation in dev)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

export const loginRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      analytics: false,
      prefix: "rl:login",
    })
  : null;

export const invitationRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 h"),
      analytics: false,
      prefix: "rl:invitation",
    })
  : null;
