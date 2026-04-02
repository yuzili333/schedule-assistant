import {
  McpClient,
  McpDiscoveryQuery,
  McpInvocationRequest,
  McpInvocationResult,
  McpServer,
  McpServerRecord,
  McpServerRegistry,
} from "./types";

export class DefaultMcpClient implements McpClient {
  constructor(private readonly registry: McpServerRegistry) {}

  listServers(): McpServer[] {
    return this.registry.list();
  }

  discoverServers(query?: McpDiscoveryQuery): McpServer[] {
    return this.registry.discover(query);
  }

  registerServer(server: McpServer, options?: Partial<McpServerRecord>): void {
    this.registry.register(server, options);
  }

  uninstallServer(serverId: string): boolean {
    return this.registry.unregister(serverId);
  }

  async callTool(request: McpInvocationRequest): Promise<McpInvocationResult> {
    const server = this.registry.get(request.serverId);
    if (!server) {
      throw new Error(`MCP server ${request.serverId} 未注册或已卸载。`);
    }

    const tool = server.tools.find((item) => item.name === request.toolName);
    if (!tool) {
      throw new Error(
        `MCP server ${request.serverId} 不支持工具 ${request.toolName}。`,
      );
    }

    return server.invoke(request.toolName, request.args);
  }
}
