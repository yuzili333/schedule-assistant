import { describe, expect, it } from "vitest";
import { InMemoryToolRegistry, RequestRouter, InMemorySkillRegistry } from "../router";
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

const router = new RequestRouter({
  skillRegistry: new InMemorySkillRegistry(skillDefinitions),
  toolRegistry: new InMemoryToolRegistry(toolDefinitions),
});

describe("ToolExecutor", () => {
  const mcpClient = new DefaultMcpClient(
    new InMemoryMcpServerRegistry(createDefaultMcpServers()),
  );

  it("dispatches tool execution through executor registry", async () => {
    const toolRegistry = new InMemoryToolRegistry(toolDefinitions);
    const executorRegistry = createDefaultToolExecutorRegistry();
    const decision = router.route({
      id: "tool-1",
      text: "今天有哪些会议",
    });

    const result = await dispatchToolExecution({
      decision: {
        ...decision,
        route: "tool",
        target: "get_calendar_events",
      },
      messages: [],
      toolRegistry,
      executorRegistry,
      mcpClient,
    });

    expect(result.status).toBe("completed");
    expect(result.content).toContain("今天已识别到以下日程");
  });

  it("returns unsupported when tool executor is missing", async () => {
    const toolRegistry = new InMemoryToolRegistry(toolDefinitions);
    const executorRegistry = new InMemoryToolExecutorRegistry();

    const decision = router.route({
      id: "tool-2",
      text: "明天下午帮我安排一个会议",
    });

    const result = await dispatchToolExecution({
      decision,
      messages: [],
      toolRegistry,
      executorRegistry,
      mcpClient,
    });

    expect(result.status).toBe("unsupported");
  });

  it("blocks execution when policy decision is block", async () => {
    const toolRegistry = new InMemoryToolRegistry(toolDefinitions);
    const executorRegistry = createDefaultToolExecutorRegistry();

    const decision = router.route(
      {
        id: "tool-3",
        text: "请帮我批量调整从今天到下周的 12 个会议到 6F Maple 会议室",
      },
      { environment: "prod" },
    );

    const result = await dispatchToolExecution({
      decision,
      messages: [],
      toolRegistry,
      executorRegistry,
      mcpClient,
    });

    expect(result.status).toBe("blocked");
    expect(result.content).toContain("当前策略已阻断自动执行");
  });
});
