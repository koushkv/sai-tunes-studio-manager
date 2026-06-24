import React, { useState, useEffect } from 'react';
import { db, collection, setDoc, deleteDoc, doc, onSnapshot } from '../lib/firebase';
import { Shield, Plus, Trash2, Mail, Users, CheckCircle } from 'lucide-react';

interface AdminControlsProps {
  currentUserEmail: string;
}

export default function AdminControls({ currentUserEmail }: AdminControlsProps) {
  const [adminEmails, setAdminEmails] = useState<string[]>(['koushikv@sssihl.edu.in']);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Sync the list of allowed admins in real-time from Firestore
    const adminRef = collection(db, 'admin_emails');
    const unsubscribe = onSnapshot(adminRef, (snapshot) => {
      const emailList: string[] = ['koushikv@sssihl.edu.in']; // Always include master as backup
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.email && !emailList.includes(data.email.toLowerCase())) {
          emailList.push(data.email.toLowerCase());
        }
      });
      setAdminEmails(emailList);
      setLoading(false);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    const emailToAdd = newEmail.trim().toLowerCase();
    
    try {
      // Add email record to admin_emails Firestore collection
      await setDoc(doc(db, 'admin_emails', emailToAdd), {
        email: emailToAdd,
        addedBy: currentUserEmail,
        addedAt: new Date().toISOString()
      });
      setSuccessMsg(`✓ AUTHORIZED: ${emailToAdd} is now registered as Admin.`);
      setNewEmail('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Error saving admin:", err);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (email.toLowerCase() === 'koushikv@sssihl.edu.in') {
      alert("MASTER ACCESS PROTECTED: You cannot de-authorize the main SSSIHL institutional HOD email.");
      return;
    }
    if (confirm(`Remove administrator privileges for ${email}?`)) {
      try {
        await deleteDoc(doc(db, 'admin_emails', email.toLowerCase()));
        setSuccessMsg(`✓ DE-AUTHORIZED: ${email} access levels revoked.`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err) {
        console.error("Error removing admin:", err);
      }
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 space-y-5 font-sans text-sm max-w-lg mx-auto">
      <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-3">
        <Shield size={16} className="text-emerald-400" />
        <div>
          <h3 className="font-display font-semibold text-zinc-100 text-xs uppercase tracking-wider">Administrator Credentials Desk</h3>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wide mt-0.5">Authorized university accounts with master edit permissions</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] rounded-lg flex items-center gap-2">
          <CheckCircle size={13} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form to add a new admin */}
      <form onSubmit={handleAddAdmin} className="space-y-2">
        <label className="block text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Authorize Custom Email / ID</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-2.5 text-zinc-500" size={13} />
            <input 
              type="email" 
              placeholder="e.g. karthik@sssihl.edu.in"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-700 focus:outline-none text-zinc-200 text-xs"
            />
          </div>
          <button 
            type="submit"
            className="px-4 bg-emerald-600 hover:bg-emerald-700 text-zinc-100 rounded-lg font-medium uppercase text-[10px] tracking-wider cursor-pointer flex items-center gap-1.5 transition-all"
          >
            <Plus size={12} />
            Add Admin
          </button>
        </div>
      </form>

      {/* List of current admins */}
      <div className="space-y-2">
        <span className="block text-[10px] text-zinc-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
          <Users size={12} /> Current Admin Registry ({adminEmails.length})
        </span>

        {loading ? (
          <p className="text-zinc-600 animate-pulse py-3 text-center text-xs uppercase tracking-wider">Syncing secure access database...</p>
        ) : (
          <div className="divide-y divide-zinc-900 bg-zinc-950/40 rounded-lg border border-zinc-800 max-h-48 overflow-y-auto">
            {adminEmails.map((email) => (
              <div key={email} className="flex justify-between items-center p-3 text-xs">
                <span className="text-zinc-350 select-all break-all">{email}</span>
                {email !== 'koushikv@sssihl.edu.in' && (
                  <button 
                    onClick={() => handleRemoveAdmin(email)}
                    className="p-1.5 bg-red-950/20 text-red-400 hover:bg-red-950/50 border border-red-900/30 hover:border-red-500/40 rounded-md transition-all cursor-pointer"
                    title="Revoke Admin Access"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                {email === 'koushikv@sssihl.edu.in' && (
                  <span className="text-[9px] px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 font-semibold rounded uppercase">Master</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
