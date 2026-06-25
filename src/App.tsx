import React, { useState, useEffect } from 'react';
import { 
  auth, 
  signInWithPopup, 
  googleProvider, 
  signOut, 
  onAuthStateChanged,
  db,
  collection,
  doc,
  setDoc,
  onSnapshot
} from './lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

// Component imports
import InstrumentLogbook from './components/InstrumentLogbook';
import MaintenanceScheduler from './components/MaintenanceScheduler';
import StewardshipProgress from './components/StewardshipProgress';
import AdminControls from './components/AdminControls';
import MusicReleases from './components/MusicReleases';

import { AllowedUser, UserRole } from './types';

interface CustomUser {
  email: string;
  displayName: string;
  photoURL: string | null;
}

const MASTER_ADMIN_EMAIL = 'koushikv@sssihl.edu.in';

export default function App() {
  const [activeTab, setActiveTab] = useState<'instruments' | 'maintenance' | 'progress' | 'releases'>('instruments');
  
  const [user, setUser] = useState<CustomUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  
  const [authError, setAuthError] = useState('');
  const [showAdminTab, setShowAdminTab] = useState(false);

  // Monitor allowed users from Firestore
  useEffect(() => {
    const usersRef = collection(db, 'allowed_users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const userList: AllowedUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        userList.push({
          id: doc.id,
          email: (data.email || '').toLowerCase(),
          name: data.name || '',
          role: data.role || 'member',
          addedBy: data.addedBy || '',
          addedAt: data.addedAt || '',
        });
      });
      setAllowedUsers(userList);
    }, (error) => {
      console.error("Firestore allowed_users read error:", error);
    });

    return () => unsubscribe();
  }, []);

  // Monitor Firebase Auth state change
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Studio Member',
          photoURL: firebaseUser.photoURL || null
        });
        setAuthError('');
      } else {
        setUser(null);
        setIsAllowed(null);
        setUserRole(null);
        setIsAdmin(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Check if user is allowed + determine role
  useEffect(() => {
    if (!user?.email) {
      setIsAllowed(null);
      setUserRole(null);
      setIsAdmin(false);
      return;
    }

    const email = user.email.toLowerCase();

    if (email === MASTER_ADMIN_EMAIL) {
      setIsAllowed(true);
      setUserRole('admin');
      setIsAdmin(true);
      
      const masterExists = allowedUsers.some(u => u.email === MASTER_ADMIN_EMAIL);
      if (!masterExists && allowedUsers.length >= 0) {
        setDoc(doc(db, 'allowed_users', MASTER_ADMIN_EMAIL), {
          email: MASTER_ADMIN_EMAIL,
          name: 'Koushik V',
          role: 'admin',
          addedBy: 'system',
          addedAt: new Date().toISOString(),
        }).catch(err => console.error("Error auto-adding master admin:", err));
      }
      return;
    }

    const found = allowedUsers.find(u => u.email === email);
    if (found) {
      setIsAllowed(true);
      setUserRole(found.role);
      setIsAdmin(found.role === 'admin');
    } else {
      setIsAllowed(false);
      setUserRole(null);
      setIsAdmin(false);
    }
  }, [user, allowedUsers]);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Auth popup failed:", err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError("Popup was blocked by your browser. Please enable popups and try again.");
      } else if (err.code === 'auth/iframe-directory-not-found' || err.code === 'auth/operation-not-supported-in-this-environment') {
        setAuthError("Google Login is restricted inside the sandboxed preview iframe.");
      } else {
        setAuthError(`Login error: ${err.message}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
    setUser(null);
    setIsAdmin(false);
    setIsAllowed(null);
    setUserRole(null);
    setShowAdminTab(false);
  };

  const getRoleLabel = (role: UserRole | null) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'junior_admin': return 'Jr. Admin';
      case 'member': return 'Member';
      default: return 'Guest';
    }
  };

  const tabs = [
    { id: 'instruments', label: 'Inventory' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'progress', label: 'Leaderboard' },
    { id: 'releases', label: 'Releases' },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] font-sans text-[#1d1d1f] flex flex-col antialiased">
      
      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/60 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5 select-none">
            <span className="text-lg">🎵</span>
            <h1 className="text-[15px] font-semibold tracking-tight text-[#1d1d1f]">
              Sai Tunes
            </h1>
          </div>

          {/* Nav + User — only when authenticated */}
          {user && isAllowed && (
            <div className="flex items-center gap-1">
              
              {/* Tab Navigation */}
              <nav className="flex items-center gap-0.5 mr-4">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setShowAdminTab(false);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all cursor-pointer ${
                      activeTab === tab.id && !showAdminTab
                        ? 'bg-[#1d1d1f] text-white'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              {/* User controls */}
              <div className="flex items-center gap-2 pl-3 border-l border-[#d2d2d7]/60">
                {isAdmin && (
                  <button
                    onClick={() => setShowAdminTab(!showAdminTab)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
                      showAdminTab
                        ? 'bg-[#0071e3] text-white'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'
                    }`}
                  >
                    Settings
                  </button>
                )}
                
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-[#e8e8ed] flex items-center justify-center text-[12px] font-semibold text-[#6e6e73]">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-[12px] text-[#6e6e73] hover:text-[#1d1d1f] font-medium cursor-pointer transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8">
        
        {/* Not logged in */}
        {!user ? (
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-sm text-center space-y-8">
              <div className="space-y-3">
                <div className="text-5xl mb-4">🎵</div>
                <h2 className="text-[28px] font-bold tracking-tight text-[#1d1d1f] leading-tight">
                  Sai Tunes
                </h2>
                <p className="text-[15px] text-[#6e6e73] leading-relaxed">
                  Studio Manager for the Hostel Music Department
                </p>
              </div>

              {authError && (
                <div className="p-4 bg-[#ff3b30]/8 border border-[#ff3b30]/15 text-[#ff3b30] text-[13px] rounded-xl leading-relaxed text-left">
                  {authError}
                </div>
              )}

              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 bg-[#1d1d1f] hover:bg-[#333336] text-white transition-all font-semibold text-[15px] rounded-xl cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".7"/>
                  <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" opacity=".5"/>
                  <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".8"/>
                </svg>
                Sign in with Google
              </button>

              <p className="text-[13px] text-[#86868b]">
                Only authorized members can access this system.
              </p>
            </div>
          </div>

        ) : isAllowed === null ? (
          /* Checking authorization */
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <div className="h-8 w-8 border-[2.5px] border-[#d2d2d7] border-t-[#0071e3] rounded-full animate-spin mx-auto"></div>
              <p className="text-[14px] text-[#86868b] font-medium">Verifying access…</p>
            </div>
          </div>

        ) : !isAllowed ? (
          /* Access Denied */
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-sm text-center space-y-6">
              <div className="text-5xl">🔒</div>
              <div className="space-y-2">
                <h2 className="text-[22px] font-bold text-[#1d1d1f]">Access Denied</h2>
                <p className="text-[14px] text-[#6e6e73] leading-relaxed">
                  <span className="font-medium text-[#1d1d1f]">{user.email}</span> is not authorized to access this system.
                </p>
              </div>

              <div className="p-4 bg-[#ff9f0a]/8 border border-[#ff9f0a]/15 rounded-xl">
                <p className="text-[13px] text-[#86868b] leading-relaxed">
                  Contact the administrator at <span className="font-semibold text-[#1d1d1f]">koushikv@sssihl.edu.in</span> to request access.
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-2.5 bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-xl font-medium text-[14px] cursor-pointer transition-colors"
              >
                Sign Out & Try Another Account
              </button>
            </div>
          </div>

        ) : (
          /* ── Authorized Content ── */
          <>
            {showAdminTab ? (
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[22px] font-bold text-[#1d1d1f]">Settings</h2>
                  <button
                    onClick={() => setShowAdminTab(false)}
                    className="text-[13px] text-[#0071e3] hover:text-[#0077ED] font-medium cursor-pointer transition-colors"
                  >
                    Done
                  </button>
                </div>
                <AdminControls currentUserEmail={user.email} />
              </div>
            ) : (
              <div className="space-y-6">
                {activeTab === 'instruments' && (
                  <InstrumentLogbook currentUser={user} isAdmin={isAdmin} />
                )}
                {activeTab === 'maintenance' && (
                  <MaintenanceScheduler currentUser={user} isAdmin={isAdmin} />
                )}
                {activeTab === 'progress' && (
                  <StewardshipProgress />
                )}
                {activeTab === 'releases' && (
                  <MusicReleases currentUser={user} isAdmin={isAdmin} />
                )}
              </div>
            )}
          </>
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="py-6 px-6 text-center select-none">
        <p className="text-[12px] text-[#86868b]">
          Sai Tunes · Hostel Music Department · SSSIHL
        </p>
      </footer>
    </div>
  );
}
