import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  cacheCalendarSubmission,
  getLatestValidCalendarSubmission,
  loadValidCalendarSubmissionCache,
  loadModelSettings,
} from "./storage";

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
    },
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: undefined,
  });
  delete process.env.AGENT_SERVICE_ENV_FILE;
  delete process.env.PUBLIC_MODEL_ENABLED;
  delete process.env.PUBLIC_MODEL_ACTIVE;
  delete process.env.PUBLIC_MODEL_REGISTRY_JSON;
  delete process.env.PUBLIC_MODEL_SYSTEM_PROMPT;
});

describe("calendar submission cache", () => {
  it("stores valid calendar submission cache entries", () => {
    installLocalStorageMock();
    const now = new Date("2026-03-27T09:00:00.000Z").getTime();

    cacheCalendarSubmission({
      attendeeNames: ["张三"],
      attendeeIds: ["EMP-1001"],
      ccNames: ["王五"],
      ccIds: ["EMP-1004"],
      now,
    });

    const latest = getLatestValidCalendarSubmission(now);
    expect(latest?.attendeeNames).toEqual(["张三"]);
    expect(latest?.ccNames).toEqual(["王五"]);
  });

  it("filters out expired cache entries after 7 days", () => {
    installLocalStorageMock();
    const now = new Date("2026-03-27T09:00:00.000Z").getTime();

    cacheCalendarSubmission({
      attendeeNames: ["张三"],
      attendeeIds: ["EMP-1001"],
      now: now - 8 * 24 * 60 * 60 * 1000,
    });

    expect(loadValidCalendarSubmissionCache(now)).toHaveLength(0);
  });
});

describe("model settings env resolution", () => {
  it("falls back to local agent-service env file when process env is missing", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "schedule-agent-env-"));
    const envFilePath = path.join(tempDir, ".env.local");
    fs.writeFileSync(
      envFilePath,
      [
        "PUBLIC_MODEL_ENABLED=true",
        "PUBLIC_MODEL_ACTIVE=QWEN",
        'PUBLIC_MODEL_REGISTRY_JSON={"QWEN":{"provider":"QWEN","label":"Qwen/Qwen3-32B","baseUrl":"https://example.com/v1/chat/completions","apiKey":"test-key","model":"Qwen/Qwen3-32B"}}',
        "PUBLIC_MODEL_SYSTEM_PROMPT=测试系统提示词",
      ].join("\n"),
      "utf8",
    );

    process.env.AGENT_SERVICE_ENV_FILE = envFilePath;

    const settings = loadModelSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.provider).toBe("QWEN");
    expect(settings.model).toBe("Qwen/Qwen3-32B");
    expect(settings.baseUrl).toBe("https://example.com/v1/chat/completions");
    expect(settings.systemPrompt).toBe("测试系统提示词");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
