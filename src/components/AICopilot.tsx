import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MessageSquare, Sparkles, Send, Settings, Key, AlertTriangle, CheckCircle, RefreshCw, X, Mic, Volume2, VolumeX } from 'lucide-react';
import type { Initiative, Allocation, Stream, Milestone } from '../hooks/useRecompute';

interface AICopilotProps {
  streams: Stream[];
  initiatives: Initiative[];
  allocations: Allocation[];
  people: any[];
  conflicts: any[];
  milestones: Milestone[];
  recomputeData: {
    utilisation: Record<string, Record<string, number>>;
    headroom: Record<string, Record<string, number>>;
    initiativeRAG: Record<string, 'green' | 'amber' | 'red'>;
    criticalPath: {
      chain: string[];
      span: string;
      dates: Record<string, string>;
    };
  };
  onClose?: () => void;
}

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export const AICopilot: React.FC<AICopilotProps> = ({
  streams,
  initiatives,
  allocations,
  people,
  conflicts,
  milestones,
  recomputeData,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'suggestions'>('chat');
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  // Gemini model selection state
  const [geminiModel, setGeminiModel] = useState<string>(() => {
    return localStorage.getItem('gemini_model') || 'gemini-1.5-flash';
  });
  const [tempGeminiModel, setTempGeminiModel] = useState(geminiModel);

  // Supabase and Embeddings Keys
  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    return localStorage.getItem('supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  });
  const [supabaseKey, setSupabaseKey] = useState(() => {
    return localStorage.getItem('supabase_key') || import.meta.env.VITE_SUPABASE_KEY || '';
  });
  const [openaiApiKey, setOpenaiApiKey] = useState(() => {
    return localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '';
  });
  const [voyageApiKey, setVoyageApiKey] = useState(() => {
    return localStorage.getItem('voyage_api_key') || import.meta.env.VITE_VOYAGE_API_KEY || '';
  });
  const [mcpServerUrl, setMcpServerUrl] = useState(() => {
    return localStorage.getItem('mcp_server_url') || import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3000';
  });

  const [tempSupabaseUrl, setTempSupabaseUrl] = useState(supabaseUrl);
  const [tempSupabaseKey, setTempSupabaseKey] = useState(supabaseKey);
  const [tempOpenaiApiKey, setTempOpenaiApiKey] = useState(openaiApiKey);
  const [tempVoyageApiKey, setTempVoyageApiKey] = useState(voyageApiKey);
  const [tempMcpServerUrl, setTempMcpServerUrl] = useState(mcpServerUrl);

  const [connectOpenBrain, setConnectOpenBrain] = useState(true);
  
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: "Hello! I am your Customer Systems Roadmap AI Copilot. I can assist with roadmap analysis (capacities, critical paths, overloads), fetch context from your Jira/Notion/Slack tools, or answer any other questions you have. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(prev => prev ? prev + ' ' + transcript : transcript);
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Safari.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const speakMessage = (text: string) => {
    window.speechSynthesis.cancel();
    
    // Clean markdown symbols for natural TTS
    const cleanText = text
      .replace(/[*#`_\-]/g, '')
      .replace(/\*System.*?\*/gi, '')
      .trim();

    if (!cleanText) {
      setSpeakingIndex(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.onend = () => {
      setSpeakingIndex(null);
    };
    utterance.onerror = () => {
      setSpeakingIndex(null);
    };
    window.speechSynthesis.speak(utterance);
  };

  // Suggestions state
  const [suggestions, setSuggestions] = useState<string>('');
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [lastSuggestedState, setLastSuggestedState] = useState<string>('');

  const activeMonths = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save Settings
  const handleSaveSettings = () => {
    localStorage.setItem('gemini_api_key', tempApiKey);
    localStorage.setItem('gemini_model', tempGeminiModel);
    localStorage.setItem('supabase_url', tempSupabaseUrl);
    localStorage.setItem('supabase_key', tempSupabaseKey);
    localStorage.setItem('openai_api_key', tempOpenaiApiKey);
    localStorage.setItem('voyage_api_key', tempVoyageApiKey);
    localStorage.setItem('mcp_server_url', tempMcpServerUrl);

    setApiKey(tempApiKey);
    setGeminiModel(tempGeminiModel);
    setSupabaseUrl(tempSupabaseUrl);
    setSupabaseKey(tempSupabaseKey);
    setOpenaiApiKey(tempOpenaiApiKey);
    setVoyageApiKey(tempVoyageApiKey);
    setMcpServerUrl(tempMcpServerUrl);
    
    setShowSettings(false);
  };

  // Get embedding from Voyage or OpenAI
  const getEmbeddingVector = async (text: string): Promise<number[]> => {
    if (voyageApiKey) {
      try {
        const res = await fetch("https://api.voyageai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${voyageApiKey}`,
          },
          body: JSON.stringify({ model: "voyage-3", input: text.slice(0, 16000) }),
        });
        const data = await res.json();
        const emb = data?.data?.[0]?.embedding;
        if (emb) return emb;
      } catch (err) {
        console.warn("Voyage AI embedding failed, falling back to OpenAI:", err);
      }
    }

    if (openaiApiKey) {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text.slice(0, 8000),
          dimensions: 1024,
        }),
      });
      const data = await res.json();
      const emb = data?.data?.[0]?.embedding;
      if (emb) return emb;
      throw new Error(`OpenAI embedding failed: ${JSON.stringify(data)}`);
    }

    throw new Error("No embedding provider configured. Please enter VOYAGE_API_KEY or OPENAI_API_KEY in settings.");
  };

  // Query thoughts matching embedding in Supabase PostgREST RPC
  const searchOpenBrainThoughts = async (embedding: number[]): Promise<any[]> => {
    if (!supabaseUrl || !supabaseKey) return [];
    const cleanUrl = supabaseUrl.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/rest/v1/rpc/match_thoughts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 5
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase RPC match_thoughts failed (${res.status}): ${errText}`);
    }
    return await res.json();
  };

  // Generate serialized snapshot of the roadmap to pass as context
  const getRoadmapSnapshot = () => {
    const activeAllocations = allocations.filter(a => a.fte > 0);
    
    // Format computed headroom
    const formattedHeadroom: Record<string, string> = {};
    streams.forEach(s => {
      formattedHeadroom[s.name] = activeMonths
        .map(m => `${m}: ${recomputeData.headroom[s.id]?.[m] || 0} FTE`)
        .join(', ');
    });

    const contextObj = {
      meta: {
        cycle: "H2 2026",
        currentTime: new Date().toISOString()
      },
      streams: streams.map(s => ({
        id: s.id,
        name: s.name,
        lead: s.lead,
        capacity: s.capacityByMonth
      })),
      people: people.map(p => ({
        name: p.name,
        role: p.role,
        stream: p.stream,
        isDelivery: p.isDelivery
      })),
      initiatives: initiatives.map(i => ({
        id: i.id,
        name: i.name,
        stream: i.stream,
        priority: i.priority,
        status: i.status,
        horizon: i.horizon,
        lead: i.lead,
        dependencies: i.dependencies?.map(d => d.to) || [],
        ragStatus: recomputeData.initiativeRAG[i.id] || 'green'
      })),
      allocations: activeAllocations.map(a => {
        const person = people.find(p => p.id === a.personId)?.name || a.personId;
        const init = initiatives.find(i => i.id === a.initiativeId)?.name || a.initiativeId;
        return `${person} allocated ${a.fte} FTE to ${init} in ${a.month}`;
      }),
      headroom: formattedHeadroom,
      criticalPath: {
        chain: recomputeData.criticalPath.chain.map(id => initiatives.find(i => i.id === id)?.name || id),
        span: recomputeData.criticalPath.span,
        dates: recomputeData.criticalPath.dates
      },
      conflicts: conflicts.map(c => ({
        title: c.title,
        tension: c.tension,
        recommendation: c.recommendation,
        status: c.status
      })),
      milestones: milestones.map(m => ({
        name: m.name,
        date: m.date,
        initiativeId: m.initiativeId
      }))
    };

    return JSON.stringify(contextObj, null, 2);
  };

  // Chat Query Submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    const userQuery = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userQuery, timestamp: new Date() }]);
    setIsChatLoading(true);

    try {
      let memoryContextText = "";
      
      if (connectOpenBrain && (voyageApiKey || openaiApiKey) && supabaseUrl && supabaseKey) {
        try {
          const vector = await getEmbeddingVector(userQuery);
          const thoughts = await searchOpenBrainThoughts(vector);
          
          if (thoughts.length > 0) {
            memoryContextText = thoughts.map((t, idx) => {
              const source = t.metadata?.source || 'unknown';
              const name = t.metadata?.conversation_name || 'Note';
              return `Memory #${idx + 1} (Source: ${source}, Context: ${name}, Date: ${t.created_at}):\n${t.content}\n`;
            }).join("\n---\n\n");
            
            setMessages(prev => [
              ...prev,
              {
                sender: 'ai',
                text: `*System: Connected to OpenBrain. Retrieved ${thoughts.length} matching persistent memory fragments related to your question.*`,
                timestamp: new Date()
              }
            ]);
          }
        } catch (err: any) {
          console.warn("Failed to retrieve OpenBrain context:", err);
          setMessages(prev => [
            ...prev,
            {
              sender: 'ai',
              text: `*System Warning: Could not retrieve OpenBrain memory context (${err.message || err}). Proceeding with standard context.*`,
              timestamp: new Date()
            }
          ]);
        }
      }

      // Declare MCP tools to Gemini if MCP Server URL is configured
      const mcpTools = mcpServerUrl ? [
        {
          functionDeclarations: [
            {
              name: 'jira_search_issues',
              description: 'Runs a JQL (Jira Query Language) query and returns matching issues, statuses, and priorities.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  jql: { type: 'STRING', description: 'The JQL query string (e.g. "project = SQSF AND status = \"In Progress\"")' }
                },
                required: ['jql']
              }
            },
            {
              name: 'jira_get_issue',
              description: 'Retrieves full details of a specific Jira issue (e.g. "SQSF-123").',
              parameters: {
                type: 'OBJECT',
                properties: {
                  issueKey: { type: 'STRING', description: 'The Jira issue key (e.g. "SQSF-101")' }
                },
                required: ['issueKey']
              }
            },
            {
              name: 'jira_get_project_timeline',
              description: 'Compiles a schedule timeline of issues in a Jira project.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  projectKey: { type: 'STRING', description: 'The Jira project short code (e.g. "SQSF")' }
                },
                required: ['projectKey']
              }
            },
            {
              name: 'notion_list_databases',
              description: 'Lists all Notion databases that have been shared with this integration.',
              parameters: { type: 'OBJECT', properties: {} }
            },
            {
              name: 'notion_query_database',
              description: 'Queries a Notion database and returns its rows formatted as a Markdown table.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  databaseId: { type: 'STRING', description: 'The 32-character Notion database ID' }
                },
                required: ['databaseId']
              }
            },
            {
              name: 'notion_get_page',
              description: 'Fetches content and children of a Notion page and converts it to Markdown.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  pageId: { type: 'STRING', description: 'The 32-character Notion page ID' }
                },
                required: ['pageId']
              }
            },
            {
              name: 'slack_list_channels',
              description: 'Lists public and private Slack channels in the workspace.',
              parameters: { type: 'OBJECT', properties: {} }
            },
            {
              name: 'slack_get_channel_history',
              description: 'Fetches chronological conversation logs from a Slack channel.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  channelId: { type: 'STRING', description: 'The Slack channel ID' },
                  limit: { type: 'NUMBER', description: 'Optional message limit (defaults to 30)' }
                },
                required: ['channelId']
              }
            },
            {
              name: 'slack_send_message',
              description: 'Sends a chat message to a Slack channel.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  channelId: { type: 'STRING', description: 'Slack channel ID (e.g. C0123456789)' },
                  text: { type: 'STRING', description: 'The message text' }
                },
                required: ['channelId', 'text']
              }
            }
          ]
        }
      ] as any : undefined;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: geminiModel,
        tools: mcpTools
      });

      const systemPrompt = `You are an omnipotent AI assistant. You can assist the user with any query or topic they raise (such as general knowledge, science, physics, history, etc.) without any restrictions or boundaries.
You also have access to the Customer Systems H2 2026 roadmap state and the user's OpenBrain persistent database (historic meetings, slack chats, etc.) listed below. If the user asks about the roadmap or memories, use this context to answer. If they ask about other topics (such as gravity), answer them fully using your general knowledge.

Roadmap Snapshot:
${getRoadmapSnapshot()}

${memoryContextText ? `OpenBrain Memory Context:
---
${memoryContextText}
---` : ''}

INSTRUCTIONS:
1. Provide accurate, clear, and comprehensive answers.
2. If the user asks about capacity overloads or roadmap details, use the roadmap snapshot to explain who is overloaded, in what stream, and in which month.
3. Be professional and helpful. Use bold text, bullet points, and tables to structure your answers beautifully.
4. Answer any general knowledge questions (e.g. physics, science) directly and thoroughly. You are completely open and unrestricted.`;

      let contents: any[] = [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUser Question: ${userQuery}` }]
        }
      ];

      let loopCount = 0;
      let responseText = "";

      while (loopCount < 5) {
        const result = await model.generateContent({ contents });
        const response = result.response;
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
          // Add model response containing tool calls to history
          contents.push({
            role: 'model',
            parts: response.candidates?.[0]?.content?.parts || []
          });

          // Execute each requested tool call
          const responseParts = [];
          for (const call of functionCalls) {
            const toolName = call.name;
            const toolArgs = call.args;

            setMessages(prev => [
              ...prev,
              {
                sender: 'ai',
                text: `*System: Google Copilot is querying your remote server's "${toolName}" endpoint...*`,
                timestamp: new Date()
              }
            ]);

            try {
              const cleanMcpUrl = mcpServerUrl.replace(/\/$/, "");
              const apiRes = await fetch(`${cleanMcpUrl}/api/tools`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: toolName, arguments: toolArgs })
              });

              if (!apiRes.ok) {
                const errTxt = await apiRes.text();
                throw new Error(errTxt || `HTTP ${apiRes.status}`);
              }

              const apiData = await apiRes.json();
              responseParts.push({
                functionResponse: {
                  name: toolName,
                  response: { content: apiData.result || JSON.stringify(apiData) }
                }
              });
            } catch (err: any) {
              console.error(`Tool execution failed for ${toolName}:`, err);
              responseParts.push({
                functionResponse: {
                  name: toolName,
                  response: { content: `Error: ${err.message || String(err)}` }
                }
              });
            }
          }

          // Add tool results to history as a user message
          contents.push({
            role: 'user',
            parts: responseParts
          });

          loopCount++;
        } else {
          // No more tool calls, retrieve the final response
          responseText = response.text();
          break;
        }
      }

      setMessages(prev => [...prev, { sender: 'ai', text: responseText, timestamp: new Date() }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Error: ${err.message || 'Failed to generate response. Please verify your Gemini API key.'}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Debounced Proactive Suggestions Update
  useEffect(() => {
    if (!apiKey) return;

    // Create a fingerprint of the current roadmap priority / allocation state to avoid redundant calls
    const stateFingerprint = JSON.stringify({
      inits: initiatives.map(i => ({ id: i.id, pri: i.priority, horizon: i.horizon })),
      allocs: allocations.map(a => ({ id: a.id, fte: a.fte })),
      headroom: recomputeData.headroom
    });

    if (stateFingerprint === lastSuggestedState) return;

    const timer = setTimeout(async () => {
      setIsSuggestionsLoading(true);
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: geminiModel });

        const prompt = `Inspect the following roadmap data snapshot.
Check the computed stream headroom for active months (Aug, Sep, Oct, Nov, Dec). Any negative headroom represents an overload.
Analyze the initiative priority, dependencies, critical path, and logged conflicts.

Roadmap Snapshot:
${getRoadmapSnapshot()}

Deliverable:
Provide a brief, professional optimization report.
1. Summary of active bottlenecks or capacity overloads (highlight specific streams & months).
2. 2-3 specific, actionable recommendations (e.g. "Move Dedupe from Sep to Nov to free up Booking Solutions", "Since Seaware OCI has positive headroom in Oct, allocate lead developer to Partner API").
3. Keep it brief, formatted in clean Markdown with distinct sections. No introductory fluff.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        setSuggestions(response.text());
        setLastSuggestedState(stateFingerprint);
      } catch (err) {
        console.error("Failed to fetch proactive suggestions:", err);
      } finally {
        setIsSuggestionsLoading(false);
      }
    }, 3000); // 3-second debounce

    return () => clearTimeout(timer);
  }, [initiatives, allocations, recomputeData, apiKey, lastSuggestedState]);

  const triggerSuggestionsRefresh = async () => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    setIsSuggestionsLoading(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: geminiModel });

      const prompt = `Provide a thorough optimization report for the following roadmap state.
Identify bottlenecks, resource allocation inefficiencies, and dependency delays. Provide specific resolution recommendations.

Roadmap Snapshot:
${getRoadmapSnapshot()}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setSuggestions(response.text());
    } catch (err) {
      console.error(err);
    } finally {
      setIsSuggestionsLoading(false);
    }
  };

  return (
    <div className="w-[450px] flex flex-col h-full glass border-l border-white/10 relative shadow-2xl overflow-hidden">
      {/* Copilot Header */}
      <div className="px-6 py-4 bg-gray-900/60 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-brand-purple animate-pulse" />
          <h2 className="font-display font-semibold text-lg text-white">AI Copilot</h2>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              setTempApiKey(apiKey);
              setTempGeminiModel(geminiModel);
              setTempSupabaseUrl(supabaseUrl);
              setTempSupabaseKey(supabaseKey);
              setTempOpenaiApiKey(openaiApiKey);
              setTempVoyageApiKey(voyageApiKey);
              setTempMcpServerUrl(mcpServerUrl);
              setShowSettings(!showSettings);
            }}
            className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Configure API Keys & Server"
          >
            <Settings className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer border-l border-white/5 pl-2"
              title="Close Copilot Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-gray-950/20">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeTab === 'chat'
              ? 'border-brand-purple text-brand-purple bg-white/[0.02]'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat Assistant</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('suggestions');
            if (!suggestions && apiKey) triggerSuggestionsRefresh();
          }}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeTab === 'suggestions'
              ? 'border-brand-purple text-brand-purple bg-white/[0.02]'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Optimization Suggestions</span>
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-x-0 top-[53px] bg-[#0c0e17] border-b border-white/10 p-5 z-30 shadow-xl max-h-[400px] overflow-y-auto animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <div className="flex items-center space-x-1.5">
              <Key className="w-4 h-4 text-brand-purple" />
              <h3 className="text-xs font-semibold text-white">Copilot Configuration</h3>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3.5 text-[11px]">
            {/* Gemini API Key */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 font-medium">Google Gemini API Key</label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-[11px] text-white focus:outline-none focus:border-brand-purple/50"
              />
            </div>

            {/* Gemini Model Name */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 font-medium">Gemini Model Name</label>
              <input
                type="text"
                placeholder="gemini-1.5-flash"
                value={tempGeminiModel}
                onChange={(e) => setTempGeminiModel(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-[11px] text-white focus:outline-none"
              />
            </div>

            {/* Supabase URL */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 font-medium">Supabase OpenBrain URL</label>
              <input
                type="text"
                placeholder="https://your-project.supabase.co"
                value={tempSupabaseUrl}
                onChange={(e) => setTempSupabaseUrl(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-[11px] text-white focus:outline-none"
              />
            </div>

            {/* Supabase Key */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 font-medium">Supabase Key (Publishable / Anon Key)</label>
              <input
                type="password"
                placeholder="eyJhbGciOi..."
                value={tempSupabaseKey}
                onChange={(e) => setTempSupabaseKey(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-[11px] text-white focus:outline-none"
              />
            </div>

            {/* OpenAI API Key */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 font-medium">OpenAI API Key (Embeddings)</label>
              <input
                type="password"
                placeholder="sk-proj-..."
                value={tempOpenaiApiKey}
                onChange={(e) => setTempOpenaiApiKey(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-[11px] text-white focus:outline-none"
              />
            </div>

            {/* Voyage API Key */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 font-medium">Voyage API Key (Alternative Embeddings)</label>
              <input
                type="password"
                placeholder="pa-..."
                value={tempVoyageApiKey}
                onChange={(e) => setTempVoyageApiKey(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-[11px] text-white focus:outline-none"
              />
            </div>

            {/* MCP Server URL */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 font-medium">MCP Server URL (HTTP/SSE)</label>
              <input
                type="text"
                placeholder="http://localhost:3000"
                value={tempMcpServerUrl}
                onChange={(e) => setTempMcpServerUrl(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-[11px] text-white focus:outline-none"
              />
            </div>

            <button
              onClick={handleSaveSettings}
              className="w-full py-2 bg-brand-purple hover:bg-brand-purple/90 transition-colors text-white text-xs font-semibold rounded-lg mt-2 cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* API Key Missing Alert */}
      {!apiKey && !showSettings && (
        <div className="p-4 bg-amber-950/20 border-b border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>AI Copilot requires a Google AI Studio API key.</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded text-amber-200 transition-colors font-medium cursor-pointer"
          >
            Configure
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'chat' ? (
          <>
            {/* Messages Container */}
            <div className="space-y-4 min-h-0 flex-1 flex flex-col justify-end">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'ai' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (speakingIndex === i) {
                          window.speechSynthesis.cancel();
                          setSpeakingIndex(null);
                        } else {
                          setSpeakingIndex(i);
                          speakMessage(msg.text);
                        }
                      }}
                      className="mt-2 p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      title={speakingIndex === i ? "Stop speaking" : "Speak message"}
                    >
                      {speakingIndex === i ? (
                        <VolumeX className="w-3.5 h-3.5 text-brand-purple" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs shadow-md leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-brand-purple text-white rounded-tr-none'
                        : 'bg-gray-900/60 text-gray-200 border border-white/5 rounded-tl-none prose prose-invert max-w-none'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      msg.text
                    ) : (
                      // A basic fallback for markdown formatting in system chat bubbles
                      <div className="space-y-2 text-xs">
                        {msg.text.split('\n').map((line, idx) => {
                          if (line.startsWith('### ')) {
                            return <h3 key={idx} className="font-semibold text-white mt-3 text-xs">{line.replace('### ', '')}</h3>;
                          }
                          if (line.startsWith('## ')) {
                            return <h2 key={idx} className="font-bold text-white mt-4 text-sm">{line.replace('## ', '')}</h2>;
                          }
                          if (line.startsWith('* ') || line.startsWith('- ')) {
                            return <li key={idx} className="ml-4 list-disc text-gray-300">{line.substring(2)}</li>;
                          }
                          if (line.match(/^\d+\.\s/)) {
                            return <li key={idx} className="ml-4 list-decimal text-gray-300">{line.replace(/^\d+\.\s/, '')}</li>;
                          }
                          if (line.trim() === '') {
                            return <div key={idx} className="h-1" />;
                          }
                          return <p key={idx} className="text-gray-300">{line}</p>;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-900/60 border border-white/5 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-gray-400 flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>AI Copilot is analyzing roadmap...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </>
        ) : (
          /* Suggestions Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                Optimization suggestions
              </span>
              <button
                onClick={triggerSuggestionsRefresh}
                disabled={isSuggestionsLoading || !apiKey}
                className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
                title="Refresh Suggestions"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSuggestionsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isSuggestionsLoading && !suggestions && (
              <div className="glass-card p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                <RefreshCw className="w-6 h-6 text-brand-purple animate-spin" />
                <p className="text-xs text-gray-400">AI is computing optimizations based on recent changes...</p>
              </div>
            )}

            {suggestions ? (
              <div className="glass-card p-5 rounded-xl border border-white/5 text-xs text-gray-300 space-y-3 leading-relaxed relative overflow-hidden">
                {isSuggestionsLoading && (
                  <div className="absolute top-2 right-2 flex items-center space-x-1.5 px-2 py-0.5 bg-brand-purple/20 border border-brand-purple/30 rounded-full text-[10px] text-brand-purple">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Updating...</span>
                  </div>
                )}
                {/* Parse suggestions string */}
                <div className="space-y-2.5">
                  {suggestions.split('\n').map((line, idx) => {
                    if (line.startsWith('### ')) {
                      return <h4 key={idx} className="font-semibold text-white mt-3 text-sm">{line.replace('### ', '')}</h4>;
                    }
                    if (line.startsWith('## ')) {
                      return <h3 key={idx} className="font-bold text-white mt-4 text-base">{line.replace('## ', '')}</h3>;
                    }
                    if (line.startsWith('* ') || line.startsWith('- ')) {
                      const isAlert = line.toLowerCase().includes('overload') || line.toLowerCase().includes('conflict');
                      return (
                        <div key={idx} className={`flex items-start gap-2 ml-1 text-gray-300 p-1.5 rounded ${isAlert ? 'bg-red-950/10 border-l-2 border-red-500' : ''}`}>
                          {isAlert ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          )}
                          <span>{line.substring(2)}</span>
                        </div>
                      );
                    }
                    if (line.trim() === '') return <div key={idx} className="h-0.5" />;
                    return <p key={idx}>{line}</p>;
                  })}
                </div>
              </div>
            ) : (
              !isSuggestionsLoading && (
                <div className="glass-card p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-brand-purple/40" />
                  <h4 className="font-semibold text-white text-sm">No Suggestions Yet</h4>
                  <p className="text-xs text-gray-500 max-w-xs">
                    Suggestions automatically update in the background when you update the roadmap priorities or allocations.
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Include OpenBrain Memory Toggle */}
      {activeTab === 'chat' && (
        <div className="px-4 py-2.5 bg-gray-950/20 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
          <label className="flex items-center space-x-2 cursor-pointer hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={connectOpenBrain}
              onChange={(e) => setConnectOpenBrain(e.target.checked)}
              className="rounded border-white/10 text-brand-purple focus:ring-brand-purple bg-gray-900"
            />
            <span>Include OpenBrain Memory Context</span>
          </label>
          {connectOpenBrain && supabaseUrl && (
            <span className="text-[10px] text-emerald-400 flex items-center space-x-1 shrink-0 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Memory Connected</span>
            </span>
          )}
        </div>
      )}

      {/* Chat Input */}
      {activeTab === 'chat' && (
        <form onSubmit={handleChatSubmit} className="p-4 bg-gray-950/40 border-t border-white/5 flex gap-2">
          <input
            type="text"
            placeholder={apiKey ? "Ask copilot..." : "API key required..."}
            value={chatInput}
            disabled={!apiKey || isChatLoading}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-gray-900 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-brand-purple/50 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={toggleListening}
            disabled={!apiKey}
            className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            } disabled:opacity-50`}
            title={isListening ? "Listening... Click to stop" : "Start voice typing"}
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={!apiKey || isChatLoading || !chatInput.trim()}
            className="p-2.5 bg-brand-purple hover:bg-brand-purple/90 transition-colors text-white rounded-xl flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
};
