import { describe, expect, it } from "vitest";
import { InMemoryToolRegistry, RequestRouter } from "../router";
import { toolDefinitions } from "../data/mock";
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
  toolRegistry: new InMemoryToolRegistry(toolDefinitions),
});

describe("ToolExecutor", () => {
  const mcpClient = new DefaultMcpClient(
    new InMemoryMcpServerRegistry(createDefaultMcpServers()),
  );

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
});
