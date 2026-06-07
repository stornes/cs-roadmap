import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  addDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { GoogleSignIn } from './components/GoogleSignIn';
import { RoadmapGrid } from './components/RoadmapGrid';
import { RealityTreeCanvas } from './components/RealityTreeCanvas';
import { AICopilot } from './components/AICopilot';
import { DocumentManager } from './components/DocumentManager';
import { CriticalPathTab } from './components/CriticalPathTab';
import { useRecompute } from './hooks/useRecompute';
import type { Stream, Initiative, Allocation, Milestone } from './hooks/useRecompute';
import { 
  LogOut, 
  Clock, 
  Trash2, 
  Sparkles
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [authLoading, setAuthLoading] = useState(true);

  // Firestore collections state
  const [streams, setStreams] = useState<Stream[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [cycleMeta, setCycleMeta] = useState<any>(null);

  // Active navigation state
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [realityTreeKind, setRealityTreeKind] = useState<'CRT' | 'FRT'>('CRT');
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);

  // Reset viewport scroll on tab switch
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Synchronize URL hash with activeTab
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      const validTabs = ['overview', 'streams', 'critical-path', 'roadmap', 'backlog', 'capacity', 'swimlanes', 'conflicts', 'trees', 'documents', 'logs'];
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Conflict creation state
  const [newConflictTitle, setNewConflictTitle] = useState('');
  const [newConflictTension, setNewConflictTension] = useState('Medium');
  const [newConflictRec, setNewConflictRec] = useState('');
  const [newConflictOwner, setNewConflictOwner] = useState('');

  const activeMonths = ["Aug", "Sep", "Oct", "Nov", "Dec"];

  // 1. Authenticate user and fetch role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const email = user.email || '';
        const isOwner = email === 'stornes@gmail.com';

        try {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role || 'viewer');
          } else if (isOwner) {
            setUserRole('admin');
          } else {
            setUserRole('viewer');
          }
        } catch (err) {
          console.error("Error getting user role:", err);
          setUserRole(isOwner ? 'admin' : 'viewer');
        }
      } else {
        setCurrentUser(null);
        setUserRole('viewer');
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // 2. Setup real-time Firestore listeners for H2 2026 cycle
  useEffect(() => {
    if (!currentUser) return;

    const cycleId = "2026-H2";

    // Cycle Metadata
    const unsubCycle = onSnapshot(doc(db, "cycles", cycleId), (doc) => {
      if (doc.exists()) setCycleMeta(doc.data());
    });

    // Streams
    const unsubStreams = onSnapshot(
      query(collection(db, "streams"), where("cycleId", "==", cycleId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Stream));
        setStreams(list.sort((a, b) => (a.id > b.id ? 1 : -1)));
      }
    );

    // Initiatives
    const unsubInitiatives = onSnapshot(
      query(collection(db, "initiatives"), where("cycleId", "==", cycleId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Initiative));
        setInitiatives(list);
      }
    );

    // Allocations
    const unsubAllocations = onSnapshot(
      query(collection(db, "allocations"), where("cycleId", "==", cycleId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Allocation));
        setAllocations(list);
      }
    );

    // People
    const unsubPeople = onSnapshot(
      query(collection(db, "people"), where("cycleId", "==", cycleId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPeople(list);
      }
    );

    // Conflicts
    const unsubConflicts = onSnapshot(
      query(collection(db, "conflicts"), where("cycleId", "==", cycleId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setConflicts(list);
      }
    );

    // Milestones
    const unsubMilestones = onSnapshot(
      query(collection(db, "milestones"), where("cycleId", "==", cycleId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone));
        setMilestones(list);
      }
    );

    // Audit Logs
    const unsubLogs = onSnapshot(
      query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(30)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAuditLogs(list);
      }
    );

    return () => {
      unsubCycle();
      unsubStreams();
      unsubInitiatives();
      unsubAllocations();
      unsubPeople();
      unsubConflicts();
      unsubMilestones();
      unsubLogs();
    };
  }, [currentUser]);

  // 3. Perform live computations (RAG, Headroom, Critical Path)
  const recomputeData = useRecompute(streams, initiatives, allocations, milestones, people);

  // 4. Mutation handlers with audit logs
  const handleAddAuditLog = async (action: string, details: any) => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        userId: auth.currentUser?.uid || 'anonymous',
        userName: auth.currentUser?.displayName || 'Anonymous',
        action,
        timestamp: serverTimestamp(),
        details
      });
    } catch (err) {
      console.error("Failed to write audit log:", err);
    }
  };

  const handleCreateInitiative = async (newInit: Omit<Initiative, 'id'>) => {
    try {
      let index = initiatives.length + 1;
      let newId = `H2-${String(index).padStart(2, '0')}`;
      while (initiatives.some(i => i.id === newId)) {
        index++;
        newId = `H2-${String(index).padStart(2, '0')}`;
      }
      const docRef = doc(db, 'initiatives', newId);
      await setDoc(docRef, {
        ...newInit,
        cycleId: '2026-H2'
      });
      await handleAddAuditLog('initiative_create', { id: newId, name: newInit.name });
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleUpdateInitiative = async (id: string, updatedFields: Partial<Initiative>) => {
    try {
      const docRef = doc(db, 'initiatives', id);
      await updateDoc(docRef, updatedFields);
      await handleAddAuditLog('initiative_update', { id, ...updatedFields });
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleDeleteInitiative = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'initiatives', id));
      
      const batch = writeBatch(db);
      allocations
        .filter(a => a.initiativeId === id)
        .forEach(a => {
          batch.delete(doc(db, 'allocations', a.id));
        });
      await batch.commit();

      await handleAddAuditLog('initiative_delete', { id });
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleUpdateAllocations = async (initiativeId: string, updatedAllocations: Record<string, Record<string, number>>) => {
    try {
      const batch = writeBatch(db);
      for (const personId of Object.keys(updatedAllocations)) {
        for (const month of Object.keys(updatedAllocations[personId])) {
          const fte = updatedAllocations[personId][month];
          const allocId = `${personId}_${initiativeId}_${month}`;
          const docRef = doc(db, 'allocations', allocId);
          if (fte <= 0) {
            batch.delete(docRef);
          } else {
            batch.set(docRef, {
              cycleId: '2026-H2',
              personId,
              initiativeId,
              month,
              fte
            });
          }
        }
      }
      await batch.commit();
      await handleAddAuditLog('allocations_update', { initiativeId });
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleAddConflict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConflictTitle.trim()) return;

    try {
      const id = String(Date.now());
      await setDoc(doc(db, 'conflicts', id), {
        cycleId: '2026-H2',
        title: newConflictTitle,
        tension: newConflictTension,
        recommendation: newConflictRec,
        owner: newConflictOwner,
        status: 'active'
      });

      setNewConflictTitle('');
      setNewConflictRec('');
      setNewConflictOwner('');
      await handleAddAuditLog('conflict_create', { title: newConflictTitle });
    } catch (err) {
      console.error(err);
      alert('Failed to log conflict.');
    }
  };

  const handleResolveConflict = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'resolved' ? 'active' : 'resolved';
      await updateDoc(doc(db, 'conflicts', id), { status: newStatus });
      await handleAddAuditLog('conflict_status_update', { id, status: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConflict = async (id: string) => {
    if (confirm('Delete this conflict logs entry?')) {
      try {
        await deleteDoc(doc(db, 'conflicts', id));
        await handleAddAuditLog('conflict_delete', { id });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070913]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm font-medium">Securing Hurtigruten Environment...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <GoogleSignIn onSignInSuccess={(user, role) => {
      setCurrentUser(user);
      setUserRole(role);
    }} />;
  }

  // Count active overloads
  let overloadCount = 0;
  streams.forEach(s => {
    activeMonths.forEach(m => {
      if ((recomputeData.headroom[s.id]?.[m] || 0) < 0) {
        overloadCount++;
      }
    });
  });

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070913] text-gray-200 overflow-hidden">
      {/* Top Menu Bar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-40">
        <div className="flex items-center space-x-8 h-full">
          {/* Logo / Title */}
          <span className="text-slate-900 font-bold text-base whitespace-nowrap">
            CS Roadmap H2 2026
          </span>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-6 h-full">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'streams', label: 'Streams' },
              { id: 'critical-path', label: 'Critical path' },
              { id: 'roadmap', label: 'Roadmap' },
              { id: 'backlog', label: 'Backlog' },
              { id: 'capacity', label: 'Utilisation' },
              { id: 'swimlanes', label: 'Resources' },
              { id: 'conflicts', label: 'Conflicts' },
              { id: 'trees', label: 'Reality Trees' },
              { id: 'documents', label: 'Documents' },
              { id: 'logs', label: 'Audit Logs' }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    window.location.hash = `#/${tab.id}`;
                  }}
                  className={`h-full px-1 flex items-center text-sm font-medium transition-all relative cursor-pointer ${
                    isActive 
                      ? 'text-blue-600 font-semibold' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-t" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right side: User card */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-200 shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center font-bold text-xs text-blue-600 border border-blue-100 shrink-0">
                {currentUser.displayName ? currentUser.displayName[0] : 'U'}
              </div>
            )}
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-slate-800 leading-tight">
                {currentUser.displayName || 'Developer'}
              </p>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {userRole}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Active Panel */}
        <main ref={mainRef} className="flex-1 p-8 overflow-y-auto min-h-0 relative">
            {activeTab === 'overview' && (
              <div className="space-y-8 max-w-5xl">
                {/* Cycle Meta Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-3xl font-display font-bold text-white tracking-tight">H2 2026 Planning Cycle</h1>
                    <p className="text-sm text-gray-400 mt-1 font-sans">
                      Status: <span className="text-emerald-400 font-semibold uppercase">{cycleMeta?.status || 'Active'}</span> • Principles: {cycleMeta?.principle || 'Dynamic Allocation'}
                    </p>
                  </div>
                </div>

                {/* Status Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Committed Initiatives</span>
                    <div className="flex items-baseline space-x-2 mt-2">
                      <span className="text-4xl font-display font-bold text-white">
                        {initiatives.filter(i => i.priority === 'P1').length}
                      </span>
                      <span className="text-xs text-gray-400">of {initiatives.length} total</span>
                    </div>
                  </div>

                  <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Active Resource Pool</span>
                    <div className="flex items-baseline space-x-2 mt-2">
                      <span className="text-4xl font-display font-bold text-white">{people.length}</span>
                      <span className="text-xs text-gray-400">Total FTEs</span>
                    </div>
                  </div>

                  <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Capacity Overloads</span>
                    <div className="flex items-baseline space-x-2 mt-2">
                      <span className={`text-4xl font-display font-bold ${overloadCount > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                        {overloadCount}
                      </span>
                      <span className="text-xs text-gray-400">hotspots detected</span>
                    </div>
                  </div>

                  <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Critical Path Span</span>
                    <div className="flex flex-col mt-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {recomputeData.criticalPath.span}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">Longest Dependency Chain</span>
                    </div>
                  </div>
                </div>

                {/* Critical Path Vis */}
                <div className="glass p-6 rounded-2xl border border-white/5 space-y-4 max-w-2xl">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <h3 className="font-display font-bold text-white text-base">Critical Path Chain</h3>
                    <Clock className="w-4 h-4 text-brand-purple" />
                  </div>
                  
                  {recomputeData.criticalPath.chain.length === 0 ? (
                    <p className="text-xs text-gray-500 py-6 text-center">No dependency chains or committed schedules found.</p>
                  ) : (
                    <div className="space-y-4">
                      {recomputeData.criticalPath.chain.map((initId, index) => {
                        const init = initiatives.find(i => i.id === initId);
                        const dateStr = recomputeData.criticalPath.dates[initId];
                        return (
                          <div key={initId} className="flex items-center space-x-3 relative">
                            {index > 0 && (
                              <div className="absolute left-3.5 top-[-20px] w-0.5 h-5 bg-brand-purple/40" />
                            )}
                            <div className="w-7.5 h-7.5 rounded-full bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center shrink-0 text-xs font-semibold text-brand-purple">
                              {index + 1}
                            </div>
                            <div className="flex-1 bg-gray-950/40 p-2.5 rounded-lg border border-white/5 flex justify-between items-center">
                              <div>
                                <span className="text-xs font-semibold text-white">{init?.name || initId}</span>
                                <span className="block text-[10px] text-gray-500 mt-0.5 font-sans">{init?.lead || 'Unassigned'}</span>
                              </div>
                              <span className="text-[10px] text-brand-purple font-mono font-medium">{dateStr}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'streams' && (
              <div className="space-y-6 max-w-5xl">
                <div>
                  <h1 className="text-2xl font-display font-bold text-white">Live Capacity Overviews</h1>
                  <p className="text-sm text-gray-400 mt-1 font-sans">Real-time resource utilisation and headroom per stream.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {streams.map(stream => (
                    <div key={stream.id} className="glass p-6 rounded-2xl border border-white/5 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <h3 className="font-display font-bold text-white text-base">{stream.name} Capacity</h3>
                        <span className="text-[10px] text-gray-400 font-semibold uppercase">Lead: {stream.lead}</span>
                      </div>

                      <div className="space-y-3">
                        {activeMonths.map(m => {
                          const cap = stream.capacityByMonth[m] || 0;
                          const util = recomputeData.utilisation[stream.id]?.[m] || 0;
                          const excess = cap - util;
                          const pct = cap > 0 ? Math.min(100, Math.round((util / cap) * 100)) : 0;
                          const isOver = excess < 0;

                          return (
                            <div key={m} className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-gray-300">{m}</span>
                                <span className={isOver ? 'text-rose-400 font-bold' : 'text-gray-400'}>
                                  {util.toFixed(1)} / {cap.toFixed(1)} FTE ({pct}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-white/5">
                                <div 
                                  className={`h-full rounded-full transition-all duration-350 ${
                                    isOver 
                                      ? 'bg-rose-500 shadow-sm shadow-rose-500/50' 
                                      : pct >= 90 
                                        ? 'bg-amber-500 shadow-sm shadow-amber-500/50' 
                                        : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                                  }`} 
                                  style={{ width: `${pct}%` }} 
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'backlog' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-display font-bold text-white">Backlog Initiatives</h1>
                  <p className="text-sm text-gray-400 mt-1 font-sans">Initiatives classified as P3 (Backlog) priority.</p>
                </div>
                <RoadmapGrid
                  streams={streams}
                  initiatives={initiatives.filter(i => i.priority === 'P3')}
                  allocations={allocations}
                  people={people}
                  initiativeRAG={recomputeData.initiativeRAG}
                  userRole={userRole}
                  onUpdateInitiative={handleUpdateInitiative}
                  onUpdateAllocations={handleUpdateAllocations}
                  onCreateInitiative={handleCreateInitiative}
                  onDeleteInitiative={handleDeleteInitiative}
                />
              </div>
            )}

            {activeTab === 'conflicts' && (
              <div className="space-y-6 max-w-5xl">
                <div>
                  <h1 className="text-2xl font-display font-bold text-white">Active Logged Conflicts</h1>
                  <p className="text-sm text-gray-400 mt-1 font-sans">Track and resolve resource constraints and scheduling overlaps.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  {/* Logged Conflicts List */}
                  <div className="md:col-span-2 glass p-6 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="font-display font-bold text-white text-base">Conflicts List</h3>
                    <div className="space-y-3">
                      {conflicts.length === 0 ? (
                        <p className="text-xs text-gray-500 py-6 text-center">No active conflicts logged.</p>
                      ) : (
                        conflicts.map(c => (
                          <div key={c.id} className={`p-4 rounded-xl border ${c.status === 'resolved' ? 'bg-emerald-950/10 border-emerald-500/20 opacity-50' : 'bg-gray-950/40 border-white/5'} flex justify-between items-start gap-4`}>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider uppercase ${
                                  c.tension === 'High' ? 'bg-red-950/40 text-red-400 border border-red-500/30' : 'bg-amber-950/40 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {c.tension}
                                </span>
                                <h4 className="text-xs font-semibold text-white">{c.title}</h4>
                              </div>
                              <p className="text-[11px] text-gray-400">Rec: {c.recommendation}</p>
                              <span className="block text-[10px] text-gray-500 font-sans">Owner: {c.owner || 'N/A'}</span>
                            </div>
                            {userRole !== 'viewer' && (
                              <div className="flex items-center space-x-1 shrink-0">
                                <button
                                  onClick={() => handleResolveConflict(c.id, c.status)}
                                  className={`px-2 py-1 border text-[10px] font-bold rounded cursor-pointer ${
                                    c.status === 'resolved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-gray-900 border-white/10 text-gray-400'
                                  }`}
                                >
                                  {c.status === 'resolved' ? 'Resolved' : 'Resolve'}
                                </button>
                                <button
                                  onClick={() => handleDeleteConflict(c.id)}
                                  className="p-1 hover:text-red-400 text-gray-600 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Log Conflict Logger Form */}
                  {userRole !== 'viewer' && (
                    <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
                      <h3 className="font-display font-bold text-white text-base">Log New Conflict</h3>
                      <form onSubmit={handleAddConflict} className="space-y-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400">Title</label>
                          <input
                            type="text"
                            required
                            value={newConflictTitle}
                            onChange={(e) => setNewConflictTitle(e.target.value)}
                            className="px-3 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-gray-400">Tension Level</label>
                            <select
                              value={newConflictTension}
                              onChange={(e) => setNewConflictTension(e.target.value)}
                              className="px-2 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-xs"
                            >
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-gray-400">Owner</label>
                            <input
                              type="text"
                              value={newConflictOwner}
                              onChange={(e) => setNewConflictOwner(e.target.value)}
                              className="px-3 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400">Recommendation / Action</label>
                          <textarea
                            value={newConflictRec}
                            onChange={(e) => setNewConflictRec(e.target.value)}
                            rows={2}
                            className="px-3 py-1.5 bg-gray-900 border border-white/5 rounded-lg text-xs resize-none"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-1.5 bg-brand-purple text-white font-semibold text-xs rounded-lg hover:bg-brand-purple/90"
                        >
                          Submit Conflict Entry
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )}

          {activeTab === 'roadmap' && (
            <RoadmapGrid
              streams={streams}
              initiatives={initiatives}
              allocations={allocations}
              people={people}
              initiativeRAG={recomputeData.initiativeRAG}
              userRole={userRole}
              onUpdateInitiative={handleUpdateInitiative}
              onUpdateAllocations={handleUpdateAllocations}
              onCreateInitiative={handleCreateInitiative}
              onDeleteInitiative={handleDeleteInitiative}
            />
          )}

          {activeTab === 'critical-path' && (
            <CriticalPathTab />
          )}

          {activeTab === 'capacity' && (
            <div className="space-y-6 max-w-5xl">
              <div>
                <h1 className="text-2xl font-display font-bold text-white">Monthly Stream Utilisation Matrix</h1>
                <p className="text-sm text-gray-400 mt-1">Aggregated FTE allocations against stream limits. Overloaded months highlighted.</p>
              </div>

              <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse text-sm text-gray-300">
                  <thead>
                    <tr className="bg-gray-950/40 border-b border-white/5 text-gray-400 font-semibold text-xs uppercase">
                      <th className="py-4 px-6">Stream</th>
                      {activeMonths.map(m => (
                        <th key={m} className="py-4 px-6 text-center">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {streams.map(stream => (
                      <tr key={stream.id} className="hover:bg-white/[0.01]">
                        <td className="py-4 px-6 font-semibold text-white">
                          <div>
                            <span>{stream.name}</span>
                            <span className="block text-[10px] text-gray-500 mt-0.5 font-normal">Lead: {stream.lead}</span>
                          </div>
                        </td>
                        {activeMonths.map(m => {
                          const cap = stream.capacityByMonth[m] || 0;
                          const util = recomputeData.utilisation[stream.id]?.[m] || 0;
                          const excess = cap - util;
                          const pct = cap > 0 ? Math.min(100, Math.round((util / cap) * 100)) : 0;
                          const isOver = excess < 0;

                          return (
                            <td key={m} className="py-4 px-6 text-center">
                              <div className={`mx-auto w-24 py-2 px-1 rounded-xl border flex flex-col items-center ${
                                isOver 
                                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-300 font-bold' 
                                  : pct >= 90
                                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-300 font-semibold'
                                    : 'bg-emerald-950/10 border-emerald-500/10 text-emerald-300'
                              }`}>
                                <span className="text-xs">{util.toFixed(1)} / {cap.toFixed(1)}</span>
                                <span className="text-[10px] opacity-75 mt-0.5">
                                  {isOver ? `Over: ${Math.abs(excess).toFixed(1)}` : `Left: ${excess.toFixed(1)}`}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'swimlanes' && (
            <div className="space-y-6 max-w-5xl">
              <div>
                <h1 className="text-2xl font-display font-bold text-white">Resource Swimlanes & Allocations</h1>
                <p className="text-sm text-gray-400 mt-1">Detailed month-by-month allocations per team member. Target limit is 1.0 FTE.</p>
              </div>

              <div className="space-y-6">
                {streams.map(stream => {
                  const streamPeople = people.filter(p => p.stream === stream.id);

                  return (
                    <div key={stream.id} className="glass p-6 rounded-2xl border border-white/5 space-y-4">
                      <h2 className="font-display font-bold text-white border-b border-white/5 pb-2 text-base">
                        {stream.name} Stream Pool
                      </h2>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs text-gray-300">
                          <thead>
                            <tr className="text-gray-500 font-semibold border-b border-white/5">
                              <th className="py-3 px-4 w-44">Team Member</th>
                              {activeMonths.map(m => (
                                <th key={m} className="py-3 px-4 w-52 text-center">{m}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {streamPeople.map(person => {
                              // Get user allocations month-by-month
                              const personAllocs = allocations.filter(a => a.personId === person.id);

                              return (
                                <tr key={person.id} className="hover:bg-white/[0.01]">
                                  <td className="py-3 px-4 font-medium text-white">
                                    <div>
                                      <span>{person.name}</span>
                                      <span className="block text-[9px] text-gray-500 mt-0.5">{person.role} • FTE: {person.fteFactor}</span>
                                    </div>
                                  </td>
                                  {activeMonths.map(m => {
                                    const allocsForMonth = personAllocs.filter(a => a.month === m);
                                    const totalFte = allocsForMonth.reduce((acc, current) => acc + current.fte, 0);
                                    const isOver = totalFte > person.fteFactor;
                                    const isIdle = totalFte === 0;

                                    return (
                                      <td key={m} className="py-3 px-4 text-center">
                                        <div className="flex flex-col gap-1.5 justify-center items-center">
                                          {allocsForMonth.map(a => {
                                            const init = initiatives.find(i => i.id === a.initiativeId);
                                            return (
                                              <span key={a.id} className="inline-block px-2 py-0.5 bg-gray-900 border border-white/5 rounded text-[10px] truncate max-w-[160px] text-gray-300">
                                                {init?.name || a.initiativeId}: {a.fte.toFixed(1)} FTE
                                              </span>
                                            );
                                          })}
                                          <span className={`text-[10px] font-semibold ${
                                            isOver 
                                              ? 'text-rose-400 font-bold' 
                                              : isIdle 
                                                ? 'text-amber-400' 
                                                : 'text-emerald-400'
                                          }`}>
                                            Total: {totalFte.toFixed(1)} FTE
                                          </span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'trees' && (
            <div className="flex flex-col h-full gap-4 relative">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h1 className="text-2xl font-display font-bold text-white">Reality Trees Canvas Diagram</h1>
                  <p className="text-sm text-gray-400 mt-1">
                    Map underlying issues in the Current Reality Tree or project injections in the Future Reality Tree.
                  </p>
                </div>
                <div className="flex border border-white/10 rounded-lg overflow-hidden bg-gray-950/60 p-1">
                  <button
                    onClick={() => setRealityTreeKind('CRT')}
                    className={`py-1.5 px-4 rounded text-xs font-semibold cursor-pointer ${
                      realityTreeKind === 'CRT' ? 'bg-brand-purple text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Current Reality (CRT)
                  </button>
                  <button
                    onClick={() => setRealityTreeKind('FRT')}
                    className={`py-1.5 px-4 rounded text-xs font-semibold cursor-pointer ${
                      realityTreeKind === 'FRT' ? 'bg-brand-purple text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Future Reality (FRT)
                  </button>
                </div>
              </div>

              <div className="flex-1 h-full w-full relative" style={{ height: 'calc(100vh - 220px)' }}>
                <RealityTreeCanvas
                  cycleId="2026-H2"
                  kind={realityTreeKind}
                  userRole={userRole}
                  onAddAuditLog={handleAddAuditLog}
                />
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6 max-w-5xl">
              <div>
                <h1 className="text-2xl font-display font-bold text-white">Audit Logs Log</h1>
                <p className="text-sm text-gray-400 mt-1">Real-time trace of mutations across initiatives, allocations, and trees.</p>
              </div>

              <div className="glass rounded-2xl border border-white/5 p-6 space-y-4 max-h-[600px] overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">No logs logged yet in this cycles session.</p>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map(log => {
                      const dateStr = log.timestamp?.seconds 
                        ? new Date(log.timestamp.seconds * 1000).toLocaleString() 
                        : 'Pending...';
                      
                      return (
                        <div key={log.id} className="flex items-start space-x-4 border-b border-white/5 pb-3 last:border-b-0 text-xs">
                          <div className="w-8 h-8 rounded-full bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-brand-purple" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium">
                              <span className="font-semibold text-brand-purple">{log.userName}</span> performed <span className="font-semibold text-white uppercase">{log.action}</span>
                            </p>
                            <span className="block text-gray-400 mt-1 text-[10px] leading-relaxed">
                              Details: {JSON.stringify(log.details)}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500 shrink-0 mt-0.5">{dateStr}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <DocumentManager
              userRole={userRole}
              initiatives={initiatives}
              onAddAuditLog={handleAddAuditLog}
            />
          )}
      </main>

        {/* AI Copilot Sidepanel */}
        {isCopilotOpen && (
          <AICopilot
            streams={streams}
            initiatives={initiatives}
            allocations={allocations}
            people={people}
            conflicts={conflicts}
            milestones={milestones}
            recomputeData={recomputeData}
            onClose={() => setIsCopilotOpen(false)}
          />
        )}

        {/* Floating Copilot Toggle Button (visible when closed) */}
        {!isCopilotOpen && (
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="fixed bottom-6 right-6 p-4 rounded-full bg-gradient-to-r from-brand-purple to-brand-blue hover:opacity-95 shadow-xl text-white flex items-center justify-center space-x-2 transition-all hover:scale-105 z-40 cursor-pointer border border-brand-purple/30"
            title="Open AI Copilot"
          >
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
            <span className="text-xs font-semibold">AI Copilot</span>
          </button>
        )}
      </div>
    </div>
  );
}
