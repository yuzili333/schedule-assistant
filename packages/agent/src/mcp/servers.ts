import { mockEvents } from "../data/mock";
import { McpServer } from "./types";

export const calendarMcpServer: McpServer = {
  serverId: "calendar",
  name: "Calendar MCP Server",
  description: "负责日程查询、会议草案生成和批量改期预览。",
  version: "0.1.0",
  capabilities: ["calendar.read", "calendar.write", "calendar.bulk"],
  tools: [
    {
      name: "list_events",
      description: "列出当前日历事件",
    },
    {
      name: "create_event_draft",
      description: "创建会议草案",
    },
    {
      name: "bulk_reschedule_preview",
      description: "生成批量改期预览",
    },
  ],
  invoke(toolName, args) {
    if (toolName === "list_events") {
      return {
        content: mockEvents
          .map((event) => {
            const attendees = event.attendees.join("、");
            return `- ${event.start}-${event.end} ${event.title}，地点 ${event.location}，参会人 ${attendees}`;
          })
          .join("\n"),
        data: mockEvents,
      };
    }

    if (toolName === "create_event_draft") {
      return {
        content: `已生成会议草案：\n- 标题：项目同步会\n- 时间：${String(args?.timeText ?? "待确认")}\n- 参会人：${String(
          args?.recipients ?? "待补充",
        )}\n- 地点：${String(args?.location ?? "待补充")}\n- 状态：待人工确认后写入日历`,
        data: {
          status: "draft",
          ...args,
        },
      };
    }

    if (toolName === "bulk_reschedule_preview") {
      return {
        content: `检测到批量改期请求，范围 ${String(
          args?.dateRange ?? "待确认",
        )}，预计影响 ${String(args?.count ?? "多")} 个日程。该操作需要审批后才能执行。`,
        data: {
          status: "preview",
          ...args,
        },
      };
    }

    throw new Error(`calendar server 不支持工具 ${toolName}`);
  },
};

export const notificationMcpServer: McpServer = {
  serverId: "notification",
  name: "Notification MCP Server",
  description: "负责邮件提醒与摘要发送预览。",
  version: "0.1.0",
  capabilities: ["notification.send", "email.send"],
  tools: [
    {
      name: "preview_schedule_digest",
      description: "预览日程摘要发送",
    },
  ],
  invoke(toolName, args) {
    if (toolName === "preview_schedule_digest") {
      return {
        content: `这是外部副作用动作，当前策略要求人工确认。\n建议先预览摘要，再确认收件人 ${String(
          args?.recipients ?? "待补充",
        )}。`,
        data: {
          status: "preview",
          ...args,
        },
      };
    }

    throw new Error(`notification server 不支持工具 ${toolName}`);
  },
};

export const weatherMcpServer: McpServer = {
  serverId: "weather",
  name: "Weather MCP Server",
  description: "负责天气查询与出行建议。",
  version: "0.1.0",
  capabilities: ["weather.read", "travel.plan"],
  tools: [
    {
      name: "get_weather_brief",
      description: "获取天气摘要",
    },
  ],
  invoke(toolName, args) {
    if (toolName === "get_weather_brief") {
      const location = String(args?.location ?? "默认办公区");
      return {
        content: `${location} 明天下午有小雨，适合线上会议；若需要外出，建议预留 20 分钟机动时间。`,
        data: {
          location,
          condition: "light_rain",
        },
      };
    }

    throw new Error(`weather server 不支持工具 ${toolName}`);
  },
};

export function createDefaultMcpServers(): McpServer[] {
  return [calendarMcpServer, notificationMcpServer, weatherMcpServer];
}
