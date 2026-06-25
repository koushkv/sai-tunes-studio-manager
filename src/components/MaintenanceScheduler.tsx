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
        remarks: completionRemarks.trim() || 'Passed routine maintenance check'
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
    <div id="maintenance-panel" className="space-y-6 font-sans text-[14px] text-[#1d1d1f]">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-[#1d1d1f]">
            Maintenance
          </h2>
          <p className="text-[13px] text-[#86868b] mt-1">Scheduled checks to prolong the life of recording monitors, computer modules, and instruments.</p>
        </div>
        {isAdmin && (
          <button 
            type="button"
            onClick={() => setShowAddNewChore(true)}
            className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors"
          >
            <Plus size={15} />
            Create task
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-5 space-y-1">
          <p className="text-[12px] text-[#86868b] font-medium">Configured tasks</p>
          <p className="text-[17px] font-semibold text-[#1d1d1f]">{totalRoutines} {selectedFreq} routines</p>
          <p className="text-[12px] text-[#86868b]">Active schedule allocation</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-5 space-y-1">
          <p className="text-[12px] text-[#86868b] font-medium">Compliance status</p>
          <p className="text-[17px] font-semibold text-[#1d1d1f]">{completedRecently} checks done recently</p>
          <p className="text-[12px] text-[#86868b]">Audited in the past 48 hours</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-5 space-y-1">
          <p className="text-[12px] text-[#86868b] font-medium">Responsible crew</p>
          <p className="text-[17px] font-semibold text-[#1d1d1f]">HOD & Junior Incharge</p>
          <p className="text-[12px] text-[#86868b]">Hostel music department crew</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#86868b] text-[14px]">Syncing routine checklist…</div>
      ) : (
        <>
          {/* Frequency and Role filters */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex gap-2 w-full sm:w-auto">
              {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setSelectedFreq(freq)}
                  className={`px-4 py-2 rounded-full text-[13px] font-medium capitalize transition-colors cursor-pointer ${
                    selectedFreq === freq 
                      ? 'bg-[#1d1d1f] text-white' 
                      : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
                  }`}
                >
                  {freq}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-[13px] text-[#86868b] font-medium">Role:</span>
              <select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value as any)}
                className="bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] cursor-pointer"
              >
                <option value="all">Everyone's chores</option>
                <option value="head">Head of Dept</option>
                <option value="junior">Junior Incharge</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Left Side: Task cards */}
            <div className="lg:col-span-7 space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-[14px] text-[#86868b]">No tasks match this filter.</p>
                  <p className="text-[13px] text-[#86868b] mt-1">All routines are complete or not scheduled.</p>
                </div>
              ) : (
                filteredTasks.map(task => {
                  const lastDoneText = task.lastDone && task.lastDone !== 'Never Checked' ? `Checked: ${task.lastDone}` : "Never checked";
                  return (
                    <div 
                      key={task.id} 
                      className="bg-white rounded-2xl border border-[#e8e8ed] p-5 space-y-3"
                    >
                      <div className="flex justify-between items-start gap-2 w-full">
                        <div>
                          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#86868b]/10 text-[#86868b]">{task.id}</span>
                          <h3 className="font-semibold text-[#1d1d1f] text-[15px] mt-2 leading-tight">{task.title}</h3>
                        </div>
                        <span className={`px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap ${
                          task.role === 'head' 
                            ? 'bg-[#0071e3]/10 text-[#0071e3]' 
                            : task.role === 'junior' 
                              ? 'bg-[#ff9f0a]/10 text-[#ff9f0a]' 
                              : 'bg-[#34c759]/10 text-[#34c759]'
                        }`}>
                          {task.role === 'head' ? 'Head of Dept' : task.role === 'junior' ? 'Junior Incharge' : 'Joint Duty'}
                        </span>
                      </div>

                      <p className="text-[13px] text-[#6e6e73] leading-relaxed">{task.description}</p>

                      <div className="pt-3 border-t border-[#e8e8ed] flex flex-col sm:flex-row justify-between items-stretch sm:items-center text-[13px] gap-3">
                        <span className="text-[#86868b] flex items-center gap-1.5 font-medium">
                          <Clock size={14} className="text-[#86868b]" /> {lastDoneText}
                        </span>
                        
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setCompletingTaskId(task.id)}
                            className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors"
                          >
                            Custom log
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFastLogCompletion(task.id)}
                            className="bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors flex items-center gap-1.5"
                          >
                            <CheckCircle size={14} />
                            Quick complete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Side: History log */}
            <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-[#e8e8ed] h-fit space-y-4">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f] border-b border-[#e8e8ed] pb-3">
                Completion logs
              </h3>

              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {tasks.flatMap(t => (t.history || []).map(h => ({ ...h, taskTitle: t.title, taskId: t.id }))).length === 0 ? (
                  <div className="text-center py-20 text-[#86868b] text-[13px]">
                    No completion logs recorded yet.
                  </div>
                ) : (
                  tasks.flatMap(t => (t.history || []).map(h => ({ ...h, taskTitle: t.title, taskId: t.id })))
                    .sort((a,b) => b.date.localeCompare(a.date))
                    .map((log, idx) => (
                      <div key={idx} className="p-3 bg-[#f5f5f7] rounded-xl text-[13px] space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <strong className="text-[#1d1d1f] text-[13px] font-semibold leading-snug block w-4/5 truncate">{log.taskTitle}</strong>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white border border-[#e8e8ed] text-[#86868b] whitespace-nowrap">{log.taskId}</span>
                        </div>
                        <p className="text-[#6e6e73] text-[12px] mt-1 pl-2 border-l-2 border-[#d2d2d7]">"{log.remarks}"</p>
                        <div className="flex justify-between items-center text-[12px] text-[#86868b] pt-2 border-t border-[#e8e8ed]">
                          <span className="flex items-center gap-1 text-[#6e6e73] font-medium">
                            <User size={12} /> {log.completedBy.split(' ')[0]}
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

      {/* Modal: Log completion */}
      {completingTaskId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden font-sans">
            <div className="px-6 py-4 border-b border-[#e8e8ed] flex justify-between items-center">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Log completion</h3>
              <button type="button" onClick={() => setCompletingTaskId(null)} className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCompleteChoreSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[13px] text-[#6e6e73] font-medium mb-1.5">Assigned member</label>
                <input 
                  type="text"
                  value={completedBy}
                  onChange={(e) => setCompletedBy(e.target.value)}
                  placeholder="e.g. HOD Incharge"
                  required
                  className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                />
              </div>

              <div>
                <label className="block text-[13px] text-[#6e6e73] font-medium mb-1.5">Observations and remarks</label>
                <textarea 
                  placeholder="Describe wiping piano keyboards, checking cables tension, vacuum filter conditions, etc..." 
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  required
                  className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] h-24 resize-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e8e8ed]">
                <button 
                  type="button" 
                  onClick={() => setCompletingTaskId(null)}
                  className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create task */}
      {showAddNewChore && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden font-sans">
            <div className="px-6 py-4 border-b border-[#e8e8ed] flex justify-between items-center">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Create routine task</h3>
              <button type="button" onClick={() => setShowAddNewChore(false)} className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateChore} className="p-6 space-y-5">
              <div>
                <label className="block text-[13px] text-[#6e6e73] font-medium mb-1.5">Task name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Acoustic guitar fret conditioning" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] text-[#6e6e73] font-medium mb-1.5">Frequency</label>
                  <select 
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value as any)}
                    className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] cursor-pointer"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] text-[#6e6e73] font-medium mb-1.5">Crew role</label>
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] cursor-pointer"
                  >
                    <option value="junior">Junior Incharge</option>
                    <option value="head">HOD Incharge</option>
                    <option value="both">Joint Duty</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[13px] text-[#6e6e73] font-medium mb-1.5">Description</label>
                <textarea 
                  placeholder="Describe standard routine steps and instructions..." 
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                  className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] h-24 resize-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e8e8ed]">
                <button 
                  type="button" 
                  onClick={() => setShowAddNewChore(false)}
                  className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors"
                >
                  Create task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
