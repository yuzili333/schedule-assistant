import { describe, expect, it } from "vitest";
import { RequestRouter } from "./router";
import { InMemoryToolRegistry } from "./registries";
import { toolDefinitions } from "../data/mock";
import { normalizeRequest } from "./normalizer";

describe("RequestRouter", () => {
  const router = new RequestRouter({
    toolRegistry: new InMemoryToolRegistry(toolDefinitions),
  });

  it("routes calendar create requests to create tool", () => {
    const decision = router.route({
      id: "r1",
      text: "创建日程\n主题：项目例会\n开始日期：2026-03-26 14:00\n结束日期：2026-03-26 15:00",
    });

    expect(decision.route).toBe("tool");
    expect(decision.target).toBe("create_calendar_event");
  });

  it("routes calendar queries to query tool", () => {
    const decision = router.route({
      id: "r2",
      text: "查询日程\n开始日期：2026-03-26 00:00\n结束日期：2026-03-26 23:59",
    });

    expect(decision.route).toBe("tool");
    expect(decision.target).toBe("get_calendar_events");
  });

  it("extracts event creation fields and selected attendee ids", () => {
    const normalized = normalizeRequest({
      id: "r3",
      text: "创建日程\n主题：版本复盘\n开始日期：2026-03-27 10:00\n结束日期：2026-03-27 11:30\n会议室：6F Maple\n提醒渠道：app、sms\n已选参会人：张三\n参会人ID：EMP-1001",
    });

    expect(normalized.entities.eventTitle).toBe("版本复盘");
    expect(normalized.entities.startDate).toBe("2026-03-27 10:00");
    expect(normalized.entities.endDate).toBe("2026-03-27 11:30");
    expect(normalized.entities.meetingRoom).toBe("6F Maple");
    expect(normalized.entities.reminderChannels).toEqual(["app", "sms"]);
    expect(normalized.entities.selectedPersonNames).toEqual(["张三"]);
    expect(normalized.entities.selectedPersonIds).toEqual(["EMP-1001"]);
  });

  it("supports registry enable and tag lookup", () => {
    const registry = new InMemoryToolRegistry(toolDefinitions);

    expect(registry.findByTag("create")).toHaveLength(1);
    registry.setEnabled("create_calendar_event", false);
    expect(registry.list().some((tool) => tool.toolName === "create_calendar_event")).toBe(false);
  });
});
