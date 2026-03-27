import { afterEach, describe, expect, it } from "vitest";
import {
  cacheCalendarSubmission,
  getLatestValidCalendarSubmission,
  loadValidCalendarSubmissionCache,
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
