import React, { useState, useEffect } from 'react';
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
  Music,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Disc3,
  Calendar,
  X,
  Link,
  Users,
} from 'lucide-react';

interface MusicReleasesProps {
  currentUser: { email: string; displayName: string; photoURL: string | null };
  isAdmin: boolean;
}

interface MusicRelease {
  id: string;
  title: string;
  year: number;
  releaseDate: string;
  coverUrl?: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
  youtubeMusicUrl?: string;
  description?: string;
  credits?: string;
  addedBy: string;
  addedAt: string;
}

const EMPTY_FORM: Omit<MusicRelease, 'id' | 'addedBy' | 'addedAt'> = {
  title: '',
  year: new Date().getFullYear(),
  releaseDate: '',
  coverUrl: '',
  spotifyUrl: '',
  appleMusicUrl: '',
  youtubeMusicUrl: '',
  description: '',
  credits: '',
};

export default function MusicReleases({ currentUser, isAdmin }: MusicReleasesProps) {
  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync releases from Firestore
  useEffect(() => {
    const releasesRef = collection(db, 'music_releases');
    const unsubscribe = onSnapshot(releasesRef, (snapshot) => {
      const items: MusicRelease[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as MusicRelease);
      });
      items.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return (b.releaseDate || '').localeCompare(a.releaseDate || '');
      });
      setReleases(items);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching releases:', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Get unique years
  const years = [...new Set(releases.map(r => r.year))].sort((a, b) => b - a);
  const filteredReleases = selectedYear === 'all' ? releases : releases.filter(r => r.year === selectedYear);

  // Group by year
  const groupedByYear: Record<number, MusicRelease[]> = {};
  filteredReleases.forEach(r => {
    if (!groupedByYear[r.year]) groupedByYear[r.year] = [];
    groupedByYear[r.year].push(r);
  });
  const sortedYears = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);

  // Form handlers
  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (release: MusicRelease) => {
    setForm({
      title: release.title,
      year: release.year,
      releaseDate: release.releaseDate,
      coverUrl: release.coverUrl || '',
      spotifyUrl: release.spotifyUrl || '',
      appleMusicUrl: release.appleMusicUrl || '',
      youtubeMusicUrl: release.youtubeMusicUrl || '',
      description: release.description || '',
      credits: release.credits || '',
    });
    setEditingId(release.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.releaseDate) return;

    const data = {
      title: form.title.trim(),
      year: form.year,
      releaseDate: form.releaseDate,
      coverUrl: form.coverUrl?.trim() || '',
      spotifyUrl: form.spotifyUrl?.trim() || '',
      appleMusicUrl: form.appleMusicUrl?.trim() || '',
      youtubeMusicUrl: form.youtubeMusicUrl?.trim() || '',
      description: form.description?.trim() || '',
      credits: form.credits?.trim() || '',
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'music_releases', editingId), data);
      } else {
        await addDoc(collection(db, 'music_releases'), {
          ...data,
          addedBy: currentUser.email,
          addedAt: new Date().toISOString(),
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      console.error('Error saving release:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'music_releases', id));
      setDeletingId(null);
    } catch (err) {
      console.error('Error deleting release:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-6 font-sans text-sm text-zinc-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-850 pb-3">
        <div>
          <h2 className="text-base font-semibold font-display text-zinc-100 flex items-center gap-2">
            <Music size={18} className="text-emerald-400" />
            Music Releases
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Our music across streaming platforms</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddForm}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-100 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-sm uppercase tracking-wide select-none h-9"
          >
            <Plus size={13} />
            Add Release
          </button>
        )}
      </div>

      {/* Streaming Platform Links — Coming Soon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl flex items-center gap-3 select-none opacity-75">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold" style={{ background: '#1DB95420', color: '#1DB954' }}>♫</div>
          <div>
            <p className="text-xs font-semibold text-zinc-100 uppercase tracking-wide">Spotify</p>
            <p className="text-[10px] text-zinc-500">Artist profile coming soon</p>
          </div>
          <span className="ml-auto text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Coming Soon</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl flex items-center gap-3 select-none opacity-75">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold" style={{ background: '#FC3C4420', color: '#FC3C44' }}>♪</div>
          <div>
            <p className="text-xs font-semibold text-zinc-100 uppercase tracking-wide">Apple Music</p>
            <p className="text-[10px] text-zinc-500">Artist profile coming soon</p>
          </div>
          <span className="ml-auto text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Coming Soon</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl flex items-center gap-3 select-none opacity-75">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold" style={{ background: '#FF000020', color: '#FF0000' }}>▶</div>
          <div>
            <p className="text-xs font-semibold text-zinc-100 uppercase tracking-wide">YouTube Music</p>
            <p className="text-[10px] text-zinc-500">Channel coming soon</p>
          </div>
          <span className="ml-auto text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Coming Soon</span>
        </div>
      </div>

      {/* Year Filter */}
      {years.length > 0 && (
        <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 w-fit select-none">
          <button
            onClick={() => setSelectedYear('all')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              selectedYear === 'all' ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All Years
          </button>
          {years.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                selectedYear === year ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-20 text-zinc-500 animate-pulse uppercase text-xs">Loading releases...</div>
      ) : releases.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 bg-zinc-950/20 border border-dashed border-zinc-800 rounded-xl space-y-3">
          <Disc3 size={40} className="text-zinc-700 mx-auto" />
          <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">No Releases Yet</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
            {isAdmin ? 'Click "Add Release" above to add your first music release.' : 'Music releases will appear here once the admin adds them.'}
          </p>
        </div>
      ) : (
        /* Release Cards Grouped by Year */
        <div className="space-y-8">
          {sortedYears.map(year => (
            <div key={year}>
              {/* Year Header */}
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-display font-bold text-zinc-100">{year}</h3>
                <span className="text-[9px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-semibold uppercase">
                  {groupedByYear[year].length} {groupedByYear[year].length === 1 ? 'release' : 'releases'}
                </span>
                <div className="flex-1 h-px bg-zinc-800/60"></div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedByYear[year].map(release => (
                  <div
                    key={release.id}
                    className="bg-zinc-900 border border-zinc-800/80 rounded-xl overflow-hidden hover:border-zinc-700 transition-all shadow-sm group"
                  >
                    {/* Cover Art */}
                    <div className="relative h-44 bg-zinc-950 flex items-center justify-center overflow-hidden">
                      {release.coverUrl ? (
                        <img
                          src={release.coverUrl}
                          alt={release.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Disc3 size={48} className="text-zinc-800 animate-spin-slow" />
                      )}
                      {/* Admin overlay */}
                      {isAdmin && (
                        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditForm(release)}
                            className="p-1.5 bg-zinc-900/90 border border-zinc-700 rounded-md text-zinc-300 hover:text-white cursor-pointer transition-colors"
                            title="Edit"
                          >
                            <Edit size={11} />
                          </button>
                          <button
                            onClick={() => setDeletingId(release.id)}
                            className="p-1.5 bg-zinc-900/90 border border-red-900/50 rounded-md text-red-400 hover:text-red-300 cursor-pointer transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-100 leading-tight">{release.title}</h4>
                        <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                          <Calendar size={10} /> {formatDate(release.releaseDate)}
                        </p>
                      </div>

                      {release.description && (
                        <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">{release.description}</p>
                      )}

                      {release.credits && (
                        <p className="text-[10px] text-zinc-500 italic flex items-center gap-1">
                          <Users size={10} /> {release.credits}
                        </p>
                      )}

                      {/* Streaming Links */}
                      <div className="flex gap-2 pt-2 border-t border-zinc-850">
                        {release.spotifyUrl && (
                          <a
                            href={release.spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer"
                            style={{ background: '#1DB95415', color: '#1DB954', border: '1px solid #1DB95430' }}
                          >
                            Spotify <ExternalLink size={9} />
                          </a>
                        )}
                        {release.appleMusicUrl && (
                          <a
                            href={release.appleMusicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer"
                            style={{ background: '#FC3C4415', color: '#FC3C44', border: '1px solid #FC3C4430' }}
                          >
                            Apple <ExternalLink size={9} />
                          </a>
                        )}
                        {release.youtubeMusicUrl && (
                          <a
                            href={release.youtubeMusicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer"
                            style={{ background: '#FF000015', color: '#FF0000', border: '1px solid #FF000030' }}
                          >
                            YouTube <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Delete confirmation */}
                    {deletingId === release.id && (
                      <div className="p-3 bg-red-500/5 border-t border-red-500/20 flex items-center justify-between">
                        <span className="text-[10px] text-red-400 font-medium uppercase">Delete this release?</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleDelete(release.id)} className="px-3 py-1 text-[10px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded cursor-pointer">Yes</button>
                          <button onClick={() => setDeletingId(null)} className="px-3 py-1 text-[10px] font-semibold bg-zinc-800 text-zinc-300 rounded cursor-pointer">No</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800/80 w-full max-w-lg overflow-hidden font-sans shadow-2xl">
            <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800/60 flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider font-display text-zinc-200">
                {editingId ? 'Edit Release' : 'Add New Release'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-zinc-400 hover:text-zinc-200 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-zinc-300 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Sai Tunes Vol. 1"
                  required
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Year *</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    min="2000"
                    max="2100"
                    required
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Release Date *</label>
                  <input
                    type="date"
                    value={form.releaseDate}
                    onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
                    required
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Cover Image URL</label>
                <input
                  type="url"
                  value={form.coverUrl}
                  onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
                  placeholder="https://example.com/album-art.jpg"
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Spotify URL</label>
                  <input
                    type="url"
                    value={form.spotifyUrl}
                    onChange={(e) => setForm({ ...form, spotifyUrl: e.target.value })}
                    placeholder="https://open.spotify.com/album/..."
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Apple Music URL</label>
                  <input
                    type="url"
                    value={form.appleMusicUrl}
                    onChange={(e) => setForm({ ...form, appleMusicUrl: e.target.value })}
                    placeholder="https://music.apple.com/album/..."
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">YouTube Music URL</label>
                  <input
                    type="url"
                    value={form.youtubeMusicUrl}
                    onChange={(e) => setForm({ ...form, youtubeMusicUrl: e.target.value })}
                    placeholder="https://music.youtube.com/..."
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of the release..."
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 h-16 text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">Credits</label>
                <input
                  type="text"
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: e.target.value })}
                  placeholder="e.g. Composed by Koushik, Mixed by Arjun"
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg focus:outline-none text-zinc-200 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="px-4 py-2 text-zinc-400 bg-zinc-950 hover:bg-zinc-850 rounded-lg font-medium uppercase text-[10px] border border-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-zinc-100 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold uppercase text-[10px] cursor-pointer"
                >
                  {editingId ? 'Save Changes' : 'Add Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
