import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import { INDONESIAN_MONTHS, ROLE_LABELS } from '../constants/rubric';
import { useApp } from '../context/AppContext';
import { AppDatabaseSnapshot, JudgeSlot, UserRole } from '../types';
import {
  computeMonthlyRecap,
  computeWeeklyRecap,
  formatIndonesianDate,
  formatScore,
} from '../utils/calculations';
import {
  exportFullEvaluationsWorkbook,
  exportGenericTable,
  exportLampiran2Excel,
  exportLampiran3Excel,
} from '../utils/excelHelper';
import { compressImageFile } from '../utils/imageCompressor';
import {
  downloadLampiran2Pdf,
  downloadLampiran3Pdf,
  downloadOfficialReportPdf,
} from '../utils/pdfGenerator';

// ============================================================================
// MODUL 12: PUSAT LAPORAN DAN EKSPOR (PDF, XLSX, CSV)
// ============================================================================
export const ReportsPage: React.FC = () => {
  const {
    classes,
    judgingPeriods,
    evaluations,
    weeklyResults,
    monthlyResults,
    trophyHistory,
    certificates,
    settings,
    addToast,
  } = useApp();

  const [selectedPeriodId, setSelectedPeriodId] = useState(judgingPeriods[0]?.id || '');
  const [month, setMonth] = useState(10);
  const [year, setYear] = useState(2026);

  const selectedPeriod = useMemo(
    () => judgingPeriods.find((p) => p.id === selectedPeriodId) || judgingPeriods[0] || null,
    [judgingPeriods, selectedPeriodId]
  );

  const handleExportReport = (reportKey: string, format: 'pdf' | 'xlsx' | 'csv') => {
    const activeClasses = classes.filter((c) => c.active);

    if (reportKey === 'eval_sheets') {
      const headers = ['Pekan', 'Bulan', 'Tanggal', 'Kelas', 'Penilai', 'Aspek A', 'Aspek B', 'Aspek C', 'Aspek D', 'Total', 'Status'];
      const rows = evaluations.map((e) => [
        `P${e.weekNumber}`,
        `${INDONESIAN_MONTHS[e.month - 1]} ${e.year}`,
        e.evaluationDate,
        e.className,
        `${e.judgeName} (${e.judgeNumber})`,
        e.subtotalA,
        e.subtotalB,
        e.subtotalC,
        e.subtotalD,
        e.totalScore,
        e.status,
      ]);
      if (format === 'pdf') {
        downloadOfficialReportPdf({
          settings,
          title: 'LAPORAN REKAP LEMBAR PENILAIAN MASING-MASING PENILAI',
          subtitle: `Tahun Pelajaran ${settings.academicYear}`,
          orientation: 'landscape',
          headers,
          rows,
          filename: 'Laporan_Lembar_Penilaian_Penilai',
        });
      } else {
        exportGenericTable('Laporan Lembar Penilaian Penilai', headers, rows, format, 'Laporan_Lembar_Penilaian_Penilai');
      }
    } else if (reportKey === 'weekly_recap' && selectedPeriod) {
      const comp = computeWeeklyRecap(activeClasses, evaluations, selectedPeriod.id);
      const wr = weeklyResults.find((w) => w.periodId === selectedPeriod.id) || null;
      if (format === 'pdf') {
        downloadLampiran2Pdf(comp.rows, selectedPeriod, settings, wr);
      } else if (format === 'xlsx') {
        exportLampiran2Excel(comp.rows, selectedPeriod, settings);
      } else {
        const headers = ['No', 'Kelas', 'Wali Kelas', 'Skor Penilai I', 'Skor Penilai II', 'Rata-rata', 'Peringkat', 'Status'];
        const rows = comp.rows.map((r, i) => [
          i + 1,
          r.className,
          r.homeroomTeacherName,
          r.scoreJudge1 ?? 'Belum Dinilai',
          r.scoreJudge2 ?? 'Belum Dinilai',
          r.averageScore !== null ? Number(r.averageScore.toFixed(2)) : 'Belum Lengkap',
          r.rank ?? '-',
          r.completionLabel,
        ]);
        exportGenericTable('Lampiran 2 Rekap Mingguan', headers, rows, 'csv', 'Lampiran_2_Rekap_Mingguan');
      }
    } else if (reportKey === 'monthly_recap') {
      const comp = computeMonthlyRecap(activeClasses, judgingPeriods, evaluations, weeklyResults, certificates, month, year);
      const mr = monthlyResults.find((m) => m.month === month && m.year === year) || null;
      if (format === 'pdf') {
        downloadLampiran3Pdf(comp.rows, month, year, settings, mr);
      } else if (format === 'xlsx') {
        exportLampiran3Excel(comp.rows, month, year, settings);
      } else {
        const headers = ['No', 'Kelas', 'Wali Kelas', 'Jml Sertifikat', 'Total Skor Bulanan', 'Status'];
        const rows = comp.rows.map((r, i) => [
          i + 1,
          r.className,
          r.homeroomTeacherName,
          r.certificateCount,
          Number(r.totalMonthlyScore.toFixed(2)),
          r.hasUnfinalizedWeeks ? 'Belum Final' : 'Final',
        ]);
        exportGenericTable('Lampiran 3 Rekap Sertifikat Bulanan', headers, rows, 'csv', 'Lampiran_3_Rekap_Bulanan');
      }
    } else if (reportKey === 'all_rankings') {
      const headers = ['No', 'Kelas', 'Tingkat', 'Wali Kelas', 'Pekan Selesai', 'Kemenangan Mingguan', 'Rata-Rata Nilai'];
      const rows = activeClasses.map((cls, idx) => {
        let count = 0;
        let sum = 0;
        judgingPeriods.forEach((p) => {
          const r = computeWeeklyRecap([cls], evaluations, p.id).rows[0];
          if (r?.isComplete && r.averageScore !== null) {
            count++;
            sum += r.averageScore;
          }
        });
        const wins = weeklyResults.filter((w) => w.status === 'APPROVED' && w.winnerClassId === cls.id).length;
        return [
          idx + 1,
          cls.name,
          cls.grade,
          cls.homeroomTeacherName,
          count,
          wins,
          count > 0 ? Number((sum / count).toFixed(2)) : '-',
        ];
      });
      if (format === 'pdf') {
        downloadOfficialReportPdf({
          settings,
          title: 'LAPORAN PERINGKAT SELURUH KELAS',
          subtitle: `Tahun Pelajaran ${settings.academicYear}`,
          orientation: 'landscape',
          headers,
          rows,
          filename: 'Laporan_Peringkat_Seluruh_Kelas',
        });
      } else {
        exportGenericTable('Laporan Peringkat Seluruh Kelas', headers, rows, format, 'Laporan_Peringkat_Seluruh_Kelas');
      }
    } else if (reportKey === 'weekly_winners') {
      const headers = ['Pekan', 'Bulan / Tahun', 'Tema', 'Kelas Pemenang', 'Wali Kelas', 'Skor Akhir', 'Status'];
      const rows = weeklyResults.map((w) => [
        `Pekan ${w.weekNumber}`,
        `${INDONESIAN_MONTHS[w.month - 1]} ${w.year}`,
        w.theme,
        w.winnerClassName,
        w.winnerHomeroomTeacher,
        formatScore(w.winnerScore),
        w.status === 'APPROVED' ? 'Disahkan' : 'Usulan',
      ]);
      if (format === 'pdf') {
        downloadOfficialReportPdf({
          settings,
          title: 'LAPORAN RIWAYAT PEMENANG MINGGUAN',
          subtitle: `Tahun Pelajaran ${settings.academicYear}`,
          orientation: 'landscape',
          headers,
          rows,
          filename: 'Laporan_Riwayat_Pemenang_Mingguan',
        });
      } else {
        exportGenericTable('Laporan Riwayat Pemenang Mingguan', headers, rows, format, 'Laporan_Riwayat_Pemenang_Mingguan');
      }
    } else if (reportKey === 'trophy_history') {
      const headers = ['Periode', 'Kelas Pemegang Piala', 'Wali Kelas', 'Jml Sertifikat', 'Total Skor', 'Pejabat Pengesah', 'Tanggal'];
      const rows = trophyHistory.map((t) => [
        t.periodLabel,
        t.className,
        t.homeroomTeacherName,
        t.certificateCount,
        formatScore(t.cumulativeScore),
        t.ratifiedByName,
        t.ratifiedDate,
      ]);
      if (format === 'pdf') {
        downloadOfficialReportPdf({
          settings,
          title: 'LAPORAN RIWAYAT PEMEGANG PIALA BERGILIR KEPALA MADRASAH',
          subtitle: `Tahun Pelajaran ${settings.academicYear}`,
          orientation: 'landscape',
          headers,
          rows,
          filename: 'Laporan_Riwayat_Piala_Bergilir',
        });
      } else {
        exportGenericTable('Laporan Riwayat Piala Bergilir', headers, rows, format, 'Laporan_Riwayat_Piala_Bergilir');
      }
    } else if (reportKey === 'certificates_list') {
      const headers = ['Nomor Sertifikat', 'Kelas', 'Wali Kelas', 'Periode', 'Skor', 'Tanggal Terbit', 'Status'];
      const rows = certificates.map((c) => [
        c.certificateNumber,
        c.className,
        c.homeroomTeacherName,
        c.periodLabel,
        formatScore(c.finalScore),
        c.issueDate,
        c.status === 'ISSUED' ? 'Aktif' : `Batal (${c.revokedReason})`,
      ]);
      if (format === 'pdf') {
        downloadOfficialReportPdf({
          settings,
          title: 'DAFTAR SERTIFIKAT PENGHARGAAN YANG TELAH DITERBITKAN',
          subtitle: `Tahun Pelajaran ${settings.academicYear}`,
          orientation: 'landscape',
          headers,
          rows,
          filename: 'Daftar_Sertifikat_Terbit',
        });
      } else {
        exportGenericTable('Daftar Sertifikat Terbit', headers, rows, format, 'Daftar_Sertifikat_Terbit');
      }
    } else if (reportKey === 'class_progression') {
      const pHeaders = judgingPeriods.map((p) => `P${p.weekNumber}-${p.month}/${p.year}`);
      const headers = ['Kelas', 'Wali Kelas', ...pHeaders];
      const rows = activeClasses.map((cls) => {
        const vals = judgingPeriods.map((p) => {
          const r = computeWeeklyRecap([cls], evaluations, p.id).rows[0];
          return r?.averageScore !== null && r?.averageScore !== undefined
            ? formatScore(r.averageScore)
            : '-';
        });
        return [cls.name, cls.homeroomTeacherName, ...vals];
      });
      if (format === 'pdf') {
        downloadOfficialReportPdf({
          settings,
          title: 'LAPORAN PERKEMBANGAN NILAI SETIAP KELAS',
          subtitle: `Tahun Pelajaran ${settings.academicYear}`,
          orientation: 'landscape',
          headers,
          rows,
          filename: 'Laporan_Perkembangan_Nilai_Kelas',
        });
      } else {
        exportGenericTable('Laporan Perkembangan Nilai Kelas', headers, rows, format, 'Laporan_Perkembangan_Nilai_Kelas');
      }
    } else if (reportKey === 'incomplete_evals') {
      const headers = ['Periode Pekan', 'Tanggal', 'Kelas', 'Wali Kelas', 'Penilai I', 'Penilai II', 'Kekurangan'];
      const rows: (string | number)[][] = [];
      judgingPeriods.forEach((p) => {
        const comp = computeWeeklyRecap(activeClasses, evaluations, p.id);
        comp.rows
          .filter((r) => !r.isComplete)
          .forEach((r) => {
            rows.push([
              `Pekan ${p.weekNumber} ${INDONESIAN_MONTHS[p.month - 1]} ${p.year}`,
              p.scheduledDate,
              r.className,
              r.homeroomTeacherName,
              r.scoreJudge1 !== null ? formatScore(r.scoreJudge1) : 'Belum',
              r.scoreJudge2 !== null ? formatScore(r.scoreJudge2) : 'Belum',
              `Kurang Penilai ${r.missingJudges.join(' & ')}`,
            ]);
          });
      });
      if (format === 'pdf') {
        downloadOfficialReportPdf({
          settings,
          title: 'LAPORAN PENILAIAN YANG BELUM LENGKAP',
          subtitle: `Tahun Pelajaran ${settings.academicYear}`,
          orientation: 'portrait',
          headers,
          rows: rows.length > 0 ? rows : [['-', '-', 'Seluruh kelas sudah lengkap dinilai', '-', '-', '-', 'Lengkap']],
          filename: 'Laporan_Penilaian_Belum_Lengkap',
        });
      } else {
        exportGenericTable('Laporan Penilaian Belum Lengkap', headers, rows, format, 'Laporan_Penilaian_Belum_Lengkap');
      }
    }

    addToast('success', 'Dokumen Berhasil Diunduh', `Laporan telah diekspor dalam format ${format.toUpperCase()}.`);
  };

  const reportCards = [
    { key: 'eval_sheets', title: '1. Lembar Penilaian Masing-Masing Penilai', desc: 'Rekap rincian skor Aspek A, B, C, D dan total nilai seluruh lembar penilai.' },
    { key: 'weekly_recap', title: '2. Rekapitulasi Nilai Mingguan (Lampiran 2)', desc: 'Dokumen resmi Lampiran 2 lengkap dengan peringkat dan tanda tangan.' },
    { key: 'all_rankings', title: '3. Peringkat Kumulatif Seluruh Kelas', desc: 'Klasemen rata-rata keseluruhan dan jumlah kemenangan setiap kelas.' },
    { key: 'monthly_recap', title: '4. Rekapitulasi Sertifikat Bulanan (Lampiran 3)', desc: 'Matriks P1–P5 perolehan sertifikat Kelas Terbaik dan total skor bulanan.' },
    { key: 'weekly_winners', title: '5. Riwayat Pemenang Mingguan', desc: 'Daftar pemenang mingguan yang telah diusulkan maupun disahkan.' },
    { key: 'trophy_history', title: '6. Riwayat Pemegang Piala Bergilir', desc: 'Arsip keputusan pengesahan Piala Bergilir Kepala Madrasah.' },
    { key: 'certificates_list', title: '7. Daftar Sertifikat yang Telah Diterbitkan', desc: 'Log penomoran sertifikat resmi beserta status aktif/pembatalan.' },
    { key: 'class_progression', title: '8. Laporan Perkembangan Nilai Setiap Kelas', desc: 'Tabel perbandingan tren nilai rata-rata kelas dari pekan ke pekan.' },
    { key: 'incomplete_evals', title: '9. Laporan Penilaian yang Belum Lengkap', desc: 'Audit daftar kelas yang masih menunggu nilai Penilai I atau Penilai II.' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Pusat Laporan &amp; Pencetakan Resmi</h2>
          <p className="text-xs text-slate-500">
            Seluruh laporan dilengkapi identitas MA Darul Mahfudz, tanggal cetak, tabel bergaris jelas, dan ruang tanda tangan resmi (A4 Portrait / Landscape).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">Periode Lampiran 2</label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
            >
              {judgingPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  Pekan {p.weekNumber} · {INDONESIAN_MONTHS[p.month - 1]} {p.year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-500 mb-1">Bulan Lampiran 3</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
            >
              {INDONESIAN_MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m} {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map((rc) => (
          <div
            key={rc.key}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-800">
                <FileText className="w-4 h-4 shrink-0" />
                <h3 className="text-xs font-bold text-slate-900">{rc.title}</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{rc.desc}</p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleExportReport(rc.key, 'pdf')}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => handleExportReport(rc.key, 'xlsx')}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                XLSX
              </button>
              <button
                type="button"
                onClick={() => handleExportReport(rc.key, 'csv')}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                CSV
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MODUL 13: PENGATURAN IDENTITAS MADRASAH & HAK AKSES PENGGUNA
// ============================================================================
export const SettingsPage: React.FC = () => {
  const {
    settings,
    users,
    judges,
    currentUser,
    updateSchoolSettings,
    updateUserRole,
    addToast,
  } = useApp();

  const isAdmin = currentUser?.role === 'administrator';
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoDataUrl' | 'buildingDataUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, {
        maxWidth: field === 'logoDataUrl' ? 360 : 960,
        maxHeight: field === 'logoDataUrl' ? 360 : 600,
        preserveAlpha: field === 'logoDataUrl',
        quality: 0.8,
      });
      setForm((prev) => ({ ...prev, [field]: dataUrl }));
      addToast('info', 'Gambar Siap Disimpan', 'Klik tombol "Simpan Pengaturan Madrasah" untuk menerapkan.');
    } catch (err) {
      addToast('error', 'Gagal Memuat Gambar', err instanceof Error ? err.message : String(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSchoolSettings(form);
    } catch (err) {
      addToast('error', 'Gagal Menyimpan Pengaturan', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Identitas Madrasah, Pejabat Penandatangan &amp; Aturan Lomba
            </h2>
            <p className="text-xs text-slate-500">
              Seluruh perubahan langsung diterapkan pada kop dokumen, sertifikat, dan perhitungan tanpa perlu mengedit kode program.
            </p>
          </div>
          {isAdmin && (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              Simpan Pengaturan Madrasah
            </button>
          )}
        </div>

        {/* Official Logo & Building Photo Uploads */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 border border-slate-200 rounded-xl space-y-3">
            <div className="text-xs font-semibold text-slate-900">
              Logo Resmi MA Darul Mahfudz
            </div>
            <p className="text-[11px] text-slate-500">
              Ditampilkan pada bagian atas tengah sertifikat dan kop laporan resmi dengan proporsi asli terjaga.
            </p>
            <div className="flex items-center gap-4">
              {form.logoDataUrl ? (
                <img
                  src={form.logoDataUrl}
                  alt="Logo Madrasah"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 object-contain border border-slate-200 rounded-lg p-1 bg-white"
                />
              ) : (
                <div className="w-16 h-16 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 text-center p-1">
                  Belum Diunggah
                </div>
              )}
              {isAdmin && (
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" />
                    Unggah Logo Resmi
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleImageUpload(e, 'logoDataUrl')}
                      className="hidden"
                    />
                  </label>
                  {form.logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, logoDataUrl: '' }))}
                      className="block text-[11px] text-red-600 hover:underline cursor-pointer"
                    >
                      Kosongkan Logo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl space-y-3">
            <div className="text-xs font-semibold text-slate-900">
              Foto Bangunan Madrasah (Latar Sertifikat)
            </div>
            <p className="text-[11px] text-slate-500">
              Digunakan sebagai latar bertransparansi lembut pada sertifikat penghargaan A4 Landscape.
            </p>
            <div className="flex items-center gap-4">
              {form.buildingDataUrl ? (
                <img
                  src={form.buildingDataUrl}
                  alt="Bangunan Madrasah"
                  referrerPolicy="no-referrer"
                  className="w-24 h-16 object-cover border border-slate-200 rounded-lg"
                />
              ) : (
                <div className="w-24 h-16 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 text-center p-1">
                  Belum Diunggah
                </div>
              )}
              {isAdmin && (
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" />
                    Unggah Foto Bangunan
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleImageUpload(e, 'buildingDataUrl')}
                      className="hidden"
                    />
                  </label>
                  {form.buildingDataUrl && (
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, buildingDataUrl: '' }))}
                      className="block text-[11px] text-red-600 hover:underline cursor-pointer"
                    >
                      Kosongkan Foto
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Institutional Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Nama Lembaga</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Tahun Pelajaran</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.academicYear}
              onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Lokasi (Kota / Desa)</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block font-medium text-slate-700 mb-1">Alamat Lengkap Madrasah</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Moto Madrasah</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.motto}
              onChange={(e) => setForm({ ...form, motto: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">Slogan Lomba</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.slogan}
              onChange={(e) => setForm({ ...form, slogan: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Nama Kepala Madrasah</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.principalName}
              onChange={(e) => setForm({ ...form, principalName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">NIP Kepala Madrasah</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.principalNip}
              onChange={(e) => setForm({ ...form, principalNip: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Nama Koordinator Lomba</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.coordinatorName}
              onChange={(e) => setForm({ ...form, coordinatorName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Wakil Kepala Madrasah Bidang Kesiswaan
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.vicePrincipalName}
              onChange={(e) => setForm({ ...form, vicePrincipalName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">NIP Wakamad Kesiswaan</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.vicePrincipalNip}
              onChange={(e) => setForm({ ...form, vicePrincipalNip: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Pola Nomor Sertifikat
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.certificateFormat}
              onChange={(e) => setForm({ ...form, certificateFormat: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block font-medium text-slate-700 mb-1">
              Ketentuan Pertimbangan Pemenang Bulanan (Lampiran 3)
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.winnerRuleText}
              onChange={(e) => setForm({ ...form, winnerRuleText: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </form>

      {/* RBAC User Management Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-700" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Manajemen Pengguna &amp; Hak Akses Sistem (RBAC)
            </h3>
            <p className="text-xs text-slate-500">
              Kelola peran Administrator, Penilai I/II, Koordinator, dan Kepala Madrasah yang ditegakkan pada aturan keamanan database.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold">Nama Pengguna</th>
                <th className="py-3 px-4 font-semibold">UID Akun</th>
                <th className="py-3 px-4 font-semibold">Peran Sistem</th>
                <th className="py-3 px-4 font-semibold">Penugasan Penilai</th>
                {isAdmin && <th className="py-3 px-4 font-semibold text-right">Ubah Peran</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">{u.displayName}</td>
                  <td className="py-3 px-4 font-mono-num text-slate-500">{u.uid.slice(0, 16)}</td>
                  <td className="py-3 px-4 text-emerald-900 font-medium">
                    {ROLE_LABELS[u.role]}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {u.judgeSlot !== 'NONE' ? `Penilai ${u.judgeSlot}` : '—'}
                  </td>
                  {isAdmin && (
                    <td className="py-2.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          updateUserRole(
                            u.uid,
                            e.target.value as UserRole,
                            u.judgeSlot,
                            u.linkedJudgeId,
                            u.active
                          )
                        }
                        className="px-2 py-1 border border-slate-200 rounded-md bg-white text-xs"
                      >
                        <option value="administrator">Administrator</option>
                        <option value="penilai">Penilai</option>
                        <option value="koordinator">Koordinator</option>
                        <option value="kepala_madrasah">Kepala Madrasah</option>
                        <option value="viewer">Tamu</option>
                      </select>

                      {u.role === 'penilai' && (
                        <select
                          value={u.judgeSlot}
                          onChange={(e) => {
                            const slot = e.target.value as JudgeSlot;
                            const matchJ = judges.find((j) => j.judgeRole === slot);
                            updateUserRole(u.uid, u.role, slot, matchJ?.id || '', u.active);
                          }}
                          className="px-2 py-1 border border-slate-200 rounded-md bg-white text-xs"
                        >
                          <option value="NONE">Semua Slot</option>
                          <option value="I">Penilai I</option>
                          <option value="II">Penilai II</option>
                        </select>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODUL 16: CADANGKAN DAN PULIHKAN DATA
// ============================================================================
export const BackupRestorePage: React.FC = () => {
  const {
    currentUser,
    storageMode,
    getSnapshot,
    restoreSnapshot,
    resetDemoData,
    addToast,
  } = useApp();

  const isAdmin = currentUser?.role === 'administrator';
  const [pendingSnapshot, setPendingSnapshot] = useState<AppDatabaseSnapshot | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleDownloadJsonBackup = () => {
    const snap = getSnapshot();
    const json = JSON.stringify(snap, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cadangan_SIP_KELAS_Darul_Mahfudz_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Cadangan JSON Diunduh', 'Seluruh entitas aplikasi telah dicadangkan.');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppDatabaseSnapshot;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !Array.isArray(parsed.classes) ||
        !Array.isArray(parsed.evaluations) ||
        !parsed.schoolSettings
      ) {
        throw new Error('Struktur berkas cadangan JSON tidak valid atau rusak.');
      }
      setPendingSnapshot(parsed);
    } catch (err) {
      addToast('error', 'Validasi Berkas Gagal', err instanceof Error ? err.message : 'Bukan berkas cadangan yang sah.');
    }
  };

  const confirmRestore = async () => {
    if (!pendingSnapshot) return;
    setRestoring(true);
    try {
      await restoreSnapshot(pendingSnapshot);
      setPendingSnapshot(null);
    } catch (err) {
      addToast('error', 'Pemulihan Gagal', err instanceof Error ? err.message : String(err));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Backup Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-800">
            <DatabaseBackup className="w-5 h-5" />
            <h2 className="text-base font-bold text-slate-900">Ekspor Cadangan Seluruh Data</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Unduh salinan lengkap seluruh data kelas, wali kelas, penilai, jadwal, nilai Lampiran 1,
            pengesahan Lampiran 2 &amp; 3, sertifikat, riwayat piala bergilir, dan log audit.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadJsonBackup}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Ekspor Cadangan (.JSON)
            </button>
            <button
              type="button"
              onClick={() => {
                exportFullEvaluationsWorkbook(getSnapshot());
                addToast('success', 'Buku Kerja Excel Diunduh', 'Data kelas, penilaian, dan sertifikat berhasil diekspor.');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Ekspor Data ke Excel (.XLSX)
            </button>
          </div>
        </div>

        {/* Restore Backup Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-amber-700">
            <Upload className="w-5 h-5" />
            <h2 className="text-base font-bold text-slate-900">Impor &amp; Pulihkan Data</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pilih berkas cadangan <code>.json</code> SIP-KELAS Darul Mahfudz. Sistem akan memeriksa
            keabsahan berkas dan menampilkan ringkasan isi sebelum pemulihan dijalankan.
          </p>

          {isAdmin ? (
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer">
                <Upload className="w-4 h-4" />
                Pilih Berkas Cadangan (.JSON)
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {storageMode === 'DEMO' && (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Data Awal Demo
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
              Hanya peran <strong>Administrator</strong> yang diizinkan melakukan pemulihan data.
            </div>
          )}
        </div>
      </div>

      {/* Validation Summary & Confirmation Preview before Restore */}
      {pendingSnapshot && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-950">
                Pratinjau Ringkasan Berkas Cadangan &amp; Peringatan Pemulihan
              </h3>
              <p className="text-xs text-amber-900">
                Tindakan pemulihan akan memperbarui atau menimpa data yang memiliki ID sama. Pastikan ringkasan di bawah ini sudah benar sebelum melanjutkan:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-3 rounded-lg border border-amber-200">
              <div className="text-slate-500">Tanggal Ekspor</div>
              <div className="font-semibold font-mono-num mt-0.5">
                {formatIndonesianDate(pendingSnapshot.exportedAt.slice(0, 10))}
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-amber-200">
              <div className="text-slate-500">Jumlah Kelas &amp; Penilai</div>
              <div className="font-semibold font-mono-num mt-0.5">
                {pendingSnapshot.classes.length} Kelas · {pendingSnapshot.judges.length} Penilai
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-amber-200">
              <div className="text-slate-500">Lembar Penilaian</div>
              <div className="font-semibold font-mono-num mt-0.5">
                {pendingSnapshot.evaluations.length} Lembar
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-amber-200">
              <div className="text-slate-500">Sertifikat &amp; Piala</div>
              <div className="font-semibold font-mono-num mt-0.5">
                {pendingSnapshot.certificates.length} Sertifikat ·{' '}
                {pendingSnapshot.trophyHistory.length} Piala
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setPendingSnapshot(null)}
              className="px-4 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
            >
              Batalkan
            </button>
            <button
              type="button"
              disabled={restoring}
              onClick={confirmRestore}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {restoring ? 'Memulihkan...' : 'Konfirmasi & Pulihkan Data Sekarang'}
            </button>
          </div>
        </div>
      )}

      {/* Demo Reset Warning Modal */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-bold">Peringatan Reset Data Demo</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Seluruh perubahan lokal pada Mode DEMO akan dihapus dan dikembalikan ke data awal 12
              kelas MA Darul Mahfudz. Lanjutkan?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-4 py-2 text-xs border border-slate-200 rounded-lg text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDemoData();
                  setConfirmReset(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Ya, Reset Data Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
