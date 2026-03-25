import { InMemorySkillRegistry, InMemoryToolRegistry } from "./registries";
import { RequestRouter } from "./router";
import { SkillDefinition, ToolDefinition, UserRequest } from "./types";

const skills: SkillDefinition[] = [
  {
    skillId: "weekly_report",
    name: "weekly report",
    aliases: ["周报", "生成周报", "写周报", "本周工作总结"],
    description: "根据本周工作内容生成结构化周报",
    supportedIntents: ["workflow", "generation"],
    requiredEntities: [],
    optionalEntities: ["timeText"],
    sideEffect: false,
    complexityBand: "medium",
  },
  {
    skillId: "meeting_to_actions",
    name: "meeting to actions",
    aliases: ["会议纪要转待办", "提取 action items", "会议行动项"],
    description: "从会议纪要中提取行动项、负责人和截止时间",
    supportedIntents: ["workflow", "generation"],
    requiredEntities: [],
    optionalEntities: ["timeText"],
    sideEffect: false,
    complexityBand: "medium",
  },
  {
    skillId: "kb_qa_with_citation",
    name: "knowledge qa",
    aliases: ["知识库问答", "根据知识库回答", "带引用回答"],
    description: "从知识库检索、重排并输出带引用答案",
    supportedIntents: ["query", "workflow"],
    requiredEntities: [],
    sideEffect: false,
    complexityBand: "medium",
  },
];

const tools: ToolDefinition[] = [
  {
    toolName: "get_ticket",
    description: "查询工单详情或状态",
    actionType: "query",
    objectType: "ticket",
    requiredParams: ["resourceId"],
    optionalParams: [],
    executionPolicy: {
      effectType: "read_only",
      allowInProd: true,
    },
    latencyClass: "fast",
    aliases: ["工单", "ticket", "status", "查工单", "查询工单"],
  },
  {
    toolName: "create_calendar_event",
    description: "创建日历事件",
    actionType: "create",
    objectType: "calendar_event",
    requiredParams: ["timeText"],
    optionalParams: ["email"],
    executionPolicy: {
      effectType: "reversible",
      requiresConfirmation: true,
      reversible: true,
      allowInProd: true,
    },
    latencyClass: "normal",
    aliases: ["创建会议", "安排会议", "schedule meeting", "calendar"],
  },
  {
    toolName: "send_email",
    description: "发送邮件",
    actionType: "send",
    objectType: "email",
    requiredParams: ["email"],
    optionalParams: ["timeText"],
    executionPolicy: {
      effectType: "external_side_effect",
      requiresConfirmation: true,
      allowInProd: true,
    },
    latencyClass: "normal",
    aliases: ["发邮件", "发送邮件", "email", "send mail"],
  },
  {
    toolName: "get_weather",
    description: "查询天气",
    actionType: "query",
    objectType: "weather",
    requiredParams: [],
    optionalParams: ["timeText"],
    executionPolicy: {
      effectType: "read_only",
      allowInProd: true,
    },
    latencyClass: "fast",
    aliases: ["天气", "weather"],
  },
];

export const skillRegistry = new InMemorySkillRegistry(skills);
export const toolRegistry = new InMemoryToolRegistry(tools);

export const router = new RequestRouter({
  skillRegistry,
  toolRegistry,
  options: {
    directThreshold: 0.78,
    toolThreshold: 0.7,
    skillThreshold: 0.66,
  },
});

const requests: UserRequest[] = [
  {
    id: "r1",
    text: "帮我查询工单 INC-1024 的当前状态",
  },
  {
    id: "r2",
    text: "请根据这周工作内容帮我生成一份周报",
  },
  {
    id: "r3",
    text: "明天下午帮我安排一个会议",
  },
  {
    id: "r4",
    text: "为什么这周客户投诉突然变多了，帮我分析下",
    history: [
      { role: "user", content: "上周投诉不多" },
      { role: "assistant", content: "了解" },
    ],
  },
  {
    id: "r5",
    text: "发邮件给 alice@example.com 告知会议改到明天下午",
  },
];

for (const req of requests) {
  const decision = router.route(req, {
    environment: "prod",
    faqCache: new Map([["公司请假流程是什么", "请登录 OA 查看请假制度"]]),
  });

  console.log(`\n[${req.id}] ${req.text}`);
  console.log(JSON.stringify(decision, null, 2));
}
