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
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  RotateCcw,
  ChevronDown,
  SearchX,
} from 'lucide-react';
import { Asset, AssetStatus, UserRole } from '../types';
import { ASSET_STATUS } from '../lib/stages';
import { formatDateTime } from '../lib/format';
import { firestoreErrorMessage } from '../lib/errors';
import { notify } from '../lib/notifications';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import {
  Button,
  EmptyState,
  FilterPill,
  LoadingState,
  PageHeader,
  cardClass,
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from './ui/Primitives';

interface InstrumentLogbookProps {
  currentUser: { email: string; displayName: string; photoURL: string | null };
  isAdmin: boolean;
  userRole: UserRole | null;
}

interface SessionLog {
  id: string;
  studentName: string;
  rollNumber: string;
  lentBy?: string;
  assetId: string;
  assetName: string;
  purpose: string;
  checkInTime: string;
  checkOutTime?: string;
  status: 'active' | 'completed';
  notes?: string;
}

const EMPTY_ASSET = {
  name: '',
  category: '',
  model: '',
  serialNumber: '',
  location: '',
  status: 'operational' as AssetStatus,
  remarks: '',
};

export default function InstrumentLogbook({ currentUser, isAdmin, userRole }: InstrumentLogbookProps) {
  const canManage = isAdmin || userRole === 'junior_admin';
  const toast = useToast();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [historyAssetFilter, setHistoryAssetFilter] = useState<string>('all');

  // Asset form (add/edit)
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);

  // Checkout form
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [checkoutAssetId, setCheckoutAssetId] = useState('');
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutRoll, setCheckoutRoll] = useState('');
  const [checkoutPurpose, setCheckoutPurpose] = useState('Composition');

  // Return flow
  const [returningSession, setReturningSession] = useState<SessionLog | null>(null);
  const [returnNotes, setReturnNotes] = useState('');

  // Per-asset expanded lending log
  const [expandedAssetHistoryId, setExpandedAssetHistoryId] = useState<string | null>(null);

  // Blocks double submits on every async action
  const [busy, setBusy] = useState(false);

  // Sync assets + logs from Firestore
  useEffect(() => {
    const unsubAssets = onSnapshot(
      collection(db, 'assets'),
      (snapshot) => {
        const items: Asset[] = [];
        snapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() } as Asset));
        items.sort((a, b) => a.name.localeCompare(b.name));
        setAssets(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching assets:', err);
        toast.error(firestoreErrorMessage(err, 'Could not load the inventory. Check your connection.'));
        setLoading(false);
      },
    );

    const unsubLogs = onSnapshot(
      collection(db, 'instrument_logs'),
      (snapshot) => {
        const items: SessionLog[] = [];
        snapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() } as SessionLog));
        items.sort((a, b) => (b.checkInTime || '').localeCompare(a.checkInTime || ''));
        setSessions(items);
      },
      (err) => {
        console.error('Error fetching lending logs:', err);
        toast.error(firestoreErrorMessage(err, 'Could not load the lending history.'));
      },
    );

    return () => { unsubAssets(); unsubLogs(); };
  }, [toast]);

  const categories = useMemo(
    () => [...new Set(assets.map(a => a.category).filter(Boolean))].sort(),
    [assets],
  );

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter(a => {
      const matchesCat = selectedCategory === 'all' || a.category === selectedCategory;
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.model || '').toLowerCase().includes(q) ||
        (a.category || '').toLowerCase().includes(q) ||
        (a.serialNumber || '').toLowerCase().includes(q) ||
        (a.location || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [assets, selectedCategory, searchQuery]);

  const filteredSessions = useMemo(
    () => sessions.filter(s => {
      const matchesStatus = sessionFilter === 'all' || s.status === sessionFilter;
      const matchesAsset = historyAssetFilter === 'all' || s.assetId === historyAssetFilter;
      return matchesStatus && matchesAsset;
    }),
    [sessions, sessionFilter, historyAssetFilter],
  );

  const availableAssets = useMemo(
    () => assets.filter(a => a.status === 'operational' && !a.lentTo),
    [assets],
  );

  const stats = useMemo(() => ({
    total: assets.length,
    available: availableAssets.length,
    lent: assets.filter(a => Boolean(a.lentTo)).length,
    attention: assets.filter(a => a.status === 'needs_repair' || a.status === 'missing').length,
  }), [assets, availableAssets]);

  /** Active session for an asset, used to offer an inline return. */
  const activeSessionFor = (assetId: string) =>
    sessions.find(s => s.assetId === assetId && s.status === 'active') || null;

  // Assets referenced by the history dropdown, including ones since deleted.
  const historyAssetOptions = useMemo(() => {
    const byId = new Map<string, string>();
    // Several assets share a brand name, so disambiguate with the model.
    assets.forEach(a => byId.set(a.id, a.model ? `${a.name} — ${a.model}` : a.name));
    sessions.forEach(s => { if (!byId.has(s.assetId)) byId.set(s.assetId, `${s.assetName || s.assetId} (removed)`); });
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [assets, sessions]);

  // === Asset CRUD ===
  const openAddAsset = () => {
    setAssetForm(EMPTY_ASSET);
    setEditingAssetId(null);
    setShowAssetForm(true);
  };

  const openEditAsset = (asset: Asset) => {
    setAssetForm({
      name: asset.name,
      category: asset.category || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      location: asset.location || '',
      status: asset.status,
      remarks: asset.remarks || '',
    });
    setEditingAssetId(asset.id);
    setShowAssetForm(true);
  };

  const closeAssetForm = () => {
    setShowAssetForm(false);
    setEditingAssetId(null);
    setAssetForm(EMPTY_ASSET);
  };

  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!assetForm.name.trim() || !assetForm.category.trim()) return;

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

    setBusy(true);
    try {
      if (editingAssetId) {
        await updateDoc(doc(db, 'assets', editingAssetId), data);
        toast.success(`Updated “${data.name}”.`);
      } else {
        await addDoc(collection(db, 'assets'), { ...data, lentTo: '', lentAt: '' });
        toast.success(`Added “${data.name}” to the inventory.`);
      }
      closeAssetForm();
    } catch (err) {
      console.error('Error saving asset:', err);
      toast.error(firestoreErrorMessage(err, 'Could not save the asset. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!assetToDelete || busy) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'assets', assetToDelete.id));
      toast.success(`Removed “${assetToDelete.name}”. Its lending history is kept.`);
      setAssetToDelete(null);
    } catch (err) {
      console.error('Error deleting asset:', err);
      toast.error(firestoreErrorMessage(err, 'Could not delete the asset. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // === Checkout ===
  const openCheckout = (assetId = '') => {
    setCheckoutAssetId(assetId);
    setCheckoutName('');
    setCheckoutRoll('');
    setCheckoutPurpose('Composition');
    setShowCheckoutForm(true);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!checkoutAssetId || !checkoutName.trim() || !checkoutPurpose.trim()) return;

    const asset = assets.find(a => a.id === checkoutAssetId);
    if (!asset) {
      toast.error('That item is no longer in the inventory.');
      return;
    }
    // Guard against two people checking the same item out at once.
    if (asset.lentTo) {
      toast.error(`“${asset.name}” was just lent to ${asset.lentTo}.`);
      return;
    }

    const now = new Date().toISOString();
    const lender = currentUser.displayName || currentUser.email;

    setBusy(true);
    try {
      await updateDoc(doc(db, 'assets', checkoutAssetId), {
        lentTo: checkoutName.trim(),
        lentAt: now,
      });

      await addDoc(collection(db, 'instrument_logs'), {
        studentName: checkoutName.trim(),
        rollNumber: checkoutRoll.trim(),
        lentBy: lender,
        assetId: checkoutAssetId,
        assetName: asset.name,
        purpose: checkoutPurpose.trim(),
        checkInTime: now,
        status: 'active',
      });

      await notify({
        type: 'asset_checked_out',
        title: `${asset.name} checked out to ${checkoutName.trim()}`,
        body: checkoutPurpose.trim(),
        actorName: lender,
        actorEmail: currentUser.email,
        entityType: 'asset',
        entityId: checkoutAssetId,
      });

      toast.success(`“${asset.name}” checked out to ${checkoutName.trim()}.`);
      setShowCheckoutForm(false);
      setCheckoutAssetId('');
      setCheckoutRoll('');
      setCheckoutName('');
      setCheckoutPurpose('Composition');
    } catch (err) {
      console.error('Error during checkout:', err);
      toast.error(firestoreErrorMessage(err, 'Checkout failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // === Return ===
  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningSession || busy) return;

    const session = returningSession;
    const now = new Date().toISOString();

    setBusy(true);
    try {
      await updateDoc(doc(db, 'instrument_logs', session.id), {
        checkOutTime: now,
        status: 'completed',
        notes: returnNotes.trim() || 'Returned in good condition',
      });

      // The asset may have been deleted while it was out — only clear it if it still exists.
      if (assets.some(a => a.id === session.assetId)) {
        await updateDoc(doc(db, 'assets', session.assetId), { lentTo: '', lentAt: '' });
      }

      await notify({
        type: 'asset_returned',
        title: `${session.assetName} returned by ${session.studentName}`,
        body: returnNotes.trim(),
        actorName: currentUser.displayName || currentUser.email,
        actorEmail: currentUser.email,
        entityType: 'asset',
        entityId: session.assetId,
      });

      toast.success(`“${session.assetName}” marked as returned.`);
      setReturningSession(null);
      setReturnNotes('');
    } catch (err) {
      console.error('Error during return:', err);
      toast.error(firestoreErrorMessage(err, 'Could not record the return. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const openReturn = (session: SessionLog) => {
    setReturnNotes('');
    setReturningSession(session);
  };

  return (
    <div className="space-y-6 font-sans">

      <PageHeader
        title="Inventory"
        subtitle="Track studio equipment, availability, and lending"
        actions={
          <>
            <Button
              icon={ArrowRightLeft}
              onClick={() => openCheckout()}
              disabled={availableAssets.length === 0}
              title={availableAssets.length === 0 ? 'No items are currently available' : undefined}
            >
              Checkout
            </Button>
            {canManage && (
              <Button variant="secondary" icon={Plus} onClick={openAddAsset}>
                Add asset
              </Button>
            )}
          </>
        }
      />

      {/* Stats — one compact strip so the list starts higher up the page */}
      {assets.length > 0 && (
        <div className={`${cardClass} grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[#e8e8ed]`}>
          {[
            { label: 'Total items', value: stats.total, tone: 'text-[#1d1d1f]' },
            { label: 'Available', value: stats.available, tone: 'text-[#34c759]' },
            { label: 'Currently lent', value: stats.lent, tone: 'text-[#0071e3]' },
            { label: 'Needs attention', value: stats.attention, tone: 'text-[#ff9f0a]' },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 flex items-baseline gap-2">
              <span className={`text-[20px] font-bold tabular-nums ${s.tone}`}>{s.value}</span>
              <span className="text-[12px] text-[#86868b] leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search + category filters */}
      {assets.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b] pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, model, serial…"
              aria-label="Search assets"
              className={`${inputClass} pl-9`}
            />
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <FilterPill
                active={selectedCategory === 'all'}
                onClick={() => setSelectedCategory('all')}
                activeClass="bg-[#0071e3] text-white"
              >
                All
              </FilterPill>
              {categories.map(cat => (
                <FilterPill
                  key={cat}
                  active={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                  activeClass="bg-[#0071e3] text-white"
                >
                  <span className="capitalize">{cat}</span>
                </FilterPill>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Asset grid */}
      {loading ? (
        <LoadingState label="Loading inventory…" />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No assets yet"
          message={
            canManage
              ? 'Add your first instrument, microphone, or cable to start the register.'
              : 'An admin will add items here. Check back later.'
          }
          action={canManage ? <Button icon={Plus} onClick={openAddAsset}>Add asset</Button> : undefined}
        />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching assets"
          message="Try a different search term or clear the category filter."
          action={
            <Button
              variant="secondary"
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className={`${cardClass} overflow-hidden`}>

          {/* Column headers — desktop only */}
          <div
            className="hidden md:grid md:grid-cols-[minmax(0,2.2fr)_1fr_1.1fr_1fr_1.5fr_auto] gap-3 items-center
                       px-4 py-2.5 bg-[#f5f5f7] border-b border-[#e8e8ed]
                       text-[11px] font-semibold uppercase tracking-wide text-[#86868b]"
            aria-hidden="true"
          >
            <span>Item</span>
            <span>Category</span>
            <span>Status</span>
            <span>Location</span>
            <span>Availability</span>
            <span className="w-[92px]" />
          </div>

          <ul className="divide-y divide-[#e8e8ed]">
            {filteredAssets.map(asset => {
              const statusStyle = ASSET_STATUS[asset.status] || ASSET_STATUS.operational;
              const assetLogs = sessions.filter(s => s.assetId === asset.id);
              const isExpanded = expandedAssetHistoryId === asset.id;
              const activeSession = activeSessionFor(asset.id);
              const hasDetails = Boolean(asset.serialNumber || asset.remarks || assetLogs.length > 0);

              return (
                <li key={asset.id} className="group hover:bg-[#f5f5f7]/60 transition-colors">
                  <div
                    className="grid gap-x-3 gap-y-2 px-4 py-2
                               md:grid-cols-[minmax(0,2.2fr)_1fr_1.1fr_1fr_1.5fr_auto] md:items-center"
                  >
                    {/* Item */}
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#1d1d1f] leading-tight truncate" title={asset.name}>
                        {asset.name}
                      </p>
                      {asset.model && (
                        <p className="text-[12px] text-[#86868b] truncate" title={asset.model}>{asset.model}</p>
                      )}
                    </div>

                    {/* On mobile these three sit together as a wrapped badge row;
                        on desktop `contents` promotes them into their own columns. */}
                    <div className="flex flex-wrap items-center gap-2 md:contents">
                      <span className="text-[12px] text-[#6e6e73] capitalize truncate" title={asset.category}>
                        {asset.category || '—'}
                      </span>

                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit ${statusStyle.bg} ${statusStyle.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusStyle.dot}`} aria-hidden="true" />
                        {statusStyle.label}
                      </span>

                      <span className="text-[12px] text-[#86868b] truncate" title={asset.location}>
                        {asset.location || '—'}
                      </span>
                    </div>

                    {/* Availability */}
                    <div className="min-w-0 text-[12px]">
                      {asset.lentTo ? (
                        <>
                          <p className="text-[#a86500] font-medium truncate" title={`Lent to ${asset.lentTo}`}>
                            Lent to {asset.lentTo}
                          </p>
                          {asset.lentAt && (
                            <p className="text-[#86868b] truncate">since {formatDateTime(asset.lentAt)}</p>
                          )}
                        </>
                      ) : asset.status === 'operational' ? (
                        <p className="text-[#1a7f37] font-medium flex items-center gap-1">
                          <CheckCircle2 size={12} aria-hidden="true" /> Available
                        </p>
                      ) : (
                        <p className="text-[#86868b]">Not available</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-start md:justify-end">
                      {asset.lentTo && activeSession ? (
                        <Button
                          variant="secondary"
                          icon={RotateCcw}
                          onClick={() => openReturn(activeSession)}
                          className="!px-2.5 !py-1 !text-[12px]"
                        >
                          Return
                        </Button>
                      ) : !asset.lentTo && asset.status === 'operational' ? (
                        <Button
                          onClick={() => openCheckout(asset.id)}
                          className="!px-2.5 !py-1 !text-[12px]"
                        >
                          Check out
                        </Button>
                      ) : null}

                      {canManage && (
                        <>
                          <button
                            onClick={() => openEditAsset(asset)}
                            aria-label={`Edit ${asset.name}`}
                            className="p-1.5 rounded-lg text-[#6e6e73] hover:bg-[#e8e8ed] hover:text-[#1d1d1f] cursor-pointer transition-colors"
                          >
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => setAssetToDelete(asset)}
                            aria-label={`Delete ${asset.name}`}
                            className="p-1.5 rounded-lg text-[#ff3b30] hover:bg-[#ff3b30]/10 cursor-pointer transition-colors"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setExpandedAssetHistoryId(isExpanded ? null : asset.id)}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${asset.name}`}
                        disabled={!hasDetails}
                        className="p-1.5 rounded-lg text-[#86868b] hover:bg-[#e8e8ed] hover:text-[#1d1d1f]
                                   cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-default"
                      >
                        <ChevronDown
                          size={15}
                          aria-hidden="true"
                          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail: serial, remarks, full lending log */}
                  {isExpanded && hasDetails && (
                    <div className="px-4 pb-4 pt-1 bg-[#f5f5f7]/70 border-t border-[#e8e8ed] space-y-3">
                      {(asset.serialNumber || asset.remarks) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] pt-3">
                          {asset.serialNumber && (
                            <p className="text-[#86868b]">
                              <span className="font-medium text-[#6e6e73]">Serial:</span>{' '}
                              <span className="break-all">{asset.serialNumber}</span>
                            </p>
                          )}
                          {asset.remarks && (
                            <p className="text-[#86868b] sm:col-span-2">
                              <span className="font-medium text-[#6e6e73]">Remarks:</span>{' '}
                              <span className="italic break-words">{asset.remarks}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {assetLogs.length > 0 && (
                        <div className="space-y-2">
                          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1d1d1f]">
                            <Clock size={12} aria-hidden="true" /> Lending log ({assetLogs.length})
                          </p>
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {assetLogs.map(log => (
                              <div key={log.id} className="text-[11px] bg-white p-2.5 rounded-lg border border-[#e8e8ed] space-y-1">
                                <div className="flex justify-between items-start gap-2 font-medium text-[#1d1d1f]">
                                  <span className="break-words">
                                    {log.studentName}
                                    {log.rollNumber ? ` (${log.rollNumber})` : ''}
                                  </span>
                                  <span className={`shrink-0 ${log.status === 'active' ? 'text-[#a86500]' : 'text-[#1a7f37]'}`}>
                                    {log.status === 'active' ? 'Out' : 'Returned'}
                                  </span>
                                </div>
                                <dl className="text-[#86868b] space-y-0.5">
                                  <div><dt className="inline font-medium text-[#6e6e73]">Issued by:</dt>{' '}<dd className="inline text-[#0071e3] font-medium">{log.lentBy || '—'}</dd></div>
                                  <div><dt className="inline font-medium text-[#6e6e73]">Borrowed:</dt>{' '}<dd className="inline">{formatDateTime(log.checkInTime)}</dd></div>
                                  {log.checkOutTime && (
                                    <div><dt className="inline font-medium text-[#6e6e73]">Returned:</dt>{' '}<dd className="inline">{formatDateTime(log.checkOutTime)}</dd></div>
                                  )}
                                  {log.purpose && (
                                    <div><dt className="inline font-medium text-[#6e6e73]">Purpose:</dt>{' '}<dd className="inline">{log.purpose}</dd></div>
                                  )}
                                </dl>
                                {log.notes && <p className="italic text-[#86868b] break-words">“{log.notes}”</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="px-4 py-2.5 bg-[#f5f5f7] border-t border-[#e8e8ed] text-[12px] text-[#86868b]">
            Showing {filteredAssets.length} of {assets.length} item{assets.length === 1 ? '' : 's'}
          </div>
        </div>
      )}

      {/* Lending & return history */}
      {sessions.length > 0 && (
        <section className={`${cardClass} p-5 sm:p-6 space-y-5`} aria-labelledby="lending-history">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
            <div>
              <h3 id="lending-history" className="text-[17px] font-semibold text-[#1d1d1f]">Lending &amp; return history</h3>
              <p className="text-[12px] text-[#86868b] mt-0.5">Borrow dates, active checkouts, and return timestamps</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <label className="sr-only" htmlFor="history-asset-filter">Filter by instrument</label>
              <select
                id="history-asset-filter"
                value={historyAssetFilter}
                onChange={(e) => setHistoryAssetFilter(e.target.value)}
                className={`${selectClass} !py-1.5 !text-[13px] sm:max-w-[200px]`}
              >
                <option value="all">All instruments</option>
                {historyAssetOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                {(['active', 'completed', 'all'] as const).map(f => (
                  <FilterPill
                    key={f}
                    active={sessionFilter === f}
                    onClick={() => setSessionFilter(f)}
                    activeClass="bg-[#0071e3] text-white"
                  >
                    {f === 'active' ? 'Out' : f === 'completed' ? 'Returned' : 'All'}
                  </FilterPill>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            {filteredSessions.length === 0 ? (
              <p className="text-center py-10 text-[#86868b] text-[13px]">No lending records match these filters.</p>
            ) : (
              filteredSessions.map(session => (
                <article key={session.id} className="p-4 bg-[#f5f5f7] rounded-xl border border-[#e8e8ed] space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="font-semibold text-[#1d1d1f] text-[14px] break-words">
                      {session.assetName || session.assetId}
                    </h4>
                    <span className={`self-start px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 ${
                      session.status === 'active' ? 'bg-[#ff9f0a]/12 text-[#a86500]' : 'bg-[#34c759]/10 text-[#1a7f37]'
                    }`}>
                      {session.status === 'active' ? 'Currently out' : 'Returned'}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] bg-white/70 p-3 rounded-lg border border-[#e8e8ed]">
                    <div>
                      <dt className="text-[#86868b]">Issued by</dt>
                      <dd className="text-[#0071e3] font-medium break-words">{session.lentBy || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[#86868b]">Borrowed by</dt>
                      <dd className="text-[#1d1d1f] font-medium break-words">
                        {session.studentName}
                        {session.rollNumber && <span className="text-[#86868b] font-normal"> ({session.rollNumber})</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#86868b]">Borrowed on</dt>
                      <dd className="text-[#1d1d1f]">{formatDateTime(session.checkInTime)}</dd>
                    </div>
                    <div>
                      <dt className="text-[#86868b]">Returned on</dt>
                      <dd className={session.checkOutTime ? 'text-[#1d1d1f]' : 'text-[#a86500] font-medium'}>
                        {session.checkOutTime ? formatDateTime(session.checkOutTime) : 'Still out'}
                      </dd>
                    </div>
                    {session.purpose && (
                      <div className="sm:col-span-2">
                        <dt className="text-[#86868b]">Purpose</dt>
                        <dd className="text-[#1d1d1f] break-words">{session.purpose}</dd>
                      </div>
                    )}
                  </dl>

                  {session.notes && (
                    <p className="text-[12px] text-[#86868b] italic bg-white/70 p-2.5 rounded-lg border border-[#e8e8ed] break-words">
                      “{session.notes}”
                    </p>
                  )}

                  {session.status === 'active' && (
                    <Button variant="ghost" icon={RotateCcw} onClick={() => openReturn(session)} className="!px-2">
                      Return item
                    </Button>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {/* ── Add / edit asset ── */}
      <Modal
        open={showAssetForm}
        onClose={closeAssetForm}
        title={editingAssetId ? 'Edit asset' : 'Add new asset'}
        description={editingAssetId ? undefined : 'Register a new item in the studio inventory.'}
      >
        <form onSubmit={handleAssetSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className={labelClass} htmlFor="asset-name">Name <span className="text-[#ff3b30]">*</span></label>
            <input
              id="asset-name"
              type="text"
              value={assetForm.name}
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              placeholder="e.g. Yamaha Keyboard"
              required
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="asset-category">Category <span className="text-[#ff3b30]">*</span></label>
              <input
                id="asset-category"
                type="text"
                list="category-suggestions"
                value={assetForm.category}
                onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                placeholder="e.g. Instrument"
                required
                className={inputClass}
              />
              <datalist id="category-suggestions">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className={labelClass} htmlFor="asset-status">Status <span className="text-[#ff3b30]">*</span></label>
              <select
                id="asset-status"
                value={assetForm.status}
                onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value as AssetStatus })}
                className={selectClass}
              >
                <option value="operational">Operational</option>
                <option value="needs_repair">Needs repair</option>
                <option value="maintenance">Under maintenance</option>
                <option value="missing">Missing</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="asset-model">Model</label>
            <input
              id="asset-model"
              type="text"
              value={assetForm.model}
              onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
              placeholder="e.g. P-125"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="asset-serial">Serial number</label>
              <input
                id="asset-serial"
                type="text"
                value={assetForm.serialNumber}
                onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                placeholder="e.g. SN-12345"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="asset-location">Location</label>
              <input
                id="asset-location"
                type="text"
                value={assetForm.location}
                onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                placeholder="e.g. Main Studio"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="asset-remarks">Remarks</label>
            <textarea
              id="asset-remarks"
              value={assetForm.remarks}
              onChange={(e) => setAssetForm({ ...assetForm, remarks: e.target.value })}
              placeholder="Any notes about this item…"
              className={textareaClass}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={closeAssetForm}>Cancel</Button>
            <Button type="submit" loading={busy}>
              {editingAssetId ? 'Save changes' : 'Add asset'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Checkout ── */}
      <Modal
        open={showCheckoutForm}
        onClose={() => setShowCheckoutForm(false)}
        title="Check out an item"
        description="Record who is taking the item and why."
        size="sm"
      >
        <form onSubmit={handleCheckout} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className={labelClass} htmlFor="checkout-item">Item <span className="text-[#ff3b30]">*</span></label>
            <select
              id="checkout-item"
              value={checkoutAssetId}
              onChange={(e) => setCheckoutAssetId(e.target.value)}
              required
              className={selectClass}
            >
              <option value="">Choose an item…</option>
              {availableAssets.map(a => (
                <option key={a.id} value={a.id}>{a.name}{a.category ? ` — ${a.category}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="checkout-lender">Issued by</label>
            <input
              id="checkout-lender"
              type="text"
              value={currentUser.displayName || currentUser.email}
              disabled
              className={`${inputClass} font-medium`}
            />
            <p className="text-[12px] text-[#86868b] mt-1">Recorded automatically from your account.</p>
          </div>

          <div>
            <label className={labelClass} htmlFor="checkout-borrower">Borrower's name <span className="text-[#ff3b30]">*</span></label>
            <input
              id="checkout-borrower"
              type="text"
              value={checkoutName}
              onChange={(e) => setCheckoutName(e.target.value)}
              required
              placeholder="Who are you giving it to?"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="checkout-roll">Roll number <span className="text-[#86868b] font-normal">(optional)</span></label>
            <input
              id="checkout-roll"
              type="text"
              value={checkoutRoll}
              onChange={(e) => setCheckoutRoll(e.target.value)}
              placeholder="e.g. 20BCSE01"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="checkout-purpose">Purpose <span className="text-[#ff3b30]">*</span></label>
            <input
              id="checkout-purpose"
              type="text"
              list="purpose-options"
              value={checkoutPurpose}
              onChange={(e) => setCheckoutPurpose(e.target.value)}
              placeholder="e.g. Composition, Practice, Recording"
              required
              className={inputClass}
            />
            <datalist id="purpose-options">
              <option value="Composition" />
              <option value="Recording" />
              <option value="Mixing &amp; Mastering" />
              <option value="Practice" />
            </datalist>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={() => setShowCheckoutForm(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Check out</Button>
          </div>
        </form>
      </Modal>

      {/* ── Return ── */}
      <Modal
        open={Boolean(returningSession)}
        onClose={() => setReturningSession(null)}
        title="Confirm return"
        description={returningSession ? `${returningSession.assetName} from ${returningSession.studentName}` : undefined}
        size="sm"
      >
        <form onSubmit={handleReturn} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className={labelClass} htmlFor="return-notes">Condition notes <span className="text-[#86868b] font-normal">(optional)</span></label>
            <textarea
              id="return-notes"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="Any damage, missing cables, or observations…"
              className={textareaClass}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={() => setReturningSession(null)}>Cancel</Button>
            <Button type="submit" icon={RotateCcw} loading={busy}>Confirm return</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete asset ── */}
      <Modal
        open={Boolean(assetToDelete)}
        onClose={() => setAssetToDelete(null)}
        title="Delete asset"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <p className="text-[14px] text-[#1d1d1f] leading-relaxed">
            Permanently remove <span className="font-semibold">{assetToDelete?.name}</span> from the inventory?
            Its past lending records will be kept.
          </p>

          {assetToDelete?.lentTo && (
            <p className="text-[13px] text-[#a86500] bg-[#ff9f0a]/8 border border-[#ff9f0a]/20 rounded-xl p-3 leading-relaxed">
              This item is currently lent to <span className="font-semibold">{assetToDelete.lentTo}</span>.
              Mark it returned first so the log stays accurate.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-[#e8e8ed]">
            <Button type="button" variant="secondary" onClick={() => setAssetToDelete(null)}>Cancel</Button>
            <Button type="button" variant="danger" icon={Trash2} loading={busy} onClick={handleDeleteAsset}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
