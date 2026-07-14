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
  userRole: import('../types').UserRole | null;
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
  operational: { bg: 'bg-[#34c759]/10', text: 'text-[#34c759]', label: 'Operational' },
  needs_repair: { bg: 'bg-[#ff3b30]/10', text: 'text-[#ff3b30]', label: 'Needs repair' },
  maintenance: { bg: 'bg-[#ff9f0a]/10', text: 'text-[#ff9f0a]', label: 'Maintenance' },
  missing: { bg: 'bg-[#86868b]/10', text: 'text-[#86868b]', label: 'Missing' },
};

const EMPTY_ASSET = {
  name: '', category: '', model: '', serialNumber: '', location: '', status: 'operational' as AssetStatus, remarks: '',
};

export default function InstrumentLogbook({ currentUser, isAdmin, userRole }: InstrumentLogbookProps) {
  const canManage = isAdmin || userRole === 'junior_admin';
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
  const [checkoutLenderName, setCheckoutLenderName] = useState(currentUser.displayName || currentUser.email);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutRoll, setCheckoutRoll] = useState('');
  const [checkoutPurpose, setCheckoutPurpose] = useState('Composition');

  // Return state
  const [returningSessionId, setReturningSessionId] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState('');

  // History filtering & item detail view
  const [historyAssetFilter, setHistoryAssetFilter] = useState<string>('all');
  const [expandedAssetHistoryId, setExpandedAssetHistoryId] = useState<string | null>(null);

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
    return sessions.filter(s => {
      const matchesStatus = sessionFilter === 'all' || s.status === sessionFilter;
      const matchesAsset = historyAssetFilter === 'all' || s.assetId === historyAssetFilter;
      return matchesStatus && matchesAsset;
    });
  }, [sessions, sessionFilter, historyAssetFilter]);

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
    if (!checkoutAssetId || !checkoutName.trim()) return;

    const asset = assets.find(a => a.id === checkoutAssetId);
    if (!asset) return;

    const now = new Date().toISOString();
    const lenderUsername = currentUser.displayName || currentUser.email || 'Student';

    try {
      await addDoc(collection(db, 'instrument_logs'), {
        studentName: checkoutName.trim(),
        rollNumber: checkoutRoll.trim(),
        lentBy: lenderUsername,
        assetId: checkoutAssetId,
        assetName: asset.name,
        purpose: checkoutPurpose.trim(),
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
      setCheckoutName('');
      setCheckoutPurpose('Composition');
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
    <div className="space-y-6 font-sans">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-[#1d1d1f]">Inventory</h2>
          <p className="text-[13px] text-[#86868b] mt-0.5">Track equipment and lending</p>
        </div>
        <div className="flex gap-2">
          {availableAssets.length > 0 && (
            <button
              onClick={() => setShowCheckoutForm(true)}
              className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors"
            >
              <ArrowRightLeft size={14} />
              Checkout
            </button>
          )}
          {canManage && (
            <button
              onClick={openAddAsset}
              className="flex items-center gap-1.5 bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors"
            >
              <Plus size={14} />
              Add asset
            </button>
          )}
        </div>
      </div>

      {/* Search + Category Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-2.5 text-[#86868b]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className="w-full pl-9 pr-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                selectedCategory === 'all' ? 'bg-[#0071e3] text-white' : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer capitalize ${
                  selectedCategory === cat ? 'bg-[#0071e3] text-white' : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
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
        <div className="text-center py-20 text-[#86868b] text-[14px] animate-pulse">Loading inventory...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <Package size={36} className="text-[#d2d2d7] mx-auto" />
          <p className="text-[15px] font-semibold text-[#6e6e73]">No assets added yet</p>
          <p className="text-[13px] text-[#86868b] max-w-sm mx-auto">
            {canManage ? 'Click "Add asset" above to start building the inventory.' : 'The admin will add items here. Check back later.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map(asset => {
            const statusStyle = STATUS_STYLES[asset.status] || STATUS_STYLES.operational;
            return (
              <div key={asset.id} className="bg-white rounded-2xl border border-[#e8e8ed] p-5 space-y-3 group relative">
                {/* Admin actions */}
                {canManage && (
                  <div className="absolute top-4 right-4 flex gap-1.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                    <button onClick={() => openEditAsset(asset)} className="p-1.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg text-[#6e6e73] hover:text-[#1d1d1f] cursor-pointer transition-colors" title="Edit">
                      <Edit size={12} />
                    </button>
                    <button onClick={() => setDeletingAssetId(asset.id)} className="p-1.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg text-[#ff3b30] hover:text-[#ff453a] cursor-pointer transition-colors" title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}

                {/* Asset info */}
                <div>
                  <h4 className="text-[15px] font-semibold text-[#1d1d1f] leading-tight">{asset.name}</h4>
                  {asset.model && <p className="text-[12px] text-[#86868b] mt-0.5">{asset.model}</p>}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {asset.category && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0071e3]/10 text-[#0071e3]">
                      {asset.category}
                    </span>
                  )}
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                    {statusStyle.label}
                  </span>
                </div>

                {asset.location && (
                  <p className="text-[12px] text-[#86868b] flex items-center gap-1">
                    <MapPin size={11} /> {asset.location}
                  </p>
                )}

                {asset.serialNumber && (
                  <p className="text-[12px] text-[#86868b]">SN: {asset.serialNumber}</p>
                )}

                {/* Lending Status */}
                {asset.lentTo ? (
                  <div className="text-[13px] text-[#ff9f0a]">
                    <span className="font-medium">Lent to: {asset.lentTo}</span>
                    {asset.lentAt && (
                      <span className="text-[12px] text-[#86868b] ml-2">since {formatDateTime(asset.lentAt)}</span>
                    )}
                  </div>
                ) : asset.status === 'operational' && (
                  <p className="text-[13px] text-[#34c759] flex items-center gap-1">
                    <CheckCircle size={12} /> Available
                  </p>
                )}

                {asset.remarks && (
                  <p className="text-[12px] text-[#86868b] italic border-t border-[#e8e8ed] pt-2">{asset.remarks}</p>
                )}

                {/* Per-Asset Lending History Toggle */}
                {(() => {
                  const assetLogs = sessions.filter(s => s.assetId === asset.id);
                  const isExpanded = expandedAssetHistoryId === asset.id;
                  if (assetLogs.length === 0) return null;
                  return (
                    <div className="border-t border-[#e8e8ed] pt-2">
                      <button
                        type="button"
                        onClick={() => setExpandedAssetHistoryId(isExpanded ? null : asset.id)}
                        className="flex items-center gap-1 text-[12px] text-[#0071e3] font-medium hover:underline cursor-pointer transition-colors"
                      >
                        <Clock size={12} /> {isExpanded ? 'Hide Lending Log' : `Lending Log (${assetLogs.length})`}
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 space-y-2 max-h-48 overflow-y-auto pr-1">
                          {assetLogs.map(log => (
                            <div key={log.id} className="text-[11px] bg-[#f5f5f7] p-2.5 rounded-lg space-y-1 border border-[#e8e8ed]">
                              <div className="flex justify-between items-center font-medium text-[#1d1d1f]">
                                <span>Lent to: {log.studentName} {log.rollNumber ? `(${log.rollNumber})` : ''}</span>
                                <span className={log.status === 'active' ? 'text-[#ff9f0a]' : 'text-[#34c759]'}>
                                  {log.status === 'active' ? 'Active' : 'Returned'}
                                </span>
                              </div>
                              <div className="text-[#86868b] space-y-0.5">
                                <div><strong className="text-[#6e6e73]">Issued / Lent by (Student):</strong> <span className="text-[#0071e3] font-medium">{log.lentBy || currentUser.displayName || currentUser.email}</span></div>
                                <div><strong className="text-[#6e6e73]">Borrowed Date:</strong> {formatDateTime(log.checkInTime)}</div>
                                {log.checkOutTime && <div><strong className="text-[#6e6e73]">Returned Date:</strong> {formatDateTime(log.checkOutTime)}</div>}
                                {log.purpose && <div><strong className="text-[#6e6e73]">Purpose:</strong> {log.purpose}</div>}
                                {log.notes && <div className="italic text-[#86868b]">"{log.notes}"</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Delete confirmation */}
                {deletingAssetId === asset.id && (
                  <div className="p-3 bg-[#ff3b30]/5 border border-[#ff3b30]/20 rounded-xl flex items-center justify-between">
                    <span className="text-[13px] text-[#ff3b30] font-medium">Delete this asset?</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleDeleteAsset(asset.id)} className="bg-[#ff3b30] hover:bg-[#ff453a] text-white rounded-full px-3 py-1 text-[12px] font-medium cursor-pointer transition-colors">Yes</button>
                      <button onClick={() => setDeletingAssetId(null)} className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-3 py-1 text-[12px] font-medium cursor-pointer transition-colors">No</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lending & Return History */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
                Lending & Return Logbook History
              </h3>
              <p className="text-[12px] text-[#86868b] mt-0.5">Track borrowing dates, active checkouts, and return timestamps</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
              {/* Asset filter select */}
              <select
                value={historyAssetFilter}
                onChange={(e) => setHistoryAssetFilter(e.target.value)}
                className="bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-1.5 text-[12px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] cursor-pointer"
              >
                <option value="all">All Instruments</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              {/* Status filter */}
              <div className="flex items-center gap-1">
                {(['active', 'completed', 'all'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setSessionFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium capitalize transition-colors cursor-pointer ${
                      sessionFilter === f ? 'bg-[#0071e3] text-white' : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
                    }`}
                  >
                    {f === 'active' ? 'Active' : f === 'completed' ? 'Returned' : 'All'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {filteredSessions.length === 0 ? (
              <p className="text-center py-8 text-[#86868b] text-[13px]">No matching borrowing history found.</p>
            ) : (
              filteredSessions.map(session => (
                <div key={session.id} className="p-4 bg-[#f5f5f7] rounded-xl text-[13px] space-y-2 border border-[#e8e8ed]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      <span className="font-semibold text-[#1d1d1f] text-[14px]">{session.assetName || session.assetId}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 self-start sm:self-auto ${
                      session.status === 'active'
                        ? 'bg-[#ff9f0a]/10 text-[#ff9f0a]'
                        : 'bg-[#34c759]/10 text-[#34c759]'
                    }`}>
                      {session.status === 'active' ? 'Currently Lent' : 'Returned'}
                    </span>
                  </div>

                  {/* Issuer & Borrower Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] bg-white/60 p-2.5 rounded-lg border border-[#e8e8ed]">
                    <div>
                      <span className="font-semibold text-[#1d1d1f]">Issued / Lent by (Student): </span>
                      <span className="text-[#0071e3] font-medium">{session.lentBy || currentUser.displayName || currentUser.email}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#1d1d1f]">Borrowed by (Student): </span>
                      <span className="text-[#1d1d1f] font-medium">{session.studentName}</span>
                      {session.rollNumber && <span className="text-[#86868b] ml-1">({session.rollNumber})</span>}
                    </div>
                  </div>

                  {/* Dates: Borrowed & Returned */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] text-[#6e6e73] bg-white/60 p-2.5 rounded-lg border border-[#e8e8ed]">
                    <div>
                      <span className="font-semibold text-[#1d1d1f]">Borrowed Date: </span>
                      <span>{formatDateTime(session.checkInTime)}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#1d1d1f]">Returned Date: </span>
                      <span>{session.checkOutTime ? formatDateTime(session.checkOutTime) : <em className="text-[#ff9f0a] not-italic font-medium">Still out with borrower</em>}</span>
                    </div>
                  </div>

                  {session.purpose && (
                    <p className="text-[12px] text-[#6e6e73]">
                      <span className="font-semibold text-[#1d1d1f]">Purpose: </span>
                      <span>{session.purpose}</span>
                    </p>
                  )}

                  {session.notes && (
                    <p className="text-[12px] text-[#86868b] italic bg-white/70 p-2 rounded-lg border border-[#e8e8ed]">
                      "{session.notes}"
                    </p>
                  )}

                  {/* Return button for active sessions */}
                  {session.status === 'active' && (
                    returningSessionId === session.id ? (
                      <div className="pt-2 border-t border-[#e8e8ed] space-y-2">
                        <input
                          type="text"
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                          placeholder="Return notes (optional)..."
                          className="w-full px-3 py-2.5 bg-white border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]"
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setReturningSessionId(null)} className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors">Cancel</button>
                          <button onClick={() => handleReturn(session)} className="bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors flex items-center gap-1">
                            <RotateCcw size={12} /> Confirm return
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReturningSessionId(session.id)}
                        className="text-[#0071e3] hover:text-[#0077ED] text-[13px] font-medium cursor-pointer transition-colors flex items-center gap-1 pt-1"
                      >
                        <RotateCcw size={12} /> Return item
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden font-sans max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#e8e8ed] flex justify-between items-center">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
                {editingAssetId ? 'Edit asset' : 'Add new asset'}
              </h3>
              <button onClick={() => { setShowAssetForm(false); setEditingAssetId(null); }} className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssetSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Name *</label>
                <input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  placeholder="e.g. Yamaha Keyboard" required
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Category *</label>
                  <input type="text" list="category-suggestions" value={assetForm.category} onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                    placeholder="e.g. Instrument" required
                    className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]" />
                  <datalist id="category-suggestions">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Status *</label>
                  <select value={assetForm.status} onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value as AssetStatus })}
                    className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] cursor-pointer">
                    <option value="operational">Operational</option>
                    <option value="needs_repair">Needs repair</option>
                    <option value="maintenance">Under maintenance</option>
                    <option value="missing">Missing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Model</label>
                <input type="text" value={assetForm.model} onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                  placeholder="e.g. P-125"
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Serial number</label>
                  <input type="text" value={assetForm.serialNumber} onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                    placeholder="e.g. SN-12345"
                    className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Location</label>
                  <input type="text" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                    placeholder="e.g. Main Studio"
                    className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]" />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Remarks</label>
                <textarea value={assetForm.remarks} onChange={(e) => setAssetForm({ ...assetForm, remarks: e.target.value })}
                  placeholder="Any notes about this item..."
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] h-20 resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e8e8ed]">
                <button type="button" onClick={() => { setShowAssetForm(false); setEditingAssetId(null); }}
                  className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors">Cancel</button>
                <button type="submit"
                  className="bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors">
                  {editingAssetId ? 'Save changes' : 'Add asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden font-sans max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#e8e8ed] flex justify-between items-center">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Checkout item</h3>
              <button onClick={() => setShowCheckoutForm(false)} className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCheckout} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Select item *</label>
                <select value={checkoutAssetId} onChange={(e) => setCheckoutAssetId(e.target.value)} required
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] cursor-pointer">
                  <option value="">Choose an item...</option>
                  {availableAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Issued / Lent by (Logged-in Student)</label>
                <input 
                  type="text" 
                  value={currentUser.displayName || currentUser.email} 
                  disabled 
                  className="w-full px-3 py-2.5 bg-[#e8e8ed] border border-[#d2d2d7] rounded-lg text-[14px] text-[#6e6e73] cursor-not-allowed select-none font-medium" 
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Whom are you giving it to? (Borrower Name) *</label>
                <input 
                  type="text" 
                  value={checkoutName} 
                  onChange={(e) => setCheckoutName(e.target.value)} 
                  required 
                  placeholder="Enter the borrower's name"
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]" 
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Roll number (Optional)</label>
                <input 
                  type="text" 
                  value={checkoutRoll} 
                  onChange={(e) => setCheckoutRoll(e.target.value)} 
                  placeholder="e.g. 20BCSE01 (Optional)"
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]" 
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Purpose *</label>
                <input 
                  type="text" 
                  list="purpose-options"
                  value={checkoutPurpose} 
                  onChange={(e) => setCheckoutPurpose(e.target.value)}
                  placeholder="e.g. Composition, Practice, Recording..."
                  required
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]" 
                />
                <datalist id="purpose-options">
                  <option value="Composition" />
                  <option value="Recording" />
                  <option value="Mixing & Mastering" />
                  <option value="Practice" />
                </datalist>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e8e8ed]">
                <button type="button" onClick={() => setShowCheckoutForm(false)}
                  className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors">Cancel</button>
                <button type="submit"
                  className="bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors">Checkout</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
