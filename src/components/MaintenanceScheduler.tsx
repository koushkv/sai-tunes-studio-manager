import React, { useState, useEffect } from 'react';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from '../lib/firebase';
import { 
  Calendar, 
  Plus, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  User, 
  History, 
  PlusCircle, 
  X,
  ListTodo,
  TrendingUp
} from 'lucide-react';
import { MaintenanceTask } from '../types';

interface MaintenanceSchedulerProps {
  currentUser: {
    email: string;
    displayName: string;
  } | null;
  isAdmin: boolean;
}

export default function MaintenanceScheduler({ currentUser, isAdmin }: MaintenanceSchedulerProps) {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [selectedFreq, setSelectedFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedRole, setSelectedRole] = useState<'all' | 'head' | 'junior'>('all');
  
  // Dialog completions state
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [completedBy, setCompletedBy] = useState(currentUser?.displayName || 'Hostel Student');
  
  // Task create form
  const [showAddNewChore, setShowAddNewChore] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFrequency, setNewFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [newRole, setNewRole] = useState<'junior' | 'head' | 'both'>('junior');

  const [loading, setLoading] = useState(true);

  // Sync tasks from Firestore — no auto-seeding, starts empty
  useEffect(() => {
    const tasksRef = collection(db, 'maintenance_tasks');
    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const fetchedTasks: MaintenanceTask[] = [];
      snapshot.forEach((docSnap) => {
        fetchedTasks.push(docSnap.data() as MaintenanceTask);
      });

      fetchedTasks.sort((a, b) => a.id.localeCompare(b.id));
      setTasks(fetchedTasks);
      setLoading(false);
    }, (error) => {
      console.error("Firestore chores subscription error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update name when user signs in
  useEffect(() => {
    if (currentUser) {
      setCompletedBy(currentUser.displayName || 'Hostel Student');
    }
  }, [currentUser]);

  // Handle single-click instant completion!
  const handleFastLogCompletion = async (taskId: string) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const standardRemarks = `Completed routine checks. Clean, functional, and aligned in physical racks.`;
    const userDisplayName = currentUser?.displayName || 'Hostel Student';
    const completionDate = new Date().toISOString().split('T')[0];

    const updatedHistory = [
      {
        date: completionDate,
        completedBy: userDisplayName,
        remarks: standardRemarks
      },
      ...(targetTask.history || [])
    ];

    try {
      await updateDoc(doc(db, 'maintenance_tasks', taskId), {
        lastDone: completionDate,
        history: updatedHistory
      });
    } catch (err) {
      console.error("Error logging routine execution:", err);
    }
  };

  // Detailed manual log completion
  const handleCompleteChoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTaskId) return;

    const targetTask = tasks.find(t => t.id === completingTaskId);
    if (!targetTask) return;

    const completionDate = new Date().toISOString().split('T')[0];
    const updatedHistory = [
      {
        date: completionDate,
        completedBy: completedBy.trim(),
        remarks: completionRemarks.trim() || 'Passed routine stewardship check'
      },
      ...(targetTask.history || [])
    ];

    try {
      await updateDoc(doc(db, 'maintenance_tasks', completingTaskId), {
        lastDone: completionDate,
        history: updatedHistory
      });

      // Clear state
      setCompletingTaskId(null);
      setCompletionRemarks('');
    } catch (err) {
      console.error("Firestore writing error:", err);
    }
  };

  // Create customized routine tasks
  const handleCreateChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    const prefix = newFrequency === 'daily' ? 'D' : newFrequency === 'weekly' ? 'W' : 'M';
    const uniqueId = `MNT-${prefix}-${Date.now().toString().slice(-4)}`;

    const newTask: MaintenanceTask = {
      id: uniqueId,
      title: newTitle.trim(),
      description: newDescription.trim(),
      frequency: newFrequency,
      role: newRole,
      lastDone: 'Never Checked',
      history: []
    };

    try {
      await setDoc(doc(db, 'maintenance_tasks', uniqueId), newTask);
      // Reset form variables
      setNewTitle('');
      setNewDescription('');
      setShowAddNewChore(false);
    } catch (err) {
      console.error("Database task write error:", err);
    }
  };

  // Query filters
  const filteredTasks = tasks.filter(task => {
    const matchesFreq = task.frequency === selectedFreq;
    const matchesRole = selectedRole === 'all' 
      ? true 
      : selectedRole === 'head' 
        ? (task.role === 'head' || task.role === 'both') 
        : (task.role === 'junior' || task.role === 'both');
    return matchesFreq && matchesRole;
  });

  const totalRoutines = tasks.filter(t => t.frequency === selectedFreq).length;
  
  // Calculate completed today or yesterday checks
  const completedRecently = tasks.filter(task => {
    if (!task.lastDone || task.lastDone === 'Never Checked') return false;
    const lastDoneDate = new Date(task.lastDone);
    const differenceInMs = Date.now() - lastDoneDate.getTime();
    const differenceInDays = differenceInMs / (1000 * 60 * 60 * 24);
    return differenceInDays <= 2;
  }).length;

  return (
    <div id="maintenance-panel" className="space-y-6 font-sans text-sm text-zinc-300">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-850 pb-3">
        <div>
          <h2 className="text-base font-semibold font-display text-zinc-100 flex items-center gap-2">
            <Calendar size={18} className="text-emerald-400" />
            Maintenance Planner & Routines
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Scheduled checks to prolong the life of expensive recording monitors, computer modules, and instruments.</p>
        </div>
        {isAdmin && (
          <button 
            type="button"
            onClick={() => setShowAddNewChore(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-100 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-sm ml-auto sm:ml-0 uppercase tracking-wide select-none h-9"
          >
            <Plus size={13} />
            Create Routine Task
          </button>
        )}
      </div>

      {/* Mini metric badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl space-y-1.5 select-none shadow-sm">
          <h4 className="text-[10px] font-semibold uppercase text-zinc-450 tracking-wider flex items-center gap-1.5">
            <ListTodo size={13} className="text-emerald-400" /> Configured Tasks
          </h4>
          <p className="text-base font-bold text-zinc-100 font-display">{totalRoutines} {selectedFreq} Routines Active</p>
          <span className="text-[11px] text-zinc-500">Active schedule allocation</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl space-y-1.5 select-none shadow-sm">
          <h4 className="text-[10px] font-semibold uppercase text-zinc-450 tracking-wider flex items-center gap-1.5">
            <TrendingUp size={13} className="text-emerald-400 animate-pulse" /> Compliance Status
          </h4>
          <p className="text-base font-bold text-zinc-100 font-display">{completedRecently} Checks Done Recently</p>
          <span className="text-[11px] text-zinc-500">Audited in the past 48 hours</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl space-y-1.5 select-none shadow-sm">
          <h4 className="text-[10px] font-semibold uppercase text-zinc-450 tracking-wider flex items-center gap-1.5">
            <AlertCircle size={13} className="text-emerald-400" /> Responsible Crew
          </h4>
          <p className="text-base font-bold text-zinc-100 font-display">HOD & Junior Incharge</p>
          <span className="text-[11px] text-zinc-500">Cooperative hostel stewardship</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-550 animate-pulse uppercase text-xs">Syncing routine checklist matrices...</div>
      ) : (
        <>
          {/* Freq and Crew toggles */}
          <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-center gap-3 select-none">
            <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 w-full sm:w-auto">
              {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setSelectedFreq(freq)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-all cursor-pointer ${
                    selectedFreq === freq 
                      ? 'bg-zinc-900 text-emerald-400 border border-zinc-805 shadow-sm font-semibold' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                  }`}
                >
                  {freq} Chores
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs w-full sm:w-auto justify-end">
              <span className="text-zinc-400 font-medium uppercase tracking-wider text-[10px]">Responsible:</span>
              <select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value as any)}
                className="p-1.5 px-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none text-zinc-300 font-medium cursor-pointer text-xs"
              >
                <option value="all" className="bg-zinc-900">Everyone's Chores</option>
                <option value="head" className="bg-zinc-900">Head of Dept (Venkatesh)</option>
                <option value="junior" className="bg-zinc-900">Junior Incharge (Karthik)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Left Side: Chores lists */}
            <div className="lg:col-span-7 space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-16 bg-zinc-950/20 border border-dashed border-zinc-800 rounded-xl space-y-2">
                  <CheckCircle size={32} className="text-zinc-700 mx-auto animate-pulse" />
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">No pending chores registered</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-relaxed">All routines matching this filter configuration are registered as complete or aren't scheduled.</p>
                </div>
              ) : (
                filteredTasks.map(task => {
                  const lastDoneText = task.lastDone && task.lastDone !== 'Never Checked' ? `Checked: ${task.lastDone}` : "Never Checked";
                  return (
                    <div 
                      key={task.id} 
                      className="bg-zinc-900 rounded-xl border border-zinc-800/80 p-5 space-y-3 hover:border-zinc-750 transition-all shadow-sm"
                    >
                      <div className="flex justify-between items-start gap-2 w-full">
                        <div>
                          <span className="font-mono text-[9px] font-semibold px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 uppercase tracking-wide text-zinc-500 select-all">{task.id}</span>
                          <h3 className="font-semibold text-zinc-100 text-sm tracking-wide mt-2 select-all leading-tight">{task.title}</h3>
                        </div>
                        <span className={`px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded-full border whitespace-nowrap select-none ${
                          task.role === 'head' 
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' 
                            : task.role === 'junior' 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {task.role === 'head' ? 'HOD Venkatesh' : task.role === 'junior' ? 'Junior Incharge' : 'Joint Duty'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed select-all">{task.description}</p>

                      <div className="pt-3 border-t border-zinc-850/60 flex flex-col sm:flex-row justify-between items-stretch sm:items-center text-xs gap-3 select-none">
                        <span className="text-zinc-500 italic flex items-center gap-1.5 select-all font-medium">
                          <Clock size={12} className="text-zinc-600" /> {lastDoneText}
                        </span>
                        
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setCompletingTaskId(task.id)}
                            className="bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-250 py-1.5 px-3.5 rounded-lg font-medium text-[10px] uppercase cursor-pointer tracking-wider"
                          >
                            Custom Log
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFastLogCompletion(task.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-zinc-100 py-1.5 px-3.5 rounded-lg font-medium text-[10px] uppercase cursor-pointer tracking-wider flex items-center gap-1 shadow-xs"
                          >
                            <CheckCircle size={10} />
                            Fast Complete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Side: Log completes history scroll */}
            <div className="lg:col-span-5 bg-zinc-900 p-5 rounded-xl border border-zinc-800/80 h-fit space-y-4 select-all">
              <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 border-b border-zinc-800 pb-3 uppercase tracking-wide font-display select-none">
                <History size={13} className="text-emerald-400" />
                Routine Completed Logs
              </h3>

              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {tasks.flatMap(t => (t.history || []).map(h => ({ ...h, taskTitle: t.title, taskId: t.id }))).length === 0 ? (
                  <div className="text-center py-20 text-zinc-500 italic text-xs uppercase select-none font-sans">
                    No completion logs recorded yet.
                  </div>
                ) : (
                  tasks.flatMap(t => (t.history || []).map(h => ({ ...h, taskTitle: t.title, taskId: t.id })))
                    .sort((a,b) => b.date.localeCompare(a.date))
                    .map((log, idx) => (
                      <div key={idx} className="p-3 bg-zinc-950/40 rounded-lg border border-zinc-850 text-xs space-y-1 block leading-normal select-text shadow-sm font-sans">
                        <div className="flex justify-between items-start gap-2">
                          <strong className="text-zinc-200 text-xs leading-snug block font-medium w-4/5 truncate">{log.taskTitle}</strong>
                          <span className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-zinc-500 rounded whitespace-nowrap">{log.taskId}</span>
                        </div>
                        <p className="text-zinc-400 italic text-[11px] mt-1 pl-2 border-l border-zinc-800">"{log.remarks}"</p>
                        <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-2 border-t border-zinc-850/60 uppercase select-none">
                          <span className="flex items-center gap-1 text-zinc-400 font-medium">
                            <User size={10} /> {log.completedBy.split(' ')[0]}
                          </span>
                          <span>{log.date}</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {/* Pop Up Form for Task Completion */}
      {completingTaskId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800/80 w-full max-w-sm overflow-hidden font-sans shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800/60 text-zinc-200 flex justify-between items-center text-xs font-semibold uppercase tracking-wider font-display">
              <h3>Log Routine Completed Checks</h3>
              <button type="button" onClick={() => setCompletingTaskId(null)} className="text-zinc-400 hover:text-zinc-200 text-lg cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleCompleteChoreSubmit} className="p-5 space-y-4 text-xs text-zinc-300">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Assigned Member *</label>
                <input 
                  type="text"
                  value={completedBy}
                  onChange={(e) => setCompletedBy(e.target.value)}
                  placeholder="e.g. Venkatesh Incharge"
                  required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Observations Remarks *</label>
                <textarea 
                  placeholder="Describe wiping piano keyboards, checking cables tension, vacuum filter conditions, etc..." 
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 h-20 text-xs"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button 
                  type="button" 
                  onClick={() => setCompletingTaskId(null)}
                  className="px-4 py-2 text-zinc-400 bg-zinc-950 hover:bg-zinc-850 rounded-lg font-medium uppercase text-[10px] border border-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-zinc-100 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold uppercase text-[10px] cursor-pointer"
                >
                  Confirm Met
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop Up Form for Creating Checklists */}
      {showAddNewChore && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800/80 w-full max-w-sm overflow-hidden font-sans shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800/60 flex justify-between items-center text-zinc-250 text-xs font-semibold uppercase tracking-wider font-display">
              <h3>Create Custom Routine</h3>
              <button type="button" onClick={() => setShowAddNewChore(false)} className="text-zinc-400 hover:text-zinc-200 text-lg cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleCreateChore} className="p-5 space-y-4 text-xs text-zinc-300">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Routine Title / Chore Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Acoustic guitar fret conditioning" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Frequency *</label>
                  <select 
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value as any)}
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 cursor-pointer text-xs"
                  >
                    <option value="daily">Daily Chores</option>
                    <option value="weekly">Weekly Checklist</option>
                    <option value="monthly">Monthly Audit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Crew Role *</label>
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 cursor-pointer text-xs"
                  >
                    <option value="junior">Junior Incharge</option>
                    <option value="head">HOD Incharge</option>
                    <option value="both">Joint Duty</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Action Description and Steps *</label>
                <textarea 
                  placeholder="Describe standard routines steps instructions..." 
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 h-20 text-xs"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button 
                  type="button" 
                  onClick={() => setShowAddNewChore(false)}
                  className="px-4 py-2 text-zinc-400 bg-zinc-950 hover:bg-zinc-850 rounded-lg font-medium uppercase text-[10px] border border-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-zinc-100 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold uppercase text-[10px] cursor-pointer"
                >
                  Create Routine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
