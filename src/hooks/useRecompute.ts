import { useMemo } from 'react';

export interface Stream {
  id: string;
  name: string;
  lead: string;
  capacityByMonth: Record<string, number>;
  baUFloorByMonth: Record<string, number>;
}

export interface Initiative {
  id: string;
  name: string;
  stream: string;
  priority: string;
  status: string;
  horizon: string;
  lead: string;
  notes?: string;
  dependencies?: Array<{ to: string; type: string }>;
}

export interface Allocation {
  id: string;
  personId: string;
  initiativeId: string;
  month: string;
  fte: number;
}

export interface Milestone {
  id: string;
  name: string;
  date: string;
  initiativeId: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  stream: string;
  isDelivery: boolean;
  fteFactor: number;
}

const getMonthName = (index: number): string => {
  const baseMonth = 7; // August
  const date = new Date(2026, baseMonth + index, 1);
  return date.toLocaleString('default', { month: 'short' });
};

export const useRecompute = (
  streams: Stream[],
  initiatives: Initiative[],
  allocations: Allocation[],
  milestones: Milestone[],
  people: Person[]
) => {
  return useMemo(() => {
    // 1. Calculate Utilisation and Headroom per Stream per Month (Aug-Dec 2026)
    const activeMonths = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const streamUtilisation: Record<string, Record<string, number>> = {};
    const streamHeadroom: Record<string, Record<string, number>> = {};

    streams.forEach(s => {
      streamUtilisation[s.id] = {};
      streamHeadroom[s.id] = {};
      activeMonths.forEach(m => {
        streamUtilisation[s.id][m] = 0;
      });
    });

    // Map initiative ID to stream ID
    const initToStream: Record<string, string> = {};
    initiatives.forEach(init => {
      initToStream[init.id] = init.stream;
    });

    // Map person ID to isDelivery flag
    const personIsDelivery: Record<string, boolean> = {};
    people.forEach(p => {
      personIsDelivery[p.id] = p.isDelivery;
    });

    // Aggregate allocations
    allocations.forEach(alloc => {
      const streamId = initToStream[alloc.initiativeId];
      const isDelivery = personIsDelivery[alloc.personId] !== false; // default to true if person not found
      if (streamId && streamUtilisation[streamId] && activeMonths.includes(alloc.month) && isDelivery) {
        streamUtilisation[streamId][alloc.month] += alloc.fte;
      }
    });

    // Compute headroom
    streams.forEach(s => {
      activeMonths.forEach(m => {
        const capacity = s.capacityByMonth[m] || 0;
        const utilisation = streamUtilisation[s.id][m];
        streamHeadroom[s.id][m] = parseFloat((capacity - utilisation).toFixed(2));
      });
    });

    // 2. Determine RAG status for each initiative
    const initiativeRAG: Record<string, 'green' | 'amber' | 'red'> = {};
    initiatives.forEach(init => {
      const streamId = init.stream;
      
      // Default color logic
      if (init.priority === 'P3' || init.status.toLowerCase().includes('deferred') || init.status.toLowerCase().includes('unscheduled')) {
        initiativeRAG[init.id] = 'amber'; // Planned / Deferred
      } else {
        // Committed (P1/P2)
        // Check if any month in which this initiative has allocations goes over capacity
        const hasOverCapacityMonth = allocations
          .filter(a => a.initiativeId === init.id && activeMonths.includes(a.month))
          .some(a => (streamHeadroom[streamId]?.[a.month] || 0) < 0);

        if (hasOverCapacityMonth || init.status.toLowerCase().includes('conflict')) {
          initiativeRAG[init.id] = 'red';
        } else {
          initiativeRAG[init.id] = 'green';
        }
      }
    });

    // 3. Compute Critical Path (topological sort over dependencies)
    // We map months: Aug 2026 is index 0.
    // Init active months duration is computed from allocations.
    const initDuration: Record<string, number> = {};
    initiatives.forEach(init => {
      // Find all unique months where this initiative has allocations > 0
      const activeAllocMonths = allocations
        .filter(a => a.initiativeId === init.id && a.fte > 0)
        .map(a => a.month);
      
      initDuration[init.id] = Math.max(1, new Set(activeAllocMonths).size); // default to at least 1 month if not allocated but in plan
      if (init.priority === 'P3' || init.status.toLowerCase().includes('deferred') || init.status.toLowerCase().includes('unscheduled')) {
        initDuration[init.id] = 0; // Deferred/Backlog initiatives take 0 duration
      }
    });

    // Adjacency lists for dependency graph
    // A depends on B means B -> A (B must finish before A starts)
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    initiatives.forEach(init => {
      adj[init.id] = [];
      inDegree[init.id] = 0;
    });

    initiatives.forEach(init => {
      const deps = init.dependencies || [];
      deps.forEach(d => {
        // d.to is the prerequisite initiative ID
        if (adj[d.to]) {
          adj[d.to].push(init.id);
          inDegree[init.id]++;
        }
      });
    });

    // Calculate Earliest Start Month for each initiative
    const earliestStart: Record<string, number> = {};
    const earliestEnd: Record<string, number> = {};
    
    // Initialize
    initiatives.forEach(init => {
      earliestStart[init.id] = 0; // Start at Aug 2026 (index 0)
      earliestEnd[init.id] = initDuration[init.id];
    });

    // Queue for topological sort
    const queue: string[] = [];
    initiatives.forEach(init => {
      if (inDegree[init.id] === 0) {
        queue.push(init.id);
      }
    });

    const topoOrder: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      topoOrder.push(u);

      adj[u].forEach(v => {
        earliestStart[v] = Math.max(earliestStart[v], earliestEnd[u]);
        earliestEnd[v] = earliestStart[v] + initDuration[v];
        
        inDegree[v]--;
        if (inDegree[v] === 0) {
          queue.push(v);
        }
      });
    }

    // Critical Path is the longest dependency chain
    // Find the end date of the longest chain
    let maxEnd = 0;
    let criticalEndNode = '';
    
    topoOrder.forEach(u => {
      if (earliestEnd[u] > maxEnd) {
        maxEnd = earliestEnd[u];
        criticalEndNode = u;
      }
    });

    // Trace back critical path chain
    const criticalChain: string[] = [];
    let current = criticalEndNode;
    while (current) {
      criticalChain.unshift(current);
      // Find prerequisite that ends at current's start time
      const deps = initiatives.find(i => i.id === current)?.dependencies || [];
      const parent = deps.find(d => earliestEnd[d.to] === earliestStart[current]);
      current = parent ? parent.to : '';
    }

    // Map indices to dates for critical path display
    const dates: Record<string, string> = {};
    initiatives.forEach(init => {
      if (initDuration[init.id] > 0) {
        const startOffset = earliestStart[init.id];
        const endOffset = earliestEnd[init.id];
        
        const startMonthName = getMonthName(startOffset);
        const endMonthName = getMonthName(endOffset - 1);
        
        dates[init.id] = `${startMonthName} 2026 -> ${endMonthName} 2026`;
      } else {
        dates[init.id] = "Deferred";
      }
    });

    // Calculate project span string
    const projectSpan = `Aug 2026 → ${getMonthName(maxEnd - 1)} 2026 (~${maxEnd} months)`;

    return {
      utilisation: streamUtilisation,
      headroom: streamHeadroom,
      initiativeRAG,
      criticalPath: {
        chain: criticalChain,
        span: projectSpan,
        dates
      }
    };
  }, [streams, initiatives, allocations, milestones, people]);
};
