import dotenv from 'dotenv';
dotenv.config();

const getAuthHeader = () => {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) {
    throw new Error("Missing JIRA_EMAIL or JIRA_API_TOKEN in environment.");
  }
  const credential = `${email}:${token}`;
  return `Basic ${Buffer.from(credential).toString('base64')}`;
};

const getJiraHost = () => {
  const host = process.env.JIRA_HOST || 'hurtigruten.atlassian.net';
  return host.replace(/^https?:\/\//, '').replace(/\/$/, '');
};

export async function jiraSearchIssues(jql: string) {
  const host = getJiraHost();
  const authHeader = getAuthHeader();
  
  const res = await fetch(`https://${host}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      jql,
      maxResults: 50,
      fields: ['summary', 'status', 'assignee', 'startdate', 'duedate', 'priority']
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API search failed (${res.status}): ${text}`);
  }

  return await res.json();
}

export async function jiraGetIssue(issueKey: string) {
  const host = getJiraHost();
  const authHeader = getAuthHeader();

  const res = await fetch(`https://${host}/rest/api/3/issue/${issueKey}`, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API getIssue failed (${res.status}): ${text}`);
  }

  return await res.json();
}

export async function jiraGetProjectTimeline(projectKey: string) {
  // Query issues in project with timeline dates
  const jql = `project = ${projectKey} AND (duedate is not null OR startdate is not null) ORDER BY duedate ASC`;
  const searchResults = (await jiraSearchIssues(jql)) as any;
  const issues = searchResults.issues || [];

  if (issues.length === 0) {
    return `No issues with timeline dates found in project "${projectKey}".`;
  }

  let output = `### Timeline for Jira Project: ${projectKey.toUpperCase()}\n\n`;
  output += `Found ${issues.length} scheduled issues:\n\n`;

  issues.forEach((issue: any) => {
    const fields = issue.fields || {};
    const key = issue.key;
    const summary = fields.summary || 'No Summary';
    const status = fields.status?.name || 'Unknown';
    const assignee = fields.assignee?.displayName || 'Unassigned';
    const start = fields.startdate || 'N/A';
    const due = fields.duedate || 'N/A';
    const priority = fields.priority?.name || 'Medium';

    output += `- **[${key}] ${summary}**\n`;
    output += `  - Status: ${status} | Priority: ${priority}\n`;
    output += `  - Assignee: ${assignee}\n`;
    output += `  - Timeline: ${start} to ${due}\n\n`;
  });

  return output;
}
