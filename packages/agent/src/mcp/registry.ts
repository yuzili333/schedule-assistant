import {
  McpDiscoveryQuery,
  McpServer,
  McpServerRecord,
  McpServerRegistry,
} from "./types";

export class InMemoryMcpServerRegistry implements McpServerRegistry {
  private readonly records = new Map<string, McpServerRecord>();

  constructor(servers: McpServer[] = []) {
    for (const server of servers) {
      this.register(server);
    }
  }

  list(): McpServer[] {
    return [...this.records.values()]
      .filter((record) => record.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map((record) => record.server);
  }

  get(serverId: string): McpServer | undefined {
    const record = this.records.get(serverId);
    return record?.enabled ? record.server : undefined;
  }

  getRecord(serverId: string): McpServerRecord | undefined {
    return this.records.get(serverId);
  }

  register(server: McpServer, options?: Partial<McpServerRecord>): void {
    this.records.set(server.serverId, {
      id: server.serverId,
      server,
      enabled: server.enabled !== false && options?.enabled !== false,
      priority: options?.priority ?? 0,
      metadata: options?.metadata ?? server.metadata,
    });
  }

  unregister(serverId: string): boolean {
    return this.records.delete(serverId);
  }

  setEnabled(serverId: string, enabled: boolean): void {
    const existing = this.records.get(serverId);
    if (!existing) {
      return;
    }

    this.records.set(serverId, {
      ...existing,
      enabled,
    });
  }

  discover(query?: McpDiscoveryQuery): McpServer[] {
    let servers = this.list();

    if (query?.capability) {
      servers = servers.filter((server) =>
        server.capabilities.includes(query.capability as string),
      );
    }

    if (query?.toolName) {
      servers = servers.filter((server) =>
        server.tools.some((tool) => tool.name === query.toolName),
      );
    }

    return servers;
  }
}
