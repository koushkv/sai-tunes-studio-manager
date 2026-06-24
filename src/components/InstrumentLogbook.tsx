import React, { useState, useEffect, useMemo } from 'react';
import {
  db,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from '../lib/firebase';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  X,
  ArrowRightLeft,
  RotateCcw,
  User,
  MapPin,
  Tag,
} from 'lucide-react';
import { Asset, AssetStatus } from '../types';

interface InstrumentLogbookProps {
  currentUser: { email: string; displayName: string; photoURL: string | null };
  isAdmin: boolean;
}

interface SessionLog {
  id: string;
  studentName: string;
  rollNumber: string;
  assetId: string;
  assetName: string;
  purpose: string;
  checkInTime: string;
  checkOutTime?: string;
  status: 'active' | 'completed';
  notes?: string;
}

const STATUS_STYLES: Record<AssetStatus, { bg: string; text: string; label: string }> = {
  operational: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'Operational' },
  needs_repair: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', label: 'Needs Repair' },
  maintenance: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', label: 'Maintenance' },
  missing: { bg: 'bg-zinc-500/10 border-zinc-500/20', text: 'text-zinc-400', label: 'Missing' },
};

const EMPTY_ASSET = {
  name: '', category: '', model: '', serialNumber: '', location: '', status: 'operational' as AssetStatus, remarks: '',
};

export default function InstrumentLogbook({ currentUser, isAdmin }: InstrumentLogbookProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState<'active' | 'completed' | 'all'>('active');

  // Asset form (add/edit)
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  // Checkout form
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [checkoutAssetId, setCheckoutAssetId] = useState('');
  const [checkoutName, setCheckoutName] = useState(currentUser.displayName);
  const [checkoutRoll, setCheckoutRoll] = useState('');
  const [checkoutPurpose, setCheckoutPurpose] = useState('composition');

  // Return state
  const [returningSessionId, setReturningSessionId] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState('');

  // Sync assets from Firestore
  useEffect(() => {
    const assetsRef = collection(db, 'assets');
    const unsubAssets = onSnapshot(assetsRef, (snapshot) => {
      const items: Asset[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Asset);
      });
      items.sort((a, b) => a.name.localeCompare(b.name));
      setAssets(items);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching assets:', err);
      setLoading(false);
    });

    const logsRef = collection(db, 'instrument_logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const items: SessionLog[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as SessionLog);
      });
      items.sort((a, b) => (b.checkInTime || '').localeCompare(a.checkInTime || ''));
      setSessions(items);
    });

    return () => { unsubAssets(); unsubLogs(); };
  }, []);

  // Dynamic categories from data
  const categories = useMemo(() => {
    const cats = [...new Set(assets.map(a => a.category).filter(Boolean))];
    return cats.sort();
  }, [assets]);

  // Filter assets
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchesCat = selectedCategory === 'all' || a.category === selectedCategory;
      const matchesSearch = !searchQuery ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [assets, selectedCategory, searchQuery]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => sessionFilter === 'all' || s.status === sessionFilter);
  }, [sessions, sessionFilter]);

  // Available assets for checkout (operational + not lent)
  const availableAssets = assets.filter(a => a.status === 'operational' && !a.lentTo);

  // === Asset CRUD ===
  const openAddAsset = () => {
    setAssetForm(EMPTY_ASSET);
    setEditingAssetId(null);
    setShowAssetForm(true);
  };

  const openEditAsset = (asset: Asset) => {
    setAssetForm({
      name: asset.name,
      category: asset.category,
      model: asset.model,
      serialNumber: asset.serialNumber,
      location: asset.location,
      status: asset.status,
      remarks: asset.remarks,
    });
    setEditingAssetId(asset.id);
    setShowAssetForm(true);
  };

  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.name.trim()) return;

    const data = {
      name: assetForm.name.trim(),
      category: assetForm.category.trim(),
      model: assetForm.model.trim(),
      serialNumber: assetForm.serialNumber.trim(),
      location: assetForm.location.trim(),
      status: assetForm.status,
      remarks: assetForm.remarks.trim(),
      lastChecked: new Date().toISOString().split('T')[0],
    };

    try {
      if (editingAssetId) {
        await updateDoc(doc(db, 'assets', editingAssetId), data);
      } else {
        await addDoc(collection(db, 'assets'), { ...data, lentTo: '', lentAt: '' });
      }
      setShowAssetForm(false);
      setEditingAssetId(null);
      setAssetForm(EMPTY_ASSET);
    } catch (err) {
      console.error('Error saving asset:', err);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'assets', id));
      setDeletingAssetId(null);
    } catch (err) {
      console.error('Error deleting asset:', err);
    }
  };

  // === Checkout ===
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutAssetId || !checkoutName.trim() || !checkoutRoll.trim()) return;

    const asset = assets.find(a => a.id === checkoutAssetId);
    if (!asset) return;

    const now = new Date().toISOString();

    try {
      await addDoc(collection(db, 'instrument_logs'), {
        studentName: checkoutName.trim(),
        rollNumber: checkoutRoll.trim(),
        assetId: checkoutAssetId,
        assetName: asset.name,
        purpose: checkoutPurpose,
        checkInTime: now,
        status: 'active',
      });

      await updateDoc(doc(db, 'assets', checkoutAssetId), {
        lentTo: checkoutName.trim(),
        lentAt: now,
      });

      setShowCheckoutForm(false);
      setCheckoutAssetId('');
      setCheckoutRoll('');
      setCheckoutPurpose('composition');
    } catch (err) {
      console.error('Error during checkout:', err);
    }
  };

  // === Return ===
  const handleReturn = async (session: SessionLog) => {
    const now = new Date().toISOString();

    try {
      await updateDoc(doc(db, 'instrument_logs', session.id), {
        checkOutTime: now,
        status: 'completed',
        notes: returnNotes.trim() || 'Returned in good condition',
      });

      // Find the asset doc by matching session.assetId
      const assetDoc = assets.find(a => a.id === session.assetId);
      if (assetDoc) {
        await updateDoc(doc(db, 'assets', session.assetId), {
          lentTo: '',
          lentAt: '',
        });
      }

      setReturningSessionId(null);
      setReturnNotes('');
    } catch (err) {
      console.error('Error during return:', err);
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' +
        d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="space-y-6 font-sans text-sm text-zinc-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-850 pb-3">
        <div>
          <h2 className="text-base font-semibold font-display text-zinc-100 flex items-center gap-2">
            <Package size={18} className="text-emerald-400" />
            Instruments & Asset Inventory
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Track all department equipment, lending, and checkout history</p>
        </div>
        <div className="flex gap-2">
          {availableAssets.length > 0 && (
            <button
              onClick={() => setShowCheckoutForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-100 bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer shadow-sm uppercase tracking-wide select-none h-9"
            >
              <ArrowRightLeft size={13} />
              Checkout
            </button>
          )}
          {isAdmin && (
            <button
              onClick={openAddAsset}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-100 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-sm uppercase tracking-wide select-none h-9"
            >
              <Plus size={13} />
              Add Asset
            </button>
          )}
        </div>
      </div>

      {/* Search + Category Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:border-zinc-700 focus:outline-none text-zinc-200 text-xs"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 select-none flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                selectedCategory === 'all' ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all cursor-pointer capitalize ${
                  selectedCategory === cat ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Asset Grid */}
      {loading ? (
        <div className="text-center py-20 text-zinc-500 animate-pulse uppercase text-xs">Loading inventory...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-20 bg-zinc-950/20 border border-dashed border-zinc-800 rounded-xl space-y-3">
          <Package size={40} className="text-zinc-700 mx-auto" />
          <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">No Assets Added Yet</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
            {isAdmin ? 'Click "Add Asset" above to start building the inventory.' : 'The admin will add items here. Check back later.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map(asset => {
            const statusStyle = STATUS_STYLES[asset.status] || STATUS_STYLES.operational;
            return (
              <div key={asset.id} className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-750 transition-all shadow-sm group relative">
                {/* Admin actions */}
                {isAdmin && (
                  <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditAsset(asset)} className="p-1.5 bg-zinc-950 border border-zinc-700 rounded-md text-zinc-400 hover:text-white cursor-pointer" title="Edit">
                      <Edit size={11} />
                    </button>
                    <button onClick={() => setDeletingAssetId(asset.id)} className="p-1.5 bg-zinc-950 border border-red-900/50 rounded-md text-red-400 hover:text-red-300 cursor-pointer" title="Delete">
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}

                {/* Asset info */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100 leading-tight">{asset.name}</h4>
                    {asset.model && <p className="text-[10px] text-zinc-500 mt-0.5">{asset.model}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {asset.category && (
                    <span className="text-[9px] px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full font-medium uppercase tracking-wide flex items-center gap-1">
                      <Tag size={8} /> {asset.category}
                    </span>
                  )}
                  <span className={`text-[9px] px-2 py-0.5 ${statusStyle.bg} ${statusStyle.text} border rounded-full font-medium uppercase tracking-wide`}>
                    {statusStyle.label}
                  </span>
                </div>

                {asset.location && (
                  <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <MapPin size={10} /> {asset.location}
                  </p>
                )}

                {asset.serialNumber && (
                  <p className="text-[10px] text-zinc-600 font-mono">SN: {asset.serialNumber}</p>
                )}

                {/* Lending Status */}
                {asset.lentTo ? (
                  <div className="p-2.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                    <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                      <User size={10} /> Lent to: {asset.lentTo}
                    </p>
                    {asset.lentAt && (
                      <p className="text-[9px] text-amber-500/70 mt-0.5">Since: {formatDateTime(asset.lentAt)}</p>
                    )}
                  </div>
                ) : asset.status === 'operational' && (
                  <p className="text-[10px] text-emerald-500/70 flex items-center gap-1">
                    <CheckCircle size={10} /> Available
                  </p>
                )}

                {asset.remarks && (
                  <p className="text-[10px] text-zinc-500 italic border-t border-zinc-850 pt-2">{asset.remarks}</p>
                )}

                {/* Delete confirmation */}
                {deletingAssetId === asset.id && (
                  <div className="p-2.5 bg-red-500/5 border border-red-500/20 rounded-lg flex items-center justify-between">
                    <span className="text-[10px] text-red-400 font-medium">Delete this asset?</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleDeleteAsset(asset.id)} className="px-3 py-1 text-[10px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded cursor-pointer">Yes</button>
                      <button onClick={() => setDeletingAssetId(null)} className="px-3 py-1 text-[10px] font-semibold bg-zinc-800 text-zinc-300 rounded cursor-pointer">No</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Checkout/Return History */}
      {sessions.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 uppercase tracking-wide font-display">
              <Clock size={13} className="text-emerald-400" />
              Checkout History
            </h3>
            <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 select-none">
              {(['active', 'completed', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSessionFilter(f)}
                  className={`px-3 py-1 rounded-md text-[10px] font-medium capitalize transition-all cursor-pointer ${
                    sessionFilter === f ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredSessions.length === 0 ? (
              <p className="text-center py-8 text-zinc-500 text-xs uppercase">No {sessionFilter} sessions</p>
            ) : (
              filteredSessions.map(session => (
                <div key={session.id} className="p-3 bg-zinc-950/40 rounded-lg border border-zinc-850 text-xs space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-semibold text-zinc-200">{session.assetName || session.assetId}</span>
                      <span className="text-zinc-600 mx-1.5">→</span>
                      <span className="text-zinc-300">{session.studentName}</span>
                      {session.rollNumber && <span className="text-zinc-600 ml-1">({session.rollNumber})</span>}
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium uppercase border ${
                      session.status === 'active'
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {session.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-zinc-500">
                    <span className="capitalize">{session.purpose}</span>
                    <span>{formatDateTime(session.checkInTime)}</span>
                  </div>

                  {session.notes && <p className="text-[10px] text-zinc-500 italic">"{session.notes}"</p>}

                  {/* Return button for active sessions */}
                  {session.status === 'active' && (
                    returningSessionId === session.id ? (
                      <div className="pt-2 border-t border-zinc-850 space-y-2">
                        <input
                          type="text"
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                          placeholder="Return notes (optional)..."
                          className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none text-zinc-200 text-xs"
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setReturningSessionId(null)} className="px-3 py-1.5 text-[10px] font-medium bg-zinc-800 text-zinc-300 rounded cursor-pointer">Cancel</button>
                          <button onClick={() => handleReturn(session)} className="px-3 py-1.5 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer flex items-center gap-1">
                            <RotateCcw size={10} /> Confirm Return
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReturningSessionId(session.id)}
                        className="text-[10px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer flex items-center gap-1 pt-1"
                      >
                        <RotateCcw size={10} /> Return Item
                      </button>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Asset Modal */}
      {showAssetForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800/80 w-full max-w-md overflow-hidden font-sans shadow-2xl">
            <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800/60 flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider font-display text-zinc-200">
                {editingAssetId ? 'Edit Asset' : 'Add New Asset'}
              </h3>
              <button onClick={() => { setShowAssetForm(false); setEditingAssetId(null); }} className="text-zinc-400 hover:text-zinc-200 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAssetSubmit} className="p-5 space-y-4 text-xs text-zinc-300">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Name *</label>
                <input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  placeholder="e.g. Yamaha Keyboard" required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Category *</label>
                  <input type="text" list="category-suggestions" value={assetForm.category} onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                    placeholder="e.g. Instrument" required
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs" />
                  <datalist id="category-suggestions">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Status *</label>
                  <select value={assetForm.status} onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value as AssetStatus })}
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 cursor-pointer text-xs">
                    <option value="operational">Operational</option>
                    <option value="needs_repair">Needs Repair</option>
                    <option value="maintenance">Under Maintenance</option>
                    <option value="missing">Missing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Model</label>
                <input type="text" value={assetForm.model} onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                  placeholder="e.g. P-125"
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Serial Number</label>
                  <input type="text" value={assetForm.serialNumber} onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                    placeholder="e.g. SN-12345"
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs" />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Location</label>
                  <input type="text" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                    placeholder="e.g. Main Studio"
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Remarks</label>
                <textarea value={assetForm.remarks} onChange={(e) => setAssetForm({ ...assetForm, remarks: e.target.value })}
                  placeholder="Any notes about this item..."
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 h-16 text-xs" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => { setShowAssetForm(false); setEditingAssetId(null); }}
                  className="px-4 py-2 text-zinc-400 bg-zinc-950 hover:bg-zinc-850 rounded-lg font-medium uppercase text-[10px] border border-zinc-800 cursor-pointer">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 text-zinc-100 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold uppercase text-[10px] cursor-pointer">
                  {editingAssetId ? 'Save Changes' : 'Add Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800/80 w-full max-w-sm overflow-hidden font-sans shadow-2xl">
            <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800/60 flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider font-display text-zinc-200">Checkout Item</h3>
              <button onClick={() => setShowCheckoutForm(false)} className="text-zinc-400 hover:text-zinc-200 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCheckout} className="p-5 space-y-4 text-xs text-zinc-300">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Select Item *</label>
                <select value={checkoutAssetId} onChange={(e) => setCheckoutAssetId(e.target.value)} required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 cursor-pointer text-xs">
                  <option value="">Choose an item...</option>
                  {availableAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Your Name *</label>
                <input type="text" value={checkoutName} onChange={(e) => setCheckoutName(e.target.value)} required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs" />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Roll Number *</label>
                <input type="text" value={checkoutRoll} onChange={(e) => setCheckoutRoll(e.target.value)} required placeholder="e.g. 20BCSE01"
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs" />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Purpose *</label>
                <select value={checkoutPurpose} onChange={(e) => setCheckoutPurpose(e.target.value)}
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 cursor-pointer text-xs">
                  <option value="composition">Composition</option>
                  <option value="recording">Recording</option>
                  <option value="mixing">Mixing & Mastering</option>
                  <option value="practice">Practice</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setShowCheckoutForm(false)}
                  className="px-4 py-2 text-zinc-400 bg-zinc-950 hover:bg-zinc-850 rounded-lg font-medium uppercase text-[10px] border border-zinc-800 cursor-pointer">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 text-zinc-100 bg-sky-600 hover:bg-sky-700 rounded-lg font-semibold uppercase text-[10px] cursor-pointer">Checkout</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
