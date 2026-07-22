import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where } from '../lib/firebase';
import { Plus, Trash2, Pencil, Music, Users, Clock, ChevronDown, ChevronUp, Check, X, ShieldQuestion } from 'lucide-react';
import type { MusicProject, ProjectStage, ProjectApproval, AllowedUser, UserRole } from '../types';
import { STAGES, getStage, stageProgress } from '../lib/stages';
import { formatDate, formatDateTime, formatRelative, nameFromEmail } from '../lib/format';
import { firestoreErrorMessage } from '../lib/errors';
import { notify } from '../lib/notifications';
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

const APPROVAL_META: Record<ProjectApproval, { label: string; bg: string; text: string }> = {
  pending:  { label: 'Awaiting approval', bg: 'bg-[#ff9f0a]/12', text: 'text-[#a86500]' },
  approved: { label: 'Approved',          bg: 'bg-[#34c759]/10', text: 'text-[#1a7f37]' },
  rejected: { label: 'Changes requested', bg: 'bg-[#ff3b30]/10', text: 'text-[#c9302c]' },
};

/** Shapes a Firestore document into a MusicProject, tolerating older records. */
function mapProject(id: string, data: any): MusicProject {
  return {
    id,
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
    // Records predating the approval flow are treated as already approved.
    approval: data.approval || 'approved',
    reviewedBy: data.reviewedBy || '',
    reviewedAt: data.reviewedAt || '',
    reviewNote: data.reviewNote || '',
    history: data.history || [],
  };
}

export default function ProjectsTracker({ currentUser, isAdmin, userRole }: ProjectsTrackerProps) {
  const canManage = isAdmin || userRole === 'junior_admin';
  const myEmail = currentUser.email.toLowerCase();
  const myName = currentUser.displayName || currentUser.email;
  const toast = useToast();

  // Managers read every project; students read approved ones plus their own.
  // Kept in two buckets because Firestore needs each query to be independently
  // provable against the security rules.
  const [visibleProjects, setVisibleProjects] = useState<MusicProject[]>([]);
  const [ownProjects, setOwnProjects] = useState<MusicProject[]>([]);
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

  // Review + delete
  const [projectToDelete, setProjectToDelete] = useState<MusicProject | null>(null);
  const [reviewing, setReviewing] = useState<{ project: MusicProject; decision: ProjectApproval } | null>(null);
  const [reviewNote, setReviewNote] = useState('');

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
    const projectsRef = collection(db, 'projects');

    const onError = (err: unknown) => {
      console.error('Firestore projects fetch error:', err);
      toast.error(firestoreErrorMessage(err, 'Could not load projects. Check your connection.'));
      setLoading(false);
    };

    const collect = (snapshot: any) => {
      const list: MusicProject[] = [];
      snapshot.forEach((docSnap: any) => list.push(mapProject(docSnap.id, docSnap.data())));
      return list;
    };

    if (canManage) {
      // Managers can read everything, so one unconstrained listener is enough.
      const unsub = onSnapshot(projectsRef, (snap) => {
        setVisibleProjects(collect(snap));
        setOwnProjects([]);
        setLoading(false);
      }, onError);
      return () => unsub();
    }

    const unsubApproved = onSnapshot(
      query(projectsRef, where('approval', '==', 'approved')),
      (snap) => { setVisibleProjects(collect(snap)); setLoading(false); },
      onError,
    );
    const unsubOwn = onSnapshot(
      query(projectsRef, where('createdByEmail', '==', myEmail)),
      (snap) => { setOwnProjects(collect(snap)); setLoading(false); },
      onError,
    );
    return () => { unsubApproved(); unsubOwn(); };
  }, [canManage, myEmail, toast]);

  /** Union of both listeners, newest first. */
  const projects = useMemo(() => {
    const byId = new Map<string, MusicProject>();
    [...visibleProjects, ...ownProjects].forEach(p => byId.set(p.id, p));
    return [...byId.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [visibleProjects, ownProjects]);

  const approved = useMemo(() => projects.filter(p => p.approval === 'approved'), [projects]);
  const pendingReview = useMemo(() => projects.filter(p => p.approval === 'pending'), [projects]);
  /** Sent back to their authors — managers keep sight of these so they don't vanish. */
  const sentBack = useMemo(() => projects.filter(p => p.approval === 'rejected'), [projects]);
  /** A student's own submissions that are not live yet. */
  const mySubmissions = useMemo(
    () => projects.filter(p => p.approval !== 'approved' && p.createdByEmail === myEmail),
    [projects, myEmail],
  );

  const stats = useMemo(() => ({
    active: approved.filter(p => p.stage !== 'completed').length,
    inPost: approved.filter(p => p.stage === 'mixing' || p.stage === 'mastering').length,
    completed: approved.filter(p => p.stage === 'completed').length,
  }), [approved]);

  const studentNames = (emails: string[]) => {
    if (!emails || emails.length === 0) return 'No students assigned';
    return emails
      .map(email => allowedUsers.find(u => u.email === email)?.name || nameFromEmail(email))
      .join(', ');
  };

  const canEdit = (p: MusicProject) => canManage || p.createdByEmail === myEmail;
  const canDelete = (p: MusicProject) =>
    canManage || (p.createdByEmail === myEmail && p.approval !== 'approved');

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

    const existing = editingProjectId ? projects.find(p => p.id === editingProjectId) : undefined;
    const projectId = editingProjectId || `project-${Date.now()}`;
    const timeString = new Date().toISOString();

    // Managers publish directly. A student's work always re-enters review:
    // a new project starts pending, and editing an approved one sends it back.
    const approval: ProjectApproval = canManage ? (existing?.approval || 'approved') : 'pending';

    let history = existing?.history || [];
    if (!existing || existing.stage !== stage) {
      history = [
        {
          stage,
          updatedBy: myName,
          updatedAt: timeString,
          notes: notes.trim() || (existing ? 'Project details updated' : 'Project submitted'),
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
      updatedBy: myName,
      updatedAt: timeString,
      createdBy: existing?.createdBy || myName,
      createdAt: existing?.createdAt || timeString,
      createdByEmail: existing?.createdByEmail || myEmail,
      approval,
      reviewedBy: existing?.reviewedBy || '',
      reviewedAt: existing?.reviewedAt || '',
      reviewNote: approval === 'pending' ? '' : existing?.reviewNote || '',
      history,
    };

    setBusy(true);
    try {
      await setDoc(doc(db, 'projects', projectId), payload);

      if (!canManage) {
        await notify({
          type: existing ? 'project_updated' : 'project_submitted',
          title: existing ? `“${payload.name}” was edited` : `New project “${payload.name}” needs approval`,
          body: `Occasion: ${payload.occasion}`,
          actorName: myName,
          actorEmail: myEmail,
          entityType: 'project',
          entityId: projectId,
        });
        toast.success(
          existing
            ? `Changes to “${payload.name}” sent for approval.`
            : `“${payload.name}” submitted for admin approval.`,
        );
      } else {
        toast.success(existing ? `Updated “${payload.name}”.` : `Created “${payload.name}”.`);
      }
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
    if (!updatingProject || busy || !updateNotes.trim()) return;

    const timeString = new Date().toISOString();
    const history = [
      { stage: updateStageValue, updatedBy: myName, updatedAt: timeString, notes: updateNotes.trim() },
      ...(updatingProject.history || []),
    ];

    setBusy(true);
    try {
      await updateDoc(doc(db, 'projects', updatingProject.id), {
        stage: updateStageValue,
        updatedBy: myName,
        updatedAt: timeString,
        notes: updateNotes.trim(),
        history,
      });

      if (!canManage) {
        await notify({
          type: 'project_updated',
          title: `“${updatingProject.name}” moved to ${getStage(updateStageValue).label}`,
          body: updateNotes.trim(),
          actorName: myName,
          actorEmail: myEmail,
          entityType: 'project',
          entityId: updatingProject.id,
        });
      }

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

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewing || busy) return;
    const { project, decision } = reviewing;
    if (decision === 'rejected' && !reviewNote.trim()) return;

    setBusy(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        approval: decision,
        reviewedBy: myName,
        reviewedAt: new Date().toISOString(),
        reviewNote: reviewNote.trim(),
      });

      await notify({
        type: decision === 'approved' ? 'project_approved' : 'project_rejected',
        title:
          decision === 'approved'
            ? `“${project.name}” was approved`
            : `Changes requested on “${project.name}”`,
        body: reviewNote.trim() || (decision === 'approved' ? 'Now visible to everyone.' : ''),
        actorName: myName,
        actorEmail: myEmail,
        entityType: 'project',
        entityId: project.id,
      });

      toast.success(
        decision === 'approved'
          ? `“${project.name}” is now live for everyone.`
          : `Sent “${project.name}” back to ${project.createdBy || 'the author'}.`,
      );
      setReviewing(null);
      setReviewNote('');
    } catch (err) {
      console.error('Error reviewing project:', err);
      toast.error(firestoreErrorMessage(err, 'Could not save the decision. Please try again.'));
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

  /** One project card, reused by the review queue, submissions, and main list. */
  const renderProject = (project: MusicProject, variant: 'review' | 'mine' | 'listed') => {
    const currentStage = getStage(project.stage);
    const isExpanded = expandedProjectId === project.id;
    const progressPct = stageProgress(project.stage);
    const approvalMeta = APPROVAL_META[project.approval];

    return (
      <article
        key={project.id}
        className={`${cardClass} overflow-hidden ${variant === 'review' ? 'ring-1 ring-[#ff9f0a]/30' : ''}`}
      >
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[18px] font-semibold text-[#1d1d1f] leading-tight break-words">{project.name}</h3>
                <span className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full shrink-0 ${currentStage.bg} ${currentStage.text}`}>
                  {currentStage.label}
                </span>
                {project.approval !== 'approved' && (
                  <span className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full shrink-0 ${approvalMeta.bg} ${approvalMeta.text}`}>
                    {approvalMeta.label}
                  </span>
                )}
              </div>
              {project.occasion && (
                <p className="text-[13px] text-[#86868b] break-words">
                  Occasion: <span className="font-medium text-[#1d1d1f]">{project.occasion}</span>
                </p>
              )}
              {variant === 'review' && (
                <p className="text-[12px] text-[#86868b]">
                  Submitted by <span className="font-medium text-[#1d1d1f]">{project.createdBy}</span>
                  {project.createdAt && ` · ${formatRelative(project.createdAt)}`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {variant === 'review' ? (
                <>
                  <Button
                    icon={Check}
                    onClick={() => { setReviewNote(''); setReviewing({ project, decision: 'approved' }); }}
                    className="!px-3 !py-1.5 !text-[12px]"
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    icon={X}
                    onClick={() => { setReviewNote(''); setReviewing({ project, decision: 'rejected' }); }}
                    className="!px-3 !py-1.5 !text-[12px]"
                  >
                    Request changes
                  </Button>
                </>
              ) : (
                project.approval === 'approved' && (
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
                )
              )}

              {canEdit(project) && (
                <button
                  onClick={() => openEdit(project)}
                  aria-label={`Edit ${project.name}`}
                  className="text-[#86868b] hover:text-[#1d1d1f] p-1.5 rounded-full hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                >
                  <Pencil size={15} aria-hidden="true" />
                </button>
              )}
              {canDelete(project) && (
                <button
                  onClick={() => setProjectToDelete(project)}
                  aria-label={`Delete ${project.name}`}
                  className="text-[#ff3b30] hover:bg-[#ff3b30]/10 p-1.5 rounded-full transition-colors cursor-pointer"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Reviewer feedback, shown to the author */}
          {project.approval === 'rejected' && project.reviewNote && (
            <div className="rounded-xl bg-[#ff3b30]/5 border border-[#ff3b30]/20 p-3">
              <p className="text-[12px] font-semibold text-[#c9302c]">
                {project.reviewedBy ? `${project.reviewedBy} requested changes` : 'Changes requested'}
              </p>
              <p className="text-[13px] text-[#6e6e73] leading-relaxed mt-1 break-words">{project.reviewNote}</p>
            </div>
          )}

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
  };

  return (
    <div className="space-y-6 font-sans">

      <PageHeader
        title="Projects"
        subtitle={
          canManage
            ? 'Track music production stages and review student submissions'
            : 'Submit a project for approval, then track its production stages'
        }
        actions={<Button icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>New project</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Active projects" value={stats.active} />
        <StatCard label="In mix / master" value={stats.inPost} tone="blue" />
        <StatCard label="Completed songs" value={stats.completed} tone="green" />
      </div>

      {loading ? (
        <LoadingState label="Syncing project catalog…" />
      ) : (
        <>
          {/* Admin review queue */}
          {canManage && pendingReview.length > 0 && (
            <section className="space-y-3" aria-labelledby="review-queue">
              <div className="flex items-center gap-2">
                <ShieldQuestion size={16} className="text-[#a86500]" aria-hidden="true" />
                <h3 id="review-queue" className="text-[16px] font-semibold text-[#1d1d1f]">
                  Awaiting your approval
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#ff9f0a]/12 text-[#a86500] text-[11px] font-semibold tabular-nums">
                  {pendingReview.length}
                </span>
              </div>
              <p className="text-[13px] text-[#86868b] -mt-1">
                These are visible only to you and their authors until approved.
              </p>
              {pendingReview.map(p => renderProject(p, 'review'))}
            </section>
          )}

          {/* Sent back — waiting on the author, but still visible to managers */}
          {canManage && sentBack.length > 0 && (
            <section className="space-y-3" aria-labelledby="sent-back">
              <h3 id="sent-back" className="text-[16px] font-semibold text-[#1d1d1f]">
                Sent back for changes
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#ff3b30]/10 text-[#c9302c] text-[11px] font-semibold tabular-nums">
                  {sentBack.length}
                </span>
              </h3>
              <p className="text-[13px] text-[#86868b] -mt-1">
                Waiting on their authors to revise and resubmit.
              </p>
              {sentBack.map(p => renderProject(p, 'review'))}
            </section>
          )}

          {/* A student's own not-yet-live submissions */}
          {!canManage && mySubmissions.length > 0 && (
            <section className="space-y-3" aria-labelledby="my-submissions">
              <h3 id="my-submissions" className="text-[16px] font-semibold text-[#1d1d1f]">Your submissions</h3>
              <p className="text-[13px] text-[#86868b] -mt-1">
                Only you and the admins can see these. They join the list below once approved.
              </p>
              {mySubmissions.map(p => renderProject(p, 'mine'))}
            </section>
          )}

          {/* Approved, shared list */}
          {approved.length === 0 ? (
            <EmptyState
              icon={Music}
              title="No approved projects yet"
              message={
                canManage
                  ? 'Approved projects appear here and in the Portfolio.'
                  : 'Create a project and an admin will review it. Approved projects show up here.'
              }
              action={<Button icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>New project</Button>}
            />
          ) : (
            <div className="space-y-4">
              {canManage && pendingReview.length > 0 && (
                <h3 className="text-[16px] font-semibold text-[#1d1d1f] pt-2">Approved projects</h3>
              )}
              {approved.map(p => renderProject(p, 'listed'))}
            </div>
          )}
        </>
      )}

      {/* ── Create / edit ── */}
      <Modal
        open={showForm}
        onClose={resetForm}
        title={editingProjectId ? 'Edit project' : 'New project'}
        description={
          canManage
            ? 'Projects you create are published immediately.'
            : 'Your project goes to an admin for approval before anyone else can see it.'
        }
      >
        <form onSubmit={handleCreateOrEdit} className="p-6 space-y-4 overflow-y-auto">
          {!canManage && (
            <p className="text-[13px] text-[#a86500] bg-[#ff9f0a]/8 border border-[#ff9f0a]/20 rounded-xl p-3 leading-relaxed">
              {editingProjectId
                ? 'Editing sends this back to an admin for approval.'
                : 'This will be visible only to you and the admins until it is approved.'}
            </p>
          )}

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
                <p className="text-[12px] text-[#86868b] text-center py-3">No students whitelisted yet.</p>
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
              {editingProjectId
                ? canManage ? 'Save changes' : 'Submit changes'
                : canManage ? 'Create project' : 'Submit for approval'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Approve / request changes ── */}
      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title={reviewing?.decision === 'approved' ? 'Approve project' : 'Request changes'}
        description={reviewing?.project.name}
        size="sm"
      >
        <form onSubmit={handleReview} className="p-6 space-y-4 overflow-y-auto">
          <p className="text-[13px] text-[#6e6e73] leading-relaxed">
            {reviewing?.decision === 'approved'
              ? 'This project becomes visible to everyone, including the Portfolio.'
              : `This goes back to ${reviewing?.project.createdBy || 'the author'} with your note. It stays hidden from everyone else.`}
          </p>

          <div>
            <label className={labelClass} htmlFor="review-note">
              {reviewing?.decision === 'approved' ? (
                <>Note <span className="text-[#86868b] font-normal">(optional)</span></>
              ) : (
                <>What needs changing? <span className="text-[#ff3b30]">*</span></>
              )}
            </label>
            <textarea
              id="review-note"
              required={reviewing?.decision === 'rejected'}
              placeholder={
                reviewing?.decision === 'approved'
                  ? 'Anything to pass on to the team…'
                  : 'e.g. Add the vocalist to assigned students, and correct the occasion date.'
              }
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className={textareaClass}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button
              type="submit"
              loading={busy}
              icon={reviewing?.decision === 'approved' ? Check : X}
              disabled={reviewing?.decision === 'rejected' && !reviewNote.trim()}
            >
              {reviewing?.decision === 'approved' ? 'Approve' : 'Send back'}
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
