import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
dotenv.config();

let notionClient: Client | null = null;

const getNotionClient = () => {
  if (notionClient) return notionClient;
  const token = process.env.NOTION_API_KEY;
  if (!token) {
    throw new Error("Missing NOTION_API_KEY in environment.");
  }
  notionClient = new Client({ auth: token });
  return notionClient;
};

// Helper to convert Notion page property values to simple strings
const formatProperty = (prop: any): string => {
  if (!prop) return '';
  switch (prop.type) {
    case 'title':
      return prop.title?.map((t: any) => t.plain_text).join('') || '';
    case 'rich_text':
      return prop.rich_text?.map((t: any) => t.plain_text).join('') || '';
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return prop.multi_select?.map((s: any) => s.name).join(', ') || '';
    case 'status':
      return prop.status?.name || '';
    case 'date':
      if (!prop.date) return '';
      return prop.date.end ? `${prop.date.start} to ${prop.date.end}` : prop.date.start;
    case 'number':
      return prop.number?.toString() || '';
    case 'checkbox':
      return prop.checkbox ? 'Checked' : 'Unchecked';
    case 'people':
      return prop.people?.map((p: any) => p.name || p.id).join(', ') || '';
    case 'email':
      return prop.email || '';
    case 'url':
      return prop.url || '';
    case 'phone_number':
      return prop.phone_number || '';
    default:
      return JSON.stringify(prop);
  }
};

export async function notionListDatabases() {
  const notion = getNotionClient();
  const response = await notion.search({
    filter: {
      property: 'object',
      value: 'database'
    }
  });

  return response.results.map((db: any) => ({
    id: db.id,
    title: db.title?.map((t: any) => t.plain_text).join('') || 'Untitled Database',
    url: db.url
  }));
}

export async function notionQueryDatabase(databaseId: string) {
  const notion = getNotionClient();
  
  // Strip formatting from ID if pasted with dashes/spaces
  const cleanDbId = databaseId.trim().replace(/-/g, '');

  const response = await notion.databases.query({
    database_id: cleanDbId,
    page_size: 100
  });

  const results = response.results || [];
  if (results.length === 0) {
    return `The Notion database "${databaseId}" is empty.`;
  }

  // Construct Markdown Table
  const samplePage: any = results[0];
  const headers = Object.keys(samplePage.properties);
  
  let markdown = `### Notion Database Query: ${cleanDbId}\n\n`;
  markdown += `| ${headers.join(' | ')} |\n`;
  markdown += `| ${headers.map(() => '---').join(' | ')} |\n`;

  results.forEach((page: any) => {
    const rowValues = headers.map(header => {
      const prop = page.properties[header];
      return formatProperty(prop).replace(/\|/g, '\\|'); // Escape vertical pipes
    });
    markdown += `| ${rowValues.join(' | ')} |\n`;
  });

  return markdown;
}

// Convert Notion rich text array to string
const formatRichText = (richTextArr: any[]): string => {
  return richTextArr?.map((t: any) => t.plain_text).join('') || '';
};

// Recursively fetch block children and format to Markdown
export async function notionGetPage(pageId: string) {
  const notion = getNotionClient();
  const cleanPageId = pageId.trim().replace(/-/g, '');

  // 1. Get Page Metadata
  const pageMeta: any = await notion.pages.retrieve({ page_id: cleanPageId });
  const titleProp = Object.values(pageMeta.properties).find((p: any) => p.type === 'title');
  const pageTitle = titleProp ? formatProperty(titleProp) : 'Untitled Page';

  let markdown = `# ${pageTitle}\n\n`;
  markdown += `*Notion Page ID: ${cleanPageId}*\n\n`;

  // 2. Fetch and parse blocks
  const blocksResponse = await notion.blocks.children.list({
    block_id: cleanPageId,
    page_size: 100
  });

  const parseBlocks = async (blocks: any[]): Promise<string> => {
    let text = '';
    for (const block of blocks) {
      const type = block.type;
      const data = block[type];
      
      switch (type) {
        case 'paragraph':
          text += `${formatRichText(data.rich_text)}\n\n`;
          break;
        case 'heading_1':
          text += `# ${formatRichText(data.rich_text)}\n\n`;
          break;
        case 'heading_2':
          text += `## ${formatRichText(data.rich_text)}\n\n`;
          break;
        case 'heading_3':
          text += `### ${formatRichText(data.rich_text)}\n\n`;
          break;
        case 'bulleted_list_item':
          text += `- ${formatRichText(data.rich_text)}\n`;
          break;
        case 'numbered_list_item':
          text += `1. ${formatRichText(data.rich_text)}\n`;
          break;
        case 'to_do':
          const checked = data.checked ? '[x]' : '[ ]';
          text += `- ${checked} ${formatRichText(data.rich_text)}\n`;
          break;
        case 'code':
          text += `\`\`\`${data.language || 'text'}\n${formatRichText(data.rich_text)}\n\`\`\`\n\n`;
          break;
        case 'quote':
          text += `> ${formatRichText(data.rich_text)}\n\n`;
          break;
        case 'toggle':
          text += `<details><summary>${formatRichText(data.rich_text)}</summary>\n\n`;
          if (block.has_children) {
            const children = await notion.blocks.children.list({ block_id: block.id });
            text += await parseBlocks(children.results);
          }
          text += `</details>\n\n`;
          break;
        default:
          // Ignore unsupported blocks or format as raw details
          break;
      }
    }
    return text;
  };

  markdown += await parseBlocks(blocksResponse.results);
  return markdown;
}
