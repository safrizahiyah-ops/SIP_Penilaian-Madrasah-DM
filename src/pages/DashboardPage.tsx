import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Trophy,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { INDONESIAN_MONTHS } from '../constants/rubric';
import { useApp } from '../context/AppContext';
import { computeWeeklyRecap, formatIndonesianDate, formatScore } from '../utils/calculations';

const CHART_PALETTE = [
  '#065f46',
  '#b45309',
  '#0284c7',
  '#7c3aed',
  '#be123c',
  '#0d9488',
];

export const DashboardPage: React.FC = () => {
  const {
    classes,
    judgingPeriods,
    evaluations,
    certificates,
    weeklyResults,
    monthlyResults,
    trophyHistory,
    settings,
    setActiveMenu,
  } = useApp();

  const sortedPeriods = useMemo(
    () =>
      [...judgingPeriods].sort((a, b) =>
        a.year !== b.year
          ? a.year - b.year
          : a.month !== b.month
            ? a.month - b.month
            : a.weekNumber - b.weekNumber
      ),
    [judgingPeriods]
  );

  const currentPeriod = useMemo(() => {
    const open = sortedPeriods.find((p) => p.status === 'OPEN');
    return open || sortedPeriods[sortedPeriods.length - 1] || null;
  }, [sortedPeriods]);

  const activeClasses = useMemo(() => classes.filter((c) => c.active), [classes]);

  // Expected evaluations = activeClasses * 2 judges * periods (SCHEDULED/OPEN/CLOSED)
  const expectedTotalEvaluations = activeClasses.length * 2 * sortedPeriods.length;
  const completedEvaluationsCount = evaluations.filter(
    (e) => e.status === 'FINAL' || e.status === 'LOCKED'
  ).length;
  const pendingEvaluationsCount = Math.max(0, expectedTotalEvaluations - completedEvaluationsCount);

  const issuedCertificatesCount = certificates.filter((c) => c.status === 'ISSUED').length;

  const currentWeeklyRecap = useMemo(() => {
    if (!currentPeriod) return null;
    return computeWeeklyRecap(activeClasses, evaluations, currentPeriod.id);
  }, [activeClasses, evaluations, currentPeriod]);

  const highestCurrentClass = useMemo(() => {
    if (!currentWeeklyRecap) return null;
    const completed = currentWeeklyRecap.rows.filter((r) => r.isComplete && r.averageScore !== null);
    if (completed.length === 0) return null;
    return completed[0];
  }, [currentWeeklyRecap]);

  const activeTrophyHolder = useMemo(
    () => trophyHistory.find((t) => t.isActiveHolder) || trophyHistory[0] || null,
    [trophyHistory]
  );

  // Incomplete Judge Alert List on Current Period
  const incompleteCurrentRows = useMemo(
    () => (currentWeeklyRecap ? currentWeeklyRecap.rows.filter((r) => !r.isComplete) : []),
    [currentWeeklyRecap]
  );

  // Chart 1: Weekly average score per period across madrasah
  const weeklyAverageChartData = useMemo(() => {
    return sortedPeriods.map((p) => {
      const comp = computeWeeklyRecap(activeClasses, evaluations, p.id);
      const valid = comp.rows.filter((r) => r.averageScore !== null);
      const avg =
        valid.length > 0
          ? valid.reduce((sum, r) => sum + (r.averageScore ?? 0), 0) / valid.length
          : 0;
      const maxVal =
        valid.length > 0 ? Math.max(...valid.map((r) => r.averageScore ?? 0)) : 0;

      return {
        label: `P${p.weekNumber} ${INDONESIAN_MONTHS[p.month - 1].slice(0, 3)}`,
        rataRataMadrasah: Number(avg.toFixed(2)),
        skorTertinggi: Number(maxVal.toFixed(2)),
      };
    });
  }, [sortedPeriods, activeClasses, evaluations]);

  // Top 6 classes for multi-line progression chart so chart stays legible
  const topClassIdsForProgression = useMemo(() => {
    const totals = activeClasses.map((cls) => {
      const clsEvals = evaluations.filter(
        (e) => e.classId === cls.id && (e.status === 'FINAL' || e.status === 'LOCKED')
      );
      const avg =
        clsEvals.length > 0
          ? clsEvals.reduce((s, e) => s + e.totalScore, 0) / clsEvals.length
          : 0;
      return { cls, avg };
    });
    totals.sort((a, b) => b.avg - a.avg);
    return totals.slice(0, 6).map((t) => t.cls);
  }, [activeClasses, evaluations]);

  const classProgressionData = useMemo(() => {
    return sortedPeriods.map((p) => {
      const comp = computeWeeklyRecap(activeClasses, evaluations, p.id);
      const entry: Record<string, string | number> = {
        pekan: `P${p.weekNumber} ${INDONESIAN_MONTHS[p.month - 1].slice(0, 3)}`,
      };
      for (const cls of topClassIdsForProgression) {
        const row = comp.rows.find((r) => r.classId === cls.id);
        if (row && row.averageScore !== null) {
          entry[cls.name] = Number(row.averageScore.toFixed(2));
        }
      }
      return entry;
    });
  }, [sortedPeriods, activeClasses, evaluations, topClassIdsForProgression]);

  return (
    <div className="space-y-6">
      {/* Madrasah Banner Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            {settings.schoolName} · {settings.location} · Tahun Pelajaran {settings.academicYear}
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Lomba Penataan (Bertema) &amp; Kebersihan Kelas — Piala Bergilir Kepala Madrasah
          </h2>
          <p className="text-xs text-slate-600">
            Moto: &ldquo;{settings.motto}&rdquo; · Pengumuman pemenang &amp; penyerahan sertifikat
            dilaksanakan setiap pekan usai upacara bendera.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveMenu('evaluation')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <ClipboardCheck className="w-4 h-4" />
            Input Penilaian Pekan Ini
          </button>
        </div>
      </div>

      {/* Incomplete Judging Notification Alert */}
      {currentPeriod && incompleteCurrentRows.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-sm font-semibold text-amber-950">
                Pemberitahuan Kelengkapan Penilaian — Pekan Ke-{currentPeriod.weekNumber}{' '}
                {INDONESIAN_MONTHS[currentPeriod.month - 1]} {currentPeriod.year}
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Terdapat <strong className="font-mono-num">{incompleteCurrentRows.length}</strong>{' '}
                kelas yang belum dinilai lengkap oleh kedua penilai:{' '}
                {incompleteCurrentRows.slice(0, 5).map((r, idx) => (
                  <span key={r.classId}>
                    {idx > 0 ? ', ' : ''}
                    <strong>{r.className}</strong> (Kurang Penilai {r.missingJudges.join(' & ')})
                  </span>
                ))}
                {incompleteCurrentRows.length > 5 ? ', dst.' : '.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveMenu('evaluation')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-950 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg transition-colors shrink-0 cursor-pointer whitespace-nowrap"
          >
            Lengkapi Nilai
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 6 KPI Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Jumlah Kelas Terdaftar</span>
            <BookOpen className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-slate-900">{classes.length}</div>
          <div className="text-xs text-slate-500">
            {activeClasses.length} kelas aktif mengikuti lomba
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Penilaian Sudah Dilaksanakan</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-slate-900">
            {completedEvaluationsCount}
          </div>
          <div className="text-xs text-slate-500">
            Lembar penilaian berstatus Final / Terkunci
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Penilaian Belum Dilaksanakan</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-slate-900">
            {pendingEvaluationsCount}
          </div>
          <div className="text-xs text-slate-500">
            Dari total {expectedTotalEvaluations} kuota lembar penilai terjadwal
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Sertifikat Telah Diterbitkan</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-slate-900">
            {issuedCertificatesCount}
          </div>
          <div className="text-xs text-slate-500">
            Sertifikat penghargaan Kelas Terbaik aktif
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Nilai Tertinggi Pekan Berjalan</span>
            <ClipboardCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {highestCurrentClass
              ? `${highestCurrentClass.className} (${formatScore(highestCurrentClass.averageScore)})`
              : 'Belum Tersedia'}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {currentPeriod
              ? `Pekan Ke-${currentPeriod.weekNumber} ${INDONESIAN_MONTHS[currentPeriod.month - 1]} ${currentPeriod.year}`
              : 'Belum ada jadwal aktif'}
          </div>
        </div>

        <div className="bg-emerald-950 text-white border border-emerald-900 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-300">
            <span>Pemegang Piala Bergilir Saat Ini</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white truncate">
            {activeTrophyHolder
              ? activeTrophyHolder.className
              : settings.currentTrophyClassName || 'Belum Ditetapkan'}
          </div>
          <div className="text-xs text-emerald-200/85 truncate">
            {activeTrophyHolder
              ? `Wali: ${activeTrophyHolder.homeroomTeacherName} · ${activeTrophyHolder.periodLabel}`
              : 'Menunggu pengesahan Kepala Madrasah'}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progression Line Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Grafik Perkembangan Nilai Kelas (6 Kelas Teratas)
            </h3>
            <p className="text-xs text-slate-500">
              Tren nilai rata-rata gabungan Penilai I dan Penilai II pada setiap pekan
            </p>
          </div>
          <div className="h-64 w-full">
            {classProgressionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={classProgressionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="pekan" tick={{ fontSize: 11 }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {topClassIdsForProgression.map((cls, idx) => (
                    <Line
                      key={cls.id}
                      type="monotone"
                      dataKey={cls.name}
                      stroke={CHART_PALETTE[idx % CHART_PALETTE.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada data penilaian mingguan untuk ditampilkan.
              </div>
            )}
          </div>
        </div>

        {/* Weekly Madrasah Average Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Grafik Rata-Rata &amp; Skor Tertinggi Mingguan
            </h3>
            <p className="text-xs text-slate-500">
              Perbandingan rata-rata seluruh kelas terhadap skor tertinggi per pekan
            </p>
          </div>
          <div className="h-64 w-full">
            {weeklyAverageChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyAverageChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="rataRataMadrasah"
                    name="Rata-Rata Kelas"
                    fill="#059669"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="skorTertinggi"
                    name="Skor Tertinggi"
                    fill="#d97706"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada rekapitulasi mingguan.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Latest Ranking Table & Schedule Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Class Rankings */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Tabel Peringkat Kelas Terbaru
              </h3>
              <p className="text-xs text-slate-500">
                {currentPeriod
                  ? `Pekan Ke-${currentPeriod.weekNumber} ${INDONESIAN_MONTHS[currentPeriod.month - 1]} ${currentPeriod.year} · Tema: ${currentPeriod.theme}`
                  : 'Belum ada periode dipilih'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveMenu('weekly_recap')}
              className="text-xs font-semibold text-emerald-800 hover:underline whitespace-nowrap cursor-pointer"
            >
              Buka Lampiran 2
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-semibold">Peringkat</th>
                  <th className="py-2.5 px-4 font-semibold">Kelas</th>
                  <th className="py-2.5 px-4 font-semibold">Wali Kelas</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Penilai I</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Penilai II</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Rata-rata</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentWeeklyRecap && currentWeeklyRecap.rows.length > 0 ? (
                  currentWeeklyRecap.rows.slice(0, 8).map((r) => (
                    <tr key={r.classId} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono-num font-semibold text-slate-900">
                        {r.rank !== null ? `#${r.rank}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{r.className}</td>
                      <td className="py-2.5 px-4 text-slate-600">{r.homeroomTeacherName}</td>
                      <td className="py-2.5 px-4 text-right font-mono-num">
                        {formatScore(r.scoreJudge1)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num">
                        {formatScore(r.scoreJudge2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-emerald-800">
                        {formatScore(r.averageScore)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {r.isComplete ? 'Lengkap' : r.completionLabel}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada data peringkat kelas pada pekan berjalan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assessment Schedule Calendar */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-semibold text-slate-900">Kalender Jadwal Penilaian</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveMenu('schedule')}
              className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              Kelola
            </button>
          </div>
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            {sortedPeriods.length > 0 ? (
              sortedPeriods.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg border border-slate-200 space-y-1 hover:border-emerald-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      Pekan Ke-{p.weekNumber} · {INDONESIAN_MONTHS[p.month - 1]} {p.year}
                    </span>
                    <span className="text-slate-500">
                      {p.status === 'OPEN'
                        ? 'Sedang Dibuka'
                        : p.status === 'CLOSED'
                          ? 'Selesai'
                          : 'Terjadwal'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 line-clamp-1">{p.theme}</div>
                  <div className="text-[11px] text-slate-500 font-mono-num">
                    Penilaian: {formatIndonesianDate(p.scheduledDate)}
                    {p.ceremonyDate ? ` · Upacara: ${formatIndonesianDate(p.ceremonyDate)}` : ''}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Belum ada jadwal penilaian terdaftar.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly & Monthly Winner History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Riwayat Pemenang Mingguan</h3>
            <p className="text-xs text-slate-500">
              Daftar kelas peraih predikat Kelas Terbaik Mingguan yang telah ditetapkan
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {weeklyResults.length > 0 ? (
              [...weeklyResults]
                .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month !== a.month ? b.month - a.month : b.weekNumber - a.weekNumber))
                .slice(0, 6)
                .map((wr) => (
                  <div key={wr.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">
                        {wr.winnerClassName} · Wali: {wr.winnerHomeroomTeacher}
                      </div>
                      <div className="text-slate-500 truncate">
                        Pekan Ke-{wr.weekNumber} {INDONESIAN_MONTHS[wr.month - 1]} {wr.year} ·{' '}
                        {wr.status === 'APPROVED' ? 'Disahkan Resmi' : 'Usulan Koordinator'}
                      </div>
                    </div>
                    <div className="font-mono-num font-bold text-emerald-800 shrink-0">
                      {formatScore(wr.winnerScore)}
                    </div>
                  </div>
                ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                Belum ada riwayat pemenang mingguan yang ditetapkan.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Riwayat Pemenang Bulanan &amp; Piala Bergilir
            </h3>
            <p className="text-xs text-slate-500">
              Rekam jejak pengesahan pemenang bulanan dan pemegang Piala Bergilir Kepala Madrasah
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {trophyHistory.length > 0 || monthlyResults.length > 0 ? (
              <>
                {trophyHistory.slice(0, 4).map((tr) => (
                  <div key={tr.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">
                        {tr.className} · {tr.periodLabel}
                      </div>
                      <div className="text-slate-500 truncate">
                        Wali: {tr.homeroomTeacherName} · Disahkan {formatIndonesianDate(tr.ratifiedDate)}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono-num">
                      <div className="font-bold text-amber-700">{tr.certificateCount} Sertifikat</div>
                      <div className="text-slate-500">Skor {formatScore(tr.cumulativeScore)}</div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                Belum ada riwayat pemenang bulanan yang disahkan.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
