import React, { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from '../lib/firebase';
import { Shield, UserPlus, Trash2, Edit, Users, Mail, CheckCircle, Crown, ChevronDown, X, AlertTriangle } from 'lucide-react';
import type { AllowedUser, UserRole } from '../types';

const MASTER_EMAIL = 'koushikv@sssihl.edu.in';

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; border: string; text: string }> = {
  admin:        { label: 'ADMIN',        bg: 'bg-indigo-500/10', border: 'border-indigo-500/25', text: 'text-indigo-400' },
  junior_admin: { label: 'JR ADMIN',     bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  text: 'text-amber-400' },
  member:       { label: 'MEMBER',       bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
};

interface AdminControlsProps {
  currentUserEmail: string;
}

export default function AdminControls({ currentUserEmail }: AdminControlsProps) {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Add-user form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('member');

  // Inline edit state
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('member');

  // Delete confirmation state
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null);

  useEffect(() => {
    const ref = collection(db, 'allowed_users');
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const list: AllowedUser[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          email: data.email ?? d.id,
          name: data.name ?? '',
          role: data.role ?? 'member',
          addedBy: data.addedBy ?? '',
          addedAt: data.addedAt ?? '',
        });
      });
      // Sort: master first, then admins, then junior_admins, then members
      const rolePriority: Record<UserRole, number> = { admin: 0, junior_admin: 1, member: 2 };
      list.sort((a, b) => {
        if (a.email === MASTER_EMAIL) return -1;
        if (b.email === MASTER_EMAIL) return 1;
        return rolePriority[a.role] - rolePriority[b.role];
      });
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error('Firestore allowed_users error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const flash = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setErrorMsg('');
    } else {
      setErrorMsg(msg);
      setSuccessMsg('');
    }
    setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    if (!email || !name) return;

    if (users.some((u) => u.email === email)) {
      flash(`USER ${email} ALREADY EXISTS`, 'error');
      return;
    }

    try {
      await setDoc(doc(db, 'allowed_users', email), {
        email,
        name,
        role: newRole,
        addedBy: currentUserEmail,
        addedAt: new Date().toISOString(),
      });
      flash(`✓ AUTHORIZED: ${email} added as ${newRole.toUpperCase()}`);
      setNewEmail('');
      setNewName('');
      setNewRole('member');
    } catch (err) {
      console.error('Error adding user:', err);
      flash('FAILED TO ADD USER', 'error');
    }
  };

  const handleUpdateRole = async (email: string, role: UserRole) => {
    if (email === MASTER_EMAIL) return;
    try {
      await updateDoc(doc(db, 'allowed_users', email), { role });
      flash(`✓ ROLE UPDATED: ${email} → ${role.toUpperCase()}`);
      setEditingEmail(null);
    } catch (err) {
      console.error('Error updating role:', err);
      flash('FAILED TO UPDATE ROLE', 'error');
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (email === MASTER_EMAIL) return;
    try {
      await deleteDoc(doc(db, 'allowed_users', email));
      flash(`✓ REVOKED: ${email} removed from allowed users`);
      setConfirmDeleteEmail(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      flash('FAILED TO REMOVE USER', 'error');
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 space-y-5 font-sans text-sm max-w-2xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/25 rounded-lg">
            <Shield size={15} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-zinc-100 text-xs uppercase tracking-wider">
              USER ACCESS MANAGEMENT
            </h3>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">
              MANAGE AUTHORIZED ACCOUNTS & ROLE PERMISSIONS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/60 border border-zinc-700/40 rounded-lg">
          <Users size={12} className="text-zinc-400" />
          <span className="text-[11px] font-mono text-zinc-300 font-medium">{users.length}</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">USERS</span>
        </div>
      </div>

      {/* ── Flash Messages ── */}
      {successMsg && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] rounded-lg flex items-center gap-2">
          <CheckCircle size={13} />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] rounded-lg flex items-center gap-2">
          <AlertTriangle size={13} />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* ── Add User Form ── */}
      <form onSubmit={handleAddUser} className="space-y-3 bg-zinc-950/50 border border-zinc-800/60 rounded-lg p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <UserPlus size={12} className="text-emerald-400" />
          <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">ADD NEW USER</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Email */}
          <div className="relative">
            <label className="block text-[9px] text-zinc-500 uppercase tracking-wider font-medium mb-1">EMAIL</label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2 text-zinc-600" size={12} />
              <input
                type="email"
                placeholder="user@sssihl.edu.in"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-600 focus:outline-none text-zinc-200 text-xs placeholder:text-zinc-700"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[9px] text-zinc-500 uppercase tracking-wider font-medium mb-1">NAME</label>
            <input
              type="text"
              placeholder="Full Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-600 focus:outline-none text-zinc-200 text-xs placeholder:text-zinc-700"
            />
          </div>
        </div>

        <div className="flex items-end gap-2.5">
          {/* Role Dropdown */}
          <div className="flex-1">
            <label className="block text-[9px] text-zinc-500 uppercase tracking-wider font-medium mb-1">ROLE</label>
            <div className="relative">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full appearance-none px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-600 focus:outline-none text-zinc-200 text-xs cursor-pointer pr-8"
              >
                <option value="admin">ADMIN</option>
                <option value="junior_admin">JUNIOR ADMIN</option>
                <option value="member">MEMBER</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-2.5 text-zinc-600 pointer-events-none" />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-100 rounded-lg font-semibold uppercase text-[10px] tracking-wider cursor-pointer flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <UserPlus size={12} />
            ADD USER
          </button>
        </div>
      </form>

      {/* ── User List ── */}
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
          <Users size={12} />
          USER REGISTRY ({users.length})
        </span>

        {loading ? (
          <p className="text-zinc-600 animate-pulse py-6 text-center text-xs uppercase tracking-wider">
            SYNCING USER DATABASE...
          </p>
        ) : users.length === 0 ? (
          <p className="text-zinc-600 py-6 text-center text-xs uppercase tracking-wider">
            NO USERS REGISTERED
          </p>
        ) : (
          <div className="bg-zinc-950/40 rounded-lg border border-zinc-800 max-h-80 overflow-y-auto divide-y divide-zinc-800/50">
            {users.map((user) => {
              const isMaster = user.email === MASTER_EMAIL;
              const roleStyle = ROLE_CONFIG[user.role];
              const isEditing = editingEmail === user.email;
              const isConfirmingDelete = confirmDeleteEmail === user.email;

              return (
                <div
                  key={user.email}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 group hover:bg-zinc-900/50 transition-colors"
                >
                  {/* Left: user info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar circle */}
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase ${
                      isMaster
                        ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                    }`}>
                      {isMaster ? <Crown size={13} /> : user.name.charAt(0)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-200 truncate">{user.name}</span>
                        {/* Role badge */}
                        {isMaster ? (
                          <span className="shrink-0 text-[8px] px-1.5 py-0.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold rounded uppercase tracking-wider">
                            MASTER
                          </span>
                        ) : (
                          <span className={`shrink-0 text-[8px] px-1.5 py-0.5 ${roleStyle.bg} border ${roleStyle.border} ${roleStyle.text} font-semibold rounded uppercase tracking-wider`}>
                            {roleStyle.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail size={9} className="text-zinc-600 shrink-0" />
                        <span className="text-[10px] text-zinc-500 truncate select-all">{user.email}</span>
                      </div>
                      {user.addedBy && (
                        <span className="text-[9px] text-zinc-600 mt-0.5 block truncate">
                          ADDED BY {user.addedBy.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: actions */}
                  {!isMaster && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* ── Inline Role Editor ── */}
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            className="appearance-none px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-[10px] text-zinc-200 cursor-pointer focus:outline-none focus:border-zinc-500"
                          >
                            <option value="admin">ADMIN</option>
                            <option value="junior_admin">JR ADMIN</option>
                            <option value="member">MEMBER</option>
                          </select>
                          <button
                            onClick={() => handleUpdateRole(user.email, editRole)}
                            className="p-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 border border-emerald-500/30 rounded transition-all cursor-pointer"
                            title="Save Role"
                          >
                            <CheckCircle size={12} />
                          </button>
                          <button
                            onClick={() => setEditingEmail(null)}
                            className="p-1 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700/50 rounded transition-all cursor-pointer"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : isConfirmingDelete ? (
                        /* ── Delete Confirmation ── */
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-red-400 uppercase tracking-wider font-semibold">CONFIRM?</span>
                          <button
                            onClick={() => handleDeleteUser(user.email)}
                            className="px-2 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/40 border border-red-500/30 rounded text-[9px] font-semibold uppercase tracking-wider transition-all cursor-pointer"
                          >
                            YES
                          </button>
                          <button
                            onClick={() => setConfirmDeleteEmail(null)}
                            className="px-2 py-1 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700/50 rounded text-[9px] font-semibold uppercase tracking-wider transition-all cursor-pointer"
                          >
                            NO
                          </button>
                        </div>
                      ) : (
                        /* ── Default Actions ── */
                        <>
                          <button
                            onClick={() => { setEditingEmail(user.email); setEditRole(user.role); }}
                            className="p-1.5 bg-zinc-800/60 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 border border-zinc-700/40 rounded-md transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Edit Role"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteEmail(user.email)}
                            className="p-1.5 bg-zinc-800/60 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 border border-zinc-700/40 rounded-md transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Remove User"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
