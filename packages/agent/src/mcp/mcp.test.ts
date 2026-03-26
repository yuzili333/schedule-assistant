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

    expect(result.content).toContain("产品周会");

    expect(client.uninstallServer("calendar")).toBe(true);
    expect(client.listServers()).toHaveLength(0);
  });

  it("supports multiple default servers and capability-based discovery", () => {
    const registry = new InMemoryMcpServerRegistry(createDefaultMcpServers());
    const client = new DefaultMcpClient(registry);

    expect(client.listServers()).toHaveLength(3);
    expect(client.discoverServers({ capability: "weather.read" })).toHaveLength(1);
    expect(client.discoverServers({ capability: "email.send" })).toHaveLength(1);
  });
});
