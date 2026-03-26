import { describe, expect, it } from "vitest";
import { RequestRouter } from "./router";
import { InMemorySkillRegistry, InMemoryToolRegistry } from "./registries";
import { skillDefinitions, toolDefinitions } from "../data/mock";
import { normalizeRequest } from "./normalizer";

describe("RequestRouter", () => {
  const router = new RequestRouter({
    skillRegistry: new InMemorySkillRegistry(skillDefinitions),
    toolRegistry: new InMemoryToolRegistry(toolDefinitions),
  });

  it("routes calendar actions to tool when time is provided", () => {
    const decision = router.route({
      id: "test-1",
      text: "明天下午帮我安排一个会议",
    });

    expect(decision.route).toBe("tool");
    expect(decision.target).toBe("create_calendar_event");
  });

  it("falls back to llm for ambiguous analysis requests", () => {
    const decision = router.route({
      id: "test-2",
      text: "为什么我这周总是没有完整专注时间，帮我分析一下",
    });

    expect(["skill", "llm"]).toContain(decision.route);
  });

  it("extracts richer entities for people, room, priority, numbers and date range", () => {
    const normalized = normalizeRequest({
      id: "test-3",
      text: "请在下周一到下周三于 6F Maple 会议室邀请产品经理和张三开 2 小时 P1 评审会",
    });

    expect(normalized.entities.meetingRoom).toBe("6F Maple");
    expect(normalized.entities.location).toBe("6F Maple");
    expect(normalized.entities.priority).toBe("P1");
    expect(normalized.entities.personNames).toEqual(
      expect.arrayContaining(["产品经理", "张三"]),
    );
    expect(normalized.entities.numericParams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 6 }),
        expect.objectContaining({ value: 2, unit: "小时" }),
      ]),
    );
    expect(normalized.entities.dateRange).toEqual(
      expect.objectContaining({
        start: "下周一",
        end: "下周三",
      }),
    );
  });

  it("blocks bulk write tools in prod", () => {
    const decision = router.route(
      {
        id: "test-4",
        text: "请帮我批量调整从今天到下周的 12 个会议到 6F Maple 会议室",
      },
      { environment: "prod" },
    );

    expect(decision.risk.effectType).toBe("bulk_write");
    expect(decision.route).toBe("block");
    expect(decision.risk.policyDecision).toBe("block");
  });

  it("supports registry center enable and tag lookup", () => {
    const registry = new InMemoryToolRegistry(toolDefinitions);

    expect(registry.findByTag("bulk")).toHaveLength(1);

    registry.setEnabled("bulk_reschedule_events", false);

    expect(registry.getByName("bulk_reschedule_events")).toBeDefined();
    expect(registry.list().some((tool) => tool.toolName === "bulk_reschedule_events")).toBe(false);
  });
});
