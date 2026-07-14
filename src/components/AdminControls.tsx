import React, { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from '../lib/firebase';
import { Shield, UserPlus, Trash2, Edit, Users, Mail, CheckCircle, Crown, ChevronDown, X, AlertTriangle } from 'lucide-react';
import type { AllowedUser, UserRole } from '../types';

const MASTER_EMAIL = 'koushikv@sssihl.edu.in';

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; text: string }> = {
  admin:        { label: 'Admin',        bg: 'bg-[#0071e3]/10', text: 'text-[#0071e3]' },
  junior_admin: { label: 'Junior admin', bg: 'bg-[#ff9f0a]/10', text: 'text-[#ff9f0a]' },
  member:       { label: 'Member',       bg: 'bg-[#34c759]/10', text: 'text-[#34c759]' },
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
          email: (data.email ?? d.id).toLowerCase(),
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
      flash(`✓ ROLE UPDATED: ${email} -> ${role.toUpperCase()}`);
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
    <div className="bg-white rounded-2xl border border-[#e8e8ed] p-6 space-y-6 font-sans max-w-2xl mx-auto">
      {/* -- Header -- */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[22px] font-bold text-[#1d1d1f]">
            User management
          </h3>
          <p className="text-[13px] text-[#86868b] mt-0.5">
            Manage authorized accounts and role permissions
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f5f5f7] rounded-full">
          <span className="text-[13px] font-medium text-[#1d1d1f]">{users.length}</span>
          <span className="text-[12px] text-[#86868b]">users</span>
        </div>
      </div>

      {/* -- Flash Messages -- */}
      {successMsg && (
        <div className="p-3 bg-[#34c759]/10 text-[#34c759] text-[13px] rounded-xl flex items-center gap-2">
          <CheckCircle size={14} />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-[#ff3b30]/10 text-[#ff3b30] text-[13px] rounded-xl flex items-center gap-2">
          <AlertTriangle size={14} />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* -- Add User Form -- */}
      <form onSubmit={handleAddUser} className="space-y-4 bg-[#f5f5f7] rounded-2xl p-5">
        <span className="text-[17px] font-semibold text-[#1d1d1f]">Add new user</span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Email */}
          <div>
            <label className="block text-[12px] text-[#86868b] font-medium mb-1.5">Email</label>
            <input
              type="email"
              placeholder="user@sssihl.edu.in"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-[12px] text-[#86868b] font-medium mb-1.5">Name</label>
            <input
              type="text"
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="w-full bg-white border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
            />
          </div>
        </div>

        <div className="flex items-end gap-3">
          {/* Role Dropdown */}
          <div className="flex-1">
            <label className="block text-[12px] text-[#86868b] font-medium mb-1.5">Role</label>
            <div className="relative">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full appearance-none bg-white border border-[#d2d2d7] rounded-lg px-3 py-2.5 pr-8 text-[14px] text-[#1d1d1f] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
              >
                <option value="admin">Admin</option>
                <option value="junior_admin">Junior admin</option>
                <option value="member">Member</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-3 text-[#86868b] pointer-events-none" />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2.5 text-[14px] font-medium cursor-pointer transition-colors whitespace-nowrap"
          >
            Add user
          </button>
        </div>
      </form>

      {/* -- User List -- */}
      <div className="space-y-3">
        <span className="text-[17px] font-semibold text-[#1d1d1f]">
          All users
        </span>

        {loading ? (
          <p className="text-[#86868b] animate-pulse py-8 text-center text-[14px]">
            Loading users…
          </p>
        ) : users.length === 0 ? (
          <p className="text-[#86868b] py-8 text-center text-[14px]">
            No users registered yet
          </p>
        ) : (
          <div className="rounded-2xl border border-[#e8e8ed] max-h-80 overflow-y-auto divide-y divide-[#e8e8ed]">
            {users.map((user) => {
              const isMaster = user.email === MASTER_EMAIL;
              const roleStyle = ROLE_CONFIG[user.role];
              const isEditing = editingEmail === user.email;
              const isConfirmingDelete = confirmDeleteEmail === user.email;

              return (
                <div
                  key={user.email}
                  className="flex items-center justify-between gap-3 px-4 py-3 group hover:bg-[#f5f5f7] transition-colors"
                >
                  {/* Left: user info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar circle */}
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold ${
                      isMaster
                        ? 'bg-[#0071e3]/10 text-[#0071e3]'
                        : 'bg-[#f5f5f7] text-[#6e6e73]'
                    }`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-[#1d1d1f] truncate">{user.name}</span>
                        {/* Role badge */}
                        {isMaster ? (
                          <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0071e3]/10 text-[#0071e3]">
                            Owner
                          </span>
                        ) : (
                          <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                            {roleStyle.label}
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] text-[#86868b] truncate block mt-0.5">{user.email}</span>
                      {user.addedBy && (
                        <span className="text-[11px] text-[#86868b] mt-0.5 block truncate">
                          Added by {user.addedBy}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: actions */}
                  {!isMaster && (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* -- Inline Role Editor -- */}
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            className="appearance-none bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-2.5 py-1.5 text-[13px] text-[#1d1d1f] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                          >
                            <option value="admin">Admin</option>
                            <option value="junior_admin">Junior admin</option>
                            <option value="member">Member</option>
                          </select>
                          <button
                            onClick={() => handleUpdateRole(user.email, editRole)}
                            className="text-[#0071e3] hover:text-[#0077ED] text-[13px] font-medium cursor-pointer transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingEmail(null)}
                            className="text-[#86868b] hover:text-[#6e6e73] text-[13px] font-medium cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : isConfirmingDelete ? (
                        /* -- Delete Confirmation -- */
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-[#ff3b30] font-medium">Remove?</span>
                          <button
                            onClick={() => handleDeleteUser(user.email)}
                            className="bg-[#ff3b30] hover:bg-[#ff453a] text-white rounded-full px-3 py-1 text-[12px] font-medium cursor-pointer transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteEmail(null)}
                            className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-3 py-1 text-[12px] font-medium cursor-pointer transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        /* -- Default Actions (visible on hover) -- */
                        <>
                          <button
                            onClick={() => { setEditingEmail(user.email); setEditRole(user.role); }}
                            className="text-[#0071e3] hover:text-[#0077ED] text-[13px] font-medium cursor-pointer transition-colors md:opacity-0 md:group-hover:opacity-100 opacity-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmDeleteEmail(user.email)}
                            className="text-[#ff3b30] hover:text-[#ff453a] text-[13px] font-medium cursor-pointer transition-colors md:opacity-0 md:group-hover:opacity-100 opacity-100"
                          >
                            Remove
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
