import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from '../lib/firebase';
import { Plus, Trash2, Pencil, Music, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { MusicProject, ProjectStage, AllowedUser, UserRole } from '../types';
import { STAGES, getStage, stageProgress } from '../lib/stages';
import { formatDate, formatDateTime, formatRelative, nameFromEmail } from '../lib/format';
import { firestoreErrorMessage } from '../lib/errors';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import {
  Button,
  EmptyState,
  LoadingState,
  PageHeader,
  StatCard,
  cardClass,
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from './ui/Primitives';

interface ProjectsTrackerProps {
  currentUser: { email: string; displayName: string };
  isAdmin: boolean;
  userRole: UserRole | null;
}

export default function ProjectsTracker({ currentUser, isAdmin, userRole }: ProjectsTrackerProps) {
  const canManage = isAdmin || userRole === 'junior_admin';
  const toast = useToast();

  const [projects, setProjects] = useState<MusicProject[]>([]);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Create / edit form
  const [showForm, setShowForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [stage, setStage] = useState<ProjectStage>('composing');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Quick stage update
  const [updatingProject, setUpdatingProject] = useState<MusicProject | null>(null);
  const [updateStageValue, setUpdateStageValue] = useState<ProjectStage>('composing');
  const [updateNotes, setUpdateNotes] = useState('');

  // Delete confirmation
  const [projectToDelete, setProjectToDelete] = useState<MusicProject | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, 'allowed_users'), (snapshot) => {
      const list: AllowedUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          email: (data.email || docSnap.id).toLowerCase(),
          name: data.name || '',
          role: data.role || 'member',
          addedBy: data.addedBy || '',
          addedAt: data.addedAt || '',
        });
      });
      list.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
      setAllowedUsers(list);
    }, (err) => console.error('Firestore allowed_users fetch error:', err));
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'projects'), (snapshot) => {
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
          history: data.history || [],
        });
      });
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      setProjects(list);
      setLoading(false);
    }, (err) => {
      console.error('Firestore projects fetch error:', err);
      toast.error(firestoreErrorMessage(err, 'Could not load projects. Check your connection.'));
      setLoading(false);
    });
  }, [toast]);

  const stats = useMemo(() => ({
    active: projects.filter(p => p.stage !== 'completed').length,
    inPost: projects.filter(p => p.stage === 'mixing' || p.stage === 'mastering').length,
    completed: projects.filter(p => p.stage === 'completed').length,
  }), [projects]);

  /** Resolves whitelisted emails to display names, falling back to the handle. */
  const studentNames = (emails: string[]) => {
    if (!emails || emails.length === 0) return 'No students assigned';
    return emails
      .map(email => allowedUsers.find(u => u.email === email)?.name || nameFromEmail(email))
      .join(', ');
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingProjectId(null);
    setName('');
    setOccasion('');
    setStage('composing');
    setSelectedStudents([]);
    setNotes('');
  };

  const openEdit = (project: MusicProject) => {
    setEditingProjectId(project.id);
    setName(project.name);
    setOccasion(project.occasion);
    setStage(project.stage);
    setSelectedStudents(project.students || []);
    setNotes(project.notes || '');
    setShowForm(true);
  };

  const handleCreateOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || !occasion.trim() || selectedStudents.length === 0) return;

    const projectId = editingProjectId || `project-${Date.now()}`;
    const existing = editingProjectId ? projects.find(p => p.id === editingProjectId) : undefined;

    const timeString = new Date().toISOString();
    const updaterName = currentUser.displayName || currentUser.email;

    let history = existing?.history || [];
    // Only append a timeline entry when the project is new or the stage actually moved.
    if (!existing || existing.stage !== stage) {
      history = [
        {
          stage,
          updatedBy: updaterName,
          updatedAt: timeString,
          notes: notes.trim() || (existing ? 'Project details updated' : 'Project initiated'),
        },
        ...history,
      ];
    }

    const payload: MusicProject = {
      id: projectId,
      name: name.trim(),
      occasion: occasion.trim(),
      stage,
      students: selectedStudents,
      notes: notes.trim(),
      updatedBy: updaterName,
      updatedAt: timeString,
      createdBy: existing?.createdBy || updaterName,
      createdAt: existing?.createdAt || timeString,
      history,
    };

    setBusy(true);
    try {
      await setDoc(doc(db, 'projects', projectId), payload);
      toast.success(existing ? `Updated “${payload.name}”.` : `Created “${payload.name}”.`);
      resetForm();
    } catch (err) {
      console.error('Error saving project:', err);
      toast.error(firestoreErrorMessage(err, 'Could not save the project. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleQuickStageUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingProject || busy) return;
    if (!updateNotes.trim()) return;

    const timeString = new Date().toISOString();
    const updaterName = currentUser.displayName || currentUser.email;

    const history = [
      {
        stage: updateStageValue,
        updatedBy: updaterName,
        updatedAt: timeString,
        notes: updateNotes.trim(),
      },
      ...(updatingProject.history || []),
    ];

    setBusy(true);
    try {
      await updateDoc(doc(db, 'projects', updatingProject.id), {
        stage: updateStageValue,
        updatedBy: updaterName,
        updatedAt: timeString,
        notes: updateNotes.trim(),
        history,
      });
      toast.success(`“${updatingProject.name}” moved to ${getStage(updateStageValue).label}.`);
      setUpdatingProject(null);
      setUpdateNotes('');
    } catch (err) {
      console.error('Error updating stage:', err);
      toast.error(firestoreErrorMessage(err, 'Could not update the stage. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!projectToDelete || busy) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'projects', projectToDelete.id));
      toast.success(`Deleted “${projectToDelete.name}”.`);
      setProjectToDelete(null);
    } catch (err) {
      console.error('Error deleting project:', err);
      toast.error(firestoreErrorMessage(err, 'Could not delete the project. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleStudentSelection = (email: string) => {
    setSelectedStudents(current =>
      current.includes(email) ? current.filter(e => e !== email) : [...current, email],
    );
  };

  return (
    <div className="space-y-6 font-sans">

      <PageHeader
        title="Projects"
        subtitle="Track music production stages and hostel recordings"
        actions={
          canManage ? (
            <Button icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>New project</Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Active projects" value={stats.active} />
        <StatCard label="In mix / master" value={stats.inPost} tone="blue" />
        <StatCard label="Completed songs" value={stats.completed} tone="green" />
      </div>

      {/* List */}
      {loading ? (
        <LoadingState label="Syncing project catalog…" />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Music}
          title="No projects yet"
          message={
            canManage
              ? 'Create your first composition, song track, or event schedule to start tracking progress.'
              : 'Projects will appear here once an admin adds them.'
          }
          action={canManage ? <Button icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>New project</Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {projects.map(project => {
            const currentStage = getStage(project.stage);
            const isExpanded = expandedProjectId === project.id;
            const progressPct = stageProgress(project.stage);

            return (
              <article key={project.id} className={`${cardClass} overflow-hidden`}>

                {/* Progress rail */}
                <div className="h-1 bg-[#f5f5f7] w-full">
                  <div
                    className="h-full transition-all duration-500 ease-out"
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

                <div className="p-5 space-y-4">
                  {/* Title + actions */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[18px] font-semibold text-[#1d1d1f] leading-tight break-words">{project.name}</h3>
                        <span className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full shrink-0 ${currentStage.bg} ${currentStage.text}`}>
                          {currentStage.label}
                        </span>
                      </div>
                      {project.occasion && (
                        <p className="text-[13px] text-[#86868b] break-words">
                          Occasion: <span className="font-medium text-[#1d1d1f]">{project.occasion}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setUpdateStageValue(project.stage);
                          setUpdateNotes('');
                          setUpdatingProject(project);
                        }}
                        className="!px-3 !py-1.5 !text-[12px]"
                      >
                        Update stage
                      </Button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEdit(project)}
                            aria-label={`Edit ${project.name}`}
                            className="text-[#86868b] hover:text-[#1d1d1f] p-1.5 rounded-full hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => setProjectToDelete(project)}
                            aria-label={`Delete ${project.name}`}
                            className="text-[#ff3b30] hover:bg-[#ff3b30]/10 p-1.5 rounded-full transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stage rail */}
                  <ol className="hidden sm:grid grid-cols-6 gap-1 bg-[#f5f5f7] p-1 rounded-lg" aria-label="Production stages">
                    {STAGES.map(s => {
                      const reached = s.step <= currentStage.step;
                      const isCurrent = s.value === project.stage;
                      return (
                        <li
                          key={s.value}
                          aria-current={isCurrent ? 'step' : undefined}
                          className={`text-center py-1 rounded text-[10px] font-medium select-none transition-colors ${
                            isCurrent
                              ? `${s.bg} ${s.text} font-semibold ring-1 ring-black/[0.05]`
                              : reached
                                ? 'bg-white text-[#1d1d1f]'
                                : 'text-[#86868b]'
                          }`}
                        >
                          {s.label}
                        </li>
                      );
                    })}
                  </ol>

                  {/* Meta */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-[13px]">
                    <p className="flex items-start gap-1.5 text-[#6e6e73] min-w-0">
                      <Users size={14} className="text-[#86868b] shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="break-words">{studentNames(project.students)}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-[#86868b] shrink-0">
                      <Clock size={14} className="shrink-0" aria-hidden="true" />
                      <span title={formatDateTime(project.updatedAt)}>
                        Updated {formatRelative(project.updatedAt) || formatDate(project.updatedAt)}
                        {project.updatedBy && ` by ${project.updatedBy}`}
                      </span>
                    </p>
                  </div>

                  {project.notes && (
                    <p className="text-[13px] text-[#6e6e73] bg-[#f5f5f7] p-3.5 rounded-xl border border-[#e8e8ed] leading-relaxed break-words">
                      {project.notes}
                    </p>
                  )}

                  {/* Timeline */}
                  {project.history && project.history.length > 0 && (
                    <div className="border-t border-[#e8e8ed] pt-3">
                      <button
                        onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                        aria-expanded={isExpanded}
                        className="flex items-center gap-1 text-[12px] text-[#0071e3] hover:underline font-medium cursor-pointer"
                      >
                        {isExpanded ? (
                          <>Hide history <ChevronUp size={14} aria-hidden="true" /></>
                        ) : (
                          <>View history timeline ({project.history.length}) <ChevronDown size={14} aria-hidden="true" /></>
                        )}
                      </button>

                      {isExpanded && (
                        <ol className="mt-4 pl-4 border-l-2 border-[#e8e8ed] space-y-4">
                          {project.history.map((hist, index) => {
                            const stageObj = getStage(hist.stage);
                            return (
                              <li key={`${hist.updatedAt}-${index}`} className="relative space-y-1">
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
                                  <p className="text-[12px] text-[#6e6e73] leading-relaxed break-words">{hist.notes}</p>
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
      )}

      {/* ── Create / edit ── */}
      <Modal
        open={showForm}
        onClose={resetForm}
        title={editingProjectId ? 'Edit project' : 'New project'}
        description={editingProjectId ? undefined : 'Set up a track and assign the students working on it.'}
      >
        <form onSubmit={handleCreateOrEdit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className={labelClass} htmlFor="project-name">Project / song name <span className="text-[#ff3b30]">*</span></label>
            <input
              id="project-name"
              type="text"
              required
              placeholder="e.g. Holi Special Bhajan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="project-occasion">Occasion / purpose <span className="text-[#ff3b30]">*</span></label>
            <input
              id="project-occasion"
              type="text"
              required
              placeholder="e.g. Holi Festival 2026"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="project-stage">Current stage</label>
            <select
              id="project-stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as ProjectStage)}
              className={selectClass}
            >
              {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className={`${labelClass} !mb-0`} id="assigned-students-label">
                Assigned students <span className="text-[#ff3b30]">*</span>
              </label>
              <span className="text-[12px] text-[#86868b]">{selectedStudents.length} selected</span>
            </div>
            <div
              role="group"
              aria-labelledby="assigned-students-label"
              className="max-h-40 overflow-y-auto border border-[#d2d2d7] rounded-lg bg-[#f5f5f7] p-2.5 space-y-1"
            >
              {allowedUsers.length === 0 ? (
                <p className="text-[12px] text-[#86868b] text-center py-3">
                  No students are whitelisted yet. Add them in Settings.
                </p>
              ) : (
                allowedUsers.map(user => (
                  <label
                    key={user.email}
                    className="flex items-center gap-2.5 text-[13px] text-[#1d1d1f] cursor-pointer select-none rounded-md px-1.5 py-1 hover:bg-white transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(user.email)}
                      onChange={() => toggleStudentSelection(user.email)}
                      className="h-4 w-4 rounded border-[#d2d2d7] accent-[#0071e3]"
                    />
                    <span className="truncate">
                      {user.name || nameFromEmail(user.email)}
                      <span className="text-[#86868b]"> · {nameFromEmail(user.email)}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            {selectedStudents.length === 0 && allowedUsers.length > 0 && (
              <p className="text-[12px] text-[#86868b] mt-1.5">Select at least one student to save.</p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="project-notes">Remarks / progress notes</label>
            <textarea
              id="project-notes"
              placeholder="Instrumentation, required recordings, track length…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={textareaClass}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={selectedStudents.length === 0}>
              {editingProjectId ? 'Save changes' : 'Create project'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Quick stage update ── */}
      <Modal
        open={Boolean(updatingProject)}
        onClose={() => setUpdatingProject(null)}
        title="Update project stage"
        description={updatingProject?.name}
        size="sm"
      >
        <form onSubmit={handleQuickStageUpdate} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className={labelClass} htmlFor="next-stage">Next stage</label>
            <select
              id="next-stage"
              value={updateStageValue}
              onChange={(e) => setUpdateStageValue(e.target.value as ProjectStage)}
              className={selectClass}
            >
              {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="update-notes">What changed? <span className="text-[#ff3b30]">*</span></label>
            <textarea
              id="update-notes"
              required
              placeholder="e.g. Finished vocal takes, added keyboard pads, mixed sub-bass…"
              value={updateNotes}
              onChange={(e) => setUpdateNotes(e.target.value)}
              className={textareaClass}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={() => setUpdatingProject(null)}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={!updateNotes.trim()}>Save stage</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete ── */}
      <Modal
        open={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        title="Delete project"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <p className="text-[14px] text-[#1d1d1f] leading-relaxed">
            Permanently delete <span className="font-semibold">{projectToDelete?.name}</span> and its full stage history?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={() => setProjectToDelete(null)}>Cancel</Button>
            <Button type="button" variant="danger" icon={Trash2} loading={busy} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
