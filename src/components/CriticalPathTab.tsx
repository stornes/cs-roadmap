import React, { useState } from 'react';
import { Clock, Info, ShieldAlert } from 'lucide-react';

interface TimelineItem {
  id: string;
  name: string;
  category: 'holiday' | 'critical' | 'co-critical' | 'float';
  startMonth: number; // 0 = Jul 26, 12 = Jul 27
  durationMonths: number;
  color: 'red' | 'blue' | 'gray';
  isMilestone?: boolean;
  confluenceId?: string;
  desc: string;
  goal?: string;
  success?: string;
  teams?: string;
  timeline?: string;
  dependency?: string;
}

export const CriticalPathTab: React.FC = () => {
  const [hoveredItem, setHoveredItem] = useState<TimelineItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; isMilestone?: boolean } | null>(null);

  const handleMouseEnter = (item: TimelineItem, e: React.MouseEvent<HTMLDivElement>) => {
    setHoveredItem(item);
    const rect = e.currentTarget.getBoundingClientRect();
    const container = document.getElementById('gantt-chart-container');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const posX = rect.left - containerRect.left + rect.width / 2;
      const posY = rect.top - containerRect.top;
      console.log("TOOLTIP CALC:", { id: item.id, posX, posY, rectLeft: rect.left, containerLeft: containerRect.left, rectTop: rect.top, containerTop: containerRect.top });
      setTooltipPos({
        x: posX,
        y: posY,
        isMilestone: item.isMilestone
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    setTooltipPos(null);
  };

  const months = [
    { name: 'Jul 26', label: 'July 2026' },
    { name: 'Aug 26', label: 'August 2026' },
    { name: 'Sep 26', label: 'September 2026' },
    { name: 'Oct 26', label: 'October 2026' },
    { name: 'Nov 26', label: 'November 2026' },
    { name: 'Dec 26', label: 'December 2026' },
    { name: 'Jan 27', label: 'January 2027' },
    { name: 'Feb 27', label: 'February 2027' },
    { name: 'Mar 27', label: 'March 2027' },
    { name: 'Apr 27', label: 'April 2027' },
    { name: 'May 27', label: 'May 2027' },
    { name: 'Jun 27', label: 'June 2027' },
    { name: 'Jul 27', label: 'July 2027' }
  ];

  const items: TimelineItem[] = [
    // 1. Holiday
    {
      id: 'norway-holiday',
      name: 'July - no activity (holiday)',
      category: 'holiday',
      startMonth: 0,
      durationMonths: 1,
      color: 'gray',
      desc: 'July is a Norwegian holiday month. Delivery is paused; the plan starts in August.'
    },
    // 2. Critical Path - Person Data
    {
      id: 'H2-11',
      name: 'ARM - PG to SF (H2-11)',
      category: 'critical',
      confluenceId: 'CS-26-H2-11',
      startMonth: 1,
      durationMonths: 2.1,
      color: 'red',
      desc: 'Salesforce integration that synchronises customer profile data from PG (Polar Global) to Salesforce Person Accounts.',
      goal: 'By the end of Q3 2026, the PG-to-Salesforce Person Account integration synchronises customer profile data reliably under the ARM (Account Read Model) pattern, with measured data freshness and zero divergence between PG and SF on in-scope profile fields.',
      success: 'PG-to-SF profile sync running with the documented freshness SLO; profile-field divergence reported and trending toward zero on in-scope fields; the integration supports CS-26H2-01 ownership transfer as the read-model substrate.',
      teams: 'SF Core: 1 (Pawel), Backend: 1',
      timeline: 'Q1-Q3 2026',
      dependency: 'None'
    },
    {
      id: 'H2-25',
      name: 'Dedupe - SF master (H2-25)',
      category: 'critical',
      confluenceId: 'CS-26-H2-25',
      startMonth: 3.1,
      durationMonths: 2.4,
      color: 'red',
      desc: 'Establish SF as the master for all person data across Hurtigruten by eliminating duplicate and inconsistent customer records created across PG, Salesforce and downstream systems',
      goal: 'By the end of Q3 2026, Salesforce will be the master for all person data across Hurtigruten, with all other systems recognising SF as the authoritative source for the in-scope dataset.',
      success: 'SF declared the master for person data in scope; dedup engine running in SF; duplicate rate falling week over week to below the agreed threshold; SQSF-5303 closed; cross-link with CS-26H2-01 partner data ownership transition aligned on sequencing.',
      teams: 'SF Core: 2, Backend: 1',
      timeline: 'Q3',
      dependency: 'Post: CS-26H2-01 Partner data ownership'
    },
    {
      id: 'milestone-person-ready',
      name: 'Person model ready',
      category: 'critical',
      startMonth: 5.5,
      durationMonths: 0,
      color: 'blue',
      isMilestone: true,
      desc: 'Milestone: Person model ready (mid-December 2026) immediately following Dedupe completion.'
    },
    {
      id: 'H2-01',
      name: 'B2B partner data ownership (H2-01)',
      category: 'critical',
      confluenceId: 'CS-26H2-01',
      startMonth: 6,
      durationMonths: 2.7,
      color: 'red',
      desc: 'Move ownership of B2B partner data from PG to Salesforce, so Salesforce becomes the system of record, including onboarding, maintenance and offboarding processes',
      goal: 'Salesforce becomes the system of record for B2B partner data, all markets, by Q4 2026.',
      success: 'zero PG-side edits, <1% drift, zero Finance reconciliation hours.',
      teams: 'PG (Jonas, Erik), Salesforce (Pawel, Miranda). SF Core: 3-4, Backend: 2',
      timeline: 'Q3-Q4 2026',
      dependency: 'Post:CS-26-H2-20 Commission Pre:CS-26-H2-25 Dedup'
    },
    {
      id: 'H2-20',
      name: 'Commission on Tour (H2-20)',
      category: 'critical',
      confluenceId: 'CS-26-H2-20',
      startMonth: 8.7,
      durationMonths: 2.8,
      color: 'red',
      desc: 'Extend Polar Global so that it can calculate commission on elements of Tour/Package. Scope not defined and agreed.',
      goal: 'By the end of 2026, Polar Global calculates commission on individual Tour/Package elements (line-item commission) for the agreed scope, with phased rollout per agent and market following the Commercial Northstar specifications.',
      success: 'scope locked with Cathrine, Iain, Per Martin and Astrid before build start; line-item commission live in PG for in-scope tour and non-tour elements.',
      teams: 'Backend : 2',
      timeline: 'Q3-Q4 2026',
      dependency: 'CS-26-H2-19'
    },
    {
      id: 'milestone-commission-live',
      name: 'Commission live',
      category: 'critical',
      startMonth: 11.5,
      durationMonths: 0,
      color: 'blue',
      isMilestone: true,
      desc: 'Milestone: Commission on Tour live (June 2027).'
    },
    // 3. Customer 360 branch (co-critical)
    {
      id: 'H2-30',
      name: 'My Account identity (H2-30)',
      category: 'co-critical',
      confluenceId: 'CS-26-H2-30',
      startMonth: 6,
      durationMonths: 2.5,
      color: 'red',
      desc: 'Implement user identification and user management in Salesforce for My Account',
      goal: 'By the end of Q4 2026, Salesforce will be the system of record for My Account user identification and management, supporting the Digital Products team\'s My Account customer-facing experience.',
      success: 'user identification and user management live in Salesforce; My Account customer-facing flows read and write against Salesforce; identity reconciled with PG and partner data where applicable; CS-26-H2-25 dedup and CS-26H2-01 partner-data work aligned with the My Account person model.',
      teams: 'SF Core: 2-3, Backend: 1',
      timeline: 'Q3-Q4 2026',
      dependency: 'Aligned with CS-26-H2-25 Dedup and CS-26H2-01 Partner Data'
    },
    {
      id: 'H2-27',
      name: 'Email-to-Case (H2-27)',
      category: 'co-critical',
      confluenceId: 'CS-26-H2-27',
      startMonth: 6,
      durationMonths: 1.8,
      color: 'red',
      desc: 'Move emails from Outlook to Salesforce to support customer 360.',
      goal: 'By the end of Q3 2026, customer emails currently received in Outlook are converted to Salesforce Cases for the in-scope business units, with service processes wrapping the cases and contributing to Customer 360.',
      success: 'Email-to-Case live for in-scope mailboxes; cases routed to correct queues with service processes attached; shared mailboxes in scope demonstrably reduced or retired; case resolution data flows into Customer 360; business-unit user adoption confirmed for the in-scope set.',
      teams: 'SF Core: 1-2, Business: 1-2',
      timeline: 'Q3 2026',
      dependency: 'None'
    },
    // 4. Has float
    {
      id: 'H2-07',
      name: 'Consent backend (H2-07)',
      category: 'float',
      confluenceId: 'CS-26H2-07',
      startMonth: 4.3,
      durationMonths: 1.7,
      color: 'blue',
      desc: 'Backend SF readiness to enable Preference Center & Double Opt-in strategies',
      goal: 'By the end of Q4 2026, Salesforce is the system of record for Marketing Consent preferences (channels, content, frequency) and Double Opt-In flows, providing the backend substrate for CS-26-H2-10 Preference Centre.',
      success: 'Salesforce Preference Model live with consent fields, channel/content/frequency preferences, and Double Opt-In workflow; opted-in contacts migrated to the SF model for in-scope markets; CS-26-H2-10 Preference Centre reads and writes against the model in production; no marketing consent state held outside the SF model post-migration.',
      teams: 'SF: 2, SFMC: 2',
      timeline: 'Q3-Q4 2026',
      dependency: 'SQSF-5467'
    },
    {
      id: 'H2-10',
      name: 'Preference Centre (H2-10)',
      category: 'float',
      confluenceId: 'CS-26-H2-10',
      startMonth: 6,
      durationMonths: 2,
      color: 'blue',
      desc: 'Implement preference centre to enable customers to define contact channel, content & frequency',
      goal: 'By the end of Q4 2026, customers manage their marketing contact preferences (channel, content, frequency) via a Preference Centre surfaced on Web and Email Footers, reading and writing against the Salesforce Preference Model.',
      success: 'Preference Centre live on Web and in Email; preferences round-trip to SF Preference Model; opt-out and channel-change rates reflect customer agency rather than complaint volume; CS-26H2-07 backend confirmed as system of record.',
      teams: 'SF Core: 1, SFMC: 2',
      timeline: 'Q3-Q4 2026',
      dependency: 'CS-26H2-07'
    },
    {
      id: 'H2-09',
      name: 'Lighthouse Phase 2 (H2-09)',
      category: 'float',
      confluenceId: 'CS-26H2-09',
      startMonth: 1,
      durationMonths: 5,
      color: 'blue',
      desc: 'Misc improvements to support Sales Delivery teams in Tallinn',
      goal: 'By the end of Q4 2026, Lighthouse Phase 2 delivers a business-agreed, prioritised stream of improvements supporting Sales Delivery teams in Tallinn within the SF Core 2-3 FTE envelope, with explicit scope discipline replacing \'everything\'-mode demand.',
      success: 'quarterly prioritisation cadence agreed with Jude and Sales Delivery; rolling visible backlog; delivery throughput tracked per quarter (count + impact); business feedback signal trending positive each quarter; demand explicitly bounded each quarter (no \'everything\' mode).',
      teams: 'SF Core: 2-3',
      timeline: 'Q3-Q4 2026',
      dependency: 'Potential backend support needed'
    },
    {
      id: 'H2-22',
      name: 'Partner API v2 (H2-22)',
      category: 'float',
      confluenceId: 'CS-26-H2-22',
      startMonth: 1,
      durationMonths: 11,
      color: 'blue',
      desc: 'Optimise agency onboarding, booking management API (partner self-service), improve QA tools, deprecate v1 API, assist partners with v2 integration',
      goal: 'By the end of Q4 2026, Partner API v2 is in production with self-service agency onboarding, booking management and improved QA tooling, with v1 API on a published deprecation path.',
      success: 'v2 API functionality complete for in-scope use cases; partner self-service onboarding live; QA tools deployed and used by partner integration support; v1 deprecation timeline published to partners; measurable migration of partner integrations from v1 to v2.',
      teams: 'Backend: 2',
      timeline: 'Q3-Q4 2026',
      dependency: 'None'
    },
    {
      id: 'H2-24',
      name: 'Seaware to OCI (H2-24)',
      category: 'float',
      confluenceId: 'CS-26-H2-24',
      startMonth: 2.2,
      durationMonths: 1.5,
      color: 'blue',
      desc: 'Move Seaware production environment to OCI (Oracle Cloud Instance) to improve operational capabilities and stability. Go-live will require a large team and a small amount of downtime for the environment swap.',
      goal: 'By the end of Q3 2026, Seaware production runs in OCI integrated with the Commercial platform, delivering improved operational capability and stability with a controlled, time-boxed cutover window.',
      success: 'Seaware running in OCI production; integration with Commercial platform verified post-cutover; load testing completed in stage and OCI sizing matches stage findings; downtime window within communicated maintenance plan; operational stability metrics (uptime, latency) match or beat pre-cutover baseline within 2 weeks.',
      teams: 'Backend : 3, Platform : 1',
      timeline: 'Q3 2026',
      dependency: 'Seaware load testing performed in a stage environment to scale the production instance correctly.'
    }
  ];

  const categories = [
    { key: 'holiday', name: 'Norway holiday' },
    { key: 'critical', name: 'Critical path - person data' },
    { key: 'co-critical', name: 'Customer 360 branch (co-critical)' },
    { key: 'float', name: 'Has float' }
  ];

  return (
    <div id="gantt-chart-container" className="space-y-6 max-w-5xl relative">
      {/* Tab Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Critical Path Timeline</h1>
        <p className="text-sm text-gray-400 mt-1">Interactive Gantt visualization of the H2 2026 longest dependent chains and floats.</p>
      </div>

      {/* Callout Info Box */}
      <div className="p-4 bg-brand-purple/10 border border-brand-purple/20 rounded-2xl flex items-start space-x-3.5">
        <Clock className="w-5 h-5 text-brand-purple shrink-0 mt-0.5" />
        <div className="text-xs text-gray-300 leading-relaxed">
          <p className="font-semibold text-white mb-1">
            The longest dependent chain: ARM &rarr; Dedupe &rarr; B2B partner data &rarr; Commission on Tour.
          </p>
          <p>
            The same <strong className="text-brand-purple">ARM &rarr; Dedupe</strong> spine gates Customer 360. Red bars represent zero float. 
            July is a Norwegian holiday (no delivery), so the active schedule spans August 2026 to June 2027.
          </p>
        </div>
      </div>

      {/* Gantt Chart Container */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col">
        {/* Header Title inside Card */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-display font-bold text-white text-sm">Customer Systems — Critical Path (Aug 2026 to Jun 2027)</h3>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Hover bars for details</span>
        </div>

        {/* Gantt Grid Split Layout */}
        <div className="flex min-w-[760px] overflow-x-auto">
          {/* Left Column: Row Categories */}
          <div className="w-[180px] shrink-0 border-r border-white/5 bg-gray-950/20 flex flex-col pt-[36px]">
            {categories.map((cat) => {
              return (
                <div 
                  key={cat.key} 
                  className={`border-b border-white/5 px-4 flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider ${
                    cat.key === 'holiday' ? 'h-[44px]' :
                    cat.key === 'critical' ? 'h-[216px]' :
                    cat.key === 'co-critical' ? 'h-[96px]' : 'h-[240px]'
                  }`}
                  style={{
                    backgroundColor: cat.key === 'co-critical' ? 'rgba(239, 68, 68, 0.02)' : 'transparent'
                  }}
                >
                  <span>{cat.name}</span>
                </div>
              );
            })}
          </div>

          {/* Right Column: Timeline Grid */}
          <div className="flex-1 relative flex flex-col">
            {/* Months Header Row */}
            <div className="h-[36px] border-b border-white/5 flex bg-gray-950/40">
              {months.map((m, idx) => (
                <div 
                  key={idx} 
                  className="flex-1 border-r border-white/5 last:border-r-0 flex items-center justify-center text-[10px] font-semibold text-gray-400 font-mono"
                >
                  {m.name}
                </div>
              ))}
            </div>

            {/* Vertical grid lines overlay */}
            <div className="absolute inset-0 pointer-events-none flex pt-[36px]">
              {months.map((_, idx) => (
                <div key={idx} className="flex-1 border-r border-white/5 last:border-r-0 h-full" />
              ))}
            </div>

            {/* Grid rows */}
            <div className="flex-1 flex flex-col relative z-10">
              {categories.map((cat) => {
                const catItems = items.filter(i => i.category === cat.key);
                return (
                  <div 
                    key={cat.key} 
                    className={`border-b border-white/5 relative flex flex-col justify-center space-y-2.5 py-3 ${
                      cat.key === 'holiday' ? 'h-[44px]' :
                      cat.key === 'critical' ? 'h-[216px]' :
                      cat.key === 'co-critical' ? 'h-[96px]' : 'h-[240px]'
                    }`}
                    style={{
                      backgroundColor: cat.key === 'co-critical' ? 'rgba(239, 68, 68, 0.01)' : 'transparent'
                    }}
                  >
                    {catItems.map((item) => {
                      const leftPercent = (item.startMonth / 13) * 100;
                      const widthPercent = (item.durationMonths / 13) * 100;

                      if (item.isMilestone) {
                        return (
                          <div 
                            key={item.id}
                            className="absolute h-10 flex flex-col items-center group cursor-help"
                            style={{ 
                              left: `${leftPercent}%`, 
                              transform: 'translateX(-50%)',
                              top: item.id === 'milestone-person-ready' ? '86px' : '172px'
                            }}
                            onMouseEnter={(e) => handleMouseEnter(item, e)}
                            onMouseLeave={handleMouseLeave}
                          >
                            {/* Diamond */}
                            <div className="w-3.5 h-3.5 rotate-45 bg-indigo-500 border border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform" />
                            {/* Label */}
                            <span className="text-[9px] font-semibold text-indigo-400 font-mono mt-1 text-center whitespace-nowrap bg-gray-950/80 px-1 py-0.5 rounded border border-indigo-500/20">
                              {item.name}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={item.id}
                          className="relative h-6 group"
                          style={{
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`
                          }}
                          onMouseEnter={(e) => handleMouseEnter(item, e)}
                          onMouseLeave={handleMouseLeave}
                        >
                          {/* Bar */}
                          <div className={`h-full rounded-md border flex items-center px-2.5 transition-all cursor-help select-none ${
                            item.color === 'red' 
                              ? 'bg-red-500/20 border-red-500/40 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.1)] group-hover:border-red-400' 
                              : item.color === 'gray'
                              ? 'bg-gray-500/20 border-gray-500/30 text-gray-400 group-hover:border-gray-300'
                              : 'bg-brand-blue/20 border-brand-blue/30 text-brand-blue font-semibold group-hover:border-brand-blue/60'
                          }`}>
                            <span className="text-[10px] font-medium truncate whitespace-nowrap">{item.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Description Panel (Shows description of hovered item, or default) */}
      <div className="glass-card p-5 rounded-2xl border border-white/5 min-h-[96px] flex items-start space-x-4">
        <div className="p-2.5 bg-gray-950/50 border border-white/5 rounded-xl text-gray-400 shrink-0">
          <Info className="w-5 h-5 text-brand-purple" />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
            {hoveredItem ? hoveredItem.name : 'Interactive Description'}
          </h4>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            {hoveredItem 
              ? hoveredItem.desc 
              : 'Hover over any timeline bar or milestone marker in the chart above to view details, duration, dependencies, and risks.'}
          </p>
        </div>
      </div>

      {/* Bottom Caption Text */}
      <div className="p-4 bg-gray-950/20 border border-white/5 rounded-2xl text-[11px] text-gray-400 leading-relaxed font-sans">
        <div className="flex items-center gap-2 mb-1.5 text-xs text-white font-semibold">
          <ShieldAlert className="w-4 h-4 text-brand-purple" />
          <span>Timeline Adjustments & Absences Analysis</span>
        </div>
        July out (Norwegian holiday) shifts the autumn chain ~1 month right; person model ready mid-December. 
        <strong> B2B (H2-01) starts in January </strong> — its only prerequisite is the person model; the earlier February date was just a hypercare + Christmas-break buffer. 
        Pulling it to January lands Commission ~June 2027. 
        <strong> Protect ARM and Dedupe above all: </strong> zero float, single resources, PG-side dependency, October absences. 
        Dedupe starts October so ARM and Dedupe no longer collide on Miranda.
      </div>

      {/* Dynamic Tooltip Overlay (Renders outside overflow containers to prevent clipping) */}
      {hoveredItem && tooltipPos && (
        <div 
          className={`absolute z-50 flex flex-col bg-gray-950/95 border rounded-xl shadow-2xl p-4 text-left pointer-events-none transition-all duration-200 backdrop-blur-md ${
            tooltipPos.isMilestone 
              ? 'w-[300px] border-indigo-500/30' 
              : 'w-[360px] border-brand-purple/30'
          }`}
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%) translateY(-12px)'
          }}
        >
          {tooltipPos.isMilestone ? (
            <>
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2 mb-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  Milestone
                </span>
              </div>
              <h5 className="text-xs font-bold text-white mb-2">{hoveredItem.name}</h5>
              <p className="text-[10px] text-gray-300 leading-relaxed font-sans">{hoveredItem.desc}</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <span className="text-[10px] font-bold text-brand-purple uppercase tracking-wider">
                  {hoveredItem.confluenceId || "METRIC"}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {hoveredItem.timeline || "H2 2026"}
                </span>
              </div>
              <h5 className="text-xs font-bold text-white mb-2">{hoveredItem.name}</h5>
              
              <div className="space-y-2 text-[10px] text-gray-300">
                <div>
                  <span className="font-semibold text-white block mb-0.5">Description:</span>
                  <p className="leading-relaxed font-sans">{hoveredItem.desc}</p>
                </div>
                {hoveredItem.goal && (
                  <div>
                    <span className="font-semibold text-white block mb-0.5">Goal:</span>
                    <p className="leading-relaxed font-sans">{hoveredItem.goal}</p>
                  </div>
                )}
                {hoveredItem.success && (
                  <div>
                    <span className="font-semibold text-white block mb-0.5">Success Criteria:</span>
                    <p className="leading-relaxed font-sans">{hoveredItem.success}</p>
                  </div>
                )}
                {(hoveredItem.teams || hoveredItem.dependency) && (
                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-white/5 mt-1.5">
                    {hoveredItem.teams && (
                      <div>
                        <span className="font-semibold text-white block mb-0.5">Teams / Resources:</span>
                        <span className="text-[9px] text-gray-400 leading-snug">{hoveredItem.teams}</span>
                      </div>
                    )}
                    {hoveredItem.dependency && (
                      <div>
                        <span className="font-semibold text-white block mb-0.5">Dependencies:</span>
                        <span className="text-[9px] text-gray-400 leading-snug">{hoveredItem.dependency}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
