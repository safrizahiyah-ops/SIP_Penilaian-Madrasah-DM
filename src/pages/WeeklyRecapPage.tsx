import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { INDONESIAN_MONTHS } from '../constants/rubric';
import { useApp } from '../context/AppContext';
import {
  computeWeeklyRecap,
  formatIndonesianDate,
  formatScore,
} from '../utils/calculations';
import { exportLampiran2Excel } from '../utils/excelHelper';
import { downloadLampiran2Pdf } from '../utils/pdfGenerator';

export const WeeklyRecapPage: React.FC = () => {
  const {
    classes,
    judgingPeriods,
    evaluations,
    weeklyResults,
    settings,
    currentUser,
    submitWeeklyDecision,
    setActiveMenu,
    addToast,
  } = useApp();

  const sortedPeriods = useMemo(
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

  const [selectedMonth, setSelectedMonth] = useState<number>(sortedPeriods[0]?.month || 10);
  const [selectedYear, setSelectedYear] = useState<number>(sortedPeriods[0]?.year || 2026);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(sortedPeriods[0]?.id || '');

  const filteredPeriods = useMemo(
    () =>
      sortedPeriods.filter(
        (p) => p.month === selectedMonth && p.year === selectedYear
      ),
    [sortedPeriods, selectedMonth, selectedYear]
  );

  useEffect(() => {
    if (filteredPeriods.length > 0 && !filteredPeriods.some((p) => p.id === selectedPeriodId)) {
      setSelectedPeriodId(filteredPeriods[0].id);
    }
  }, [filteredPeriods, selectedPeriodId]);

  const currentPeriod = useMemo(
    () => judgingPeriods.find((p) => p.id === selectedPeriodId) || null,
    [judgingPeriods, selectedPeriodId]
  );

  const recap = useMemo(() => {
    if (!currentPeriod) return null;
    return computeWeeklyRecap(classes, evaluations, currentPeriod.id);
  }, [classes, evaluations, currentPeriod]);

  const officialWeeklyResult = useMemo(
    () =>
      currentPeriod
        ? weeklyResults.find((w) => w.periodId === currentPeriod.id) || null
        : null,
    [weeklyResults, currentPeriod]
  );

  const [tieWinnerClassId, setTieWinnerClassId] = useState('');
  const [tieResolutionNote, setTieResolutionNote] = useState('');

  useEffect(() => {
    if (officialWeeklyResult) {
      setTieWinnerClassId(officialWeeklyResult.winnerClassId);
      setTieResolutionNote(officialWeeklyResult.tieResolutionNote);
    } else if (recap && recap.topCandidates[0]) {
      setTieWinnerClassId(recap.topCandidates[0].classId);
      setTieResolutionNote('');
    }
  }, [officialWeeklyResult, recap]);

  const canPropose =
    currentUser?.role === 'koordinator' ||
    currentUser?.role === 'administrator' ||
    currentUser?.role === 'kepala_madrasah';

  const canRatify =
    currentUser?.role === 'kepala_madrasah' || currentUser?.role === 'administrator';

  const handleDecision = async (action: 'PROPOSE' | 'APPROVE') => {
    if (!currentPeriod || !recap) return;
    if (!recap.allClassesComplete) {
      addToast(
        'error',
        'Penilaian Belum Lengkap',
        'Peringkat dan pemenang final tidak dapat ditetapkan sebelum seluruh kelas dinilai lengkap oleh Penilai I dan Penilai II.'
      );
      return;
    }

    const chosenId = tieWinnerClassId || recap.topCandidates[0]?.classId;
    const chosenRow = recap.rows.find((r) => r.classId === chosenId);
    if (!chosenRow || chosenRow.averageScore === null) {
      addToast('error', 'Pemenang Tidak Valid', 'Pilih kelas kandidat pemenang terlebih dahulu.');
      return;
    }

    if (recap.hasExactTopTie && !tieResolutionNote.trim()) {
      addToast(
        'warning',
        'Catatan Seri Diperlukan',
        'Terdapat nilai seri identik. Mohon isi catatan keputusan panitia / Kepala Madrasah.'
      );
      return;
    }

    try {
      await submitWeeklyDecision({
        periodId: currentPeriod.id,
        winnerClassId: chosenRow.classId,
        winnerScore: chosenRow.averageScore,
        hasTie: recap.hasExactTopTie,
        tieResolutionNote,
        action,
      });
    } catch (err) {
      addToast('error', 'Gagal Memproses Keputusan', err instanceof Error ? err.message : String(err));
    }
  };

  const displayWinner = useMemo(() => {
    if (officialWeeklyResult) {
      return {
        className: officialWeeklyResult.winnerClassName,
        homeroomTeacher: officialWeeklyResult.winnerHomeroomTeacher,
        score: formatScore(officialWeeklyResult.winnerScore),
        statusLabel:
          officialWeeklyResult.status === 'APPROVED'
            ? `Disahkan Resmi (${officialWeeklyResult.approvedByName})`
            : 'Diunggah sebagai Usulan Koordinator',
      };
    }
    if (recap?.allClassesComplete && recap.topCandidates[0]) {
      const top = recap.topCandidates[0];
      return {
        className: top.className,
        homeroomTeacher: top.homeroomTeacherName,
        score: formatScore(top.averageScore),
        statusLabel: 'Kandidat Peringkat 1 — Menunggu Pengesahan',
      };
    }
    return null;
  }, [officialWeeklyResult, recap]);

  return (
    <div className="space-y-6">
      {/* Filter & Export Bar */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <label className="block font-medium text-slate-600 mb-1">Bulan</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium"
            >
              {INDONESIAN_MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-600 mb-1">Tahun</label>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-600 mb-1">Pilih Pekan</label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
            >
              {filteredPeriods.length > 0 ? (
                filteredPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    Pekan Ke-{p.weekNumber} ({formatIndonesianDate(p.scheduledDate)})
                  </option>
                ))
              ) : (
                <option value="">Tidak ada jadwal pada bulan ini</option>
              )}
            </select>
          </div>
        </div>

        {currentPeriod && recap && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Laporan
            </button>
            <button
              type="button"
              onClick={() =>
                downloadLampiran2Pdf(recap.rows, currentPeriod, settings, officialWeeklyResult)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh PDF Lampiran 2
            </button>
            <button
              type="button"
              onClick={() =>
                exportLampiran2Excel(recap.rows, currentPeriod, settings, displayWinner || undefined)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Ekspor Excel
            </button>
          </div>
        )}
      </div>

      {currentPeriod && recap ? (
        <>
          {/* Official Document Header & Table (Lampiran 2) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6">
            <div className="text-center border-b border-slate-200 pb-4 space-y-1">
              <div className="text-xs font-bold tracking-wider text-emerald-800">
                {settings.schoolName.toUpperCase()} — TAHUN PELAJARAN {settings.academicYear}
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                LAMPIRAN 2 — REKAPITULASI NILAI MINGGUAN
              </h2>
              <p className="text-xs text-slate-600">
                Pekan Ke-{currentPeriod.weekNumber} · Bulan{' '}
                {INDONESIAN_MONTHS[currentPeriod.month - 1]} {currentPeriod.year} · Tema: &ldquo;
                {currentPeriod.theme}&rdquo;
              </p>
            </div>

            {!recap.allClassesComplete && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Status Rekapitulasi: Belum Lengkap ({recap.incompleteCount} kelas belum selesai).</strong>{' '}
                  Sesuai ketentuan lomba, kelas yang belum dinilai lengkap oleh Penilai I dan
                  Penilai II tidak dianggap bernilai nol dan peringkat final belum ditetapkan hingga
                  seluruh nilai sah tersedia.
                </div>
              </div>
            )}

            {/* Lampiran 2 Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-emerald-950 text-white">
                    <th className="py-3 px-3 font-semibold text-center w-12">No.</th>
                    <th className="py-3 px-4 font-semibold">Kelas</th>
                    <th className="py-3 px-4 font-semibold">Wali Kelas</th>
                    <th className="py-3 px-3 font-semibold text-right">Skor Penilai I</th>
                    <th className="py-3 px-3 font-semibold text-right">Skor Penilai II</th>
                    <th className="py-3 px-3 font-semibold text-right">Rata-rata</th>
                    <th className="py-3 px-3 font-semibold text-right">Aspek A/B/C/D</th>
                    <th className="py-3 px-3 font-semibold text-center">Peringkat</th>
                    <th className="py-3 px-4 font-semibold">Status &amp; Pemecah Seri</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recap.rows.map((r, idx) => (
                    <tr
                      key={r.classId}
                      className={
                        r.rank === 1
                          ? 'bg-emerald-50/60 font-medium'
                          : 'hover:bg-slate-50/70'
                      }
                    >
                      <td className="py-2.5 px-3 text-center font-mono-num text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{r.className}</td>
                      <td className="py-2.5 px-4 text-slate-700">{r.homeroomTeacherName}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num">
                        {r.scoreJudge1 !== null ? formatScore(r.scoreJudge1) : 'Belum Dinilai'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num">
                        {r.scoreJudge2 !== null ? formatScore(r.scoreJudge2) : 'Belum Dinilai'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-bold text-emerald-900">
                        {r.averageScore !== null ? formatScore(r.averageScore) : 'Belum Lengkap'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-[11px] text-slate-500">
                        {r.isComplete
                          ? `${formatScore(r.avgAspectA, 1)} / ${formatScore(r.avgAspectB, 1)} / ${formatScore(r.avgAspectC, 1)} / ${formatScore(r.avgAspectD, 1)}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono-num font-bold text-slate-900">
                        {r.rank !== null ? r.rank : 'Belum Final'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {r.isComplete ? (
                          <span>
                            Lengkap{r.tieBreakReason ? ` · ${r.tieBreakReason}` : ''}
                          </span>
                        ) : (
                          <span className="text-amber-800 font-medium">
                            {r.completionLabel} (Kurang Penilai {r.missingJudges.join(' & ')})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-slate-500">
              Rumus: Rata-rata = (Skor Penilai I + Skor Penilai II) / 2 · Aturan Pemecah Seri
              Transparan: Rata-rata Tertinggi → Nilai Aspek A → Aspek B → Aspek C → Aspek D → Nilai
              Seri (Keputusan Panitia/Kepala Madrasah). Nama penilai tidak memengaruhi peringkat.
            </div>

            {/* Bottom Summary & Signature Space (Lampiran 2 Mandatory Footer) */}
            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 p-4 rounded-xl bg-emerald-950 text-white space-y-2">
                <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold">
                  <Award className="w-4 h-4" />
                  <span>KELAS TERBAIK PEKAN KE-{currentPeriod.weekNumber}</span>
                </div>
                {displayWinner ? (
                  <>
                    <div className="text-xl font-bold">{displayWinner.className}</div>
                    <div className="text-xs text-emerald-100">
                      Wali Kelas: <strong>{displayWinner.homeroomTeacher}</strong>
                    </div>
                    <div className="text-xs text-emerald-100">
                      Nilai Akhir: <strong className="font-mono-num">{displayWinner.score}</strong>{' '}
                      · {displayWinner.statusLabel}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-emerald-200/80 py-2">
                    Menunggu seluruh kelas selesai dinilai oleh Penilai I dan Penilai II.
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 grid grid-cols-2 gap-6 text-xs text-center pt-2">
                <div className="space-y-14">
                  <div>
                    <div className="text-slate-600">Mengetahui,</div>
                    <div className="font-semibold text-slate-900">Kepala Madrasah</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 underline">
                      {settings.principalName}
                    </div>
                    {settings.principalNip && (
                      <div className="text-[11px] text-slate-500 font-mono-num">
                        NIP. {settings.principalNip}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-14">
                  <div>
                    <div className="text-slate-600">
                      {settings.location},{' '}
                      {formatIndonesianDate(
                        currentPeriod.ceremonyDate || currentPeriod.scheduledDate
                      )}
                    </div>
                    <div className="font-semibold text-slate-900">Koordinator Lomba</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 underline">
                      {settings.coordinatorName}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Official Proposal & Ratification Panel */}
          {recap.allClassesComplete && (canPropose || canRatify) && (
            <div className="no-print bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Panel Penetapan &amp; Pengesahan Pemenang Mingguan
                    </h3>
                    <p className="text-xs text-slate-500">
                      Koordinator mengusulkan hasil rekapitulasi; Kepala Madrasah mengesahkan pemenang resmi sebelum penerbitan sertifikat.
                    </p>
                  </div>
                </div>
                {officialWeeklyResult?.status === 'APPROVED' && (
                  <button
                    type="button"
                    onClick={() => setActiveMenu('certificates')}
                    className="px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Buka Generator Sertifikat
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Kelas Terbaik Pekan Ini
                  </label>
                  <select
                    disabled={
                      officialWeeklyResult?.status === 'APPROVED' &&
                      currentUser?.role !== 'administrator'
                    }
                    value={tieWinnerClassId}
                    onChange={(e) => setTieWinnerClassId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
                  >
                    {recap.topCandidates.map((cand) => (
                      <option key={cand.classId} value={cand.classId}>
                        {cand.className} — Rata-rata {formatScore(cand.averageScore)} (Wali:{' '}
                        {cand.homeroomTeacherName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Catatan Pengesahan / Keputusan Seri (Jika Ada)
                  </label>
                  <input
                    type="text"
                    disabled={
                      officialWeeklyResult?.status === 'APPROVED' &&
                      currentUser?.role !== 'administrator'
                    }
                    value={tieResolutionNote}
                    onChange={(e) => setTieResolutionNote(e.target.value)}
                    placeholder="Opsional (Wajib diisi apabila terdapat Nilai Seri identik)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                {canPropose && officialWeeklyResult?.status !== 'APPROVED' && (
                  <button
                    type="button"
                    onClick={() => handleDecision('PROPOSE')}
                    className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Simpan Usulan Koordinator
                  </button>
                )}
                {canRatify &&
                  (officialWeeklyResult?.status !== 'APPROVED' ||
                    currentUser?.role === 'administrator') && (
                    <button
                      type="button"
                      onClick={() => handleDecision('APPROVE')}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Tetapkan &amp; Sahkan Pemenang Mingguan
                    </button>
                  )}
              </div>
            </div>
          )}

          {/* Weekly History List */}
          <div className="no-print bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-xs font-semibold text-slate-900">
                Riwayat Pengesahan Rekapitulasi Mingguan
              </h3>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {weeklyResults.length > 0 ? (
                weeklyResults.map((w) => (
                  <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold text-slate-900">
                        Pekan Ke-{w.weekNumber} {INDONESIAN_MONTHS[w.month - 1]} {w.year}
                      </span>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span className="text-emerald-800 font-semibold">{w.winnerClassName}</span>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span className="text-slate-600">Wali: {w.winnerHomeroomTeacher}</span>
                    </div>
                    <div className="font-mono-num text-slate-700">
                      Skor <strong>{formatScore(w.winnerScore)}</strong> ·{' '}
                      {w.status === 'APPROVED' ? 'Disahkan' : 'Usulan'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-5 text-center text-slate-400">
                  Belum ada riwayat keputusan mingguan.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
          Pilih bulan dan periode pekan yang memiliki jadwal penilaian untuk melihat Lampiran 2.
        </div>
      )}
    </div>
  );
};
