import { afterEach, describe, expect, it } from "vitest";
import { InMemorySkillRegistry, InMemoryToolRegistry, RequestRouter } from "../router";
import { skillDefinitions, toolDefinitions } from "../data/mock";
import {
  createDefaultToolExecutorRegistry,
  dispatchToolExecution,
  InMemoryToolExecutorRegistry,
} from "./tool-executor";
import {
  createDefaultMcpServers,
  DefaultMcpClient,
  InMemoryMcpServerRegistry,
} from "../mcp";
import { cacheCalendarSubmission } from "./storage";

const router = new RequestRouter({
  skillRegistry: new InMemorySkillRegistry(skillDefinitions),
  toolRegistry: new InMemoryToolRegistry(toolDefinitions),
});

describe("ToolExecutor", () => {
  const mcpClient = new DefaultMcpClient(
    new InMemoryMcpServerRegistry(createDefaultMcpServers()),
  );

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
  });

  it("queries calendar events through mcp", async () => {
    const result = await dispatchToolExecution({
      decision: router.route({
        id: "tool-1",
        text: "查询日程\n开始日期：2026-03-26 00:00\n结束日期：2026-03-26 23:59",
      }),
      messages: [],
      toolRegistry: new InMemoryToolRegistry(toolDefinitions),
      executorRegistry: createDefaultToolExecutorRegistry(),
      mcpClient,
    });

    expect(result.status).toBe("completed");
    expect(result.content).toContain("需求评审会");
  });

  it("returns person candidates before creating event when attendee name is ambiguous", async () => {
    const result = await dispatchToolExecution({
      decision: router.route({
        id: "tool-2",
        text: "创建日程\n主题：项目例会\n开始日期：2026-03-26 14:00\n结束日期：2026-03-26 15:00\n参会人：张三",
      }),
      messages: [],
      toolRegistry: new InMemoryToolRegistry(toolDefinitions),
      executorRegistry: createDefaultToolExecutorRegistry(),
      mcpClient,
    });

    expect(result.status).toBe("preview");
    expect(result.metadata?.personCandidates).toHaveLength(2);
  });

  it("returns cc candidates before creating event when cc name is ambiguous", async () => {
    const result = await dispatchToolExecution({
      decision: router.route({
        id: "tool-2-cc",
        text: "创建日程\n主题：项目例会\n开始日期：2026-03-26 14:00\n结束日期：2026-03-26 15:00\n抄送人：张三",
      }),
      messages: [],
      toolRegistry: new InMemoryToolRegistry(toolDefinitions),
      executorRegistry: createDefaultToolExecutorRegistry(),
      mcpClient,
    });

    expect(result.status).toBe("preview");
    expect(result.metadata?.personCandidates?.every((item) => item.role === "cc")).toBe(true);
  });

  it("returns unsupported when executor is missing", async () => {
    const result = await dispatchToolExecution({
      decision: router.route({
        id: "tool-3",
        text: "查询日程",
      }),
      messages: [],
      toolRegistry: new InMemoryToolRegistry(toolDefinitions),
      executorRegistry: new InMemoryToolExecutorRegistry(),
      mcpClient,
    });

    expect(result.status).toBe("unsupported");
  });

  it("recommends cached attendees and cc recipients when create request omits them", async () => {
    installLocalStorageMock();
    cacheCalendarSubmission({
      attendeeNames: ["张三"],
      attendeeIds: ["EMP-1001"],
      ccNames: ["王五"],
      ccIds: ["EMP-1004"],
      now: new Date("2026-03-27T09:00:00.000Z").getTime(),
    });

    const result = await dispatchToolExecution({
      decision: router.route({
        id: "tool-cache-1",
        text: "创建日程\n主题：项目复盘\n开始日期：2026-03-28 10:00\n结束日期：2026-03-28 11:00",
      }),
      messages: [],
      toolRegistry: new InMemoryToolRegistry(toolDefinitions),
      executorRegistry: createDefaultToolExecutorRegistry(),
      mcpClient,
    });

    expect(result.status).toBe("preview");
    expect(result.metadata?.recommendation?.recommendedFields.some((item) => item.source === "cache")).toBe(true);
    expect(result.metadata?.draft?.selectedAttendeeNames).toEqual(["张三"]);
    expect(result.metadata?.draft?.selectedCcNames).toEqual(["王五"]);
  });
});
