import { mockEvents, mockPeople } from "../data/mock";
import { McpServer } from "./types";

export const calendarMcpServer: McpServer = {
  serverId: "calendar",
  name: "Calendar MCP Server",
  description: "负责日程查询和创建草案。",
  version: "0.1.0",
  capabilities: ["calendar.read", "calendar.write"],
  tools: [
    {
      name: "list_events",
      description: "列出当前日历事件",
    },
    {
      name: "create_event_draft",
      description: "创建会议草案",
    },
  ],
  invoke(toolName, args) {
    if (toolName === "list_events") {
      const title = String(args?.title ?? "").trim();
      const startDate = String(args?.startDate ?? "").trim();
      const endDate = String(args?.endDate ?? "").trim();
      const events = mockEvents.filter((event) => {
        const matchedTitle = !title || event.title.includes(title);
        const matchedStart = !startDate || event.startDate >= startDate;
        const matchedEnd = !endDate || event.endDate <= endDate;
        return matchedTitle && matchedStart && matchedEnd;
      });

      return {
        content: events
          .map((event) => {
            const attendees = event.attendees.map((item) => item.name).join("、");
            return `- ${event.startDate} ~ ${event.endDate} ${event.title}，会议室 ${event.meetingRoom ?? "未填写"}，参会人 ${attendees}`;
          })
          .join("\n"),
        data: events,
      };
    }

    if (toolName === "create_event_draft") {
      return {
        content: `已生成日程草案：\n- 主题：${String(args?.title ?? "待确认")}\n- 开始日期：${String(
          args?.startDate ?? "待确认",
        )}\n- 结束日期：${String(args?.endDate ?? "待确认")}\n- 是否全天：${String(
          args?.allDay ? "是" : "否",
        )}\n- 会议室：${String(args?.meetingRoom ?? "未填写")}\n- 描述：${String(
          args?.description ?? "未填写",
        )}\n- 附件：${String(args?.attachments ?? "未填写")}\n- 提醒渠道：${String(
          args?.reminderChannels ?? "未填写",
        )}\n- 紧急状态：${String(args?.urgent ? "是" : "否")}\n- 参会人：${String(
          args?.recipients ?? "未选择",
        )}\n- 状态：待人工确认后写入日程服务`,
        data: {
          status: "draft",
          ...args,
        },
      };
    }

    throw new Error(`calendar server 不支持工具 ${toolName}`);
  },
};

export const organizationMcpServer: McpServer = {
  serverId: "organization",
  name: "Organization MCP Server",
  description: "负责机构人员搜索与候选人查询。",
  version: "0.1.0",
  capabilities: ["organization.people.read"],
  tools: [
    {
      name: "search_people",
      description: "按人名搜索候选人员",
    },
  ],
  invoke(toolName, args) {
    if (toolName === "search_people") {
      const keyword = String(args?.keyword ?? "").trim();
      const candidates = mockPeople.filter((person) => person.name.includes(keyword));
      return {
        content:
          candidates.length > 0
            ? `已为“${keyword}”找到 ${candidates.length} 位候选人员，请手动选择。`
            : `未找到与“${keyword}”匹配的机构人员。`,
        data: candidates,
      };
    }

    throw new Error(`organization server 不支持工具 ${toolName}`);
  },
};

export function createDefaultMcpServers(): McpServer[] {
  return [calendarMcpServer, organizationMcpServer];
}
