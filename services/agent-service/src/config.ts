export interface AgentServiceConfig {
  port: number;
  host: string;
  apiPrefix: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  grayReleaseRatio: number;
}

export function loadAgentServiceConfig(): AgentServiceConfig {
  return {
    port: Number(process.env.PORT ?? 8787),
    host: process.env.HOST?.trim() || "127.0.0.1",
    apiPrefix: process.env.AGENT_SERVICE_API_PREFIX?.trim() || "/api",
    rateLimitWindowMs: Number(process.env.AGENT_SERVICE_RATE_LIMIT_WINDOW_MS ?? 60_000),
    rateLimitMaxRequests: Number(process.env.AGENT_SERVICE_RATE_LIMIT_MAX_REQUESTS ?? 30),
    grayReleaseRatio: Number(process.env.AGENT_SERVICE_GRAY_RELEASE_RATIO ?? 1),
  };
}
