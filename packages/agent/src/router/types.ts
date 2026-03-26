export type RouteType = "direct" | "tool" | "llm" | "block";
export type RiskLevel = "low" | "medium" | "high";
export type ComplexityLevel = "low" | "medium" | "high";
export type ToolEffectType =
  | "read_only"
  | "reversible"
  | "irreversible_write"
  | "bulk_write"
  | "external_side_effect";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface UserRequest {
  id: string;
  text: string;
  userId?: string;
  sessionId?: string;
  locale?: string;
  history?: ChatMessage[];
  metadata?: Record<string, unknown>;
}

export interface NormalizedFlags {
  hasResourceId: boolean;
  hasExplicitAction: boolean;
  hasSideEffectVerb: boolean;
  hasQuestionForm: boolean;
  hasMultiIntent: boolean;
  hasTimeExpression: boolean;
  hasEmail: boolean;
  hasDateRange: boolean;
  hasPriority: boolean;
  hasLocation: boolean;
  hasMeetingRoom: boolean;
  hasPeople: boolean;
  hasNumericParams: boolean;
}

export interface NumericEntity {
  raw: string;
  value: number;
  unit?: string;
}

export interface DateRangeEntity {
  raw: string;
  start?: string;
  end?: string;
}

export interface ExtractedEntities {
  resourceId?: string;
  email?: string;
  emails: string[];
  timeText?: string;
  personNames: string[];
  selectedPersonIds: string[];
  selectedPersonNames: string[];
  numericParams: NumericEntity[];
  dateRange?: DateRangeEntity;
  priority?: "P0" | "P1" | "P2" | "high" | "medium" | "low" | "紧急";
  location?: string;
  meetingRoom?: string;
  eventTitle?: string;
  startDate?: string;
  endDate?: string;
  allDay?: boolean;
  description?: string;
  attachments: string[];
  reminderChannels: string[];
  urgent?: boolean;
}

export type EntityKey = keyof ExtractedEntities;

export interface NormalizedRequest {
  raw: UserRequest;
  normalizedText: string;
  tokens: string[];
  intents: string[];
  entities: ExtractedEntities;
  flags: NormalizedFlags;
}

export interface DirectRuleMatch {
  hit: boolean;
  target?: string;
  confidence: number;
  reasonCodes: string[];
  payload?: Record<string, unknown>;
}

export interface ToolExecutionPolicy {
  effectType: ToolEffectType;
  requiresConfirmation?: boolean;
  allowInProd?: boolean;
  reversible?: boolean;
}

export interface ToolDefinition {
  toolName: string;
  description: string;
  actionType: string;
  objectType: string;
  requiredParams: string[];
  optionalParams?: string[];
  sideEffect?: boolean;
  riskLevel?: RiskLevel;
  executionPolicy: ToolExecutionPolicy;
  latencyClass?: "fast" | "normal" | "slow";
  enabled?: boolean;
  aliases?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ToolMatchResult {
  score: number;
  matchedTool?: ToolDefinition;
  reasonCodes: string[];
  missingParams: string[];
}

export interface ComplexityAssessment {
  score: number; // 0 ~ 1
  level: ComplexityLevel;
  reasonCodes: string[];
}

export interface RiskAssessment {
  score: number; // 0 ~ 1
  level: RiskLevel;
  requiresBlock: boolean;
  requiresHumanConfirm: boolean;
  effectType: ToolEffectType;
  policyDecision: "allow" | "confirm" | "block";
  reasonCodes: string[];
}

export interface CostAssessment {
  estimatedLatencyMs: number;
  llmCostWeight: number; // 0 ~ 1
  reasonCodes: string[];
}

export interface RouteScores {
  direct: number;
  tool: number;
  llm: number;
}

export interface RouteDecision {
  route: RouteType;
  target?: string;
  confidence: number;
  scores: RouteScores;
  reasonCodes: string[];
  extractedParams: ExtractedEntities;
  missingParams: string[];
  complexity: ComplexityAssessment;
  risk: RiskAssessment;
  cost: CostAssessment;
  requiresLLM: boolean;
  metadata?: Record<string, unknown>;
}

export interface RouterContext {
  faqCache?: Map<string, string>;
  responseCache?: Map<string, unknown>;
  userPermissions?: string[];
  environment?: "dev" | "test" | "prod";
}

export interface RouterOptions {
  directThreshold: number;
  toolThreshold: number;
  llmThreshold: number;
  scoreCloseDelta: number;
  blockHighRiskIrreversible: boolean;
}

export interface RouteDependencies {
  toolRegistry: ToolRegistry;
  options?: Partial<RouterOptions>;
}

export interface RegistryRecord<TDefinition> {
  id: string;
  definition: TDefinition;
  enabled: boolean;
  priority: number;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface ToolRegistry {
  list(): ToolDefinition[];
  getByName(toolName: string): ToolDefinition | undefined;
  getRecord(toolName: string): RegistryRecord<ToolDefinition> | undefined;
  register(tool: ToolDefinition, options?: Partial<RegistryRecord<ToolDefinition>>): void;
  setEnabled(toolName: string, enabled: boolean): void;
  replaceAll(tools: ToolDefinition[]): void;
  findByTag(tag: string): ToolDefinition[];
}
