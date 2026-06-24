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

// Icon imports
import { 
  Music, 
  Calendar, 
  TrendingUp, 
  LogOut, 
  Sparkles, 
  Shield, 
  AlertCircle, 
  Key, 
  Lock,
  Mail,
  User,
  Activity,
  Maximize2,
  Disc3,
  ShieldX
} from 'lucide-react';

import { AllowedUser, UserRole } from './types';

interface CustomUser {
  email: string;
  displayName: string;
  photoURL: string | null;
}

const MASTER_ADMIN_EMAIL = 'koushikv@sssihl.edu.in';

export default function App() {
  const [activeTab, setActiveTab] = useState<'instruments' | 'maintenance' | 'progress' | 'releases'>('instruments');
  
  // Real-time Auth User Context
  const [user, setUser] = useState<CustomUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null); // null = loading
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

    // Master admin is always allowed
    if (email === MASTER_ADMIN_EMAIL) {
      setIsAllowed(true);
      setUserRole('admin');
      setIsAdmin(true);
      
      // Ensure master admin exists in allowed_users collection
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

    // Check against allowed_users list
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

  // Google SSO logic
  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Auth popup failed:", err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError("Auth popup was blocked by browser. Please enable popups and try again.");
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

  // Role display helpers
  const getRoleBadge = (role: UserRole | null) => {
    switch (role) {
      case 'admin': return { label: 'ADMINISTRATOR', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
      case 'junior_admin': return { label: 'JUNIOR ADMIN', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'member': return { label: 'MEMBER', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      default: return { label: 'GUEST', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
    }
  };

  const roleBadge = getRoleBadge(userRole);

  return (
    <div id="master-layout" className="min-h-screen bg-zinc-950 font-sans text-zinc-300 flex flex-col antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* Header Panel */}
      <header id="primary-header" className="bg-zinc-900 border-b border-zinc-850 sticky top-0 z-40 px-4 py-2 flex-shrink-0 shadow-md">
        <div id="header-wrapper" className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-1.5 rounded select-none shadow-[0_0_10px_rgba(16,185,129,0.05)]">
              <Sparkles className="animate-pulse" size={15} />
            </div>
            <div>
              <h1 className="text-sm font-display font-semibold text-zinc-100 tracking-wider flex items-center gap-2 leading-none uppercase select-none">
                SAI TUNES <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 font-sans text-emerald-400 px-2 py-0.5 rounded font-medium tracking-wide">STEWARDSHIP OFFICE</span>
              </h1>
              <p className="text-[10px] uppercase font-sans text-zinc-500 tracking-wider select-none mt-1 font-medium">Hostel Music Department Log & Routines Hub</p>
            </div>
          </div>

          {/* Render Tab bar and User controls only when authenticated AND allowed */}
          {user && isAllowed && (
            <div className="flex items-center gap-3 flex-wrap justify-center font-sans text-[11px]">
              
              {/* Navigation Menu Tabs */}
              <nav id="header-nav-tabs" className="flex items-center bg-zinc-950 p-0.5 rounded border border-zinc-800 shrink-0 select-none">
                {[
                  { id: 'instruments', label: 'INSTRUMENTS', icon: <Music size={11} /> },
                  { id: 'maintenance', label: 'MAINTENANCE', icon: <Calendar size={11} /> },
                  { id: 'progress', label: 'LEADERBOARD', icon: <TrendingUp size={11} /> },
                  { id: 'releases', label: 'RELEASES', icon: <Disc3 size={11} /> },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setShowAdminTab(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded tracking-wide transition-all cursor-pointer ${
                      activeTab === tab.id && !showAdminTab
                        ? 'bg-zinc-900 text-emerald-400 border border-zinc-800/80 shadow-md font-semibold' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>

              {/* User Avatar panel */}
              <div className="flex items-center gap-2 border-l border-zinc-800 pl-3 select-none py-1">
                <div className="text-right leading-tight block">
                  <span className="block font-semibold text-zinc-200 text-[10px] uppercase truncate max-w-28">{user.displayName}</span>
                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${roleBadge.color}`}>{roleBadge.label}</span>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full border border-zinc-800" />
                ) : (
                  <div className={`h-6 w-6 rounded-full border border-zinc-800 flex items-center justify-center font-black ${isAdmin ? 'bg-indigo-950 text-indigo-400 border-indigo-850' : 'bg-emerald-950 text-emerald-400 border-emerald-850'}`}>
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setShowAdminTab(!showAdminTab)}
                    className={`p-1 border rounded cursor-pointer transition-all ${showAdminTab ? 'bg-indigo-600 border-indigo-500 text-zinc-100' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'}`}
                    title="User Management Panel"
                  >
                    <Shield size={12} />
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="p-1 px-2.5 border border-zinc-800 hover:border-red-900 bg-zinc-950 hover:bg-red-950/20 text-zinc-450 hover:text-red-400 rounded transition-all cursor-pointer font-medium flex items-center gap-0.5"
                  title="Logout"
                >
                  <LogOut size={11} />
                </button>
              </div>

            </div>
          )}

        </div>
      </header>

      {/* Main Workspace Frame */}
      <main id="main-content-stage" className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 flex flex-col justify-start">
        
        {/* Not logged in — Show sign-in page */}
        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 max-w-md mx-auto select-none animate-in fade-in duration-300">
            
            <div className="w-full bg-zinc-900 border border-zinc-800/80 rounded-xl p-8 shadow-2xl font-sans text-center space-y-6">
              <div className="space-y-2">
                <span className="text-[9px] px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full font-semibold tracking-wider uppercase inline-block">SSSIHL SECURE CREDENTIALS</span>
                
                <h2 className="text-lg font-display font-bold text-zinc-100 tracking-tight leading-snug mt-2">SAI TUNES CO-OPERATIVE</h2>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide">Hostel Music Department Sign-In</p>
              </div>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg leading-normal flex items-start gap-2 text-left">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-red-400" />
                  <p>{authError}</p>
                </div>
              )}

              {/* Standard Google login button */}
              <button
                onClick={handleGoogleLogin}
                className="w-full py-2.5 bg-zinc-100 text-zinc-950 hover:bg-white transition-all font-semibold text-[12px] rounded-lg border border-zinc-300 cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide shadow-sm active:scale-98"
              >
                <Key size={14} className="text-zinc-900" />
                Sign In with Google Account
              </button>

              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Only authorized members can access this system. Contact the admin if you need access.
              </p>
            </div>

          </div>

        ) : isAllowed === null ? (
          /* Loading — checking authorization */
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center space-y-3 select-none">
              <div className="h-8 w-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Verifying access permissions...</p>
            </div>
          </div>

        ) : !isAllowed ? (
          /* Access Denied */
          <div className="flex-1 flex flex-col items-center justify-center py-10 max-w-md mx-auto select-none animate-in fade-in duration-300">
            <div className="w-full bg-zinc-900 border border-red-900/30 rounded-xl p-8 shadow-2xl font-sans text-center space-y-5">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <ShieldX size={28} className="text-red-400" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-base font-display font-bold text-zinc-100 tracking-tight">ACCESS DENIED</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your account <span className="text-zinc-200 font-semibold">{user.email}</span> is not authorized to access this system.
                </p>
              </div>

              <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                <p className="text-[11px] text-amber-400 leading-relaxed">
                  Please contact the administrator at <span className="font-semibold">koushikv@sssihl.edu.in</span> to request access.
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-750 transition-all border border-zinc-700 text-zinc-300 hover:text-white font-semibold rounded-lg uppercase cursor-pointer tracking-wide text-xs flex items-center justify-center gap-2"
              >
                <LogOut size={13} />
                Sign Out & Try Another Account
              </button>
            </div>
          </div>

        ) : (
          /* Authorized — show app content */
          <>
            {/* If Admin tab is specifically toggled */}
            {showAdminTab ? (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6 text-xs max-w-2xl mx-auto shadow-xl">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-3 mb-4 select-none">
                    <span className="font-semibold text-zinc-300 uppercase tracking-wide flex items-center gap-1.5 font-display text-xs">
                      <Lock size={13} className="text-zinc-400" /> System Control Center
                    </span>
                    <button onClick={() => setShowAdminTab(false)} className="text-zinc-400 hover:text-zinc-200 px-2.5 py-1 text-[10px] font-semibold border border-zinc-800 bg-zinc-950 rounded-md transition-all cursor-pointer">Close Panel</button>
                  </div>
                  <AdminControls currentUserEmail={user.email} />
                </div>
              </div>
            ) : (
              // Standard active tab content
              <div className="flex-1 animate-in fade-in duration-150">
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

      {/* Footer Block */}
      <footer id="primary-footer" className="bg-zinc-900/60 text-zinc-500 py-4 px-4 flex-shrink-0 border-t border-zinc-850/60 text-xs font-sans select-none">
        <div id="footer-wrapper" className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="space-y-1 text-center md:text-left">
            <p className="font-semibold text-zinc-300 tracking-wide text-[11px] uppercase font-display">Sai Tunes Hostel Studio Stewardship Hub</p>
            <p className="text-[10px] text-zinc-500 max-w-2xl leading-relaxed">Unified student-led accountability with real-time Firestore database synchronization and secure campus login.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-zinc-400 rounded-full font-medium">v3.0</span>
            <span className="text-[9px] bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-1 text-emerald-400 rounded-full font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Cloud Connected
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
