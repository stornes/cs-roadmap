import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position
} from 'reactflow';
import type { Connection, Edge, Node, NodeProps } from 'reactflow';
import 'reactflow/dist/style.css';
import { db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Check } from 'lucide-react';

interface RealityTreeCanvasProps {
  cycleId: string;
  kind: 'CRT' | 'FRT';
  userRole: string;
  onAddAuditLog: (action: string, details: any) => Promise<void>;
}

// Custom Node component
const CustomTreeNode: React.FC<NodeProps> = ({ data }) => {
  const isAnd = data.type === 'and';
  
  const getNodeStyles = () => {
    if (isAnd) return 'w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center font-bold text-white text-lg shadow-lg';
    
    switch (data.type) {
      // CRT types
      case 'root_cause': return 'bg-[#180f1e] border-2 border-purple-800 text-purple-200';
      case 'contributing_effect': return 'bg-[#1e130f] border-2 border-orange-800 text-orange-200';
      case 'undesirable_effect': return 'bg-[#1a0f12] border-2 border-rose-800 text-rose-200';
      case 'core_problem': return 'bg-[#2a0c13] border-2 border-red-500 shadow-md shadow-red-500/20 text-red-100 font-bold';
      
      // FRT types
      case 'injection': return 'bg-[#0f152a] border-2 border-indigo-700 text-indigo-200';
      case 'effect': return 'bg-[#0f1d1c] border-2 border-teal-700 text-teal-200';
      case 'desired_effect': return 'bg-[#0e2d1d] border-2 border-emerald-500 shadow-md shadow-emerald-500/20 text-emerald-100 font-bold';
      
      default: return 'bg-gray-900 border-2 border-gray-700 text-gray-200';
    }
  };

  return (
    <div className={`${getNodeStyles()} px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium tracking-wide max-w-[200px] break-words text-center min-w-[120px]`}>
      {/* Target handle (causes point here) */}
      <Handle type="target" position={Position.Bottom} className="w-2 h-2 !bg-gray-500 border border-gray-700" />
      
      {isAnd ? '+' : data.label}
      
      {/* Source handle (outbound cause) */}
      <Handle type="source" position={Position.Top} className="w-2 h-2 !bg-gray-500 border border-gray-700" />
    </div>
  );
};

export const RealityTreeCanvas: React.FC<RealityTreeCanvasProps> = ({
  cycleId,
  kind,
  userRole,
  onAddAuditLog
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Node editor modal/panel state
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState('effect');
  
  const isEditorOrAdmin = userRole === 'editor' || userRole === 'admin';
  const nodeTypes = useMemo(() => ({ customNode: CustomTreeNode }), []);

  // Fetch graph data from Firestore
  useEffect(() => {
    const fetchGraph = async () => {
      const docRef = doc(db, 'trees', kind);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const firestoreNodes = (data.nodes || []).map((n: any) => ({
          id: n.id,
          type: 'customNode',
          position: { x: n.x, y: n.y },
          data: { label: n.label, type: n.type }
        }));
        
        const firestoreEdges = (data.edges || []).map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          animated: true
        }));

        setNodes(firestoreNodes);
        setEdges(firestoreEdges);
      }
    };
    fetchGraph();
  }, [kind, cycleId, setNodes, setEdges]);

  // Save changes to Firestore
  const saveGraph = async (newNodes: Node[], newEdges: Edge[]) => {
    if (!isEditorOrAdmin) return;
    try {
      const docRef = doc(db, 'trees', kind);
      
      const firestoreNodes = newNodes.map(n => ({
        id: n.id,
        label: n.data.label || '',
        type: n.data.type || 'effect',
        x: n.position.x,
        y: n.position.y
      }));

      const firestoreEdges = newEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target
      }));

      await updateDoc(docRef, {
        nodes: firestoreNodes,
        edges: firestoreEdges
      });
    } catch (err) {
      console.error("Error saving tree:", err);
    }
  };

  // Node Drag Stop handler
  const handleNodeDragStop = useCallback((_: any, node: Node) => {
    setNodes(nds => {
      const updated = nds.map(n => (n.id === node.id ? node : n));
      saveGraph(updated, edges);
      return updated;
    });
  }, [edges, setNodes]);

  // Connection/Edge drawing handler
  const onConnect = useCallback((connection: Connection) => {
    if (!isEditorOrAdmin) return;
    setEdges(eds => {
      const updated = addEdge({ ...connection, animated: true }, eds);
      saveGraph(nodes, updated);
      onAddAuditLog('tree_edge_create', { kind, from: connection.source, to: connection.target });
      return updated;
    });
  }, [nodes, isEditorOrAdmin, kind, setEdges, onAddAuditLog]);

  // Click node to open edit panel
  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
    setEditLabel(node.data.label || '');
    setEditType(node.data.type || 'effect');
  }, []);

  // Update node label/type
  const handleUpdateNode = () => {
    if (!selectedNodeId || !isEditorOrAdmin) return;
    
    setNodes(nds => {
      const updated = nds.map(n => {
        if (n.id === selectedNodeId) {
          return {
            ...n,
            data: { ...n.data, label: editLabel, type: editType }
          };
        }
        return n;
      });
      saveGraph(updated, edges);
      onAddAuditLog('tree_node_update', { kind, nodeId: selectedNodeId, label: editLabel, type: editType });
      return updated;
    });
    setSelectedNodeId(null);
  };

  // Delete node & connected edges
  const handleDeleteNode = () => {
    if (!selectedNodeId || !isEditorOrAdmin) return;

    setNodes(nds => {
      const updatedNodes = nds.filter(n => n.id !== selectedNodeId);
      setEdges(eds => {
        const updatedEdges = eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);
        saveGraph(updatedNodes, updatedEdges);
        return updatedEdges;
      });
      onAddAuditLog('tree_node_delete', { kind, nodeId: selectedNodeId });
      return updatedNodes;
    });
    setSelectedNodeId(null);
  };

  // Add a new node
  const handleAddNode = () => {
    if (!isEditorOrAdmin) return;
    
    const id = `node_${Date.now()}`;
    const defaultLabel = kind === 'CRT' ? 'New Cause/Effect' : 'New Injection/Outcome';
    const defaultType = kind === 'CRT' ? 'undesirable_effect' : 'effect';
    
    const newNode: Node = {
      id,
      type: 'customNode',
      position: { x: 300, y: 300 },
      data: { label: defaultLabel, type: defaultType }
    };

    setNodes(nds => {
      const updated = [...nds, newNode];
      saveGraph(updated, edges);
      onAddAuditLog('tree_node_create', { kind, nodeId: id, label: defaultLabel, type: defaultType });
      return updated;
    });
  };

  // Add AND junction
  const handleAddAndJunction = () => {
    if (!isEditorOrAdmin) return;
    
    const id = `and_${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'customNode',
      position: { x: 300, y: 300 },
      data: { label: '+', type: 'and' }
    };

    setNodes(nds => {
      const updated = [...nds, newNode];
      saveGraph(updated, edges);
      onAddAuditLog('tree_node_create', { kind, nodeId: id, label: '+', type: 'and' });
      return updated;
    });
  };

  return (
    <div className="flex h-full w-full gap-6 relative">
      {/* React Flow Viewport */}
      <div className="flex-1 h-full rounded-xl overflow-hidden glass border border-white/5 relative">
        {isEditorOrAdmin && (
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            <button
              onClick={handleAddNode}
              className="py-2 px-3 bg-gray-900 border border-white/10 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 hover:bg-gray-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Node</span>
            </button>
            {kind === 'FRT' && (
              <button
                onClick={handleAddAndJunction}
                className="py-2 px-3 bg-gray-900 border border-white/10 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 hover:bg-gray-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add AND-Junction</span>
              </button>
            )}
          </div>
        )}

        <div className="w-full h-full" style={{ height: 'calc(100vh - 220px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={isEditorOrAdmin ? onNodesChange : undefined}
            onEdgesChange={isEditorOrAdmin ? onEdgesChange : undefined}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onNodeDragStop={handleNodeDragStop}
            fitView
          >
            <Background color="#374151" gap={16} size={1} />
            <Controls className="!bg-slate-900 !border-slate-800 !text-white" />
            <MiniMap 
              nodeColor={() => '#1f2937'} 
              maskColor="rgba(17, 24, 39, 0.4)" 
              className="!bg-slate-950/60 !border-white/5 rounded-lg overflow-hidden" 
            />
          </ReactFlow>
        </div>
      </div>

      {/* Selected Node Panel */}
      {selectedNodeId && (
        <div className="w-[320px] glass border border-white/10 p-5 flex flex-col rounded-xl shadow-2xl h-fit z-20 animate-in slide-in-from-right duration-250">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
            <h3 className="font-display font-semibold text-white">Node Properties</h3>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-xs text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="space-y-4">
            {editType !== 'and' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Label</label>
                <textarea
                  value={editLabel}
                  disabled={!isEditorOrAdmin}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-white focus:outline-none resize-none"
                  rows={3}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400">Node Type</label>
              <select
                value={editType}
                disabled={!isEditorOrAdmin}
                onChange={(e) => setEditType(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-white/5 rounded-lg text-sm text-white focus:outline-none"
              >
                {kind === 'CRT' ? (
                  <>
                    <option value="root_cause">Root Cause (Burgundy)</option>
                    <option value="contributing_effect">Contributing Effect (Orange)</option>
                    <option value="undesirable_effect">Undesirable Effect (Rose)</option>
                    <option value="core_problem">Core Problem (Glowing Red)</option>
                  </>
                ) : (
                  <>
                    <option value="injection">Injection (Indigo)</option>
                    <option value="effect">Effect (Teal)</option>
                    <option value="desired_effect">Desired Effect (Glowing Green)</option>
                    <option value="and">AND-Junction (+)</option>
                  </>
                )}
              </select>
            </div>

            {isEditorOrAdmin && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDeleteNode}
                  className="flex-1 py-2 bg-red-950/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-900/20 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={handleUpdateNode}
                  className="flex-1 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
