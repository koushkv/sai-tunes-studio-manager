import React, { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from '../lib/firebase';
import { Plus, Trash2, Edit, Music, Users, Clock, ChevronDown, ChevronUp, X, Activity } from 'lucide-react';
import type { MusicProject, ProjectStage, AllowedUser } from '../types';

interface ProjectsTrackerProps {
  currentUser: {
    email: string;
    displayName: string;
  };
  isAdmin: boolean;
  userRole: import('../types').UserRole | null;
}

const STAGES: { value: ProjectStage; label: string; bg: string; text: string; step: number }[] = [
  { value: 'composing',   label: 'Composing',   bg: 'bg-[#0071e3]/10', text: 'text-[#0071e3]', step: 1 },
  { value: 'arranging',   label: 'Arranging',   bg: 'bg-[#af52de]/10', text: 'text-[#af52de]', step: 2 },
  { value: 'live_inputs', label: 'Live Inputs', bg: 'bg-[#ff9500]/10', text: 'text-[#ff9500]', step: 3 },
  { value: 'mixing',      label: 'Mixing',      bg: 'bg-[#ff2d55]/10', text: 'text-[#ff2d55]', step: 4 },
  { value: 'mastering',   label: 'Mastering',   bg: 'bg-[#55befc]/10', text: 'text-[#0071e3]', step: 5 },
  { value: 'completed',   label: 'Completed',   bg: 'bg-[#34c759]/10', text: 'text-[#34c759]', step: 6 },
];

export default function ProjectsTracker({ currentUser, isAdmin, userRole }: ProjectsTrackerProps) {
  const canManage = isAdmin || userRole === 'junior_admin';
  const [projects, setProjects] = useState<MusicProject[]>([]);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded card state
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [stage, setStage] = useState<ProjectStage>('composing');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Quick Stage Update Modal
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);
  const [updateStageValue, setUpdateStageValue] = useState<ProjectStage>('composing');
  const [updateNotes, setUpdateNotes] = useState('');

  // Whitelist/allowed users mapping to show student selections
  useEffect(() => {
    const usersRef = collection(db, 'allowed_users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const list: AllowedUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          email: data.email || doc.id,
          name: data.name || '',
          role: data.role || 'member',
          addedBy: data.addedBy || '',
          addedAt: data.addedAt || '',
        });
      });
      setAllowedUsers(list);
    });
    return () => unsubscribe();
  }, []);

  // Listen to Projects from Firestore
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
      // Sort projects by updatedAt descending
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setProjects(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore projects fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !occasion.trim() || selectedStudents.length === 0) return;

    const projectId = editingProjectId || `project-${Date.now()}`;
    const targetProject = projects.find(p => p.id === projectId);

    const timeString = new Date().toISOString();
    const updaterName = currentUser.displayName || currentUser.email;

    let initialHistory = targetProject?.history || [];

    // If new project or stage changed, log in history
    if (!editingProjectId || (targetProject && targetProject.stage !== stage)) {
      initialHistory = [
        {
          stage,
          updatedBy: updaterName,
          updatedAt: timeString,
          notes: notes.trim() || (editingProjectId ? 'Project details updated' : 'Project initiated'),
        },
        ...initialHistory
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
      createdBy: targetProject?.createdBy || updaterName,
      createdAt: targetProject?.createdAt || timeString,
      history: initialHistory,
    };

    try {
      await setDoc(doc(db, 'projects', projectId), payload);
      resetForm();
    } catch (err) {
      console.error("Error saving project:", err);
    }
  };

  const handleQuickStageUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingProjectId) return;

    const targetProject = projects.find(p => p.id === updatingProjectId);
    if (!targetProject) return;

    const timeString = new Date().toISOString();
    const updaterName = currentUser.displayName || currentUser.email;

    const updatedHistory = [
      {
        stage: updateStageValue,
        updatedBy: updaterName,
        updatedAt: timeString,
        notes: updateNotes.trim() || `Stage updated to ${STAGES.find(s => s.value === updateStageValue)?.label}`,
      },
      ...(targetProject.history || [])
    ];

    try {
      await updateDoc(doc(db, 'projects', updatingProjectId), {
        stage: updateStageValue,
        updatedBy: updaterName,
        updatedAt: timeString,
        notes: updateNotes.trim() || targetProject.notes,
        history: updatedHistory,
      });
      setUpdatingProjectId(null);
      setUpdateNotes('');
    } catch (err) {
      console.error("Error updating stage:", err);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId));
    } catch (err) {
      console.error("Error deleting project:", err);
    }
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
    setSelectedStudents(project.students);
    setNotes(project.notes || '');
    setShowForm(true);
  };

  const toggleStudentSelection = (email: string) => {
    if (selectedStudents.includes(email)) {
      setSelectedStudents(selectedStudents.filter(e => e !== email));
    } else {
      setSelectedStudents([...selectedStudents, email]);
    }
  };

  // Find displayName for email whitelists
  const getStudentNamesStr = (emails: string[]) => {
    return emails.map(email => {
      const u = allowedUsers.find(user => user.email === email);
      return u ? u.name : email.split('@')[0];
    }).join(', ');
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-[#1d1d1f]">Projects</h2>
          <p className="text-[14px] text-[#86868b] mt-0.5">Track music production stages and hostel recordings</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-5 space-y-1">
          <p className="text-[12px] text-[#86868b] font-medium">Active projects</p>
          <p className="text-[22px] font-bold text-[#1d1d1f]">
            {projects.filter(p => p.stage !== 'completed').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-5 space-y-1">
          <p className="text-[12px] text-[#86868b] font-medium">In mix / master</p>
          <p className="text-[22px] font-bold text-[#1d1d1f]">
            {projects.filter(p => p.stage === 'mixing' || p.stage === 'mastering').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-5 space-y-1">
          <p className="text-[12px] text-[#86868b] font-medium">Completed songs</p>
          <p className="text-[22px] font-bold text-[#34c759]">
            {projects.filter(p => p.stage === 'completed').length}
          </p>
        </div>
      </div>

      {/* ── Main List ── */}
      {loading ? (
        <div className="text-center py-20 text-[#86868b] text-[14px]">Syncing project catalog…</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-[#e8e8ed] space-y-3">
          <Music className="mx-auto text-[#d2d2d7]" size={40} />
          <p className="text-[16px] text-[#1d1d1f] font-semibold">No Projects Yet</p>
          <p className="text-[14px] text-[#86868b] max-w-sm mx-auto">Click "New Project" to add your first composition, song track, or HOD event schedule.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => {
            const currentStageObj = STAGES.find(s => s.value === project.stage) || STAGES[0];
            const isExpanded = expandedProjectId === project.id;
            const progressPct = Math.round((currentStageObj.step / 6) * 100);

            return (
              <div 
                key={project.id}
                className="bg-white rounded-2xl border border-[#e8e8ed] overflow-hidden transition-all shadow-xs"
              >
                {/* Visual top bar colored by stage */}
                <div className="h-1 bg-[#f5f5f7] w-full">
                  <div 
                    className="h-full transition-all duration-500 ease-out" 
                    style={{ 
                      width: `${progressPct}%`,
                      backgroundColor: project.stage === 'completed' ? '#34c759' : '#0071e3'
                    }} 
                  />
                </div>

                <div className="p-5 space-y-4">
                  {/* Top info row */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[18px] font-semibold text-[#1d1d1f] leading-tight">{project.name}</h3>
                        <span className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full ${currentStageObj.bg} ${currentStageObj.text}`}>
                          {currentStageObj.label}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#86868b]">Occasion: <span className="font-medium text-[#1d1d1f]">{project.occasion}</span></p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setUpdateStageValue(project.stage);
                          setUpdatingProjectId(project.id);
                        }}
                        className="bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#0071e3] font-medium rounded-full px-3 py-1.5 text-[12px] cursor-pointer transition-colors"
                      >
                        Update Stage
                      </button>
                      <button
                        onClick={() => openEdit(project)}
                        className="text-[#86868b] hover:text-[#1d1d1f] p-1.5 rounded-full hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                        title="Edit Project"
                      >
                        <Edit size={16} />
                      </button>
                      {canManage && (
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="text-[#ff3b30] hover:text-[#ff453a] p-1.5 rounded-full hover:bg-[#ff3b30]/10 transition-colors cursor-pointer"
                          title="Delete Project"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary progress bar */}
                  <div className="hidden sm:grid grid-cols-6 gap-1 bg-[#f5f5f7] p-1 rounded-lg">
                    {STAGES.map(s => {
                      const isActive = s.step <= currentStageObj.step;
                      const isCurrent = s.value === project.stage;
                      return (
                        <div 
                          key={s.value}
                          className={`text-center py-1 rounded text-[10px] font-medium select-none transition-colors ${
                            isCurrent 
                              ? `${s.bg} ${s.text} font-semibold ring-1 ring-black/[0.05]` 
                              : isActive 
                                ? 'bg-white text-[#1d1d1f]' 
                                : 'text-[#86868b]'
                          }`}
                        >
                          {s.label}
                        </div>
                      );
                    })}
                  </div>

                  {/* Mid section: Students & latest notes */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-[13px] pt-2">
                    <div className="flex items-center gap-1.5 text-[#6e6e73]">
                      <Users size={14} className="text-[#86868b] shrink-0" />
                      <span>{getStudentNamesStr(project.students)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#86868b]">
                      <Clock size={14} className="shrink-0" />
                      <span>Updated {new Date(project.updatedAt).toLocaleDateString()} by {project.updatedBy}</span>
                    </div>
                  </div>

                  {project.notes && (
                    <p className="text-[13px] text-[#6e6e73] bg-[#f5f5f7] p-3.5 rounded-xl border border-[#e8e8ed] leading-relaxed">
                      {project.notes}
                    </p>
                  )}

                  {/* Toggle Timeline */}
                  {project.history && project.history.length > 0 && (
                    <div className="border-t border-[#e8e8ed] pt-3">
                      <button
                        onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                        className="flex items-center gap-1 text-[12px] text-[#0071e3] hover:text-[#0077ED] font-medium cursor-pointer transition-colors"
                      >
                        {isExpanded ? (
                          <>Hide History <ChevronUp size={14} /></>
                        ) : (
                          <>View History Timeline ({project.history.length}) <ChevronDown size={14} /></>
                        )}
                      </button>

                      {/* Expandable History Feed */}
                      {isExpanded && (
                        <div className="mt-4 pl-3 border-l-2 border-[#e8e8ed] space-y-4 animate-in fade-in duration-200">
                          {project.history.map((hist, index) => {
                            const stageObj = STAGES.find(s => s.value === hist.stage);
                            return (
                              <div key={index} className="relative space-y-1">
                                {/* Visual dot */}
                                <div className="absolute -left-[18px] top-1.5 h-2 w-2 rounded-full bg-[#d2d2d7]" />
                                
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${stageObj?.bg} ${stageObj?.text}`}>
                                    {stageObj?.label || hist.stage}
                                  </span>
                                  <span className="text-[11px] text-[#86868b]">
                                    by {hist.updatedBy} · {new Date(hist.updatedAt).toLocaleDateString()} at {new Date(hist.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                {hist.notes && (
                                  <p className="text-[12px] text-[#6e6e73] pl-1 leading-relaxed">
                                    {hist.notes}
                                  </p>
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
      )}

      {/* ── ADD/EDIT MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden font-sans max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#e8e8ed] flex justify-between items-center">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
                {editingProjectId ? 'Edit Project' : 'New Project'}
              </h3>
              <button onClick={resetForm} className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrEdit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Project / Song Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Holi Special Bhajan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Occasion / Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Holi Festival 2026"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Initial Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as ProjectStage)}
                    className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] cursor-pointer"
                  >
                    {STAGES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Select Students working on it */}
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Assigned Students *</label>
                <div className="max-h-[120px] overflow-y-auto border border-[#d2d2d7] rounded-lg bg-[#f5f5f7] p-2.5 space-y-1.5">
                  {allowedUsers.length === 0 ? (
                    <p className="text-[12px] text-[#86868b] text-center py-2">No students whitelisted yet.</p>
                  ) : (
                    allowedUsers.map(user => (
                      <label key={user.email} className="flex items-center gap-2 text-[13px] text-[#1d1d1f] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(user.email)}
                          onChange={() => toggleStudentSelection(user.email)}
                          className="h-4 w-4 rounded border-[#d2d2d7] text-[#0071e3] focus:ring-[#0071e3]/30"
                        />
                        <span>{user.name} ({user.email.split('@')[0]})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Remarks / Progress Notes</label>
                <textarea
                  placeholder="Additional details about compositions, instrumentation, required recordings, tracks length, etc..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e8e8ed]">
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedStudents.length === 0}
                  className="bg-[#0071e3] hover:bg-[#0077ED] disabled:bg-[#e8e8ed] disabled:text-[#86868b] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors"
                >
                  {editingProjectId ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── QUICK STAGE UPDATE MODAL ── */}
      {updatingProjectId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden font-sans max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#e8e8ed] flex justify-between items-center">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Update Project Stage</h3>
              <button onClick={() => setUpdatingProjectId(null)} className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickStageUpdate} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Next Stage</label>
                <select
                  value={updateStageValue}
                  onChange={(e) => setUpdateStageValue(e.target.value as ProjectStage)}
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] cursor-pointer"
                >
                  {STAGES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Update Notes *</label>
                <textarea
                  required
                  placeholder="Describe details of work done (e.g. finished vocals inputs, added keyboard pads, mixed sub-bass)..."
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e8e8ed]">
                <button
                  type="button"
                  onClick={() => { setUpdatingProjectId(null); setUpdateNotes(''); }}
                  className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors"
                >
                  Save Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
