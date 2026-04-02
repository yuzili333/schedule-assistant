import express, { Express, Request, Response } from "express";
import {
  AgentServiceRequest,
  AgentServiceResponse,
  AgentServiceStreamEvent,
  runScheduleAgent,
} from "./core/index.js";
import { loadAgentServiceConfig } from "./config.js";
import { recordAuditEvent } from "./audit.js";
import { checkRateLimit } from "./rate-limit.js";
import { resolveGrayVariant } from "./gray-release.js";
import { resolveModelSettingsForRequest } from "./context.js";

function buildRequestId(): string {
  return `req-${crypto.randomUUID()}`;
}

function getClientKey(req: Request, body: AgentServiceRequest): string {
  return [
    body.userId ?? "",
    body.sessionId ?? "",
    req.ip ?? "",
  ].filter(Boolean).join(":") || "anonymous";
}

function writeSse(res: Response, event: AgentServiceStreamEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function validateBody(body: unknown): body is AgentServiceRequest {
  if (!body || typeof body !== "object") {
    return false;
  }

  const value = body as Partial<AgentServiceRequest>;
  return Array.isArray(value.messages);
}

export function createAgentServiceApp(): Express {
  const config = loadAgentServiceConfig();
  const app = express();
  const apiRouter = express.Router();

  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", process.env.AGENT_SERVICE_CORS_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    next();
  });
  app.use(express.json({ limit: "1mb" }));

  apiRouter.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "agent-service",
    });
  });

  apiRouter.post("/chat", async (req, res) => {
    if (!validateBody(req.body)) {
      res.status(400).json({ message: "请求体格式无效。" });
      return;
    }

    const requestId = buildRequestId();
    const rateLimit = checkRateLimit({
      key: getClientKey(req, req.body),
      now: Date.now(),
      windowMs: config.rateLimitWindowMs,
      maxRequests: config.rateLimitMaxRequests,
    });

    if (!rateLimit.allowed) {
      recordAuditEvent({
        id: crypto.randomUUID(),
        requestId,
        userId: req.body.userId,
        sessionId: req.body.sessionId,
        status: "rate_limited",
        timestamp: new Date().toISOString(),
      });
      res.status(429).json({ message: "请求过于频繁，请稍后再试。", requestId });
      return;
    }

    try {
      recordAuditEvent({
        id: crypto.randomUUID(),
        requestId,
        userId: req.body.userId,
        sessionId: req.body.sessionId,
        status: "started",
        timestamp: new Date().toISOString(),
        metadata: {
          grayVariant: resolveGrayVariant(getClientKey(req, req.body), config.grayReleaseRatio),
        },
      });

      const result = await runScheduleAgent(
        req.body.messages,
        resolveModelSettingsForRequest(),
      );

      const payload: AgentServiceResponse = {
        ...result,
        requestId,
      };

      recordAuditEvent({
        id: crypto.randomUUID(),
        requestId,
        userId: req.body.userId,
        sessionId: req.body.sessionId,
        route: result.decision.route,
        target: result.decision.target,
        latencyMs: result.latencyMs,
        status: "completed",
        timestamp: new Date().toISOString(),
      });

      res.json(payload);
    } catch (error) {
      recordAuditEvent({
        id: crypto.randomUUID(),
        requestId,
        userId: req.body.userId,
        sessionId: req.body.sessionId,
        status: "errored",
        timestamp: new Date().toISOString(),
        metadata: {
          message: error instanceof Error ? error.message : "unknown_error",
        },
      });
      res.status(500).json({
        message: error instanceof Error ? error.message : "Agent service 内部错误。",
        requestId,
      });
    }
  });

  apiRouter.post("/chat/stream", async (req, res) => {
    if (!validateBody(req.body)) {
      res.status(400).json({ message: "请求体格式无效。" });
      return;
    }

    const requestId = buildRequestId();
    const rateLimit = checkRateLimit({
      key: getClientKey(req, req.body),
      now: Date.now(),
      windowMs: config.rateLimitWindowMs,
      maxRequests: config.rateLimitMaxRequests,
    });

    if (!rateLimit.allowed) {
      res.status(429).json({ message: "请求过于频繁，请稍后再试。", requestId });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      recordAuditEvent({
        id: crypto.randomUUID(),
        requestId,
        userId: req.body.userId,
        sessionId: req.body.sessionId,
        status: "started",
        timestamp: new Date().toISOString(),
        metadata: {
          mode: "stream",
          grayVariant: resolveGrayVariant(getClientKey(req, req.body), config.grayReleaseRatio),
        },
      });

      const result = await runScheduleAgent(
        req.body.messages,
        resolveModelSettingsForRequest(),
        (chunk: string) => {
          writeSse(res, {
            type: "chunk",
            chunk,
          });
        },
      );

      const payload: AgentServiceResponse = {
        ...result,
        requestId,
      };
      writeSse(res, {
        type: "meta",
        payload,
      });
      writeSse(res, {
        type: "done",
        requestId,
      });

      recordAuditEvent({
        id: crypto.randomUUID(),
        requestId,
        userId: req.body.userId,
        sessionId: req.body.sessionId,
        route: result.decision.route,
        target: result.decision.target,
        latencyMs: result.latencyMs,
        status: "completed",
        timestamp: new Date().toISOString(),
      });
      res.end();
    } catch (error) {
      writeSse(res, {
        type: "error",
        message: error instanceof Error ? error.message : "Agent service 内部错误。",
        requestId,
      });
      recordAuditEvent({
        id: crypto.randomUUID(),
        requestId,
        userId: req.body.userId,
        sessionId: req.body.sessionId,
        status: "errored",
        timestamp: new Date().toISOString(),
        metadata: {
          message: error instanceof Error ? error.message : "unknown_error",
        },
      });
      res.end();
    }
  });

  app.use(apiRouter);
  if (config.apiPrefix !== "/") {
    app.use(config.apiPrefix, apiRouter);
  }

  return app;
}
