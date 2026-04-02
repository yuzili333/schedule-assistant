export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpInvocationRequest {
  serverId: string;
  toolName: string;
  args?: Record<string, unknown>;
}

export interface McpInvocationResult {
  content: string;
  data?: Record<string, unknown> | unknown[];
}

export interface McpServerDefinition {
  serverId: string;
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  tools: McpToolDefinition[];
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface McpServer extends McpServerDefinition {
  invoke(
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<McpInvocationResult> | McpInvocationResult;
}

export interface McpServerRecord {
  id: string;
  server: McpServer;
  enabled: boolean;
  priority: number;
  metadata?: Record<string, unknown>;
}

export interface McpDiscoveryQuery {
  capability?: string;
  toolName?: string;
}

export interface McpServerRegistry {
  list(): McpServer[];
  get(serverId: string): McpServer | undefined;
  getRecord(serverId: string): McpServerRecord | undefined;
  register(server: McpServer, options?: Partial<McpServerRecord>): void;
  unregister(serverId: string): boolean;
  setEnabled(serverId: string, enabled: boolean): void;
  discover(query?: McpDiscoveryQuery): McpServer[];
}

export interface McpClient {
  listServers(): McpServer[];
  discoverServers(query?: McpDiscoveryQuery): McpServer[];
  registerServer(server: McpServer, options?: Partial<McpServerRecord>): void;
  uninstallServer(serverId: string): boolean;
  callTool(request: McpInvocationRequest): Promise<McpInvocationResult>;
}
