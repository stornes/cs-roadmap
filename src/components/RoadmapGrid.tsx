import React, { useState } from 'react';
import type { Initiative, Allocation, Stream } from '../hooks/useRecompute';
import { ChevronDown, ChevronRight, Save, Trash2, Plus, ExternalLink } from 'lucide-react';
import notionMappings from '../notion_mappings.json';

interface RoadmapGridProps {
  streams: Stream[];
  initiatives: Initiative[];
  allocations: Allocation[];
  people: any[];
  initiativeRAG: Record<string, 'green' | 'amber' | 'red'>;
  userRole: string;
  onUpdateInitiative: (id: string, updatedFields: Partial<Initiative>) => Promise<void>;
  onUpdateAllocations: (initiativeId: string, updatedAllocations: Record<string, Record<string, number>>) => Promise<void>;
  onCreateInitiative: (initiative: Omit<Initiative, 'id'>) => Promise<void>;
  onDeleteInitiative: (id: string) => Promise<void>;
}

export const RoadmapGrid: React.FC<RoadmapGridProps> = ({
  streams,
  initiatives,
  allocations,
  people,
  initiativeRAG,
  userRole,
  onUpdateInitiative,
  onUpdateAllocations,
  onCreateInitiative,
  onDeleteInitiative
}) => {
  const [selectedInitId, setSelectedInitId] = useState<string | null>(null);
  
  const getNotionPageId = (initId: string): string | null => {
    const entry = Object.entries(notionMappings).find(([_, value]) => value === initId);
    return entry ? entry[0] : null;
  };
  const [filterStream, setFilterStream] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedStreams, setExpandedStreams] = useState<Record<string, boolean>>({
    A: true, B: true, C: true
  });

  // For creating new initiative
  const [showAddForm, setShowAddForm] = useState<string | null>(null); // streamId
  const [newInitName, setNewInitName] = useState('');
  const [newInitPriority, setNewInitPriority] = useState('P2');
  const [newInitStatus, setNewInitStatus] = useState('Negotiable');
  const [newInitHorizon, setNewInitHorizon] = useState('Q3–Q4');
  const [newInitLead, setNewInitLead] = useState('');

  // Selected initiative edit state
  const selectedInit = initiatives.find(i => i.id === selectedInitId);
  const [editFields, setEditFields] = useState<Partial<Initiative>>({});
  // Structure: personId -> month -> fte
  const [editAllocations, setEditAllocations] = useState<Record<string, Record<string, number>>>({});

  const isEditorOrAdmin = userRole === 'editor' || userRole === 'admin';

  const toggleStream = (streamId: string) => {
    setExpandedStreams(prev => ({ ...prev, [streamId]: !prev[streamId] }));
  };

  const handleRowClick = (init: Initiative) => {
    setSelectedInitId(init.id);
    setEditFields(init);
    
    // Load allocations
    const initialAlloc: Record<string, Record<string, number>> = {};
    const streamPeople = people.filter(p => p.stream === init.stream);
    
    streamPeople.forEach(p => {
      initialAlloc[p.id] = { Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0 };
    });

    allocations
      .filter(a => a.initiativeId === init.id)
      .forEach(a => {
        if (!initialAlloc[a.personId]) {
          initialAlloc[a.personId] = { Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0 };
        }
        initialAlloc[a.personId][a.month] = a.fte;
      });

    setEditAllocations(initialAlloc);
  };

  const handleSave = async () => {
    if (!selectedInitId) return;
    try {
      await onUpdateInitiative(selectedInitId, editFields);
      await onUpdateAllocations(selectedInitId, editAllocations);
      setSelectedInitId(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save changes.');
    }
  };

  const handleAddInitiative = async (streamId: string) => {
    if (!newInitName.trim()) return;
    try {
      await onCreateInitiative({
        name: newInitName,
        stream: streamId,
        priority: newInitPriority,
        status: newInitStatus,
        horizon: newInitHorizon,
        lead: newInitLead,
        dependencies: []
      });
      setNewInitName('');
      setNewInitLead('');
      setShowAddForm(null);
    } catch (err) {
      console.error(err);
      alert('Failed to create initiative.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this initiative?')) {
      await onDeleteInitiative(id);
      if (selectedInitId === id) setSelectedInitId(null);
    }
  };

  // Filtered initiatives
  const filteredInitiatives = initiatives.filter(init => {
    if (filterStream !== 'all' && init.stream !== filterStream) return false;
    if (filterPriority !== 'all' && init.priority !== filterPriority) return false;
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const matchName = init.name.toLowerCase().includes(query);
      const matchLead = init.lead.toLowerCase().includes(query);
      const matchId = init.id.toLowerCase().includes(query);
      if (!matchName && !matchLead && !matchId) return false;
    }
    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P1': return 'bg-purple-950/40 text-purple-300 border-purple-800/50';
      case 'P2': return 'bg-blue-950/40 text-blue-300 border-blue-800/50';
      default: return 'bg-gray-800/40 text-gray-400 border-gray-700/50';
    }
  };

  const getRAGBadge = (rag: 'green' | 'amber' | 'red') => {
    switch (rag) {
      case 'green': return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />;
      case 'red': return <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />;
      default: return <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />;
    }
  };

  return (
    <div className="flex h-full w-full gap-6 relative">
      {/* List Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 items-center">
          <input
            type="text"
            placeholder="Search initiatives, leads, codes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-brand-purple/50 w-64"
          />

          <select
            value={filterStream}
            onChange={(e) => setFilterStream(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-gray-200 focus:outline-none"
          >
            <option value="all">All Streams</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-gray-200 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="P1">P1 - Committed</option>
            <option value="P2">P2 - Planned</option>
            <option value="P3">P3 - Backlog</option>
          </select>
        </div>

        {/* Accordion List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {streams.map(stream => {
            const streamInits = filteredInitiatives.filter(i => i.stream === stream.id);
            if (filterStream !== 'all' && filterStream !== stream.id) return null;
            
            const isExpanded = expandedStreams[stream.id];

            return (
              <div key={stream.id} className="glass-card rounded-xl overflow-hidden border border-white/5">
                {/* Accordion Header */}
                <button
                  onClick={() => toggleStream(stream.id)}
                  className="w-full px-6 py-4 bg-gray-900/40 flex items-center justify-between hover:bg-gray-900/60 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                    <div>
                      <h3 className="font-display font-semibold text-lg text-white">{stream.name}</h3>
                      <p className="text-xs text-gray-400">Lead: {stream.lead} • {streamInits.length} initiatives</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isEditorOrAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAddForm(showAddForm === stream.id ? null : stream.id);
                        }}
                        className="p-1.5 bg-brand-purple/10 border border-brand-purple/20 rounded-md text-brand-purple hover:bg-brand-purple/20 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </button>

                {/* Add Form */}
                {showAddForm === stream.id && (
                  <div className="p-6 bg-gray-950/40 border-b border-white/5 flex flex-col gap-4">
                    <h4 className="text-sm font-semibold text-gray-200">New Initiative for {stream.id}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <input
                        type="text"
                        placeholder="Initiative Name"
                        value={newInitName}
                        onChange={(e) => setNewInitName(e.target.value)}
                        className="px-3 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Lead Developer(s)"
                        value={newInitLead}
                        onChange={(e) => setNewInitLead(e.target.value)}
                        className="px-3 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Horizon (e.g. Q3–Q4)"
                        value={newInitHorizon}
                        onChange={(e) => setNewInitHorizon(e.target.value)}
                        className="px-3 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-sm"
                      />
                      <div className="flex gap-2">
                        <select
                          value={newInitPriority}
                          onChange={(e) => {
                            setNewInitPriority(e.target.value);
                            setNewInitStatus(e.target.value === 'P1' ? 'Committed' : e.target.value === 'P2' ? 'Negotiable' : 'Deferred');
                          }}
                          className="px-3 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-sm text-gray-200 animate-none"
                        >
                          <option value="P1">P1 (Committed)</option>
                          <option value="P2">P2 (Planned)</option>
                          <option value="P3">P3 (Backlog)</option>
                        </select>
                        <button
                          onClick={() => handleAddInitiative(stream.id)}
                          className="flex-1 py-1.5 px-4 bg-brand-purple text-white text-sm font-medium rounded-lg hover:bg-brand-purple/90"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="p-4 overflow-x-auto">
                    {streamInits.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">No initiatives match active filters.</p>
                    ) : (
                      <table className="w-full text-left text-sm text-gray-300">
                        <thead>
                          <tr className="border-b border-white/5 text-gray-400 font-medium text-xs">
                            <th className="py-3 px-4 w-16">RAG</th>
                            <th className="py-3 px-4 w-24">ID</th>
                            <th className="py-3 px-4">Name</th>
                            <th className="py-3 px-4 w-24">Priority</th>
                            <th className="py-3 px-4 w-32">Status</th>
                            <th className="py-3 px-4 w-32">Horizon</th>
                            <th className="py-3 px-4 w-40">Lead</th>
                            {isEditorOrAdmin && <th className="py-3 px-4 w-12" />}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {streamInits.map(init => (
                            <tr
                              key={init.id}
                              onClick={() => handleRowClick(init)}
                              className={`hover:bg-white/5 transition-colors cursor-pointer group ${selectedInitId === init.id ? 'bg-white/5' : ''}`}
                            >
                              <td className="py-3.5 px-4">
                                {getRAGBadge(initiativeRAG[init.id] || 'green')}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-semibold text-gray-400">
                                {init.id}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-white group-hover:text-brand-purple transition-colors flex items-center gap-2">
                                <span>{init.name}</span>
                                {getNotionPageId(init.id) && (
                                  <a
                                    href={`https://www.notion.so/${getNotionPageId(init.id)?.replace(/-/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 text-gray-500 hover:text-brand-purple hover:bg-white/5 rounded transition-all shrink-0"
                                    title="View in Notion"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getPriorityColor(init.priority)}`}>
                                  {init.priority}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-xs text-gray-300 truncate max-w-[120px]">
                                {init.status}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-gray-400">
                                {init.horizon}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-gray-300">
                                {init.lead}
                              </td>
                              {isEditorOrAdmin && (
                                <td className="py-3.5 px-4 text-right">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(init.id);
                                    }}
                                    className="p-1 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Slide-Over / Details Panel */}
      {selectedInitId && selectedInit && (
        <div className="w-[480px] glass border-l border-white/10 p-6 flex flex-col h-full overflow-hidden absolute right-0 top-0 z-20 shadow-2xl animate-in slide-in-from-right duration-250">
          <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-mono font-semibold text-gray-400">{selectedInitId}</h3>
                {getNotionPageId(selectedInitId) && (
                  <a
                    href={`https://www.notion.so/${getNotionPageId(selectedInitId)?.replace(/-/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-brand-purple hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View Notion Page</span>
                  </a>
                )}
              </div>
              <h2 className="text-xl font-display font-semibold text-white truncate max-w-[320px]">{editFields.name}</h2>
            </div>
            <button
              onClick={() => setSelectedInitId(null)}
              className="text-gray-400 hover:text-white text-sm px-3 py-1.5 bg-gray-900 border border-white/5 rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            {/* Metadata Fields */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-brand-purple uppercase tracking-wider">Initiative Fields</h4>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Name</label>
                <input
                  type="text"
                  value={editFields.name || ''}
                  disabled={!isEditorOrAdmin}
                  onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                  className="px-3 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-white focus:outline-none focus:border-brand-purple/50 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400">Priority</label>
                  <select
                    value={editFields.priority || 'P2'}
                    disabled={!isEditorOrAdmin}
                    onChange={(e) => setEditFields({ ...editFields, priority: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-white focus:outline-none focus:border-brand-purple/50 disabled:opacity-50"
                  >
                    <option value="P1">P1 - Committed</option>
                    <option value="P2">P2 - Planned</option>
                    <option value="P3">P3 - Backlog</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400">Status</label>
                  <input
                    type="text"
                    value={editFields.status || ''}
                    disabled={!isEditorOrAdmin}
                    onChange={(e) => setEditFields({ ...editFields, status: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-white focus:outline-none focus:border-brand-purple/50 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400">Horizon</label>
                  <input
                    type="text"
                    value={editFields.horizon || ''}
                    disabled={!isEditorOrAdmin}
                    onChange={(e) => setEditFields({ ...editFields, horizon: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-white focus:outline-none focus:border-brand-purple/50 disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400">Lead</label>
                  <input
                    type="text"
                    value={editFields.lead || ''}
                    disabled={!isEditorOrAdmin}
                    onChange={(e) => setEditFields({ ...editFields, lead: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-white focus:outline-none focus:border-brand-purple/50 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Notes</label>
                <textarea
                  value={editFields.notes || ''}
                  disabled={!isEditorOrAdmin}
                  onChange={(e) => setEditFields({ ...editFields, notes: e.target.value })}
                  rows={3}
                  className="px-3 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-white focus:outline-none focus:border-brand-purple/50 disabled:opacity-50 resize-none"
                />
              </div>
            </div>

            {/* Allocations Grid */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <h4 className="text-xs font-semibold text-brand-purple uppercase tracking-wider">Team Allocations (FTE per Month)</h4>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {people.filter(p => p.stream === selectedInit.stream).map(person => {
                  const personAlloc = editAllocations[person.id] || { Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0 };
                  const activeMonths = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                  return (
                    <div key={person.id} className="p-3 bg-gray-950/40 rounded-lg border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-white">{person.name}</span>
                        <span className="text-xs text-gray-400">{person.role}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {activeMonths.map(m => (
                          <div key={m} className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 mb-1">{m}</span>
                            <input
                              type="number"
                              min="0"
                              max="1"
                              step="0.1"
                              value={personAlloc[m] || 0}
                              disabled={!isEditorOrAdmin}
                              onChange={(e) => {
                                const val = parseFloat(parseFloat(e.target.value).toFixed(2)) || 0;
                                setEditAllocations({
                                  ...editAllocations,
                                  [person.id]: {
                                    ...personAlloc,
                                    [m]: val
                                  }
                                });
                              }}
                              className="w-12 text-center py-1 bg-gray-950 border border-white/5 rounded text-xs text-white disabled:opacity-50"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {isEditorOrAdmin && (
            <div className="pt-4 border-t border-white/5 mt-auto flex gap-4">
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-brand-purple hover:bg-brand-purple/90 transition-colors text-white font-medium rounded-xl flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Save className="w-5 h-5" />
                <span>Save Changes</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
