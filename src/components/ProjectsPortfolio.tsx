import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot } from '../lib/firebase';
import { Music, Users, Clock, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import type { MusicProject, ProjectStage } from '../types';

interface ProjectsPortfolioProps {
  currentUser: { email: string; displayName: string };
}

const STAGES: { value: ProjectStage; label: string; bg: string; text: string; step: number }[] = [
  { value: 'composing',   label: 'Composing',   bg: 'bg-[#0071e3]/10', text: 'text-[#0071e3]', step: 1 },
  { value: 'arranging',   label: 'Arranging',   bg: 'bg-[#af52de]/10', text: 'text-[#af52de]', step: 2 },
  { value: 'live_inputs', label: 'Live Inputs', bg: 'bg-[#ff9500]/10', text: 'text-[#ff9500]', step: 3 },
  { value: 'mixing',      label: 'Mixing',      bg: 'bg-[#ff2d55]/10', text: 'text-[#ff2d55]', step: 4 },
  { value: 'mastering',   label: 'Mastering',   bg: 'bg-[#55befc]/10', text: 'text-[#0071e3]', step: 5 },
  { value: 'completed',   label: 'Completed',   bg: 'bg-[#34c759]/10', text: 'text-[#34c759]', step: 6 },
];

export default function ProjectsPortfolio({ currentUser }: ProjectsPortfolioProps) {
  const [projects, setProjects] = useState<MusicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<ProjectStage | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  useEffect(() => {
    const projRef = collection(db, 'projects');
    const unsubscribe = onSnapshot(projRef, (snapshot) => {
      const list: MusicProject[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name || '',
          occasion: data.occasion || '',
          stage: data.stage || 'composing',
          students: data.students || [],
          notes: data.notes || '',
          updatedBy: data.updatedBy || '',
          updatedAt: data.updatedAt || '',
          createdBy: data.createdBy || '',
          createdAt: data.createdAt || '',
          history: data.history || [],
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setProjects(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore projects fetch error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Derive available years
  const years = Array.from(new Set(
    projects.map(p => new Date(p.createdAt).getFullYear()).filter(y => !isNaN(y))
  )).sort((a, b) => b - a);

  // Filtered projects
  const filtered = projects.filter(p => {
    if (filterStage !== 'all' && p.stage !== filterStage) return false;
    if (selectedYear !== 'all' && new Date(p.createdAt).getFullYear() !== selectedYear) return false;
    return true;
  });

  // Group by year
  const groupedByYear: Record<number, MusicProject[]> = {};
  filtered.forEach(p => {
    const year = new Date(p.createdAt).getFullYear();
    if (!isNaN(year)) {
      if (!groupedByYear[year]) groupedByYear[year] = [];
      groupedByYear[year].push(p);
    }
  });
  const sortedYears = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);

  // Stats
  const totalProjects = filtered.length;
  const completedCount = filtered.filter(p => p.stage === 'completed').length;
  const inProgressCount = totalProjects - completedCount;

  return (
    <div className="space-y-6 font-sans">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-[#1d1d1f]">Portfolio</h2>
          <p className="text-[13px] text-[#86868b] mt-0.5">All projects throughout the year</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-4 text-center">
          <p className="text-[24px] font-bold text-[#1d1d1f]">{totalProjects}</p>
          <p className="text-[12px] text-[#86868b] mt-0.5">Total</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-4 text-center">
          <p className="text-[24px] font-bold text-[#0071e3]">{inProgressCount}</p>
          <p className="text-[12px] text-[#86868b] mt-0.5">In Progress</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-4 text-center">
          <p className="text-[24px] font-bold text-[#34c759]">{completedCount}</p>
          <p className="text-[12px] text-[#86868b] mt-0.5">Completed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Year filter */}
        {years.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedYear('all')}
              className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                selectedYear === 'all' ? 'bg-[#1d1d1f] text-white' : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
              }`}
            >
              All Years
            </button>
            {years.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                  selectedYear === year ? 'bg-[#1d1d1f] text-white' : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        )}

        {/* Stage filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={14} className="text-[#86868b]" />
          <button
            onClick={() => setFilterStage('all')}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
              filterStage === 'all' ? 'bg-[#0071e3] text-white' : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
            }`}
          >
            All
          </button>
          {STAGES.map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStage(s.value)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                filterStage === s.value ? `${s.bg} ${s.text} ring-1 ring-black/[0.05]` : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-[#86868b] text-[14px] animate-pulse">Loading portfolio...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-[#e8e8ed] space-y-3">
          <Music className="mx-auto text-[#d2d2d7]" size={40} />
          <p className="text-[16px] text-[#1d1d1f] font-semibold">No Projects Found</p>
          <p className="text-[14px] text-[#86868b] max-w-sm mx-auto">
            {filterStage !== 'all' || selectedYear !== 'all'
              ? 'No projects match the current filters. Try adjusting your selection.'
              : 'Projects will appear here once the admin adds them.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedYears.map(year => (
            <div key={year}>
              {/* Year header */}
              {sortedYears.length > 1 && (
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-[20px] font-bold text-[#1d1d1f]">{year}</h3>
                  <span className="text-[12px] text-[#86868b] bg-[#e8e8ed] px-2.5 py-0.5 rounded-full font-medium">
                    {groupedByYear[year].length} project{groupedByYear[year].length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 h-px bg-[#e8e8ed]" />
                </div>
              )}

              {/* Project cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedByYear[year].map(project => {
                  const currentStageObj = STAGES.find(s => s.value === project.stage) || STAGES[0];
                  const progressPct = Math.round((currentStageObj.step / 6) * 100);
                  const isExpanded = expandedId === project.id;

                  return (
                    <div 
                      key={project.id}
                      className="bg-white rounded-2xl border border-[#e8e8ed] overflow-hidden transition-all"
                    >
                      {/* Progress bar */}
                      <div className="h-1.5 bg-[#f5f5f7] w-full">
                        <div 
                          className="h-full transition-all duration-500 ease-out rounded-r-full" 
                          style={{ 
                            width: `${progressPct}%`,
                            backgroundColor: project.stage === 'completed' ? '#34c759' : '#0071e3'
                          }} 
                        />
                      </div>

                      <div className="p-5 space-y-3">
                        {/* Title + badge */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-[16px] font-semibold text-[#1d1d1f] leading-tight">{project.name}</h4>
                            <span className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full ${currentStageObj.bg} ${currentStageObj.text}`}>
                              {currentStageObj.label}
                            </span>
                          </div>
                          {project.occasion && (
                            <p className="text-[13px] text-[#86868b]">
                              <span className="font-medium text-[#6e6e73]">{project.occasion}</span>
                            </p>
                          )}
                        </div>

                        {/* Stage progress mini-bar */}
                        <div className="grid grid-cols-6 gap-0.5 bg-[#f5f5f7] p-0.5 rounded-lg">
                          {STAGES.map(s => {
                            const isActive = s.step <= currentStageObj.step;
                            const isCurrent = s.value === project.stage;
                            return (
                              <div 
                                key={s.value}
                                className={`text-center py-1 rounded text-[9px] sm:text-[10px] font-medium select-none transition-colors ${
                                  isCurrent 
                                    ? `${s.bg} ${s.text} font-semibold ring-1 ring-black/[0.05]` 
                                    : isActive 
                                      ? 'bg-white text-[#1d1d1f]' 
                                      : 'text-[#b4b4b9]'
                                }`}
                              >
                                {s.label}
                              </div>
                            );
                          })}
                        </div>

                        {/* Students */}
                        {project.students && project.students.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73]">
                            <Users size={13} className="text-[#86868b] shrink-0" />
                            <span className="truncate">{project.students.join(', ')}</span>
                          </div>
                        )}

                        {/* Last update */}
                        <div className="flex items-center gap-1.5 text-[12px] text-[#86868b]">
                          <Clock size={13} className="shrink-0" />
                          <span>Updated {new Date(project.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} by {project.updatedBy}</span>
                        </div>

                        {/* Notes */}
                        {project.notes && (
                          <p className="text-[12px] text-[#6e6e73] bg-[#f5f5f7] p-3 rounded-xl border border-[#e8e8ed] leading-relaxed">
                            {project.notes}
                          </p>
                        )}

                        {/* Timeline toggle */}
                        {project.history && project.history.length > 0 && (
                          <div className="border-t border-[#e8e8ed] pt-3">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : project.id)}
                              className="flex items-center gap-1 text-[12px] text-[#0071e3] hover:text-[#0077ED] font-medium cursor-pointer transition-colors"
                            >
                              {isExpanded ? (
                                <>Hide Timeline <ChevronUp size={14} /></>
                              ) : (
                                <>View Timeline ({project.history.length}) <ChevronDown size={14} /></>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="mt-3 pl-3 border-l-2 border-[#e8e8ed] space-y-3">
                                {project.history.map((hist, index) => {
                                  const stageObj = STAGES.find(s => s.value === hist.stage);
                                  return (
                                    <div key={index} className="relative space-y-0.5">
                                      <div className="absolute -left-[18px] top-1.5 h-2 w-2 rounded-full bg-[#d2d2d7]" />
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${stageObj?.bg} ${stageObj?.text}`}>
                                          {stageObj?.label || hist.stage}
                                        </span>
                                        <span className="text-[11px] text-[#86868b]">
                                          by {hist.updatedBy} · {new Date(hist.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </span>
                                      </div>
                                      {hist.notes && (
                                        <p className="text-[11px] text-[#6e6e73] pl-1 leading-relaxed">{hist.notes}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
