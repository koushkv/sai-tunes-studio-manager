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
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-[#1d1d1f]">Releases</h2>
          <p className="text-[13px] text-[#86868b] mt-1">Our music across streaming platforms</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddForm}
            className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors"
          >
            <Plus size={14} />
            Add release
          </button>
        )}
      </div>

      {/* Streaming Platform Links — Coming Soon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold bg-[#1DB954]/10 text-[#1DB954]">♫</div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#1d1d1f]">Spotify</p>
            <p className="text-[12px] text-[#86868b]">Artist profile coming soon</p>
          </div>
          <span className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#ff9f0a]/10 text-[#ff9f0a] whitespace-nowrap">Coming soon</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold bg-[#FC3C44]/10 text-[#FC3C44]">♪</div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#1d1d1f]">Apple Music</p>
            <p className="text-[12px] text-[#86868b]">Artist profile coming soon</p>
          </div>
          <span className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#ff9f0a]/10 text-[#ff9f0a] whitespace-nowrap">Coming soon</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#e8e8ed] p-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold bg-[#FF0000]/10 text-[#FF0000]">▶</div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#1d1d1f]">YouTube Music</p>
            <p className="text-[12px] text-[#86868b]">Channel coming soon</p>
          </div>
          <span className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#ff9f0a]/10 text-[#ff9f0a] whitespace-nowrap">Coming soon</span>
        </div>
      </div>

      {/* Year Filter */}
      {years.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedYear('all')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
              selectedYear === 'all' ? 'bg-[#1d1d1f] text-white' : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
            }`}
          >
            All years
          </button>
          {years.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                selectedYear === year ? 'bg-[#1d1d1f] text-white' : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-20 text-[#86868b] text-[14px] animate-pulse">Loading releases…</div>
      ) : releases.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20">
          <p className="text-[17px] font-semibold text-[#1d1d1f]">No releases yet</p>
          <p className="text-[13px] text-[#86868b] mt-1 max-w-sm mx-auto">
            {isAdmin ? 'Click "Add release" above to add your first music release.' : 'Music releases will appear here once the admin adds them.'}
          </p>
        </div>
      ) : (
        /* Release Cards Grouped by Year */
        <div className="space-y-8">
          {sortedYears.map(year => (
            <div key={year}>
              {/* Year Header */}
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-[17px] font-semibold text-[#1d1d1f]">{year}</h3>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0071e3]/10 text-[#0071e3]">
                  {groupedByYear[year].length} {groupedByYear[year].length === 1 ? 'release' : 'releases'}
                </span>
                <div className="flex-1 h-px bg-[#e8e8ed]"></div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {groupedByYear[year].map(release => (
                  <div
                    key={release.id}
                    className="bg-white rounded-2xl border border-[#e8e8ed] overflow-hidden group"
                  >
                    {/* Cover Art */}
                    <div className="relative h-44 bg-[#f5f5f7] flex items-center justify-center overflow-hidden">
                      {release.coverUrl ? (
                        <img
                          src={release.coverUrl}
                          alt={release.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Disc3 size={48} className="text-[#d2d2d7]" />
                      )}
                      {/* Admin overlay */}
                      {isAdmin && (
                        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-colors">
                          <button
                            onClick={() => openEditForm(release)}
                            className="p-1.5 bg-white/90 border border-[#d2d2d7] rounded-lg text-[#6e6e73] hover:text-[#1d1d1f] cursor-pointer transition-colors"
                            title="Edit"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => setDeletingId(release.id)}
                            className="p-1.5 bg-white/90 border border-[#d2d2d7] rounded-lg text-[#ff3b30] hover:text-[#ff453a] cursor-pointer transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h4 className="text-[14px] font-semibold text-[#1d1d1f] leading-tight">{release.title}</h4>
                        <p className="text-[12px] text-[#86868b] mt-1 flex items-center gap-1">
                          <Calendar size={11} /> {formatDate(release.releaseDate)}
                        </p>
                      </div>

                      {release.description && (
                        <p className="text-[13px] text-[#6e6e73] leading-relaxed line-clamp-2">{release.description}</p>
                      )}

                      {release.credits && (
                        <p className="text-[12px] text-[#86868b] flex items-center gap-1">
                          <Users size={11} /> {release.credits}
                        </p>
                      )}

                      {/* Streaming Links */}
                      <div className="flex gap-2 pt-3 border-t border-[#e8e8ed] flex-wrap">
                        {release.spotifyUrl && (
                          <a
                            href={release.spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#1DB954]/10 text-[#1DB954] cursor-pointer transition-colors hover:bg-[#1DB954]/20"
                          >
                            Spotify <ExternalLink size={10} />
                          </a>
                        )}
                        {release.appleMusicUrl && (
                          <a
                            href={release.appleMusicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#FC3C44]/10 text-[#FC3C44] cursor-pointer transition-colors hover:bg-[#FC3C44]/20"
                          >
                            Apple <ExternalLink size={10} />
                          </a>
                        )}
                        {release.youtubeMusicUrl && (
                          <a
                            href={release.youtubeMusicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#FF0000]/10 text-[#FF0000] cursor-pointer transition-colors hover:bg-[#FF0000]/20"
                          >
                            YouTube <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Delete confirmation */}
                    {deletingId === release.id && (
                      <div className="p-3 bg-[#ff3b30]/5 border-t border-[#ff3b30]/20 flex items-center justify-between">
                        <span className="text-[12px] text-[#ff3b30] font-medium">Delete this release?</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleDelete(release.id)} className="bg-[#ff3b30] hover:bg-[#ff453a] text-white rounded-full px-3 py-1 text-[12px] font-medium cursor-pointer transition-colors">Yes</button>
                          <button onClick={() => setDeletingId(null)} className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-3 py-1 text-[12px] font-medium cursor-pointer transition-colors">No</button>
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden font-sans">
            <div className="px-6 py-4 border-b border-[#e8e8ed] flex justify-between items-center">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
                {editingId ? 'Edit release' : 'Add new release'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Sai Tunes Vol. 1"
                  required
                  className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Year *</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    min="2000"
                    max="2100"
                    required
                    className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Release date *</label>
                  <input
                    type="date"
                    value={form.releaseDate}
                    onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
                    required
                    className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Cover image URL</label>
                <input
                  type="url"
                  value={form.coverUrl}
                  onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
                  placeholder="https://example.com/album-art.jpg"
                  className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Spotify URL</label>
                  <input
                    type="url"
                    value={form.spotifyUrl}
                    onChange={(e) => setForm({ ...form, spotifyUrl: e.target.value })}
                    placeholder="https://open.spotify.com/album/..."
                    className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Apple Music URL</label>
                  <input
                    type="url"
                    value={form.appleMusicUrl}
                    onChange={(e) => setForm({ ...form, appleMusicUrl: e.target.value })}
                    placeholder="https://music.apple.com/album/..."
                    className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">YouTube Music URL</label>
                  <input
                    type="url"
                    value={form.youtubeMusicUrl}
                    onChange={(e) => setForm({ ...form, youtubeMusicUrl: e.target.value })}
                    placeholder="https://music.youtube.com/..."
                    className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of the release..."
                  className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">Credits</label>
                <input
                  type="text"
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: e.target.value })}
                  placeholder="e.g. Composed by Koushik, Mixed by Arjun"
                  className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#e8e8ed]">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full px-5 py-2 text-[14px] font-medium cursor-pointer transition-colors"
                >
                  {editingId ? 'Save changes' : 'Add release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
