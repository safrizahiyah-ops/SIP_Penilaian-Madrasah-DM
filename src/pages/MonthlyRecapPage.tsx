import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { INDONESIAN_MONTHS } from '../constants/rubric';
import { useApp } from '../context/AppContext';
import { computeMonthlyRecap, formatIndonesianDate, formatScore } from '../utils/calculations';
import { exportLampiran3Excel } from '../utils/excelHelper';
import { downloadLampiran3Pdf } from '../utils/pdfGenerator';

export const MonthlyRecapPage: React.FC = () => {
  const {
    classes,
    judgingPeriods,
    evaluations,
    weeklyResults,
    monthlyResults,
    certificates,
    settings,
    currentUser,
    submitMonthlyDecision,
    setActiveMenu,
    addToast,
  } = useApp();

  const [month, setMonth] = useState(10);
  const [year, setYear] = useState(2026);

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

  const officialMonthly = useMemo(
    () => monthlyResults.find((m) => m.month === month && m.year === year) || null,
    [monthlyResults, month, year]
  );

  const [selectedWinnerId, setSelectedWinnerId] = useState('');
  const [decisionNote, setDecisionNote] = useState('');

  useEffect(() => {
    if (officialMonthly) {
      setSelectedWinnerId(officialMonthly.winnerClassId);
      setDecisionNote(officialMonthly.principalDecisionNote);
    } else if (monthlyComp.topCandidates[0]) {
      setSelectedWinnerId(monthlyComp.topCandidates[0].classId);
      setDecisionNote('');
    }
  }, [officialMonthly, monthlyComp]);

  const canRatify =
    currentUser?.role === 'kepala_madrasah' || currentUser?.role === 'administrator';
  const canPropose =
    canRatify || currentUser?.role === 'koordinator';

  const handleMonthlySubmit = async (action: 'PROPOSE' | 'APPROVE') => {
    if (!monthlyComp.isMonthFullyFinalized) {
      addToast(
        'warning',
        'Periode Bulan Belum Final',
        'Seluruh pekan terjadwal pada bulan ini harus selesai dinilai dan disahkan terlebih dahulu sebelum pengesahan bulanan final.'
      );
      return;
    }

    const row = monthlyComp.rows.find((r) => r.classId === selectedWinnerId);
    if (!row) {
      addToast('error', 'Pilih Kelas Pemenang', 'Kelas pemenang bulanan belum dipilih.');
      return;
    }

    try {
      await submitMonthlyDecision({
        month,
        year,
        winnerClassId: row.classId,
        certificateCount: row.certificateCount,
        totalMonthlyScore: row.totalMonthlyScore,
        tieBreakerUsed: row.tieBreakerNote || 'Jumlah Sertifikat & Total Skor Kumulatif',
        principalDecisionNote: decisionNote,
        action,
      });
    } catch (err) {
      addToast('error', 'Gagal Menyimpan Keputusan', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter & Export Controls */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs">
          <div>
            <label className="block font-medium text-slate-600 mb-1">Bulan</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
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
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Lampiran 3
          </button>
          <button
            type="button"
            onClick={() =>
              downloadLampiran3Pdf(monthlyComp.rows, month, year, settings, officialMonthly)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh PDF Lampiran 3
          </button>
          <button
            type="button"
            onClick={() => exportLampiran3Excel(monthlyComp.rows, month, year, settings)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Ekspor Excel
          </button>
        </div>
      </div>

      {/* Lampiran 3 Official Document */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6">
        <div className="text-center border-b border-slate-200 pb-4 space-y-1">
          <div className="text-xs font-bold tracking-wider text-emerald-800">
            {settings.schoolName.toUpperCase()} — TAHUN PELAJARAN {settings.academicYear}
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            LAMPIRAN 3 — REKAPITULASI PEROLEHAN SERTIFIKAT BULANAN
          </h2>
          <p className="text-xs text-slate-600">
            Bulan: <strong>{INDONESIAN_MONTHS[month - 1]}</strong> · Tahun: <strong>{year}</strong>{' '}
            · Pemegang Piala Bergilir Saat Ini:{' '}
            <strong>{settings.currentTrophyClassName || 'Belum Ditetapkan'}</strong>
          </p>
        </div>

        {!monthlyComp.isMonthFullyFinalized && (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Status Periode: Belum Final.</strong> Terdapat jadwal pekan pada bulan{' '}
              {INDONESIAN_MONTHS[month - 1]} {year} yang belum lengkap dinilai atau belum disahkan.
              Skor pekan yang belum sah tidak dimasukkan ke perhitungan Total Skor Bulanan.
            </span>
          </div>
        )}

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-emerald-950 text-white">
                <th className="py-3 px-3 font-semibold text-center w-11">No.</th>
                <th className="py-3 px-4 font-semibold">Kelas</th>
                <th className="py-3 px-4 font-semibold">Wali Kelas</th>
                <th className="py-3 px-3 font-semibold text-center w-16">P1</th>
                <th className="py-3 px-3 font-semibold text-center w-16">P2</th>
                <th className="py-3 px-3 font-semibold text-center w-16">P3</th>
                <th className="py-3 px-3 font-semibold text-center w-16">P4</th>
                <th className="py-3 px-3 font-semibold text-center w-16">P5</th>
                <th className="py-3 px-3 font-semibold text-center">Jumlah Sertifikat</th>
                <th className="py-3 px-3 font-semibold text-right">Total Skor</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {monthlyComp.rows.map((r, idx) => (
                <tr
                  key={r.classId}
                  className={idx === 0 && r.certificateCount > 0 ? 'bg-emerald-50/50' : 'hover:bg-slate-50/70'}
                >
                  <td className="py-2.5 px-3 text-center font-mono-num text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-slate-900">{r.className}</td>
                  <td className="py-2.5 px-4 text-slate-700">{r.homeroomTeacherName}</td>
                  {([1, 2, 3, 4, 5] as const).map((wn) => {
                    const slot = r.weeks[wn];
                    return (
                      <td key={wn} className="py-2.5 px-2 text-center font-mono-num">
                        {slot.wonCertificate ? (
                          <span
                            title={`Pemenang Pekan ${wn} (${formatScore(slot.weeklyScore)})`}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-700 text-white"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : slot.periodId ? (
                          slot.isWeekFinal && slot.weeklyScore !== null ? (
                            <span className="text-slate-500">{formatScore(slot.weeklyScore, 1)}</span>
                          ) : (
                            <span className="text-amber-700 text-[10px]">Belum Final</span>
                          )
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-center font-mono-num font-bold text-amber-800 text-sm">
                    {r.certificateCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-num font-bold text-emerald-900">
                    {formatScore(r.totalMonthlyScore)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {r.hasUnfinalizedWeeks
                      ? 'Belum Final'
                      : r.tieBreakerNote || 'Sah / Final'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mandatory Consideration Rule Text (Requirement 9) */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-xs">
          <div className="font-semibold text-slate-900">
            Ketentuan Pertimbangan Penetapan Pemenang Bulanan:
          </div>
          <p className="text-slate-700 font-medium">
            &ldquo;{settings.winnerRuleText}&rdquo;
          </p>
          <p className="text-[11px] text-slate-500">
            Catatan: Urutan di atas merupakan mekanisme pertimbangan ketika beberapa kelas memiliki
            jumlah sertifikat Kelas Terbaik yang sama dalam satu bulan, sedangkan Total Skor Bulanan
            tetap dihitung dari jumlah skor akhir mingguan yang sah pada periode bulan terpilih.
          </p>
        </div>

        {/* Signature Block */}
        <div className="pt-3 flex justify-end text-xs">
          <div className="text-center space-y-14 pr-6">
            <div>
              <div className="text-slate-600">
                {settings.location}, {formatIndonesianDate(new Date().toISOString().slice(0, 10))}
              </div>
              <div className="font-semibold text-slate-900">Kepala Madrasah</div>
            </div>
            <div>
              <div className="font-bold text-slate-900 underline">{settings.principalName}</div>
              {settings.principalNip && (
                <div className="text-[11px] font-mono-num text-slate-500">
                  NIP. {settings.principalNip}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Ratification Panel */}
      {canPropose && (
        <div className="no-print bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pengesahan Pemenang Bulanan — {INDONESIAN_MONTHS[month - 1]} {year}
                </h3>
                <p className="text-xs text-slate-500">
                  Sahkan pemenang bulanan untuk dilanjutkan ke penetapan Piala Bergilir Kepala Madrasah.
                </p>
              </div>
            </div>

            {officialMonthly?.status === 'APPROVED' && (
              <button
                type="button"
                onClick={() => setActiveMenu('trophy')}
                className="px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-lg cursor-pointer whitespace-nowrap"
              >
                Lanjut ke Piala Bergilir
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Kandidat Kelas Pemenang Bulanan
              </label>
              <select
                value={selectedWinnerId}
                onChange={(e) => setSelectedWinnerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
              >
                {monthlyComp.rows.slice(0, 5).map((r) => (
                  <option key={r.classId} value={r.classId}>
                    {r.className} — {r.certificateCount} Sertifikat · Total Skor{' '}
                    {formatScore(r.totalMonthlyScore)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Catatan Keputusan Kepala Madrasah (Opsional / Jika Seri)
              </label>
              <input
                type="text"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Catatan pengesahan pemenang bulanan..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5">
            {officialMonthly?.status !== 'APPROVED' && (
              <button
                type="button"
                onClick={() => handleMonthlySubmit('PROPOSE')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Simpan Usulan Bulanan
              </button>
            )}
            {canRatify && (
              <button
                type="button"
                onClick={() => handleMonthlySubmit('APPROVE')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Sahkan Pemenang Bulanan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
