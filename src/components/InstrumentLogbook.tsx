import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, doc, updateDoc, onSnapshot, query, orderBy } from '../lib/firebase';
import { 
  Music, 
  Clock, 
  LogIn, 
  LogOut, 
  Sparkles, 
  CheckCircle, 
  History, 
  Search, 
  FileText,
  AlertTriangle 
} from 'lucide-react';

interface InstrumentLogbookProps {
  currentUser: {
    email: string;
    displayName: string;
  } | null;
  isAdmin: boolean;
}

interface InstrumentLog {
  id: string;
  instrumentName: string;
  studentName: string;
  rollNumber: string;
  purpose: string;
  checkInTime: string;
  checkOutTime?: string;
  returned: boolean;
  remarks?: string;
  verifiedSolder?: boolean;
}

const DEFAULT_INSTRUMENTS = [
  "Fender Stratocaster Electric Guitar",
  "Scarlett 18i20 Audio Interface",
  "Yamaha Motif XS8 MIDI Arranger",
  "Taylor 114e Acoustic Guitar",
  "Audio-Technica ATH-M50x Headphones",
  "Shure SM57 Dynamic Microphone",
  "SSSIHL Studio Monitor System A",
  "Novation Launchkey Pad Controller",
  "Sai Harmonium (Scale Standard)"
];

export default function InstrumentLogbook({ currentUser, isAdmin }: InstrumentLogbookProps) {
  const [logs, setLogs] = useState<InstrumentLog[]>([]);
  const [instrument, setInstrument] = useState(DEFAULT_INSTRUMENTS[0]);
  const [customInstrument, setCustomInstrument] = useState('');
  const [useCustomInstrument, setUseCustomInstrument] = useState(false);
  
  const [studentName, setStudentName] = useState(currentUser?.displayName || '');
  const [rollNumber, setRollNumber] = useState('');
  const [purpose, setPurpose] = useState('Composition');
  const [customPurpose, setCustomPurpose] = useState('');
  
  const [deskClean, setDeskClean] = useState(false);
  const [cablesProper, setCablesProper] = useState(false);
  const [noFoodDrink, setNoFoodDrink] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Clean form prefill
  useEffect(() => {
    if (currentUser) {
      setStudentName(currentUser.displayName || '');
    }
  }, [currentUser]);

  // Sync real-time instrument logs from Firestore
  useEffect(() => {
    const logsRef = collection(db, 'instrument_logs');
    const q = query(logsRef, orderBy('checkInTime', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parsedLogs: InstrumentLog[] = [];
      snapshot.forEach((doc) => {
        parsedLogs.push({ id: doc.id, ...doc.data() } as InstrumentLog);
      });
      setLogs(parsedLogs);
    }, (error) => {
      console.error("Error loading logs from Firestore:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !rollNumber) {
      setErrorMsg(" borrower name & roll details are mandatory.");
      return;
    }
    if (!deskClean || !cablesProper || !noFoodDrink) {
      setErrorMsg("Stewardship safety checks require review confirmation before taking studio modules.");
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    const finalInstrumentName = useCustomInstrument ? customInstrument.trim() : instrument;
    
    try {
      await addDoc(collection(db, 'instrument_logs'), {
        instrumentName: finalInstrumentName,
        studentName: studentName.trim(),
        rollNumber: rollNumber.trim().toUpperCase(),
        purpose: purpose === 'Custom' ? customPurpose.trim() : purpose,
        checkInTime: new Date().toISOString(),
        returned: false,
        remarks: ''
      });

      setSuccessMsg(`✓ CHEKOUT LOGGED! Enjoy your sessions with standard ${finalInstrumentName}!`);
      // Reset form variables
      setRollNumber('');
      setDeskClean(false);
      setCablesProper(false);
      setNoFoodDrink(false);
      setCustomInstrument('');
      setCustomPurpose('');
      
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error("Checkout logging failed:", err);
      setErrorMsg(`Database error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnItem = async (logId: string) => {
    const confirmation = confirm("Confirm this instrument is returned in perfect, clean condition, cables coiled over-under, and workstation wiped down?");
    if (!confirmation) return;

    try {
      const docRef = doc(db, 'instrument_logs', logId);
      await updateDoc(docRef, {
        returned: true,
        checkOutTime: new Date().toISOString(),
        remarks: 'Wiped, cable coiled Over-Under. Perfect shape.'
      });
      setSuccessMsg("✓ INSTRUMENT SUCCESSFULLY RETURNED & VERIFIED!");
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error("Error checking in item:", err);
      alert(`Database write error: ${err.message}`);
    }
  };

  // Filter lists:
  const activeCheckouts = logs.filter(l => !l.returned);
  const historicLogs = logs.filter(l => l.returned);

  const filteredHistory = historicLogs.filter(log => {
    const term = searchQuery.toLowerCase();
    return (
      log.studentName.toLowerCase().includes(term) ||
      log.instrumentName.toLowerCase().includes(term) ||
      log.rollNumber.toLowerCase().includes(term) ||
      (log.remarks || '').toLowerCase().includes(term)
    );
  });

  return (
    <div id="instruments-panel" className="space-y-6 font-sans text-sm text-zinc-300">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-850 pb-3">
        <div>
          <h2 className="text-base font-semibold font-display text-zinc-100 flex items-center gap-2">
            <Music size={18} className="text-emerald-400" />
            Studio Instrument Desk
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Log workstations, electronic keyboards, or analog guitars checked out for study hours.</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium rounded-lg flex items-center gap-1.5 text-xs">
          <CheckCircle size={15} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-400 font-medium rounded-lg flex items-center gap-1.5 text-xs">
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Check-Out form */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800/85 rounded-xl p-5 h-fit space-y-4 select-none text-xs shadow-md">
          <h3 className="font-semibold text-zinc-200 border-b border-zinc-800 pb-3 text-xs flex items-center gap-1.5 uppercase font-display tracking-wide">
            <LogIn size={13} className="text-emerald-400" />
            Book Checkout Session
          </h3>

          <form onSubmit={handleCheckoutSubmit} className="space-y-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Select Instrument/Workstation *</label>
              
              <div className="flex gap-2 items-center mb-2">
                <button
                  type="button"
                  onClick={() => setUseCustomInstrument(false)}
                  className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${!useCustomInstrument ? 'bg-emerald-600 text-zinc-100 shadow-sm' : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200'}`}
                >
                  Standard List
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomInstrument(true)}
                  className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${useCustomInstrument ? 'bg-emerald-600 text-zinc-100 shadow-sm' : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200'}`}
                >
                  Custom Gear
                </button>
              </div>

              {useCustomInstrument ? (
                <input
                  type="text"
                  placeholder="e.g. Gibson Les Paul, AKG C414 Condenser"
                  value={customInstrument}
                  onChange={(e) => setCustomInstrument(e.target.value)}
                  required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-700 focus:outline-none text-zinc-200 text-xs"
                />
              ) : (
                <select
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value)}
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-700 focus:outline-none text-zinc-200 text-xs cursor-pointer"
                >
                  {DEFAULT_INSTRUMENTS.map((inst, idx) => (
                    <option key={idx} value={inst} className="bg-zinc-900">{inst}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Borrower Name *</label>
                <input
                  type="text"
                  placeholder="Student Fullname"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-700 focus:outline-none text-zinc-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Student Roll / ID*</label>
                <input
                  type="text"
                  placeholder="e.g. 23-MU-45"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-700 focus:outline-none text-zinc-200 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Session Work Purpose *</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-700 focus:outline-none text-zinc-200 text-xs cursor-pointer"
              >
                <option value="Composition" className="bg-zinc-900">Composition (MIDI / Synthesizers)</option>
                <option value="Vocal Recording" className="bg-zinc-900">Vocal Recording / Micing</option>
                <option value="Instrument Practice" className="bg-zinc-900">Instrument Practice (Guitar/Harmonium)</option>
                <option value="Mixing & Editing" className="bg-zinc-900">Mixing & DAW arrangements</option>
                <option value="Learning / Tutorial" className="bg-zinc-900">Learning / Tutorials</option>
                <option value="Custom" className="bg-zinc-900">Custom Task (Write below)</option>
              </select>

              {purpose === 'Custom' && (
                <input
                  type="text"
                  placeholder="Describe your session work..."
                  value={customPurpose}
                  onChange={(e) => setCustomPurpose(e.target.value)}
                  required
                  className="w-full mt-2 p-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-700 focus:outline-none text-zinc-200 text-xs"
                />
              )}
            </div>

            {/* Micro clean checklist */}
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-2">
              <span className="block font-medium text-[9px] text-zinc-550 tracking-wider uppercase border-b border-zinc-900 pb-1">Stewardship Accountability</span>
              
              <label className="flex items-start gap-2 text-zinc-400 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={deskClean}
                  onChange={(e) => setDeskClean(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-500 bg-zinc-900 border-zinc-700 focus:ring-0"
                />
                <span className="text-[11px] leading-relaxed">Workstation and keybeds are wiped dust-clean</span>
              </label>

              <label className="flex items-start gap-2 text-zinc-400 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={cablesProper}
                  onChange={(e) => setCablesProper(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-500 bg-zinc-900 border-zinc-700 focus:ring-0"
                />
                <span className="text-[11px] leading-relaxed">Cables are laid flat with no stress tension</span>
              </label>

              <label className="flex items-start gap-2 text-zinc-400 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={noFoodDrink}
                  onChange={(e) => setNoFoodDrink(e.target.checked)}
                  className="mt-0.5 rounded text-red-500 bg-zinc-900 border-red-900/40 focus:ring-0"
                />
                <span className="font-semibold text-[11px] leading-relaxed text-red-400">Strictly no food or drinks near electronic consoles</span>
              </label>
            </div>

            <button 
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed transition-all text-zinc-100 font-medium rounded-lg cursor-pointer text-center flex items-center justify-center gap-1.5 uppercase tracking-wider text-xs shadow-sm select-none"
            >
              <LogIn size={13} />
              {submitting ? "Connecting..." : "Confirm & Log Checkout"}
            </button>
          </form>
        </div>

        {/* Real-time active checkouts queue & historic files log */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Active List */}
          <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800/80 space-y-4 flex flex-col justify-between">
            <h3 className="font-semibold text-zinc-200 border-b border-zinc-800 pb-3 text-xs flex items-center gap-1.5 uppercase font-display tracking-wide">
              <Clock size={13} className="text-emerald-400" />
              Active Checkouts ({activeCheckouts.length})
            </h3>

            {activeCheckouts.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/15 select-none">
                <Sparkles size={22} className="text-zinc-650 mx-auto mb-2 animate-pulse" />
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">All instruments nested</p>
                <p className="text-xs text-zinc-500 mt-1">All reference gear is currently safe in standard storage racks.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {activeCheckouts.map((log) => {
                  const checkInTimeDate = new Date(log.checkInTime);
                  const timeFormatted = checkInTimeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={log.id} className="p-4 bg-zinc-950/55 rounded-xl border border-zinc-800/80 flex flex-col justify-between h-36 hover:border-zinc-700 transition-all shadow-sm">
                      <div>
                        <div className="flex justify-between items-start w-full gap-1">
                          <strong className="text-zinc-100 font-semibold text-xs tracking-wide block truncate select-all">{log.instrumentName}</strong>
                        </div>
                        <p className="text-zinc-400 text-[11px] mt-1 select-all">Borrower: <span className="text-zinc-350 font-medium">{log.studentName}</span> <span className="text-zinc-500 font-mono text-[10px]">[{log.rollNumber}]</span></p>
                        
                        <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-zinc-500 border-t border-zinc-900/60 pt-2 select-all">
                          <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 text-[9px]">
                            {log.purpose}
                          </span>
                          <span>Checked out {timeFormatted}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleReturnItem(log.id)}
                        className="w-full mt-2 py-1 bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:text-white transition-all font-medium text-[10px] rounded-lg cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                      >
                        <LogOut size={11} />
                        Return Instrument
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* History Accordion toggle */}
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4 text-xs shadow-md">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="w-full flex justify-between items-center text-zinc-300 font-semibold uppercase tracking-wide cursor-pointer text-xs select-none font-display"
            >
              <span className="flex items-center gap-1.5 text-zinc-250">
                <History size={13} className="text-zinc-400" />
                Historic Logbook Register ({historicLogs.length})
              </span>
              <span className="text-[10px] text-zinc-400 border border-zinc-800 bg-zinc-950 px-2.5 py-1 rounded-lg transition-all">{historyOpen ? 'HIDE LOGS' : 'VIEW ALL LOGS'}</span>
            </button>

            {historyOpen && (
              <div className="mt-4 space-y-3 pt-4 border-t border-zinc-800">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-zinc-500" size={13} />
                  <input
                    type="text"
                    placeholder="Search past logs by gear or borrower name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-zinc-700 focus:outline-none text-zinc-200 text-xs"
                  />
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="text-center py-6 text-zinc-550 text-xs uppercase">No match found.</div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {filteredHistory.map((log) => {
                      const checkIn = new Date(log.checkInTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                      const checkOut = log.checkOutTime ? new Date(log.checkOutTime).toLocaleString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      return (
                        <div key={log.id} className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-lg text-xs leading-relaxed flex flex-col justify-between">
                          <div className="flex justify-between items-start gap-1">
                            <div>
                              <strong className="text-zinc-200 font-medium block select-all">{log.instrumentName}</strong>
                              <span className="text-zinc-400">Borrower: <strong className="text-zinc-300">{log.studentName}</strong> <span className="text-zinc-500 font-mono text-[10px]">[{log.rollNumber}]</span></span>
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-[9px] rounded-full">Returned</span>
                          </div>
                          
                          <div className="mt-2 flex flex-wrap justify-between items-center text-[10px] text-zinc-500 border-t border-zinc-900/40 pt-1.5 select-all">
                            <span>PURPOSE: {log.purpose}</span>
                            <span className="font-mono text-[9px]">{checkIn} - {checkOut}</span>
                          </div>
                          {log.remarks && (
                            <p className="text-zinc-500 italic select-all mt-1.5 pl-2 border-l border-zinc-800">"{log.remarks}"</p>
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

      </div>
    </div>
  );
}
