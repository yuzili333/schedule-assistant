import { describe, expect, it } from "vitest";
import {
  createDefaultMcpServers,
  DefaultMcpClient,
  InMemoryMcpServerRegistry,
} from ".";

describe("MCP server registry and client", () => {
  it("supports register, discovery, invoke and uninstall", async () => {
    const registry = new InMemoryMcpServerRegistry();
    const client = new DefaultMcpClient(registry);
    const [calendarServer] = createDefaultMcpServers();

    client.registerServer(calendarServer, { priority: 10 });

    expect(client.listServers()).toHaveLength(1);
    expect(client.discoverServers({ capability: "calendar.read" })).toHaveLength(1);
    expect(client.discoverServers({ toolName: "list_events" })).toHaveLength(1);

    const result = await client.callTool({
      serverId: "calendar",
      toolName: "list_events",
    });

    expect(result.content).toContain("需求评审会");
    expect(client.uninstallServer("calendar")).toBe(true);
    expect(client.listServers()).toHaveLength(0);
  });

  it("supports organization people discovery", async () => {
    const client = new DefaultMcpClient(
      new InMemoryMcpServerRegistry(createDefaultMcpServers()),
    );

    expect(client.discoverServers({ capability: "organization.people.read" })).toHaveLength(1);

    const result = await client.callTool({
      serverId: "organization",
      toolName: "search_people",
      args: { keyword: "张三" },
    });

    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as unknown[])).toHaveLength(2);
  });
});
