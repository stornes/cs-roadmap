import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response } from 'express';
import cors from 'cors';

// Import Handlers
import { 
  jiraSearchIssues, 
  jiraGetIssue, 
  jiraGetProjectTimeline 
} from './handlers/jira.js';
import { 
  notionListDatabases, 
  notionQueryDatabase, 
  notionGetPage 
} from './handlers/notion.js';
import { 
  slackListChannels, 
  slackGetChannelHistory, 
  slackSendMessage 
} from './handlers/slack.js';

const server = new Server(
  {
    name: 'hurtigruten-connectors-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Available Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // 1. Jira Tools
      {
        name: 'jira_search_issues',
        description: 'Runs a JQL (Jira Query Language) query and returns matching issues, statuses, and priorities.',
        inputSchema: {
          type: 'object',
          properties: {
            jql: {
              type: 'string',
              description: 'The JQL query string (e.g. "project = SQSF AND status = \"In Progress\"")'
            }
          },
          required: ['jql']
        }
      },
      {
        name: 'jira_get_issue',
        description: 'Retrieves full details of a specific Jira issue (e.g. "SQSF-123").',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The Jira issue key (e.g. "SQSF-101")'
            }
          },
          required: ['issueKey']
        }
      },
      {
        name: 'jira_get_project_timeline',
        description: 'Compiles a text-based schedule timeline of active issues in a project that have start or due dates.',
        inputSchema: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              description: 'The Jira project short code (e.g. "SQSF")'
            }
          },
          required: ['projectKey']
        }
      },

      // 2. Notion Tools
      {
        name: 'notion_list_databases',
        description: 'Lists all Notion databases that have been shared with this integration token.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'notion_query_database',
        description: 'Queries a Notion database (e.g. My Account MVP database) and returns its rows formatted as a Markdown table.',
        inputSchema: {
          type: 'object',
          properties: {
            databaseId: {
              type: 'string',
              description: 'The Notion database ID (32-character string, with or without dashes)'
            }
          },
          required: ['databaseId']
        }
      },
      {
        name: 'notion_get_page',
        description: 'Fetches metadata and recursively reads block children of a Notion page, rendering the content as Markdown.',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'The Notion page ID (32-character string)'
            }
          },
          required: ['pageId']
        }
      },

      // 3. Slack Tools
      {
        name: 'slack_list_channels',
        description: 'Lists all available public and private Slack channels in the configured workspace.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'slack_get_channel_history',
        description: 'Fetches the recent message history of a Slack channel and returns a chronological conversation log.',
        inputSchema: {
          type: 'object',
          properties: {
            channelId: {
              type: 'string',
              description: 'The Slack channel ID (e.g. "C0123456789")'
            },
            limit: {
              type: 'integer',
              description: 'Optional number of messages to retrieve (defaults to 30)'
            }
          },
          required: ['channelId']
        }
      },
      {
        name: 'slack_send_message',
        description: 'Posts a chat message to a specific Slack channel.',
        inputSchema: {
          type: 'object',
          properties: {
            channelId: {
              type: 'string',
              description: 'The Slack channel ID or channel name (e.g. "C0123456789")'
            },
            text: {
              type: 'string',
              description: 'The message content text to send'
            }
          },
          required: ['channelId', 'text']
        }
      }
    ]
  };
});

// Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Jira Router
      case 'jira_search_issues': {
        const jql = String(args?.jql);
        const data = await jiraSearchIssues(jql);
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
        };
      }
      case 'jira_get_issue': {
        const key = String(args?.issueKey);
        const data = await jiraGetIssue(key);
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
        };
      }
      case 'jira_get_project_timeline': {
        const key = String(args?.projectKey);
        const textTimeline = await jiraGetProjectTimeline(key);
        return {
          content: [{ type: 'text', text: textTimeline }]
        };
      }

      // Notion Router
      case 'notion_list_databases': {
        const list = await notionListDatabases();
        return {
          content: [{ type: 'text', text: JSON.stringify(list, null, 2) }]
        };
      }
      case 'notion_query_database': {
        const dbId = String(args?.databaseId);
        const markdownTable = await notionQueryDatabase(dbId);
        return {
          content: [{ type: 'text', text: markdownTable }]
        };
      }
      case 'notion_get_page': {
        const pageId = String(args?.pageId);
        const markdownContent = await notionGetPage(pageId);
        return {
          content: [{ type: 'text', text: markdownContent }]
        };
      }

      // Slack Router
      case 'slack_list_channels': {
        const channels = await slackListChannels();
        return {
          content: [{ type: 'text', text: JSON.stringify(channels, null, 2) }]
        };
      }
      case 'slack_get_channel_history': {
        const channelId = String(args?.channelId);
        const limitCount = args?.limit ? Number(args.limit) : 30;
        const historyText = await slackGetChannelHistory(channelId, limitCount);
        return {
          content: [{ type: 'text', text: historyText }]
        };
      }
      case 'slack_send_message': {
        const channelId = String(args?.channelId);
        const text = String(args?.text);
        const result = await slackSendMessage(channelId, text);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      default:
        throw new Error(`Tool "${name}" not found.`);
    }
  } catch (error: any) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: ${error.message || String(error)}` }]
    };
  }
});

// Setup Express SSE Host
const app = express();
app.use(cors());
app.use(express.json());

const transports: Record<string, SSEServerTransport> = {};

app.get('/sse', async (req: Request, res: Response) => {
  console.log('New client initiating SSE stream connection...');
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;

  res.on('close', () => {
    console.log(`Client disconnected from session ${transport.sessionId}`);
    delete transports[transport.sessionId];
  });

  await server.connect(transport);
  console.log(`Connected server to session ${transport.sessionId}`);
});

app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];

  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No active transport session found for sessionId');
  }
});

app.post('/api/tools', async (req: Request, res: Response) => {
  const { name, arguments: args } = req.body;
  console.log(`Received API tools call from React client: ${name}`);

  try {
    let resultText = "";
    switch (name) {
      case 'jira_search_issues': {
        const data = await jiraSearchIssues(String(args?.jql));
        resultText = JSON.stringify(data, null, 2);
        break;
      }
      case 'jira_get_issue': {
        const data = await jiraGetIssue(String(args?.issueKey));
        resultText = JSON.stringify(data, null, 2);
        break;
      }
      case 'jira_get_project_timeline': {
        resultText = await jiraGetProjectTimeline(String(args?.projectKey));
        break;
      }
      case 'notion_list_databases': {
        const list = await notionListDatabases();
        resultText = JSON.stringify(list, null, 2);
        break;
      }
      case 'notion_query_database': {
        resultText = await notionQueryDatabase(String(args?.databaseId));
        break;
      }
      case 'notion_get_page': {
        resultText = await notionGetPage(String(args?.pageId));
        break;
      }
      case 'slack_list_channels': {
        const channels = await slackListChannels();
        resultText = JSON.stringify(channels, null, 2);
        break;
      }
      case 'slack_get_channel_history': {
        const limitCount = args?.limit ? Number(args.limit) : 30;
        resultText = await slackGetChannelHistory(String(args?.channelId), limitCount);
        break;
      }
      case 'slack_send_message': {
        const result = await slackSendMessage(String(args?.channelId), String(args?.text));
        resultText = JSON.stringify(result, null, 2);
        break;
      }
      default:
        res.status(404).json({ error: `Tool "${name}" not found.` });
        return;
    }

    res.json({ result: resultText });
  } catch (error: any) {
    console.error(`API tools execution failed:`, error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`Hurtigruten Connectors MCP Server listening on port ${PORT}...`);
  console.log(`- SSE Endpoint: http://localhost:${PORT}/sse`);
  console.log(`- Messages Endpoint: http://localhost:${PORT}/messages`);
  console.log(`=============================================================\n`);
});
