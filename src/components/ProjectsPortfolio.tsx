import { useState, useEffect, useMemo } from 'react';
import { db, collection, onSnapshot, query, where } from '../lib/firebase';
import { Music, Users, Clock, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import type { MusicProject, ProjectStage, AllowedUser } from '../types';
import { STAGES, getStage, stageProgress } from '../lib/stages';
import { formatDate, formatDateTime, getYear, nameFromEmail } from '../lib/format';
import { firestoreErrorMessage } from '../lib/errors';
import { useToast } from './ui/Toast';
import {
  Button,
  EmptyState,
  FilterPill,
  LoadingState,
  PageHeader,
  StatCard,
  cardClass,
} from './ui/Primitives';

interface ProjectsPortfolioProps {
  /** Whitelist, used to render assigned students as names rather than emails. */
  allowedUsers: AllowedUser[];
}

export default function ProjectsPortfolio({ allowedUsers }: ProjectsPortfolioProps) {
  const toast = useToast();
  const [projects, setProjects] = useState<MusicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<ProjectStage | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  useEffect(() => {
    // The Portfolio is the public archive; pending submissions never appear here.
    return onSnapshot(query(collection(db, 'projects'), where('approval', '==', 'approved')), (snapshot) => {
      const list: MusicProject[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || '',
          occasion: data.occasion || '',
          stage: data.stage || 'composing',
          students: data.students || [],
          notes: data.notes || '',
          updatedBy: data.updatedBy || '',
          updatedAt: data.updatedAt || '',
          createdBy: data.createdBy || '',
          createdAt: data.createdAt || '',
          createdByEmail: (data.createdByEmail || '').toLowerCase(),
          approval: data.approval || 'approved',
          history: data.history || [],
        });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setProjects(list);
      setLoading(false);
    }, (err) => {
      console.error('Firestore projects fetch error:', err);
      toast.error(firestoreErrorMessage(err, 'Could not load the portfolio.'));
      setLoading(false);
    });
  }, [toast]);

  const years = useMemo(() => {
    const set = new Set<number>();
    projects.forEach(p => {
      const y = getYear(p.createdAt);
      if (y !== null) set.add(y);
    });
    return [...set].sort((a, b) => b - a);
  }, [projects]);

  const filtered = useMemo(
    () => projects.filter(p => {
      if (filterStage !== 'all' && p.stage !== filterStage) return false;
      if (selectedYear !== 'all' && getYear(p.createdAt) !== selectedYear) return false;
      return true;
    }),
    [projects, filterStage, selectedYear],
  );

  /** Projects bucketed by creation year; undated ones fall into their own group. */
  const groups = useMemo(() => {
    const byYear = new Map<number | 'undated', MusicProject[]>();
    filtered.forEach(p => {
      const key = getYear(p.createdAt) ?? 'undated';
      const bucket = byYear.get(key);
      if (bucket) bucket.push(p);
      else byYear.set(key, [p]);
    });
    return [...byYear.entries()].sort((a, b) => {
      if (a[0] === 'undated') return 1;
      if (b[0] === 'undated') return -1;
      return b[0] - a[0];
    });
  }, [filtered]);

  const stats = useMemo(() => {
    const completed = filtered.filter(p => p.stage === 'completed').length;
    return { total: filtered.length, completed, inProgress: filtered.length - completed };
  }, [filtered]);

  const studentNames = (emails: string[]) =>
    (emails || [])
      .map(email => allowedUsers.find(u => u.email === email)?.name || nameFromEmail(email))
      .join(', ');

  const hasFilters = filterStage !== 'all' || selectedYear !== 'all';

  return (
    <div className="space-y-6 font-sans">

      <PageHeader title="Portfolio" subtitle="Every project the department has worked on, by year" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="In progress" value={stats.inProgress} tone="blue" />
        <StatCard label="Completed" value={stats.completed} tone="green" />
      </div>

      {/* Filters */}
      {projects.length > 0 && (
        <div className="space-y-3">
          {years.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <FilterPill active={selectedYear === 'all'} onClick={() => setSelectedYear('all')}>
                All years
              </FilterPill>
              {years.map(year => (
                <FilterPill key={year} active={selectedYear === year} onClick={() => setSelectedYear(year)}>
                  {year}
                </FilterPill>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <SlidersHorizontal size={14} className="text-[#86868b] mr-0.5" aria-hidden="true" />
            <FilterPill
              active={filterStage === 'all'}
              onClick={() => setFilterStage('all')}
              activeClass="bg-[#0071e3] text-white"
            >
              All stages
            </FilterPill>
            {STAGES.map(s => (
              <FilterPill
                key={s.value}
                active={filterStage === s.value}
                onClick={() => setFilterStage(s.value)}
                activeClass={`${s.bg} ${s.text} ring-1 ring-black/[0.05]`}
              >
                {s.label}
              </FilterPill>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState label="Loading portfolio…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Music}
          title={hasFilters ? 'No projects match these filters' : 'Nothing in the portfolio yet'}
          message={
            hasFilters
              ? 'Try a different year or stage.'
              : 'Projects created in the Projects tab will appear here automatically.'
          }
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                onClick={() => { setFilterStage('all'); setSelectedYear('all'); }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map(([year, items]) => (
            <section key={String(year)} aria-label={year === 'undated' ? 'Undated projects' : `Projects from ${year}`}>
              {groups.length > 1 && (
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-[20px] font-bold tracking-tight text-[#1d1d1f]">
                    {year === 'undated' ? 'Undated' : year}
                  </h3>
                  <span className="text-[12px] text-[#86868b] bg-[#e8e8ed] px-2.5 py-0.5 rounded-full font-medium">
                    {items.length} project{items.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 h-px bg-[#e8e8ed]" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {items.map(project => {
                  const currentStage = getStage(project.stage);
                  const progressPct = stageProgress(project.stage);
                  const isExpanded = expandedId === project.id;
                  const names = studentNames(project.students);

                  return (
                    <article key={project.id} className={`${cardClass} overflow-hidden`}>
                      <div className="h-1.5 bg-[#f5f5f7] w-full">
                        <div
                          className="h-full transition-all duration-500 ease-out rounded-r-full"
                          style={{
                            width: `${progressPct}%`,
                            backgroundColor: project.stage === 'completed' ? '#34c759' : '#0071e3',
                          }}
                          role="progressbar"
                          aria-valuenow={progressPct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${project.name} progress`}
                        />
                      </div>

                      <div className="p-5 space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-[16px] font-semibold text-[#1d1d1f] leading-tight break-words">
                              {project.name}
                            </h4>
                            <span className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full shrink-0 ${currentStage.bg} ${currentStage.text}`}>
                              {currentStage.label}
                            </span>
                          </div>
                          {project.occasion && (
                            <p className="text-[13px] text-[#6e6e73] font-medium break-words">{project.occasion}</p>
                          )}
                        </div>

                        <ol className="grid grid-cols-6 gap-0.5 bg-[#f5f5f7] p-0.5 rounded-lg" aria-label="Production stages">
                          {STAGES.map(s => {
                            const reached = s.step <= currentStage.step;
                            const isCurrent = s.value === project.stage;
                            return (
                              <li
                                key={s.value}
                                aria-current={isCurrent ? 'step' : undefined}
                                title={s.label}
                                className={`text-center py-1 rounded text-[9px] sm:text-[10px] font-medium select-none truncate transition-colors ${
                                  isCurrent
                                    ? `${s.bg} ${s.text} font-semibold ring-1 ring-black/[0.05]`
                                    : reached
                                      ? 'bg-white text-[#1d1d1f]'
                                      : 'text-[#b4b4b9]'
                                }`}
                              >
                                {s.label}
                              </li>
                            );
                          })}
                        </ol>

                        {names && (
                          <p className="flex items-start gap-1.5 text-[12px] text-[#6e6e73]">
                            <Users size={13} className="text-[#86868b] shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="break-words">{names}</span>
                          </p>
                        )}

                        <p className="flex items-center gap-1.5 text-[12px] text-[#86868b]">
                          <Clock size={13} className="shrink-0" aria-hidden="true" />
                          <span>
                            Updated {formatDate(project.updatedAt)}
                            {project.updatedBy && ` by ${project.updatedBy}`}
                          </span>
                        </p>

                        {project.notes && (
                          <p className="text-[12px] text-[#6e6e73] bg-[#f5f5f7] p-3 rounded-xl border border-[#e8e8ed] leading-relaxed break-words">
                            {project.notes}
                          </p>
                        )}

                        {project.history && project.history.length > 0 && (
                          <div className="border-t border-[#e8e8ed] pt-3">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : project.id)}
                              aria-expanded={isExpanded}
                              className="flex items-center gap-1 text-[12px] text-[#0071e3] hover:underline font-medium cursor-pointer"
                            >
                              {isExpanded ? (
                                <>Hide timeline <ChevronUp size={14} aria-hidden="true" /></>
                              ) : (
                                <>View timeline ({project.history.length}) <ChevronDown size={14} aria-hidden="true" /></>
                              )}
                            </button>

                            {isExpanded && (
                              <ol className="mt-3 pl-4 border-l-2 border-[#e8e8ed] space-y-3">
                                {project.history.map((hist, index) => {
                                  const stageObj = getStage(hist.stage);
                                  return (
                                    <li key={`${hist.updatedAt}-${index}`} className="relative space-y-0.5">
                                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#d2d2d7]" aria-hidden="true" />
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${stageObj.bg} ${stageObj.text}`}>
                                          {stageObj.label}
                                        </span>
                                        <span className="text-[11px] text-[#86868b]">
                                          by {hist.updatedBy} · {formatDateTime(hist.updatedAt)}
                                        </span>
                                      </div>
                                      {hist.notes && (
                                        <p className="text-[11px] text-[#6e6e73] leading-relaxed break-words">{hist.notes}</p>
                                      )}
                                    </li>
                                  );
                                })}
                              </ol>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
