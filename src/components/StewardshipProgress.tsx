import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, orderBy, limit } from '../lib/firebase';
import { 
  TrendingUp, 
  Clock, 
  Activity, 
  BookOpen, 
  Zap, 
  Disc, 
  Sparkles, 
  RotateCcw,
  AlertOctagon,
  ShieldAlert,
  ClipboardList
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'checkout' | 'return' | 'routine';
  title: string;
  user: string;
  date: string;
  timeFormatted: string;
  desc: string;
}

export default function StewardshipProgress() {
  const [activeCheckoutsCount, setActiveCheckoutsCount] = useState(0);
  const [totalLogEntries, setTotalLogEntries] = useState(0);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [routineCompletionsCount, setRoutineCompletionsCount] = useState(0);

  // Power Sequencing Game State
  const [seqMode, setSeqMode] = useState<'on' | 'off'>('on');
  const [gameState, setGameState] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [correctClicks, setCorrectClicks] = useState<string[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Sockets & hardware switches:
  const sequencingOnOrder = ['Power Strip', 'Audio Interface', 'DAW Computer', 'Studio Monitors'];
  const sequencingOffOrder = ['Studio Monitors', 'DAW Computer', 'Audio Interface', 'Power Strip'];

  // Cable Coiler simulator state
  const [coilingStep, setCoilingStep] = useState(0);
  const [coiledList, setCoiledList] = useState<string[]>([]);
  const [cableError, setCableError] = useState<string | null>(null);

  const stepsCable = [
    { title: "Step 1: The 'Over' Loop", desc: "Hold the cable in your non-dominant hand. Loop the cable forward naturally over your thumb." },
    { title: "Step 2: The 'Under' Loop", desc: "Twist your wrist outwards, grab the cable from underneath, and coil it in the opposite direction to neutralize radial torque." },
    { title: "Step 3: Keep alternating", desc: "Repeat: One Over loop, then one Under loop. This prevents internal copper strands from tangling." },
    { title: "Step 4: Secure the end", desc: "Never tie a knot! Secure with a Velcro cable tie and hang neatly on the wall hooks." }
  ];

  // Fetch real-time metrics and compile an activity feed
  useEffect(() => {
    // 1. Listen to instrument logs
    const logsRef = collection(db, 'instrument_logs');
    const logsUnsubscribe = onSnapshot(logsRef, (snapshot) => {
      let active = 0;
      let total = 0;
      const checkoutActivities: ActivityItem[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        total++;
        if (!data.returned) {
          active++;
          checkoutActivities.push({
            id: `co-${docSnap.id}`,
            type: 'checkout',
            title: `Checkout: ${data.instrumentName}`,
            user: data.studentName,
            date: data.checkInTime,
            timeFormatted: new Date(data.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            desc: `Tasked for ${data.purpose}`
          });
        } else {
          checkoutActivities.push({
            id: `ret-${docSnap.id}`,
            type: 'return',
            title: `Returned: ${data.instrumentName}`,
            user: data.studentName,
            date: data.checkOutTime || data.checkInTime,
            timeFormatted: new Date(data.checkOutTime || data.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            desc: data.remarks || 'Returned ok'
          });
        }
      });

      setActiveCheckoutsCount(active);
      setTotalLogEntries(total);

      // Merge and sort activities with routines completions
      setRecentActivities(prev => {
        const routinesOnly = prev.filter(x => x.type === 'routine');
        const combined = [...routinesOnly, ...checkoutActivities];
        return combined.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
      });
    }, (error) => {
      console.error(error);
    });

    // 2. Listen to routine tasks (specifically to build a timeline count and activities)
    const tasksRef = collection(db, 'maintenance_tasks');
    const tasksUnsubscribe = onSnapshot(tasksRef, (snapshot) => {
      let count = 0;
      const routineActivities: ActivityItem[] = [];

      snapshot.forEach((docSnap) => {
        const task = docSnap.data();
        if (task.history && Array.isArray(task.history)) {
          count += task.history.length;
          task.history.forEach((h: any, idx: number) => {
            routineActivities.push({
              id: `rt-${docSnap.id}-${idx}`,
              type: 'routine',
              title: `Checked: ${task.title}`,
              user: h.completedBy,
              date: h.date + 'T12:00:00Z', // fallback parsing
              timeFormatted: 'Completed Today',
              desc: h.remarks
            });
          });
        }
      });

      setRoutineCompletionsCount(count);

      // Merge and sort
      setRecentActivities(prev => {
        const checkoutsOnly = prev.filter(x => x.type !== 'routine');
        const combined = [...checkoutsOnly, ...routineActivities];
        return combined.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
      });

    }, (error) => {
      console.error(error);
    });

    return () => {
      logsUnsubscribe();
      tasksUnsubscribe();
    };
  }, []);

  // Power Sequencing handlers
  const startGame = (type: 'on' | 'off') => {
    setSeqMode(type);
    setGameState('running');
    setCorrectClicks([]);
    setFeedbackMsg(`TRANS PANEL ARMED: Toggle power switches in precise routing order [To ${type.toUpperCase()}] to decouple back-EMF pop voltage.`);
  };

  const handlePowerClick = (item: string) => {
    if (gameState !== 'running') return;

    const expectedOrder = seqMode === 'on' ? sequencingOnOrder : sequencingOffOrder;
    const currentExpectIndex = correctClicks.length;
    const expectedItem = expectedOrder[currentExpectIndex];

    if (item === expectedItem) {
      const updatedClicks = [...correctClicks, item];
      setCorrectClicks(updatedClicks);
      
      if (updatedClicks.length === expectedOrder.length) {
        setGameState('success');
        setFeedbackMsg(`✨ DRILL PERFECT: Sequences matching theoretical models! Protected voice coils from transient damage.`);
      } else {
        setFeedbackMsg(`SUCCESSFUL TRIG: Next expected toggle is -> ${expectedOrder[updatedClicks.length].toUpperCase()}`);
      }
    } else {
      setGameState('failed');
      if (seqMode === 'on' && item === 'Studio Monitors') {
        setFeedbackMsg(`🚨 DAMAGE SIMULATED: Loud audio crackle/POP! Monitors engaged before source units line stabilization logic. Tweeter damage simulated.`);
      } else if (seqMode === 'off' && item !== 'Studio Monitors' && !correctClicks.includes('Studio Monitors')) {
        setFeedbackMsg(`🚨 DISCHARGE OUTLET TRIPPED: Amplifier still hot! Switch active monitors OFF first to prevent pop feedback!`);
      } else {
        setFeedbackMsg(`🚨 ORDER FAULT: Safe alignment broken. Up: Source OUTWARDS. Down: Monitors BACKWARDS.`);
      }
    }
  };

  // Cable Alignment handlers
  const handleCoilStepClick = (type: 'over' | 'under') => {
    if (coiledList.length >= 6) return;

    const expected = coiledList.length % 2 === 0 ? 'over' : 'under';
    if (type === expected) {
      setCableError(null);
      const nextList = [...coiledList, type];
      setCoiledList(nextList);
      if (nextList.length === 6) {
        setCoilingStep(3); // Secure wrap
      } else {
        setCoilingStep(nextList.length % 2 === 0 ? 0 : 1);
      }
    } else {
      setCableError(`TENSION FAULT: Altenation broken. Laying two "${type.toUpperCase()}" wraps consecutively memory-bends the internal copper shields.`);
      resetCableSim();
    }
  };

  const resetCableSim = () => {
    setCoilingStep(0);
    setCoiledList([]);
  };

  return (
    <div id="progress-layout" className="space-y-6 font-sans text-sm text-zinc-300">
      
      {/* Title */}
      <div className="border-b border-zinc-850 pb-3">
        <h2 className="text-base font-semibold font-display text-zinc-100 flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-400" />
          Stewardship Progress & Training Cabin
        </h2>
        <p className="text-xs text-zinc-400 mt-1">Audit real-time metrics, live log timestamps, and train on safe hardware simulators.</p>
      </div>

      {/* Main real-time stat blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl space-y-2 shadow-sm select-none">
          <h4 className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={13} className="text-emerald-400 animate-pulse" /> Live Studio Activity
          </h4>
          <p className="text-sm font-bold text-zinc-100">{activeCheckoutsCount} Instruments Active</p>
          <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-850">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${Math.min(activeCheckoutsCount * 20, 100)}%` }}></div>
          </div>
          <span className="text-[11px] text-zinc-550 text-zinc-500 mt-1 block">Active gear in room right now</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl space-y-2 shadow-sm select-none">
          <h4 className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardList size={13} className="text-indigo-400" /> Routines Completed
          </h4>
          <p className="text-sm font-bold text-zinc-100">{routineCompletionsCount} Audited Checks Done</p>
          <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-850">
            <div className="bg-indigo-500 h-full transition-all" style={{ width: `${Math.min(routineCompletionsCount * 5, 100)}%` }}></div>
          </div>
          <span className="text-[11px] text-zinc-550 text-zinc-500 mt-1 block">All-time maintenance tasks registered</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl space-y-2 shadow-sm select-none">
          <h4 className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={13} className="text-emerald-400" /> Total Log Syncs
          </h4>
          <p className="text-sm font-bold text-zinc-100">{totalLogEntries} Session Syncs</p>
          <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-850">
            <div className="bg-sky-400 h-full transition-all" style={{ width: `${Math.min(totalLogEntries * 3, 100)}%` }}></div>
          </div>
          <span className="text-[11px] text-zinc-550 text-zinc-500 mt-1 block">Check-ins recorded securely in database</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Side: Real-time Live activity lead stream */}
        <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800/80 p-5 rounded-xl space-y-4 shadow-sm">
          <div className="border-b border-zinc-800 pb-3">
            <h3 className="font-semibold text-zinc-200 text-xs flex items-center gap-1.5 uppercase tracking-wide font-display">
              <Clock size={13} className="text-zinc-400" />
              Live Activity Ledger
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1">Real-time actions in Sai Tunes</p>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 select-all">
            {recentActivities.length === 0 ? (
              <div className="text-center py-20 text-zinc-500 italic text-xs">
                <Activity size={24} className="mx-auto mb-2 text-zinc-800" />
                No events processed yet.
              </div>
            ) : (
              recentActivities.map((act) => (
                <div key={act.id} className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-lg block select-text text-xs leading-normal shadow-xs">
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                      act.type === 'checkout' 
                        ? 'bg-sky-500/10 border border-sky-500/20 text-sky-400' 
                        : act.type === 'return' 
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold' 
                          : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                    }`}>
                      {act.type}
                    </span>
                    <span className="text-[10px] text-zinc-550 text-zinc-500 font-medium select-none">{act.timeFormatted}</span>
                  </div>
                  <strong className="block text-xs text-zinc-200 font-medium mt-2 leading-snug">{act.title}</strong>
                  <p className="text-[11px] text-zinc-400 italic mt-1 pl-2 border-l border-zinc-800">By {act.user.split(' ')[0]} &mdash; "{act.desc}"</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Interactive Simulators for student checklist drills */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Power sequence drill */}
          <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-xl space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-zinc-200 flex items-center gap-1.5 text-xs uppercase tracking-wide font-display">
                  <Zap size={14} className="text-amber-400 animate-pulse" />
                  Power Sequence Simulator
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1">Test power routing transients to protect reference monitors</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startGame('on')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-zinc-100 rounded-lg text-[10px] font-semibold uppercase cursor-pointer transition-colors"
                >
                  Boot Turn-On Drill
                </button>
                <button
                  type="button"
                  onClick={() => startGame('off')}
                  className="px-3 py-1.5 bg-zinc-950 text-zinc-400 border border-zinc-800 hover:bg-zinc-900 rounded-lg text-[10px] font-semibold uppercase cursor-pointer transition-colors"
                >
                  Shut-Down Drill
                </button>
              </div>
            </div>

            {gameState === 'idle' ? (
              <div className="text-center py-8 bg-zinc-950/20 rounded-xl border border-dashed border-zinc-800 text-xs text-zinc-500 space-y-1.5">
                <Zap size={20} className="mx-auto text-amber-500" />
                <p className="font-semibold text-zinc-400">Power Transient Trainer Ready</p>
                <p className="px-6 text-[11px] text-zinc-500 max-w-lg mx-auto">Select a boot or shut-down drill sequence above to practice correct studio hardware alignment.</p>
              </div>
            ) : (
              <div className="space-y-4 select-none">
                <div className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2 ${
                  gameState === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : gameState === 'failed' 
                      ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                      : 'bg-zinc-950 text-zinc-400 border-zinc-850'
                }`}>
                  {gameState === 'failed' ? <AlertOctagon size={14} className="text-red-400 mt-0.5 flex-shrink-0" /> : <Sparkles size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />}
                  <p>{feedbackMsg}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: 'Power Strip', desc: 'Main Suppressor', icon: '🔌' },
                    { name: 'Audio Interface', desc: 'Scarlett Preamps', icon: '🎛️' },
                    { name: 'DAW Computer', desc: 'Station Unit', icon: '🖥️' },
                    { name: 'Studio Monitors', desc: 'JBL Speakers', icon: '🔊' }
                  ].map(item => {
                    const isClicked = correctClicks.includes(item.name);
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handlePowerClick(item.name)}
                        disabled={gameState !== 'running' || isClicked}
                        className={`p-3.5 rounded-xl border text-center transition-all flex flex-col justify-between h-24 cursor-pointer ${
                          isClicked 
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold' 
                            : gameState === 'failed'
                              ? 'bg-zinc-950 text-zinc-700 border-zinc-900 grayscale'
                              : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 active:scale-95 text-zinc-300'
                        }`}
                      >
                        <span className="text-xl block">{item.icon}</span>
                        <div>
                          <h4 className="font-semibold text-[10px] uppercase leading-none">{item.name}</h4>
                          <span className="text-[9px] text-zinc-500 block mt-1 uppercase tracking-tight">{item.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-zinc-800 text-zinc-500">
                  <span>Target Sequence Mode: <strong className="uppercase text-emerald-400 font-semibold">{seqMode}</strong></span>
                  <button 
                    type="button"
                    onClick={() => setGameState('idle')} 
                    className="flex items-center gap-1 hover:text-zinc-300 font-semibold uppercase cursor-pointer"
                  >
                    <RotateCcw size={11} /> Reset Board
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cable Alignment trainer */}
          <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-xl space-y-4 shadow-sm">
            <div className="border-b border-zinc-800 pb-3">
              <h3 className="font-semibold text-zinc-200 flex items-center gap-1.5 text-xs uppercase tracking-wide font-display">
                <Disc className="text-emerald-400 animate-spin" style={{ animationDuration: '8s' }} size={13} />
                Over-Under Cable Stewardship Trainer
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1">Interactive simulation to coil music cables and neutralize tension memory</p>
            </div>

            {cableError && (
              <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 text-xs rounded-lg tracking-wide leading-normal flex items-start justify-between">
                <div>
                  <strong className="block uppercase font-bold text-xs">⚠️ Tension Fault:</strong>
                  {cableError}
                </div>
                <button type="button" onClick={() => setCableError(null)} className="text-red-400 hover:text-red-200 font-semibold ml-2 text-xs uppercase cursor-pointer">Dismiss</button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs select-none">
              <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 flex flex-col justify-between space-y-3">
                <div>
                  <span className="font-semibold text-[10px] uppercase tracking-wider text-zinc-500 block border-b border-zinc-900 pb-1 mb-2">Active Step Instruction</span>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-zinc-200 tracking-wide text-xs">{stepsCable[coilingStep].title}</h4>
                    <p className="text-zinc-400 leading-relaxed text-[11px]">{stepsCable[coilingStep].desc}</p>
                  </div>
                </div>

                {/* Cable Reel visualization */}
                <div className="pt-3 flex justify-center gap-1.5 items-center min-h-[44px] border-t border-zinc-900/60">
                  {coiledList.length === 0 ? (
                    <span className="text-zinc-600 italic uppercase font-semibold text-[9px] tracking-wider">Empty Cable Reel</span>
                  ) : (
                    coiledList.map((coil, idx) => (
                      <span 
                        key={idx} 
                        className={`h-6 px-3.5 rounded-full border flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider ${
                          coil === 'over' 
                            ? 'bg-sky-500/10 border-sky-500/40 text-sky-400' 
                            : 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                        }`}
                      >
                        {coil}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Interaction Buttons */}
              <div className="flex flex-col justify-between p-4 bg-zinc-950/40 border border-zinc-800 rounded-xl space-y-3">
                <div>
                  <span className="font-semibold text-[10px] uppercase tracking-wider text-zinc-500 block border-b border-zinc-900 pb-1 mb-2">Coil Practice</span>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    Alternating Over and Under loops creates a neutral plane where copper fibers exert zero strain.
                  </p>
                </div>

                {coiledList.length < 6 ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleCoilStepClick('over')}
                      className="py-2.5 bg-zinc-900 hover:bg-zinc-850 active:scale-95 transition-all text-sky-400 border border-sky-500/20 font-semibold rounded-lg cursor-pointer text-center flex flex-col items-center justify-center uppercase text-[10px] tracking-wide"
                    >
                      Coil OVER
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCoilStepClick('under')}
                      className="py-2.5 bg-zinc-900 hover:bg-zinc-850 active:scale-95 transition-all text-purple-400 border border-purple-500/20 font-semibold rounded-lg cursor-pointer text-center flex flex-col items-center justify-center uppercase text-[10px] tracking-wide"
                    >
                      Coil UNDER
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-center space-y-2 uppercase">
                    <p className="font-bold text-xs">✓ Cable coiled successfully!</p>
                    <button 
                      type="button"
                      onClick={resetCableSim}
                      className="mx-auto mt-1 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-zinc-100 rounded-lg text-[10px] font-semibold px-3 py-1.5 cursor-pointer transition-colors"
                    >
                      <RotateCcw size={10} /> RESTART COILING
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
