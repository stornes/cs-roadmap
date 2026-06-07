import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';
dotenv.config();

let slackClient: WebClient | null = null;

const getSlackClient = () => {
  if (slackClient) return slackClient;
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing SLACK_BOT_TOKEN in environment.");
  }
  slackClient = new WebClient(token);
  return slackClient;
};

export async function slackListChannels() {
  const slack = getSlackClient();
  const response = await slack.conversations.list({
    types: 'public_channel,private_channel',
    exclude_archived: true
  });

  const channels = response.channels || [];
  return channels.map((c: any) => ({
    id: c.id,
    name: c.name,
    is_private: c.is_private || false,
    topic: c.topic?.value || '',
    purpose: c.purpose?.value || ''
  }));
}

export async function slackGetChannelHistory(channelId: string, limitCount = 30) {
  const slack = getSlackClient();
  const response = await slack.conversations.history({
    channel: channelId,
    limit: limitCount
  });

  const messages = response.messages || [];
  if (messages.length === 0) {
    return `No recent messages found in Slack channel "${channelId}".`;
  }

  // Fetch users info in parallel if possible, or display user ID
  // To keep it fast, we can list the messages and resolve timestamps
  let output = `### Slack Channel History: ${channelId}\n\n`;
  output += `Recent ${messages.length} messages:\n\n`;

  // Reverse list to show chronological order (oldest first)
  const chronological = [...messages].reverse();

  chronological.forEach((msg: any) => {
    const ts = msg.ts ? new Date(parseFloat(msg.ts) * 1000).toLocaleString() : 'N/A';
    const user = msg.user || 'System/Bot';
    const text = msg.text || '';
    output += `[${ts}] **@${user}**: ${text}\n`;
  });

  return output;
}

export async function slackSendMessage(channelId: string, text: string) {
  const slack = getSlackClient();
  const response = await slack.chat.postMessage({
    channel: channelId,
    text
  });

  return {
    success: true,
    channel: response.channel,
    ts: response.ts
  };
}
