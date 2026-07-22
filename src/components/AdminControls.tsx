import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from '../lib/firebase';
import { Trash2, Users } from 'lucide-react';
import type { AllowedUser, UserRole } from '../types';
import { ROLE_META } from '../lib/stages';
import { formatDate, nameFromEmail } from '../lib/format';
import { firestoreErrorMessage } from '../lib/errors';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import {
  Button,
  EmptyState,
  LoadingState,
  cardClass,
  inputClass,
  labelClass,
  selectClass,
} from './ui/Primitives';

const MASTER_EMAIL = 'koushikv@sssihl.edu.in';

const ROLE_OPTIONS: { value: UserRole; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Full access, including user management' },
  { value: 'junior_admin', label: 'Junior admin', hint: 'Can manage inventory, projects, and routines' },
  { value: 'member', label: 'Student', hint: 'Can check items out and log progress' },
];

interface AdminControlsProps {
  currentUserEmail: string;
}

export default function AdminControls({ currentUserEmail }: AdminControlsProps) {
  const toast = useToast();
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Add-user form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('member');

  // Inline role editing
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('member');

  // Removal confirmation
  const [userToRemove, setUserToRemove] = useState<AllowedUser | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, 'allowed_users'), (snapshot) => {
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
      const rolePriority: Record<UserRole, number> = { admin: 0, junior_admin: 1, member: 2 };
      list.sort((a, b) => {
        if (a.email === MASTER_EMAIL) return -1;
        if (b.email === MASTER_EMAIL) return 1;
        const byRole = rolePriority[a.role] - rolePriority[b.role];
        return byRole !== 0 ? byRole : (a.name || a.email).localeCompare(b.name || b.email);
      });
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error('Firestore allowed_users error:', err);
      toast.error(firestoreErrorMessage(err, 'Could not load the user list.'));
      setLoading(false);
    });
  }, [toast]);

  const adminCount = useMemo(() => users.filter(u => u.role === 'admin').length, [users]);

  /** Prevents removing the last admin and locking everyone out of Settings. */
  const wouldOrphanAdmins = (user: AllowedUser, nextRole?: UserRole) =>
    user.role === 'admin' && adminCount <= 1 && nextRole !== 'admin';

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    if (!email || !name) return;

    if (users.some(u => u.email === email)) {
      toast.error(`${email} is already authorized.`);
      return;
    }

    setBusy(true);
    try {
      await setDoc(doc(db, 'allowed_users', email), {
        email,
        name,
        role: newRole,
        addedBy: currentUserEmail,
        addedAt: new Date().toISOString(),
      });
      toast.success(`${name} added as ${ROLE_META[newRole].label}.`);
      setNewEmail('');
      setNewName('');
      setNewRole('member');
    } catch (err) {
      console.error('Error adding user:', err);
      toast.error(firestoreErrorMessage(err, 'Could not add the user. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateRole = async (user: AllowedUser, role: UserRole) => {
    if (user.email === MASTER_EMAIL || busy) return;

    if (role === user.role) {
      setEditingEmail(null);
      return;
    }
    if (wouldOrphanAdmins(user, role)) {
      toast.error('At least one admin must remain. Promote someone else first.');
      return;
    }

    setBusy(true);
    try {
      await updateDoc(doc(db, 'allowed_users', user.email), { role });
      toast.success(`${user.name || user.email} is now ${ROLE_META[role].label}.`);
      setEditingEmail(null);
    } catch (err) {
      console.error('Error updating role:', err);
      toast.error(firestoreErrorMessage(err, 'Could not update the role. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!userToRemove || userToRemove.email === MASTER_EMAIL || busy) return;

    if (wouldOrphanAdmins(userToRemove)) {
      toast.error('At least one admin must remain. Promote someone else first.');
      setUserToRemove(null);
      return;
    }

    setBusy(true);
    try {
      await deleteDoc(doc(db, 'allowed_users', userToRemove.email));
      toast.success(`Access revoked for ${userToRemove.name || userToRemove.email}.`);
      setUserToRemove(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error(firestoreErrorMessage(err, 'Could not remove the user. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${cardClass} p-5 sm:p-6 space-y-6 font-sans`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[20px] font-bold tracking-tight text-[#1d1d1f]">User management</h3>
          <p className="text-[13px] text-[#86868b] mt-0.5">Control who can sign in and what they can do</p>
        </div>
        <span className="shrink-0 flex items-baseline gap-1.5 px-3 py-1 bg-[#f5f5f7] rounded-full">
          <span className="text-[13px] font-semibold text-[#1d1d1f] tabular-nums">{users.length}</span>
          <span className="text-[12px] text-[#86868b]">{users.length === 1 ? 'user' : 'users'}</span>
        </span>
      </div>

      {/* Add user */}
      <form onSubmit={handleAddUser} className="space-y-4 bg-[#f5f5f7] rounded-2xl p-5">
        <h4 className="text-[15px] font-semibold text-[#1d1d1f]">Add a user</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="new-user-email">Email <span className="text-[#ff3b30]">*</span></label>
            <input
              id="new-user-email"
              type="email"
              placeholder="user@sssihl.edu.in"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              autoComplete="off"
              className={`${inputClass} !bg-white`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-user-name">Name <span className="text-[#ff3b30]">*</span></label>
            <input
              id="new-user-name"
              type="text"
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoComplete="off"
              className={`${inputClass} !bg-white`}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className={labelClass} htmlFor="new-user-role">Role</label>
            <select
              id="new-user-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className={`${selectClass} !bg-white`}
            >
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <p className="text-[12px] text-[#86868b] mt-1.5">
              {ROLE_OPTIONS.find(r => r.value === newRole)?.hint}
            </p>
          </div>

          <Button type="submit" loading={busy} className="!px-5 !py-2.5 !text-[14px] sm:mb-7">
            Add user
          </Button>
        </div>
      </form>

      {/* User list */}
      <div className="space-y-3">
        <h4 className="text-[15px] font-semibold text-[#1d1d1f]">All users</h4>

        {loading ? (
          <LoadingState label="Loading users…" />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No users registered yet" message="Add the first account using the form above." />
        ) : (
          <ul className="rounded-2xl border border-[#e8e8ed] max-h-96 overflow-y-auto divide-y divide-[#e8e8ed]">
            {users.map(user => {
              const isMaster = user.email === MASTER_EMAIL;
              const isSelf = user.email === currentUserEmail.toLowerCase();
              const roleStyle = ROLE_META[user.role] || ROLE_META.member;
              const isEditing = editingEmail === user.email;

              return (
                <li key={user.email} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 group hover:bg-[#f5f5f7] transition-colors">

                  {/* Identity */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold ${
                      isMaster ? 'bg-[#0071e3]/10 text-[#0071e3]' : 'bg-[#e8e8ed] text-[#6e6e73]'
                    }`}>
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium text-[#1d1d1f] truncate">
                          {user.name || nameFromEmail(user.email)}
                        </span>
                        {isMaster ? (
                          <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0071e3]/10 text-[#0071e3]">
                            Owner
                          </span>
                        ) : (
                          <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                            {roleStyle.label}
                          </span>
                        )}
                        {isSelf && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#e8e8ed] text-[#6e6e73]">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] text-[#86868b] truncate block mt-0.5">{user.email}</span>
                      {user.addedBy && (
                        <span className="text-[11px] text-[#86868b] block truncate mt-0.5">
                          Added by {user.addedBy}
                          {user.addedAt && ` · ${formatDate(user.addedAt)}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!isMaster && (
                    <div className="flex items-center gap-2 shrink-0 sm:pl-2">
                      {isEditing ? (
                        <>
                          <label className="sr-only" htmlFor={`role-${user.email}`}>Role for {user.name || user.email}</label>
                          <select
                            id={`role-${user.email}`}
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            className={`${selectClass} !py-1.5 !text-[13px] !bg-white`}
                          >
                            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <Button
                            variant="ghost"
                            onClick={() => handleUpdateRole(user, editRole)}
                            disabled={busy}
                            className="!px-2"
                          >
                            Save
                          </Button>
                          <Button variant="ghost" onClick={() => setEditingEmail(null)} className="!px-2 !text-[#86868b]">
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            onClick={() => { setEditingEmail(user.email); setEditRole(user.role); }}
                            className="!px-2"
                          >
                            Edit role
                          </Button>
                          <button
                            onClick={() => setUserToRemove(user)}
                            aria-label={`Remove ${user.name || user.email}`}
                            className="p-1.5 rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Remove user ── */}
      <Modal
        open={Boolean(userToRemove)}
        onClose={() => setUserToRemove(null)}
        title="Revoke access"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <p className="text-[14px] text-[#1d1d1f] leading-relaxed">
            Remove <span className="font-semibold">{userToRemove?.name || userToRemove?.email}</span> from the
            authorized list? They will be signed out of the system on their next visit.
          </p>
          {userToRemove?.email === currentUserEmail.toLowerCase() && (
            <p className="text-[13px] text-[#a86500] bg-[#ff9f0a]/8 border border-[#ff9f0a]/20 rounded-xl p-3 leading-relaxed">
              This is your own account — you will lose access immediately.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={() => setUserToRemove(null)}>Cancel</Button>
            <Button type="button" variant="danger" icon={Trash2} loading={busy} onClick={handleRemoveUser}>
              Revoke access
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
