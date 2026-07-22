import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from '../lib/firebase';
import { Plus, Clock, CheckCircle2, User, Trash2, ClipboardList, AlertCircle } from 'lucide-react';
import { MaintenanceTask, UserRole } from '../types';
import { formatDate, formatDateTime } from '../lib/format';
import { firestoreErrorMessage } from '../lib/errors';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import {
  Button,
  EmptyState,
  FilterPill,
  LoadingState,
  PageHeader,
  StatCard,
  cardClass,
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from './ui/Primitives';

interface MaintenanceSchedulerProps {
  currentUser: { email: string; displayName: string } | null;
  isAdmin: boolean;
  userRole: UserRole | null;
}

type Frequency = 'daily' | 'weekly' | 'monthly';

/** How many days may pass before a routine at this cadence counts as due. */
const DUE_AFTER_DAYS: Record<Frequency, number> = { daily: 1, weekly: 7, monthly: 30 };

function daysSince(value?: string): number | null {
  if (!value || value === 'Never Checked') return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 86_400_000;
}

/** A task is due when it has never been done, or its cadence window has elapsed. */
function isDue(task: MaintenanceTask): boolean {
  const elapsed = daysSince(task.lastDone);
  if (elapsed === null) return true;
  return elapsed >= DUE_AFTER_DAYS[task.frequency as Frequency];
}

export default function MaintenanceScheduler({ currentUser, isAdmin, userRole }: MaintenanceSchedulerProps) {
  const canManage = isAdmin || userRole === 'junior_admin';
  const toast = useToast();

  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [selectedFreq, setSelectedFreq] = useState<Frequency>('daily');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'done'>('all');

  // Detailed completion dialog
  const [completingTask, setCompletingTask] = useState<MaintenanceTask | null>(null);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [completedBy, setCompletedBy] = useState(currentUser?.displayName || '');

  // Create task dialog
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFrequency, setNewFrequency] = useState<Frequency>('daily');

  // Delete confirmation
  const [taskToDelete, setTaskToDelete] = useState<MaintenanceTask | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, 'maintenance_tasks'), (snapshot) => {
      const fetched: MaintenanceTask[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as MaintenanceTask;
        fetched.push({ ...data, id: data.id || docSnap.id, history: data.history || [] });
      });
      fetched.sort((a, b) => a.title.localeCompare(b.title));
      setTasks(fetched);
      setLoading(false);
    }, (err) => {
      console.error('Firestore maintenance subscription error:', err);
      toast.error(firestoreErrorMessage(err, 'Could not load the maintenance checklist.'));
      setLoading(false);
    });
  }, [toast]);

  useEffect(() => {
    if (currentUser?.displayName) setCompletedBy(currentUser.displayName);
  }, [currentUser]);

  const writeCompletion = async (task: MaintenanceTask, by: string, remarks: string) => {
    const now = new Date().toISOString();
    const history = [
      { date: now, completedBy: by, remarks },
      ...(task.history || []),
    ];
    await updateDoc(doc(db, 'maintenance_tasks', task.id), { lastDone: now, history });
  };

  /** One-tap log for the common "checked, all fine" case. */
  const handleQuickComplete = async (task: MaintenanceTask) => {
    if (busy) return;
    setBusy(true);
    try {
      await writeCompletion(
        task,
        currentUser?.displayName || currentUser?.email || 'Student',
        'Completed routine checks. Clean, functional, and correctly racked.',
      );
      toast.success(`Logged “${task.title}”.`);
    } catch (err) {
      console.error('Error logging routine execution:', err);
      toast.error(firestoreErrorMessage(err, 'Could not log the completion. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDetailedComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask || busy) return;
    if (!completedBy.trim() || !completionRemarks.trim()) return;

    setBusy(true);
    try {
      await writeCompletion(completingTask, completedBy.trim(), completionRemarks.trim());
      toast.success(`Logged “${completingTask.title}”.`);
      setCompletingTask(null);
      setCompletionRemarks('');
    } catch (err) {
      console.error('Firestore write error:', err);
      toast.error(firestoreErrorMessage(err, 'Could not save the log. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!newTitle.trim() || !newDescription.trim()) return;

    const prefix = newFrequency === 'daily' ? 'D' : newFrequency === 'weekly' ? 'W' : 'M';
    const uniqueId = `MNT-${prefix}-${Date.now().toString().slice(-5)}`;

    const newTask: MaintenanceTask = {
      id: uniqueId,
      title: newTitle.trim(),
      description: newDescription.trim(),
      frequency: newFrequency,
      role: 'both',
      lastDone: '',
      history: [],
    };

    setBusy(true);
    try {
      await setDoc(doc(db, 'maintenance_tasks', uniqueId), newTask);
      toast.success(`Created “${newTask.title}”.`);
      setNewTitle('');
      setNewDescription('');
      setSelectedFreq(newFrequency);
      setShowAddTask(false);
    } catch (err) {
      console.error('Database task write error:', err);
      toast.error(firestoreErrorMessage(err, 'Could not create the task. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete || busy) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'maintenance_tasks', taskToDelete.id));
      toast.success(`Deleted “${taskToDelete.title}”.`);
      setTaskToDelete(null);
    } catch (err) {
      console.error('Error deleting task:', err);
      toast.error(firestoreErrorMessage(err, 'Could not delete the task. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const tasksAtFreq = useMemo(
    () => tasks.filter(t => t.frequency === selectedFreq),
    [tasks, selectedFreq],
  );

  const filteredTasks = useMemo(
    () => tasksAtFreq.filter(t => {
      if (statusFilter === 'due') return isDue(t);
      if (statusFilter === 'done') return !isDue(t);
      return true;
    }),
    [tasksAtFreq, statusFilter],
  );

  const dueCount = useMemo(() => tasks.filter(isDue).length, [tasks]);

  const allLogs = useMemo(
    () => tasks
      .flatMap(t => (t.history || []).map(h => ({ ...h, taskTitle: t.title, taskId: t.id })))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [tasks],
  );

  return (
    <div className="space-y-6 font-sans">

      <PageHeader
        title="Maintenance"
        subtitle="Scheduled checks that keep monitors, computers, and instruments in shape"
        actions={
          canManage ? <Button icon={Plus} onClick={() => setShowAddTask(true)}>Create task</Button> : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total routines" value={tasks.length} hint="Across all frequencies" />
        <StatCard
          label="Due now"
          value={dueCount}
          hint={dueCount === 0 && tasks.length > 0 ? 'Everything is up to date' : 'Overdue or never checked'}
        />
        <StatCard label="Completions logged" value={allLogs.length} tone="green" hint="All time" />
      </div>

      {loading ? (
        <LoadingState label="Syncing routine checklist…" />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No maintenance routines yet"
          message={
            canManage
              ? 'Create daily, weekly, or monthly checks so nothing in the studio gets neglected.'
              : 'An admin will set up the routine checklist here.'
          }
          action={canManage ? <Button icon={Plus} onClick={() => setShowAddTask(true)}>Create task</Button> : undefined}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex gap-2" role="group" aria-label="Frequency">
              {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                <FilterPill key={freq} active={selectedFreq === freq} onClick={() => setSelectedFreq(freq)}>
                  <span className="capitalize">{freq}</span>
                </FilterPill>
              ))}
            </div>

            <div className="flex gap-1.5" role="group" aria-label="Status">
              {([
                { id: 'all', label: 'All' },
                { id: 'due', label: 'Due' },
                { id: 'done', label: 'Up to date' },
              ] as const).map(f => (
                <FilterPill
                  key={f.id}
                  active={statusFilter === f.id}
                  onClick={() => setStatusFilter(f.id)}
                  activeClass="bg-[#0071e3] text-white"
                >
                  {f.label}
                </FilterPill>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            {/* Task list */}
            <div className="lg:col-span-7 space-y-3">
              {filteredTasks.length === 0 ? (
                <div className={`${cardClass} py-12 px-6 text-center`}>
                  <p className="text-[14px] text-[#6e6e73] font-medium">
                    {statusFilter === 'due'
                      ? `No ${selectedFreq} routines are due.`
                      : statusFilter === 'done'
                        ? `No ${selectedFreq} routines have been completed recently.`
                        : `No ${selectedFreq} routines configured.`}
                  </p>
                  <p className="text-[13px] text-[#86868b] mt-1">Try another frequency or status filter.</p>
                </div>
              ) : (
                filteredTasks.map(task => {
                  const due = isDue(task);
                  return (
                    <article key={task.id} className={`${cardClass} p-5 space-y-3`}>
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#86868b]/10 text-[#86868b] font-mono">
                              {task.id}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                due ? 'bg-[#ff9f0a]/12 text-[#a86500]' : 'bg-[#34c759]/10 text-[#1a7f37]'
                              }`}
                            >
                              {due ? <AlertCircle size={11} aria-hidden="true" /> : <CheckCircle2 size={11} aria-hidden="true" />}
                              {due ? 'Due' : 'Up to date'}
                            </span>
                          </div>
                          <h3 className="font-semibold text-[#1d1d1f] text-[15px] mt-2 leading-tight break-words">
                            {task.title}
                          </h3>
                        </div>

                        {canManage && (
                          <button
                            onClick={() => setTaskToDelete(task)}
                            aria-label={`Delete ${task.title}`}
                            className="shrink-0 text-[#ff3b30] hover:bg-[#ff3b30]/10 p-1.5 rounded-full transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      <p className="text-[13px] text-[#6e6e73] leading-relaxed break-words">{task.description}</p>

                      <div className="pt-3 border-t border-[#e8e8ed] flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <span className="text-[13px] text-[#86868b] flex items-center gap-1.5 font-medium">
                          <Clock size={14} aria-hidden="true" />
                          {task.lastDone && task.lastDone !== 'Never Checked'
                            ? `Last checked ${formatDate(task.lastDone)}`
                            : 'Never checked'}
                        </span>

                        <div className="flex gap-2 sm:justify-end">
                          <Button variant="secondary" onClick={() => { setCompletionRemarks(''); setCompletingTask(task); }}>
                            Custom log
                          </Button>
                          <Button icon={CheckCircle2} disabled={busy} onClick={() => handleQuickComplete(task)}>
                            Quick complete
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Completion log */}
            <div className={`lg:col-span-5 ${cardClass} p-5 space-y-4`}>
              <h3 className="text-[17px] font-semibold text-[#1d1d1f] border-b border-[#e8e8ed] pb-3">
                Completion log
              </h3>

              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {allLogs.length === 0 ? (
                  <p className="text-center py-16 text-[#86868b] text-[13px]">
                    No completions recorded yet.
                  </p>
                ) : (
                  allLogs.map((log, idx) => (
                    <div key={`${log.taskId}-${log.date}-${idx}`} className="p-3 bg-[#f5f5f7] rounded-xl space-y-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <strong className="text-[#1d1d1f] text-[13px] font-semibold leading-snug min-w-0 break-words">
                          {log.taskTitle}
                        </strong>
                        <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white border border-[#e8e8ed] text-[#86868b] font-mono">
                          {log.taskId}
                        </span>
                      </div>
                      {log.remarks && (
                        <p className="text-[#6e6e73] text-[12px] pl-2 border-l-2 border-[#d2d2d7] break-words leading-relaxed">
                          {log.remarks}
                        </p>
                      )}
                      <div className="flex justify-between items-center gap-2 text-[12px] text-[#86868b] pt-2 border-t border-[#e8e8ed]">
                        <span className="flex items-center gap-1 text-[#6e6e73] font-medium min-w-0">
                          <User size={12} className="shrink-0" aria-hidden="true" />
                          <span className="truncate">{log.completedBy}</span>
                        </span>
                        <span className="shrink-0">{formatDateTime(log.date)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Detailed completion ── */}
      <Modal
        open={Boolean(completingTask)}
        onClose={() => setCompletingTask(null)}
        title="Log completion"
        description={completingTask?.title}
      >
        <form onSubmit={handleDetailedComplete} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className={labelClass} htmlFor="completed-by">Completed by <span className="text-[#ff3b30]">*</span></label>
            <input
              id="completed-by"
              type="text"
              value={completedBy}
              onChange={(e) => setCompletedBy(e.target.value)}
              placeholder="Student name"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="completion-remarks">Observations <span className="text-[#ff3b30]">*</span></label>
            <textarea
              id="completion-remarks"
              value={completionRemarks}
              onChange={(e) => setCompletionRemarks(e.target.value)}
              placeholder="Wiped keyboard keys, checked cable tension, cleaned vents…"
              required
              className={textareaClass}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={() => setCompletingTask(null)}>Cancel</Button>
            <Button type="submit" loading={busy}>Save log</Button>
          </div>
        </form>
      </Modal>

      {/* ── Create task ── */}
      <Modal
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        title="Create routine task"
        description="Add a recurring check to the studio maintenance schedule."
      >
        <form onSubmit={handleCreateTask} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className={labelClass} htmlFor="task-title">Task name <span className="text-[#ff3b30]">*</span></label>
            <input
              id="task-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Acoustic guitar fret conditioning"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="task-frequency">Frequency</label>
            <select
              id="task-frequency"
              value={newFrequency}
              onChange={(e) => setNewFrequency(e.target.value as Frequency)}
              className={selectClass}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="task-description">Description <span className="text-[#ff3b30]">*</span></label>
            <textarea
              id="task-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe the standard steps so anyone can follow them…"
              required
              className={textareaClass}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={() => setShowAddTask(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Create task</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete task ── */}
      <Modal
        open={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        title="Delete routine"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <p className="text-[14px] text-[#1d1d1f] leading-relaxed">
            Delete <span className="font-semibold">{taskToDelete?.title}</span> and its
            {' '}{taskToDelete?.history?.length || 0} logged completion{taskToDelete?.history?.length === 1 ? '' : 's'}?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={() => setTaskToDelete(null)}>Cancel</Button>
            <Button type="button" variant="danger" icon={Trash2} loading={busy} onClick={handleDeleteTask}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
