import { afterEach, describe, expect, it } from "vitest";
import {
  createDefaultMcpServers,
  DefaultMcpClient,
  InMemoryMcpServerRegistry,
} from "../mcp";
import { cacheCalendarSubmission } from "./storage";
import { runScheduleSkill } from "./skill-runtime";

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

describe("SkillRuntime", () => {
  it("prefers valid cache over todo attendees and cc recommendations when user did not provide them", async () => {
    installLocalStorageMock();
    cacheCalendarSubmission({
      attendeeNames: ["缓存参会人"],
      attendeeIds: ["EMP-CACHE-1"],
      ccNames: ["缓存抄送人"],
      ccIds: ["EMP-CACHE-2"],
      now: new Date("2026-03-27T09:00:00.000Z").getTime(),
    });

    const mcpClient = new DefaultMcpClient(
      new InMemoryMcpServerRegistry(createDefaultMcpServers()),
    );

    const result = await runScheduleSkill({
      skillId: "recommend_create_calendar_prefill",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "请帮我新增日程，先推荐一下",
        },
      ],
      mcpClient,
    });

    expect(result.metadata?.draft?.selectedAttendeeNames).toEqual(["缓存参会人"]);
    expect(result.metadata?.draft?.selectedCcNames).toEqual(["缓存抄送人"]);
    expect(result.metadata?.recommendation?.recommendedFields.some(
      (field) => field.fieldLabel === "参会人" && field.source === "cache",
    )).toBe(true);
    expect(result.metadata?.recommendation?.recommendedFields.some(
      (field) => field.fieldLabel === "抄送人" && field.source === "cache",
    )).toBe(true);
  });
});
