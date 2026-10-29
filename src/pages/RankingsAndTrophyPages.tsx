import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, Search, ShieldCheck, Trophy } from 'lucide-react';
import { INDONESIAN_MONTHS } from '../constants/rubric';
import { useApp } from '../context/AppContext';
import { ClassGrade } from '../types';
import {
  computeMonthlyRecap,
  computeWeeklyRecap,
  formatIndonesianDate,
  formatScore,
} from '../utils/calculations';

// ============================================================================
// PERINGKAT KELAS PAGE (MODUL 9)
// ============================================================================
export const RankingsPage: React.FC = () => {
  const { classes, judgingPeriods, evaluations, weeklyResults } = useApp();
  const [gradeFilter, setGradeFilter] = useState<'ALL' | ClassGrade>('ALL');
  const [search, setSearch] = useState('');

  const standings = useMemo(() => {
    const activeClasses = classes.filter(
      (c) => c.active && (gradeFilter === 'ALL' || c.grade === gradeFilter)
    );

    const rows = activeClasses.map((cls) => {
      let weeksCompleted = 0;
      let sumWeeklyAvg = 0;
      let sumA = 0;
      let sumB = 0;
      let sumC = 0;
      let sumD = 0;

      for (const p of judgingPeriods) {
        const comp = computeWeeklyRecap([cls], evaluations, p.id);
        const r = comp.rows[0];
        if (r && r.isComplete && r.averageScore !== null) {
          weeksCompleted += 1;
          sumWeeklyAvg += r.averageScore;
          sumA += r.avgAspectA ?? 0;
          sumB += r.avgAspectB ?? 0;
          sumC += r.avgAspectC ?? 0;
          sumD += r.avgAspectD ?? 0;
        }
      }

      const weeklyWins = weeklyResults.filter(
        (w) => w.status === 'APPROVED' && w.winnerClassId === cls.id
      ).length;

      const overallAvg = weeksCompleted > 0 ? sumWeeklyAvg / weeksCompleted : null;

      return {
        cls,
        weeksCompleted,
        cumulativeScore: sumWeeklyAvg,
        overallAvg,
        avgA: weeksCompleted > 0 ? sumA / weeksCompleted : null,
        avgB: weeksCompleted > 0 ? sumB / weeksCompleted : null,
        avgC: weeksCompleted > 0 ? sumC / weeksCompleted : null,
        avgD: weeksCompleted > 0 ? sumD / weeksCompleted : null,
        weeklyWins,
      };
    });

    rows.sort((a, b) => {
      if ((b.overallAvg ?? -1) !== (a.overallAvg ?? -1)) {
        return (b.overallAvg ?? -1) - (a.overallAvg ?? -1);
      }
      if (b.weeklyWins !== a.weeklyWins) return b.weeklyWins - a.weeklyWins;
      return (b.avgA ?? 0) - (a.avgA ?? 0);
    });

    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        !q ||
        r.cls.name.toLowerCase().includes(q) ||
        r.cls.homeroomTeacherName.toLowerCase().includes(q)
    );
  }, [classes, gradeFilter, judgingPeriods, evaluations, weeklyResults, search]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Klasemen &amp; Peringkat Kumulatif Kelas
          </h2>
          <p className="text-xs text-slate-500">
            Rekapitulasi performa rata-rata nilai, capaian per aspek (A–D), dan perolehan kemenangan mingguan seluruh kelas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kelas / wali..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'X', 'XI', 'XII'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGradeFilter(g)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                  gradeFilter === g ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {g === 'ALL' ? 'Semua' : `Kelas ${g}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-emerald-950 text-white">
                <th className="py-3 px-4 font-semibold w-16">Peringkat</th>
                <th className="py-3 px-4 font-semibold">Kelas</th>
                <th className="py-3 px-4 font-semibold">Wali Kelas</th>
                <th className="py-3 px-3 font-semibold text-center">Pekan Selesai</th>
                <th className="py-3 px-3 font-semibold text-center">Juara Mingguan</th>
                <th className="py-3 px-3 font-semibold text-right">Rata-rata A</th>
                <th className="py-3 px-3 font-semibold text-right">Rata-rata B</th>
                <th className="py-3 px-3 font-semibold text-right">Total Kumulatif</th>
                <th className="py-3 px-4 font-semibold text-right">Rata-Rata Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {standings.map((item, idx) => (
                <tr
                  key={item.cls.id}
                  className={idx === 0 ? 'bg-emerald-50/60 font-medium' : 'hover:bg-slate-50/70'}
                >
                  <td className="py-3 px-4 font-mono-num font-bold text-slate-900">#{idx + 1}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{item.cls.name}</td>
                  <td className="py-3 px-4 text-slate-700">{item.cls.homeroomTeacherName}</td>
                  <td className="py-3 px-3 text-center font-mono-num">{item.weeksCompleted}</td>
                  <td className="py-3 px-3 text-center font-mono-num font-bold text-amber-800">
                    {item.weeklyWins}x
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num">{formatScore(item.avgA, 1)}</td>
                  <td className="py-3 px-3 text-right font-mono-num">{formatScore(item.avgB, 1)}</td>
                  <td className="py-3 px-3 text-right font-mono-num">
                    {formatScore(item.cumulativeScore)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num font-bold text-emerald-900 text-sm">
                    {formatScore(item.overallAvg)}
                  </td>
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
// PIALA BERGILIR KEPALA MADRASAH PAGE (MODUL 10)
// ============================================================================
export const TrophyPage: React.FC = () => {
  const {
    classes,
    judgingPeriods,
    evaluations,
    weeklyResults,
    certificates,
    trophyHistory,
    settings,
    currentUser,
    ratifyTrophyHolder,
    addToast,
  } = useApp();

  const canRatifyTrophy =
    currentUser?.role === 'kepala_madrasah' || currentUser?.role === 'administrator';

  const activeHolder = useMemo(
    () => trophyHistory.find((t) => t.isActiveHolder) || trophyHistory[0] || null,
    [trophyHistory]
  );

  const [month, setMonth] = useState(10);
  const [year, setYear] = useState(2026);
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [ratifiedDate, setRatifiedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const monthlyComp = useMemo(
    () =>
      computeMonthlyRecap(
        classes,
        judgingPeriods,
        evaluations,
        weeklyResults,
        certificates,
        month,
        year
      ),
    [classes, judgingPeriods, evaluations, weeklyResults, certificates, month, year]
  );

  const selectedCandidate = useMemo(
    () =>
      monthlyComp.rows.find((r) => r.classId === selectedClassId) ||
      monthlyComp.rows[0] ||
      null,
    [monthlyComp, selectedClassId]
  );

  const handleRatify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) {
      addToast('error', 'Data Kelas Kosong', 'Pilih kelas kandidat pemegang piala.');
      return;
    }
    try {
      await ratifyTrophyHolder({
        month,
        year,
        periodLabel: `${INDONESIAN_MONTHS[month - 1]} ${year}`,
        classId: selectedCandidate.classId,
        certificateCount: selectedCandidate.certificateCount,
        cumulativeScore: selectedCandidate.totalMonthlyScore,
        ratifiedDate,
        notes:
          notes ||
          `Penetapan resmi pemegang Piala Bergilir Kepala Madrasah periode ${INDONESIAN_MONTHS[month - 1]} ${year}.`,
      });
      setNotes('');
    } catch (err) {
      addToast('error', 'Gagal Mengesahkan Piala', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Deep Emerald & Gold Trophy Showcase Card */}
      <div className="bg-emerald-950 text-white border-2 border-amber-500/60 rounded-2xl p-6 lg:p-10 relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-3 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-24 h-24 rounded-full bg-amber-400/15 border-2 border-amber-400 flex items-center justify-center text-amber-300">
              <Trophy className="w-12 h-12" />
            </div>
            <div className="text-xs font-semibold tracking-wider text-amber-300">
              PIALA BERGILIR KEPALA MADRASAH
            </div>
          </div>

          <div className="lg:col-span-9 space-y-4">
            <div className="text-xs text-emerald-200/90">
              {settings.schoolName} · Tahun Pelajaran {settings.academicYear}
            </div>
            {activeHolder ? (
              <>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-amber-300">
                    KELAS PEMEGANG PIALA BERGILIR SAAT INI
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-white">
                    KELAS {activeHolder.className}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-emerald-800/80 text-xs">
                  <div>
                    <div className="text-emerald-300/80">Wali Kelas</div>
                    <div className="font-semibold text-white mt-0.5">
                      {activeHolder.homeroomTeacherName}
                    </div>
                  </div>
                  <div>
                    <div className="text-emerald-300/80">Periode Kemenangan</div>
                    <div className="font-semibold text-white mt-0.5">
                      {activeHolder.periodLabel}
                    </div>
                  </div>
                  <div>
                    <div className="text-emerald-300/80">Capaian Sertifikat &amp; Skor</div>
                    <div className="font-semibold font-mono-num text-amber-300 mt-0.5">
                      {activeHolder.certificateCount} Sertifikat · Skor{' '}
                      {formatScore(activeHolder.cumulativeScore)}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-emerald-200/85 pt-1">
                  Disahkan secara resmi oleh <strong>{activeHolder.ratifiedByName}</strong> (
                  {activeHolder.ratifiedByTitle}) pada tanggal{' '}
                  <strong className="font-mono-num">
                    {formatIndonesianDate(activeHolder.ratifiedDate)}
                  </strong>
                  .
                </div>
              </>
            ) : (
              <div className="py-4 text-sm text-emerald-100">
                Belum ada kelas yang disahkan sebagai pemegang Piala Bergilir Kepala Madrasah.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Explicit Ratification Form (Never silently switches trophy holder!) */}
      {canRatifyTrophy && (
        <div className="no-print bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pengesahan Resmi Pemegang Piala Bergilir Kepala Madrasah
              </h3>
              <p className="text-xs text-slate-500">
                Status pemegang piala tidak berpindah otomatis secara diam-diam. Setiap penyerahan piala wajib disahkan dengan tanggal dan pejabat pengesah.
              </p>
            </div>
          </div>

          <form onSubmit={handleRatify} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Periode Bulan</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {INDONESIAN_MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Tahun</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Pilih Kelas Pemegang Piala (Berdasarkan Lampiran 3)
              </label>
              <select
                value={selectedCandidate?.classId || ''}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
              >
                {monthlyComp.rows.map((r) => (
                  <option key={r.classId} value={r.classId}>
                    {r.className} ({r.certificateCount} Sertifikat · Skor{' '}
                    {formatScore(r.totalMonthlyScore)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Tanggal Pengesahan</label>
              <input
                type="date"
                required
                value={ratifiedDate}
                onChange={(e) => setRatifiedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-medium text-slate-700 mb-1">
                Berita Acara / Catatan Keputusan Kepala Madrasah
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Diserahkan pada upacara bendera hari Senin..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                Sahkan Pemegang Piala
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Complete Trophy History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Riwayat Kelas Pemegang Piala Bergilir Kepala Madrasah
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold">Periode</th>
                <th className="py-3 px-4 font-semibold">Kelas</th>
                <th className="py-3 px-4 font-semibold">Wali Kelas</th>
                <th className="py-3 px-4 font-semibold text-center">Jml Sertifikat</th>
                <th className="py-3 px-4 font-semibold text-right">Total Skor</th>
                <th className="py-3 px-4 font-semibold">Pejabat &amp; Tgl Pengesahan</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trophyHistory.length > 0 ? (
                trophyHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.periodLabel}</td>
                    <td className="py-3 px-4 font-bold text-emerald-900">{item.className}</td>
                    <td className="py-3 px-4 text-slate-700">{item.homeroomTeacherName}</td>
                    <td className="py-3 px-4 text-center font-mono-num font-bold">
                      {item.certificateCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num">
                      {formatScore(item.cumulativeScore)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {item.ratifiedByName} · {formatIndonesianDate(item.ratifiedDate)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {item.isActiveHolder ? 'Pemegang Aktif' : 'Arsip Riwayat'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Belum ada riwayat pemegang piala bergilir.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
