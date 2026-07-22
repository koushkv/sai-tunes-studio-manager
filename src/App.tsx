import { useEffect, useMemo, useRef, useState } from 'react';
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
  onSnapshot,
} from './lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { Lock, LogOut, Settings, ChevronDown } from 'lucide-react';

import InstrumentLogbook from './components/InstrumentLogbook';
import MaintenanceScheduler from './components/MaintenanceScheduler';
import ProjectsTracker from './components/ProjectsTracker';
import AdminControls from './components/AdminControls';
import ProjectsPortfolio from './components/ProjectsPortfolio';
import { ToastProvider } from './components/ui/Toast';
import { Button } from './components/ui/Primitives';
import { ROLE_META } from './lib/stages';

import { AllowedUser, UserRole } from './types';

interface CustomUser {
  email: string;
  displayName: string;
  photoURL: string | null;
}

const MASTER_ADMIN_EMAIL = 'koushikv@sssihl.edu.in';

type TabId = 'instruments' | 'projects' | 'maintenance' | 'portfolio';

const TABS: { id: TabId; label: string }[] = [
  { id: 'instruments', label: 'Inventory' },
  { id: 'projects', label: 'Projects' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'portfolio', label: 'Portfolio' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('instruments');

  const [user, setUser] = useState<CustomUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [allowedUsersLoading, setAllowedUsersLoading] = useState(true);

  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [showAdminTab, setShowAdminTab] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const isAdmin = userRole === 'admin';
  const accountMenuRef = useRef<HTMLDivElement>(null);
  // Guards against re-issuing the master-admin seed write on every snapshot.
  const masterSeeded = useRef(false);

  // Monitor allowed users from Firestore.
  // Only subscribed once someone is signed in, so the whitelist can stay
  // behind an authenticated-only security rule.
  const signedInEmail = user?.email ?? null;

  useEffect(() => {
    if (!signedInEmail) {
      setAllowedUsers([]);
      setAllowedUsersLoading(true);
      return;
    }

    const usersRef = collection(db, 'allowed_users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const userList: AllowedUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        userList.push({
          id: docSnap.id,
          email: (data.email || docSnap.id).toLowerCase(),
          name: data.name || '',
          role: data.role || 'member',
          addedBy: data.addedBy || '',
          addedAt: data.addedAt || '',
        });
      });
      setAllowedUsers(userList);
      setAllowedUsersLoading(false);
    }, (error) => {
      console.error('Firestore allowed_users read error:', error);
      setAllowedUsersLoading(false);
    });

    return () => unsubscribe();
  }, [signedInEmail]);

  // Monitor Firebase Auth state
  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          email: (firebaseUser.email || '').toLowerCase(),
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Studio Student',
          photoURL: firebaseUser.photoURL || null,
        });
        setAuthError('');
      } else {
        setUser(null);
        setIsAllowed(null);
        setUserRole(null);
      }
      setSigningIn(false);
    });
  }, []);

  // Resolve access + role once both auth and the whitelist have settled
  useEffect(() => {
    if (allowedUsersLoading) return;

    if (!user?.email) {
      setIsAllowed(null);
      setUserRole(null);
      return;
    }

    const email = user.email;

    if (email === MASTER_ADMIN_EMAIL) {
      setIsAllowed(true);
      setUserRole('admin');

      if (!masterSeeded.current && !allowedUsers.some(u => u.email === MASTER_ADMIN_EMAIL)) {
        masterSeeded.current = true;
        setDoc(doc(db, 'allowed_users', MASTER_ADMIN_EMAIL), {
          email: MASTER_ADMIN_EMAIL,
          name: user.displayName || 'Koushik V',
          role: 'admin',
          addedBy: 'system',
          addedAt: new Date().toISOString(),
        }).catch((err) => {
          masterSeeded.current = false;
          console.error('Error auto-adding master admin:', err);
        });
      }
      return;
    }

    const found = allowedUsers.find(u => u.email === email);
    setIsAllowed(Boolean(found));
    setUserRole(found ? found.role : null);
  }, [user, allowedUsers, allowedUsersLoading]);

  // Settings is admin-only — drop out of it if the role is revoked live.
  useEffect(() => {
    if (!isAdmin && showAdminTab) setShowAdminTab(false);
  }, [isAdmin, showAdminTab]);

  // Close the account menu on outside click or Escape
  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!accountMenuRef.current?.contains(e.target as Node)) setAccountMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountMenuOpen]);

  const handleGoogleLogin = async () => {
    setAuthError('');
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Auth login failed:', err);
      setSigningIn(false);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setAuthError('');
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError('Your browser blocked the sign-in pop-up. Allow pop-ups for this site and try again.');
      } else if (
        err.code === 'auth/iframe-directory-not-found' ||
        err.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        setAuthError('Google sign-in is blocked inside this embedded preview. Open the site in a new tab and try again.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setAuthError(
          `${window.location.hostname} is not an authorized domain for this Firebase project. ` +
            'Add it under Firebase Console → Authentication → Settings → Authorized domains.',
        );
      } else if (err.code === 'auth/network-request-failed') {
        setAuthError('Network error. Check your connection and try again.');
      } else {
        setAuthError(err.message || 'Sign-in failed. Please try again.');
      }
    }
  };

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
    setUser(null);
    setIsAllowed(null);
    setUserRole(null);
    setShowAdminTab(false);
    setActiveTab('instruments');
  };

  const roleBadge = useMemo(() => (userRole ? ROLE_META[userRole] : null), [userRole]);
  const isAuthed = Boolean(user && isAllowed);

  const initials = (user?.displayName || user?.email || '?').trim().charAt(0).toUpperCase();

  const openTab = (tab: TabId) => {
    setActiveTab(tab);
    setShowAdminTab(false);
    setAccountMenuOpen(false);
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#f5f5f7] font-sans text-[#1d1d1f] flex flex-col antialiased">

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-[14px] focus:font-medium"
        >
          Skip to content
        </a>

        {/* ── Header ── */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/60 sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="h-14 flex items-center justify-between gap-4">

              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Sai Tunes</span>
                <span className="hidden sm:inline text-[12px] text-[#86868b] truncate">Studio Manager</span>
              </div>

              {isAuthed && user && (
                <div className="flex items-center gap-2">
                  {/* Desktop nav */}
                  <nav aria-label="Sections" className="hidden md:flex items-center gap-0.5">
                    {TABS.map(tab => {
                      const current = activeTab === tab.id && !showAdminTab;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => openTab(tab.id)}
                          aria-current={current ? 'page' : undefined}
                          className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            current
                              ? 'bg-[#1d1d1f] text-white'
                              : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </nav>

                  {/* Account menu */}
                  <div className="relative md:pl-2 md:ml-1 md:border-l md:border-[#d2d2d7]/60" ref={accountMenuRef}>
                    <button
                      onClick={() => setAccountMenuOpen(o => !o)}
                      aria-haspopup="menu"
                      aria-expanded={accountMenuOpen}
                      aria-label="Account menu"
                      className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full hover:bg-black/[0.04] transition-colors cursor-pointer"
                    >
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <span className="h-7 w-7 rounded-full bg-[#e8e8ed] flex items-center justify-center text-[12px] font-semibold text-[#6e6e73]">
                          {initials}
                        </span>
                      )}
                      <ChevronDown
                        size={14}
                        aria-hidden="true"
                        className={`text-[#86868b] transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {accountMenuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 overflow-hidden animate-sheet-in"
                      >
                        <div className="px-4 py-3 border-b border-[#e8e8ed]">
                          <div className="flex items-center gap-2">
                            <p className="text-[14px] font-semibold text-[#1d1d1f] truncate">{user.displayName}</p>
                            {roleBadge && (
                              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${roleBadge.bg} ${roleBadge.text}`}>
                                {roleBadge.label}
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-[#86868b] truncate mt-0.5">{user.email}</p>
                        </div>

                        {isAdmin && (
                          <button
                            role="menuitem"
                            onClick={() => { setShowAdminTab(true); setAccountMenuOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                          >
                            <Settings size={15} aria-hidden="true" className="text-[#6e6e73]" />
                            Settings
                          </button>
                        )}

                        <button
                          role="menuitem"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-[#ff3b30] hover:bg-[#ff3b30]/5 transition-colors cursor-pointer"
                        >
                          <LogOut size={15} aria-hidden="true" />
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile nav — one scrollable row, no duplicated controls */}
            {isAuthed && (
              <nav
                aria-label="Sections"
                className="md:hidden flex items-center gap-1 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1"
              >
                {TABS.map(tab => {
                  const current = activeTab === tab.id && !showAdminTab;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => openTab(tab.id)}
                      aria-current={current ? 'page' : undefined}
                      className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        current
                          ? 'bg-[#1d1d1f] text-white'
                          : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        </header>

        {/* ── Main ── */}
        <main id="main" className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {!user ? (
            /* Signed out */
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="w-full max-w-sm text-center space-y-8">
                <div className="space-y-3">
                  <h1 className="text-[32px] font-bold tracking-tight text-[#1d1d1f] leading-tight">Sai Tunes</h1>
                  <p className="text-[15px] text-[#6e6e73] leading-relaxed">
                    Studio Manager for the Hostel Music Department
                  </p>
                </div>

                {authError && (
                  <div
                    role="alert"
                    className="p-4 bg-[#ff3b30]/8 border border-[#ff3b30]/15 text-[#ff3b30] text-[13px] rounded-xl leading-relaxed text-left"
                  >
                    {authError}
                  </div>
                )}

                <button
                  onClick={handleGoogleLogin}
                  disabled={signingIn}
                  aria-busy={signingIn || undefined}
                  className="w-full py-3 bg-[#1d1d1f] hover:bg-[#333336] disabled:opacity-60 disabled:cursor-not-allowed text-white transition-all font-semibold text-[15px] rounded-xl cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
                >
                  {signingIn ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0" aria-hidden="true">
                      <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#fff" opacity=".7" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#fff" opacity=".5" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#fff" opacity=".8" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  {signingIn ? 'Signing in…' : 'Sign in with Google'}
                </button>

                <p className="text-[13px] text-[#86868b]">Only authorized students can access this system.</p>
              </div>
            </div>

          ) : isAllowed === null ? (
            /* Verifying */
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-4" role="status" aria-live="polite">
                <div className="h-8 w-8 border-[2.5px] border-[#d2d2d7] border-t-[#0071e3] rounded-full animate-spin mx-auto" aria-hidden="true" />
                <p className="text-[14px] text-[#86868b] font-medium">Verifying access…</p>
              </div>
            </div>

          ) : !isAllowed ? (
            /* Not on the whitelist */
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="w-full max-w-sm text-center space-y-6">
                <div className="h-14 w-14 rounded-full bg-[#e8e8ed] flex items-center justify-center mx-auto">
                  <Lock size={24} className="text-[#6e6e73]" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-[22px] font-bold text-[#1d1d1f]">Access denied</h2>
                  <p className="text-[14px] text-[#6e6e73] leading-relaxed">
                    <span className="font-medium text-[#1d1d1f]">{user.email}</span> is not authorized to use this system.
                  </p>
                </div>

                <div className="p-4 bg-[#ff9f0a]/8 border border-[#ff9f0a]/15 rounded-xl">
                  <p className="text-[13px] text-[#6e6e73] leading-relaxed">
                    Ask the administrator at{' '}
                    <a
                      href={`mailto:${MASTER_ADMIN_EMAIL}`}
                      className="font-semibold text-[#0071e3] hover:underline break-all"
                    >
                      {MASTER_ADMIN_EMAIL}
                    </a>{' '}
                    to request access.
                  </p>
                </div>

                <Button variant="secondary" onClick={handleLogout} className="w-full py-2.5">
                  Sign out & try another account
                </Button>
              </div>
            </div>

          ) : showAdminTab ? (
            /* Settings */
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-[#1d1d1f]">Settings</h2>
                <Button variant="secondary" onClick={() => setShowAdminTab(false)}>Done</Button>
              </div>
              <AdminControls currentUserEmail={user.email} />
            </div>

          ) : (
            /* Feature panels */
            <>
              {activeTab === 'instruments' && (
                <InstrumentLogbook currentUser={user} isAdmin={isAdmin} userRole={userRole} />
              )}
              {activeTab === 'projects' && (
                <ProjectsTracker currentUser={user} isAdmin={isAdmin} userRole={userRole} />
              )}
              {activeTab === 'maintenance' && (
                <MaintenanceScheduler currentUser={user} isAdmin={isAdmin} userRole={userRole} />
              )}
              {activeTab === 'portfolio' && <ProjectsPortfolio allowedUsers={allowedUsers} />}
            </>
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="py-6 px-6 text-center select-none">
          <p className="text-[12px] text-[#86868b]">Sai Tunes · Hostel Music Department · SSSIHL</p>
        </footer>
      </div>
    </ToastProvider>
  );
}
