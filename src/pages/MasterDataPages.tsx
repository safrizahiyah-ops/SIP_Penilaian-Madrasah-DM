import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Download,
  Edit3,
  FileUp,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { INDONESIAN_MONTHS } from '../constants/rubric';
import { useApp } from '../context/AppContext';
import { ClassGrade, JudgeNumber, PeriodStatus, SchoolClass, Teacher, Judge, JudgingPeriod } from '../types';
import { formatIndonesianDate } from '../utils/calculations';
import {
  downloadClassImportTemplate,
  ImportedClassCandidate,
  parseClassImportFile,
} from '../utils/excelHelper';

// ============================================================================
// 1. DATA KELAS PAGE
// ============================================================================
export const ClassesPage: React.FC = () => {
  const { classes, teachers, currentUser, saveClass, importClassesBulk, deleteClass, addToast } = useApp();
  const isAdmin = currentUser?.role === 'administrator';

  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'ALL' | ClassGrade>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<ClassGrade>('X');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [homeroomTeacherName, setHomeroomTeacherName] = useState('');
  const [active, setActive] = useState(true);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportedClassCandidate[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = classes.filter((c) => {
      if (gradeFilter !== 'ALL' && c.grade !== gradeFilter) return false;
      if (statusFilter === 'ACTIVE' && !c.active) return false;
      if (statusFilter === 'INACTIVE' && c.active) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.homeroomTeacherName.toLowerCase().includes(q)
      );
    });
    list.sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name, 'id') : b.name.localeCompare(a.name, 'id')
    );
    return list;
  }, [classes, search, gradeFilter, statusFilter, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openAdd = () => {
    setEditing(null);
    setCode(`KLS-${String(classes.length + 1).padStart(2, '0')}`);
    setName('');
    setGrade('X');
    setHomeroomTeacherId('');
    setHomeroomTeacherName('');
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (cls: SchoolClass) => {
    setEditing(cls);
    setCode(cls.code);
    setName(cls.name);
    setGrade(cls.grade);
    setHomeroomTeacherId(cls.homeroomTeacherId);
    setHomeroomTeacherName(cls.homeroomTeacherName);
    setActive(cls.active);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !homeroomTeacherName.trim()) {
      addToast('error', 'Validasi Gagal', 'ID Kelas, Nama Kelas, dan Wali Kelas wajib diisi.');
      return;
    }
    try {
      await saveClass(
        {
          id: editing ? editing.id : name.replace(/\s+/g, '_').toUpperCase(),
          code,
          name,
          grade,
          homeroomTeacherId,
          homeroomTeacherName,
          active,
        },
        Boolean(editing)
      );
      setModalOpen(false);
    } catch (err) {
      addToast('error', 'Gagal Menyimpan Kelas', err instanceof Error ? err.message : String(err));
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await parseClassImportFile(file);
      setImportPreview(res.items);
      setImportWarnings(res.warnings);
    } catch (err) {
      addToast('error', 'Berkas Tidak Valid', err instanceof Error ? err.message : 'Gagal membaca Excel/CSV.');
    }
  };

  const confirmImport = async () => {
    try {
      await importClassesBulk(importPreview);
      setImportModalOpen(false);
      setImportPreview([]);
      setImportWarnings([]);
    } catch (err) {
      addToast('error', 'Gagal Impor', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Data Master Kelas</h2>
          <p className="text-xs text-slate-500">
            Mendukung kapasitas awal 12 kelas maupun penambahan rombongan belajar secara fleksibel.
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <FileUp className="w-4 h-4 text-emerald-700" />
              Impor Excel / CSV
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Tambah Kelas
            </button>
          </div>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari ID kelas, nama kelas, atau wali kelas..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'X', 'XI', 'XII'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGradeFilter(g);
                  setPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  gradeFilter === g ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {g === 'ALL' ? 'Semua Tingkat' : `Kelas ${g}`}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE');
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Status Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold w-12">No.</th>
                <th className="py-3 px-4 font-semibold">ID Kelas</th>
                <th className="py-3 px-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => setSortAsc((s) => !s)}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    Nama Kelas
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold">Tingkat</th>
                <th className="py-3 px-4 font-semibold">Nama Wali Kelas</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                {isAdmin && <th className="py-3 px-4 font-semibold text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length > 0 ? (
                paginated.map((cls, idx) => (
                  <tr key={cls.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono-num text-slate-500">
                      {(page - 1) * pageSize + idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono-num font-medium text-slate-800">{cls.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{cls.name}</td>
                    <td className="py-3 px-4 font-mono-num text-slate-700">Tingkat {cls.grade}</td>
                    <td className="py-3 px-4 text-slate-700">{cls.homeroomTeacherName}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {cls.active ? 'Aktif' : 'Nonaktif'}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(cls)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(cls.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-slate-400">
                    Tidak ada data kelas yang sesuai filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Menampilkan <strong className="font-mono-num">{paginated.length}</strong> dari{' '}
            <strong className="font-mono-num">{filtered.length}</strong> kelas
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border border-slate-200 rounded-md disabled:opacity-40 cursor-pointer"
            >
              Sebelumnya
            </button>
            <span className="font-mono-num">
              Hal {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border border-slate-200 rounded-md disabled:opacity-40 cursor-pointer"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Class Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editing ? 'Edit Data Kelas' : 'Tambah Data Kelas Baru'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">ID Kelas</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Contoh: KLS-X01"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nama Kelas</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: X IPA 1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tingkat Kelas</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value as ClassGrade)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="X">Kelas X</option>
                    <option value="XI">Kelas XI</option>
                    <option value="XII">Kelas XII</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Pilih dari Daftar Wali Kelas (Opsional)</label>
                <select
                  value={homeroomTeacherId}
                  onChange={(e) => {
                    const tid = e.target.value;
                    setHomeroomTeacherId(tid);
                    const found = teachers.find((t) => t.id === tid);
                    if (found) setHomeroomTeacherName(found.fullName);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">-- Ketik Manual di Bawah --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Wali Kelas</label>
                <input
                  type="text"
                  required
                  value={homeroomTeacherName}
                  onChange={(e) => setHomeroomTeacherName(e.target.value)}
                  placeholder="Nama lengkap beserta gelar"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700"
                />
                <span className="text-slate-700 font-medium">Kelas berstatus Aktif dalam perlombaan</span>
              </label>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
                >
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel / CSV Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Impor Data Kelas (Excel / CSV)</h3>
              <button type="button" onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Unggah berkas <code>.xlsx</code> atau <code>.csv</code> dengan kolom:{' '}
              <strong>ID Kelas, Nama Kelas, Tingkat Kelas, Nama Wali Kelas, Status Aktif</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={downloadClassImportTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Template Excel
              </button>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileImport}
                className="text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-slate-200 file:bg-white file:text-xs file:font-medium"
              />
            </div>

            {importWarnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                {importWarnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-2">ID</th>
                      <th className="p-2">Kelas</th>
                      <th className="p-2">Tingkat</th>
                      <th className="p-2">Wali Kelas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importPreview.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-mono-num">{item.code}</td>
                        <td className="p-2 font-semibold">{item.name}</td>
                        <td className="p-2">{item.grade}</td>
                        <td className="p-2">{item.homeroomTeacherName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={importPreview.length === 0}
                onClick={confirmImport}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg disabled:opacity-40 cursor-pointer"
              >
                Impor {importPreview.length} Kelas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Kelas</h3>
            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus kelas ini dari daftar master?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteClass(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. DATA WALI KELAS PAGE
// ============================================================================
export const TeachersPage: React.FC = () => {
  const { teachers, teacherContacts, classes, currentUser, saveTeacher, deleteTeacher, addToast } = useApp();
  const isAdmin = currentUser?.role === 'administrator';

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [fullName, setFullName] = useState('');
  const [nip, setNip] = useState('');
  const [assignedClassId, setAssignedClassId] = useState('');
  const [phone, setPhone] = useState('');
  const [active, setActive] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter(
      (t) =>
        !q ||
        t.fullName.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        t.assignedClassName.toLowerCase().includes(q)
    );
  }, [teachers, search]);

  const openAdd = () => {
    setEditing(null);
    setFullName('');
    setNip('');
    setAssignedClassId('');
    setPhone('');
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setEditing(t);
    setFullName(t.fullName);
    setNip(t.nip);
    setAssignedClassId(t.assignedClassId);
    setPhone(teacherContacts[t.id] || '');
    setActive(t.active);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      addToast('error', 'Validasi Gagal', 'Nama lengkap wali kelas wajib diisi.');
      return;
    }
    const cls = classes.find((c) => c.id === assignedClassId);
    try {
      await saveTeacher(
        {
          id: editing ? editing.id : `TCH_${Date.now()}`,
          fullName,
          nip,
          assignedClassId,
          assignedClassName: cls ? cls.name : '',
          active,
        },
        phone,
        Boolean(editing)
      );
      setModalOpen(false);
    } catch (err) {
      addToast('error', 'Gagal Menyimpan', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Data Wali Kelas</h2>
          <p className="text-xs text-slate-500">
            Daftar guru wali kelas pendamping kebersihan dan penataan kelas bertema.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Wali Kelas
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama wali kelas, NIP/NUPTK, atau kelas..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold w-12">No.</th>
                <th className="py-3 px-4 font-semibold">Nama Lengkap</th>
                <th className="py-3 px-4 font-semibold">NIP / NUPTK</th>
                <th className="py-3 px-4 font-semibold">Kelas Diampu</th>
                {isAdmin && <th className="py-3 px-4 font-semibold">Nomor Kontak</th>}
                <th className="py-3 px-4 font-semibold">Status</th>
                {isAdmin && <th className="py-3 px-4 font-semibold text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? (
                filtered.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono-num text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{t.fullName}</td>
                    <td className="py-3 px-4 font-mono-num text-slate-600">{t.nip || '—'}</td>
                    <td className="py-3 px-4 font-medium text-emerald-900">{t.assignedClassName || '—'}</td>
                    {isAdmin && (
                      <td className="py-3 px-4 font-mono-num text-slate-600">
                        {teacherContacts[t.id] || '—'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-slate-600">{t.active ? 'Aktif' : 'Nonaktif'}</td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTeacher(t.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Belum ada data wali kelas yang sesuai pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editing ? 'Edit Wali Kelas' : 'Tambah Wali Kelas'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Lengkap &amp; Gelar</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">NIP / NUPTK (Opsional)</label>
                <input
                  type="text"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Kelas yang Diampu</label>
                <select
                  value={assignedClassId}
                  onChange={(e) => setAssignedClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">-- Belum Ditentukan --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nomor Kontak / WhatsApp (Opsional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span className="font-medium text-slate-700">Status Aktif</span>
              </label>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
                >
                  Simpan Wali Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. DATA PENILAI PAGE
// ============================================================================
export const JudgesPage: React.FC = () => {
  const { judges, currentUser, saveJudge, deleteJudge, addToast } = useApp();
  const isAdmin = currentUser?.role === 'administrator';

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Judge | null>(null);
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [identityNumber, setIdentityNumber] = useState('');
  const [judgeRole, setJudgeRole] = useState<JudgeNumber>('I');
  const [active, setActive] = useState(true);

  const openAdd = () => {
    setEditing(null);
    setFullName('');
    setPosition('');
    setIdentityNumber('');
    setJudgeRole('I');
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (j: Judge) => {
    setEditing(j);
    setFullName(j.fullName);
    setPosition(j.position);
    setIdentityNumber(j.identityNumber);
    setJudgeRole(j.judgeRole);
    setActive(j.active);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !position.trim()) {
      addToast('error', 'Validasi Gagal', 'Nama penilai dan jabatan wajib diisi.');
      return;
    }
    try {
      await saveJudge(
        {
          id: editing ? editing.id : `JDG_${judgeRole}_${Date.now()}`,
          fullName,
          position,
          identityNumber,
          judgeRole,
          linkedUserUid: editing?.linkedUserUid || '',
          active,
        },
        Boolean(editing)
      );
      setModalOpen(false);
    } catch (err) {
      addToast('error', 'Gagal Menyimpan', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Data Penilai Independen</h2>
          <p className="text-xs text-slate-500">
            Sistem memisahkan nilai Penilai I dan Penilai II untuk menjaga objektivitas penilaian kelas.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Penilai
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold w-12">No.</th>
                <th className="py-3 px-4 font-semibold">Jenis Penilai</th>
                <th className="py-3 px-4 font-semibold">Nama Penilai</th>
                <th className="py-3 px-4 font-semibold">Jabatan</th>
                <th className="py-3 px-4 font-semibold">Nomor Identitas</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                {isAdmin && <th className="py-3 px-4 font-semibold text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {judges.length > 0 ? (
                judges.map((j, idx) => (
                  <tr key={j.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono-num text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-900">Penilai {j.judgeRole}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{j.fullName}</td>
                    <td className="py-3 px-4 text-slate-700">{j.position}</td>
                    <td className="py-3 px-4 font-mono-num text-slate-600">
                      {j.identityNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{j.active ? 'Aktif' : 'Nonaktif'}</td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(j)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteJudge(j.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Belum ada data penilai terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editing ? 'Edit Data Penilai' : 'Tambah Data Penilai'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Jenis Kewenangan Penilai</label>
                <select
                  value={judgeRole}
                  onChange={(e) => setJudgeRole(e.target.value as JudgeNumber)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="I">Penilai I</option>
                  <option value="II">Penilai II</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Lengkap Penilai</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Jabatan / Unsur</label>
                <input
                  type="text"
                  required
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Contoh: Pembina UKS / Tim Ketertiban"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nomor Identitas / NIP (Opsional)</label>
                <input
                  type="text"
                  value={identityNumber}
                  onChange={(e) => setIdentityNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span className="font-medium text-slate-700">Status Aktif</span>
              </label>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
                >
                  Simpan Penilai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. JADWAL PENILAIAN PAGE
// ============================================================================
export const SchedulePage: React.FC = () => {
  const {
    judgingPeriods,
    settings,
    currentUser,
    saveJudgingPeriod,
    deleteJudgingPeriod,
    addToast,
  } = useApp();

  const canManage =
    currentUser?.role === 'administrator' || currentUser?.role === 'koordinator';
  const isAdmin = currentUser?.role === 'administrator';

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JudgingPeriod | null>(null);
  const [weekNumber, setWeekNumber] = useState(1);
  const [globalWeekNumber, setGlobalWeekNumber] = useState(1);
  const [month, setMonth] = useState(10);
  const [year, setYear] = useState(2026);
  const [scheduledDate, setScheduledDate] = useState('2026-10-31');
  const [ceremonyDate, setCeremonyDate] = useState('2026-11-02');
  const [theme, setTheme] = useState('');
  const [status, setStatus] = useState<PeriodStatus>('OPEN');

  const sorted = useMemo(
    () =>
      [...judgingPeriods].sort((a, b) =>
        a.year !== b.year
          ? b.year - a.year
          : a.month !== b.month
            ? b.month - a.month
            : b.weekNumber - a.weekNumber
      ),
    [judgingPeriods]
  );

  const openAdd = () => {
    setEditing(null);
    setWeekNumber(1);
    setGlobalWeekNumber(judgingPeriods.length + 12);
    setMonth(11);
    setYear(2026);
    setScheduledDate(new Date().toISOString().slice(0, 10));
    setCeremonyDate('');
    setTheme('');
    setStatus('OPEN');
    setModalOpen(true);
  };

  const openEdit = (p: JudgingPeriod) => {
    setEditing(p);
    setWeekNumber(p.weekNumber);
    setGlobalWeekNumber(p.globalWeekNumber);
    setMonth(p.month);
    setYear(p.year);
    setScheduledDate(p.scheduledDate);
    setCeremonyDate(p.ceremonyDate);
    setTheme(p.theme);
    setStatus(p.status);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme.trim() || !scheduledDate) {
      addToast('error', 'Validasi Gagal', 'Tanggal penilaian dan tema kelas wajib diisi.');
      return;
    }
    try {
      await saveJudgingPeriod(
        {
          id: editing
            ? editing.id
            : `PRD_${year}_${String(month).padStart(2, '0')}_P${weekNumber}`,
          weekNumber,
          globalWeekNumber,
          month,
          year,
          academicYear: settings.academicYear,
          scheduledDate,
          ceremonyDate,
          theme,
          status,
        },
        Boolean(editing)
      );
      setModalOpen(false);
    } catch (err) {
      addToast('error', 'Gagal Menyimpan Jadwal', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Jadwal &amp; Tema Penilaian Mingguan</h2>
          <p className="text-xs text-slate-500">
            Atur periode pekan (P1–P5), tema dekorasi kelas, tanggal penilaian, serta jadwal pengumuman usai upacara bendera.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Periode Pekan
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold">Periode Pekan</th>
                <th className="py-3 px-4 font-semibold">Tema Penataan Kelas</th>
                <th className="py-3 px-4 font-semibold">Tgl Penilaian</th>
                <th className="py-3 px-4 font-semibold">Pengumuman Upacara</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                {canManage && <th className="py-3 px-4 font-semibold text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.length > 0 ? (
                sorted.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Pekan Ke-{p.weekNumber} · {INDONESIAN_MONTHS[p.month - 1]} {p.year}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{p.theme}</td>
                    <td className="py-3 px-4 font-mono-num text-slate-700">
                      {formatIndonesianDate(p.scheduledDate)}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-slate-600">
                      {p.ceremonyDate ? formatIndonesianDate(p.ceremonyDate) : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {p.status === 'OPEN'
                        ? 'Dibuka (Aktif)'
                        : p.status === 'CLOSED'
                          ? 'Ditutup'
                          : 'Terjadwal'}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => deleteJudgingPeriod(p.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Belum ada periode penilaian terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editing ? 'Edit Jadwal Penilaian' : 'Tambah Jadwal Penilaian'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Pekan Ke (P1-P5)</label>
                  <select
                    disabled={Boolean(editing) && !isAdmin}
                    value={weekNumber}
                    onChange={(e) => setWeekNumber(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {[1, 2, 3, 4, 5].map((w) => (
                      <option key={w} value={w}>
                        Pekan {w}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Bulan</label>
                  <select
                    disabled={Boolean(editing) && !isAdmin}
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {INDONESIAN_MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tahun</label>
                  <input
                    type="number"
                    disabled={Boolean(editing) && !isAdmin}
                    min={2024}
                    max={2035}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Tema Kelas Pekan Ini</label>
                <input
                  type="text"
                  required
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Contoh: pahlawan & Keteladanan Ulama Nusantara"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tanggal Penilaian</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tgl Pengumuman Upacara</label>
                  <input
                    type="date"
                    value={ceremonyDate}
                    onChange={(e) => setCeremonyDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Status Periode</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PeriodStatus)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="SCHEDULED">Terjadwal</option>
                  <option value="OPEN">Sedang Dibuka (Input Nilai Aktif)</option>
                  <option value="CLOSED">Selesai / Ditutup</option>
                </select>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
