import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  History,
  Printer,
  Save,
  X,
} from 'lucide-react';
import {
  createEmptyItemNotes,
  createEmptyScores,
  INDONESIAN_MONTHS,
  RUBRIC_GROUPS,
} from '../constants/rubric';
import { useApp } from '../context/AppContext';
import { Evaluation, JudgeNumber, RubricItemKey, ScoresMap } from '../types';
import { calculateEvaluationTotals, formatIndonesianDate } from '../utils/calculations';
import { exportLampiran1Excel } from '../utils/excelHelper';
import { downloadLampiran1Pdf } from '../utils/pdfGenerator';

export const EvaluationPage: React.FC = () => {
  const {
    classes,
    judges,
    judgingPeriods,
    evaluations,
    auditLogs,
    settings,
    currentUser,
    saveEvaluation,
    addToast,
  } = useApp();

  const activeClasses = useMemo(() => classes.filter((c) => c.active), [classes]);
  const activeJudges = useMemo(() => judges.filter((j) => j.active), [judges]);

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

  const defaultPeriodId = useMemo(() => {
    const open = sortedPeriods.find((p) => p.status === 'OPEN');
    return open?.id || sortedPeriods[0]?.id || '';
  }, [sortedPeriods]);

  const [periodId, setPeriodId] = useState(defaultPeriodId);
  const [classId, setClassId] = useState(activeClasses[0]?.id || '');
  const [judgeNumber, setJudgeNumber] = useState<JudgeNumber>(
    currentUser?.judgeSlot === 'II' ? 'II' : 'I'
  );
  const [judgeId, setJudgeId] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().slice(0, 10));
  const [theme, setTheme] = useState('');
  const [scores, setScores] = useState<ScoresMap>(() => createEmptyScores());
  const [itemNotes, setItemNotes] = useState(() => createEmptyItemNotes());
  const [generalNote, setGeneralNote] = useState('');
  const [revisionMode, setRevisionMode] = useState(false);
  const [previewEval, setPreviewEval] = useState<Evaluation | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync defaults when data loads
  useEffect(() => {
    if (!periodId && defaultPeriodId) setPeriodId(defaultPeriodId);
  }, [defaultPeriodId, periodId]);

  useEffect(() => {
    if (!classId && activeClasses[0]) setClassId(activeClasses[0].id);
  }, [activeClasses, classId]);

  useEffect(() => {
    if (currentUser?.judgeSlot === 'I' || currentUser?.judgeSlot === 'II') {
      setJudgeNumber(currentUser.judgeSlot);
    }
  }, [currentUser?.judgeSlot]);

  useEffect(() => {
    const matchingJudge = activeJudges.find((j) => j.judgeRole === judgeNumber) || activeJudges[0];
    if (matchingJudge) setJudgeId(matchingJudge.id);
  }, [judgeNumber, activeJudges]);

  const selectedPeriod = useMemo(
    () => judgingPeriods.find((p) => p.id === periodId) || null,
    [judgingPeriods, periodId]
  );

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId]
  );

  // Check if an evaluation already exists for (periodId, classId, judgeNumber)
  const existingEvaluation = useMemo(
    () =>
      evaluations.find(
        (e) => e.periodId === periodId && e.classId === classId && e.judgeNumber === judgeNumber
      ) || null,
    [evaluations, periodId, classId, judgeNumber]
  );

  // Load existing evaluation values or reset cleanly when selection changes
  useEffect(() => {
    if (existingEvaluation) {
      setEvaluationDate(existingEvaluation.evaluationDate);
      setTheme(existingEvaluation.theme);
      setJudgeId(existingEvaluation.judgeId);
      setScores({ ...existingEvaluation.scores });
      setItemNotes({ ...existingEvaluation.itemNotes });
      setGeneralNote(existingEvaluation.generalNote);
      setRevisionMode(false);
    } else {
      if (selectedPeriod) {
        setEvaluationDate(selectedPeriod.scheduledDate);
        setTheme(selectedPeriod.theme);
      }
      setScores(createEmptyScores());
      setItemNotes(createEmptyItemNotes());
      setGeneralNote('');
      setRevisionMode(false);
    }
  }, [existingEvaluation, selectedPeriod]);

  const totals = useMemo(() => calculateEvaluationTotals(scores), [scores]);

  const canWrite =
    currentUser?.role === 'administrator' || currentUser?.role === 'penilai';

  const isFormLocked =
    !canWrite || (Boolean(existingEvaluation) && !revisionMode);

  const handleScoreChange = (key: RubricItemKey, maxScore: number, rawValue: string) => {
    if (rawValue === '') {
      setScores((prev) => ({ ...prev, [key]: 0 }));
      return;
    }
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    if (parsed < 0) {
      addToast('warning', 'Batas Skor Minimum', 'Skor item penilaian tidak boleh negatif (minimal 0).');
      setScores((prev) => ({ ...prev, [key]: 0 }));
      return;
    }
    if (parsed > maxScore) {
      addToast('warning', 'Melebihi Skor Maksimal', `Skor maksimal untuk item ini adalah ${maxScore} poin.`);
      setScores((prev) => ({ ...prev, [key]: maxScore }));
      return;
    }
    setScores((prev) => ({ ...prev, [key]: parsed }));
  };

  const handleSave = async (targetStatus: 'DRAFT' | 'FINAL') => {
    if (!canWrite) {
      addToast('error', 'Akses Ditolak', 'Hanya Penilai dan Administrator yang dapat menyimpan lembar penilaian.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveEvaluation({
        periodId,
        evaluationDate,
        classId,
        theme,
        judgeId,
        judgeNumber,
        scores,
        itemNotes,
        generalNote,
        status: targetStatus,
        allowRevision: revisionMode,
      });
      setRevisionMode(false);
      setPreviewEval(saved);
    } catch (err) {
      addToast('error', 'Gagal Menyimpan Penilaian', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const buildCurrentDraftObject = (): Evaluation | null => {
    if (!selectedPeriod || !selectedClass) return null;
    const judgeObj = judges.find((j) => j.id === judgeId);
    return {
      id: existingEvaluation?.id || `preview_${periodId}_${classId}_${judgeNumber}`,
      periodId: selectedPeriod.id,
      weekNumber: selectedPeriod.weekNumber,
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      evaluationDate,
      classId: selectedClass.id,
      className: selectedClass.name,
      homeroomTeacherName: selectedClass.homeroomTeacherName,
      theme,
      judgeId,
      judgeName: judgeObj?.fullName || 'Penilai',
      judgeNumber,
      scores,
      itemNotes,
      subtotalA: totals.subtotalA,
      subtotalB: totals.subtotalB,
      subtotalC: totals.subtotalC,
      subtotalD: totals.subtotalD,
      totalScore: totals.totalScore,
      generalNote,
      status: existingEvaluation?.status || 'DRAFT',
      revisionCount: existingEvaluation?.revisionCount || 0,
      readerUids: [],
      createdBy: currentUser?.uid || '',
      updatedBy: currentUser?.uid || '',
    };
  };

  const evaluationAuditHistory = useMemo(
    () =>
      auditLogs
        .filter((l) => l.module === 'Penilaian Mingguan')
        .slice(0, 10),
    [auditLogs]
  );

  return (
    <div className="space-y-6">
      {/* Identity Section — Lampiran 1 */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-medium text-emerald-800">
              LAMPIRAN 1 — FORMULIR DIGITAL RESMI
            </div>
            <h2 className="text-base lg:text-lg font-bold text-slate-900">
              Lembar Penilaian Lomba Penataan (Bertema) dan Kebersihan Kelas
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            {existingEvaluation && canWrite && !revisionMode && (
              <button
                type="button"
                onClick={() => setRevisionMode(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit / Revisi Penilaian
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const obj = existingEvaluation || buildCurrentDraftObject();
                if (obj) setPreviewEval(obj);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Lihat Pratinjau
            </button>
            <button
              type="button"
              onClick={() => {
                const obj = existingEvaluation || buildCurrentDraftObject();
                if (obj) downloadLampiran1Pdf(obj, settings);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh PDF
            </button>
            <button
              type="button"
              onClick={() => {
                const obj = existingEvaluation || buildCurrentDraftObject();
                if (obj) exportLampiran1Excel(obj, settings);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Ekspor Excel
            </button>
          </div>
        </div>

        {/* Status notice if already evaluated */}
        {existingEvaluation && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Lembar penilaian <strong>Penilai {existingEvaluation.judgeNumber}</strong> untuk{' '}
                <strong>{existingEvaluation.className}</strong> sudah tersimpan dengan status{' '}
                <strong>{existingEvaluation.status}</strong> (Total Skor:{' '}
                <strong className="font-mono-num">{existingEvaluation.totalScore}/100</strong> ·
                Revisi ke-{existingEvaluation.revisionCount}).
              </span>
            </div>
            {revisionMode && (
              <span className="font-semibold text-amber-800">
                Mode Revisi Aktif — Perubahan akan dicatat di Riwayat Audit
              </span>
            )}
          </div>
        )}

        {/* Identity Form Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Periode Pekan &amp; Bulan</label>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium"
            >
              {sortedPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  Pekan Ke-{p.weekNumber} · {INDONESIAN_MONTHS[p.month - 1]} {p.year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Hari / Tanggal Penilaian</label>
            <input
              type="date"
              disabled={isFormLocked}
              value={evaluationDate}
              onChange={(e) => setEvaluationDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Kelas yang Dinilai</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
            >
              {activeClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Nama Wali Kelas</label>
            <input
              type="text"
              readOnly
              value={selectedClass?.homeroomTeacherName || '—'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">Tema Kelas</label>
            <input
              type="text"
              disabled={isFormLocked}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Tema penataan kelas pekan berjalan"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Jenis Penilai</label>
            <select
              disabled={
                currentUser?.role === 'penilai' &&
                (currentUser.judgeSlot === 'I' || currentUser.judgeSlot === 'II')
              }
              value={judgeNumber}
              onChange={(e) => setJudgeNumber(e.target.value as JudgeNumber)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold disabled:bg-slate-50"
            >
              <option value="I">Penilai I</option>
              <option value="II">Penilai II</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Nama Penilai</label>
            <select
              disabled={isFormLocked}
              value={judgeId}
              onChange={(e) => setJudgeId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white disabled:bg-slate-50"
            >
              {activeJudges.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.fullName} (Penilai {j.judgeRole})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Rubric Aspects A, B, C, D */}
      <div className="space-y-5">
        {RUBRIC_GROUPS.map((group) => {
          const groupSubtotal =
            group.code === 'A'
              ? totals.subtotalA
              : group.code === 'B'
                ? totals.subtotalB
                : group.code === 'C'
                  ? totals.subtotalC
                  : totals.subtotalD;

          return (
            <div key={group.code} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 bg-emerald-950 text-white flex items-center justify-between gap-4">
                <h3 className="text-xs lg:text-sm font-bold tracking-wide">
                  {group.title.toUpperCase()} — MAKSIMAL {group.maxSubtotal} POIN
                </h3>
                <div className="text-xs font-mono-num font-semibold text-amber-300 shrink-0">
                  Jumlah {group.code}: {groupSubtotal} / {group.maxSubtotal}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 px-4 font-semibold w-12">No.</th>
                      <th className="py-2.5 px-4 font-semibold">Item Penilaian</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-28">Skor Maksimal</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-32">Skor Penilai</th>
                      <th className="py-2.5 px-4 font-semibold">Catatan / Komentar Item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <tr key={item.key} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-mono-num text-slate-500">{item.number}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{item.label}</td>
                        <td className="py-2.5 px-4 text-center font-mono-num font-semibold text-slate-600">
                          {item.maxScore}
                        </td>
                        <td className="py-2 px-4 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            max={item.maxScore}
                            disabled={isFormLocked}
                            value={scores[item.key]}
                            onChange={(e) => handleScoreChange(item.key, item.maxScore, e.target.value)}
                            className="w-20 text-center px-2 py-1.5 border border-slate-300 rounded-md font-mono-num font-bold text-slate-900 focus:outline-none focus:border-emerald-700 disabled:bg-slate-100"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            disabled={isFormLocked}
                            value={itemNotes[item.key]}
                            onChange={(e) =>
                              setItemNotes((prev) => ({ ...prev, [item.key]: e.target.value }))
                            }
                            placeholder="Catatan singkat (opsional)..."
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs disabled:bg-slate-50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50/60 border-t border-slate-200 font-semibold text-slate-900">
                      <td className="py-2.5 px-4" />
                      <td className="py-2.5 px-4">Jumlah {group.code}</td>
                      <td className="py-2.5 px-4 text-center font-mono-num">{group.maxSubtotal}</td>
                      <td className="py-2.5 px-4 text-center font-mono-num text-emerald-900 text-sm">
                        {groupSubtotal}
                      </td>
                      <td className="py-2.5 px-4" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grand Total & General Note & Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500">Jumlah A (Maks 45)</div>
            <div className="text-lg font-bold font-mono-num text-slate-900">{totals.subtotalA}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500">Jumlah B (Maks 35)</div>
            <div className="text-lg font-bold font-mono-num text-slate-900">{totals.subtotalB}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500">Jumlah C (Maks 10)</div>
            <div className="text-lg font-bold font-mono-num text-slate-900">{totals.subtotalC}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500">Jumlah D (Maks 10)</div>
            <div className="text-lg font-bold font-mono-num text-slate-900">{totals.subtotalD}</div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 rounded-lg bg-emerald-950 text-white">
            <div className="text-[11px] text-amber-300">TOTAL SKOR (0–100)</div>
            <div className="text-2xl font-bold font-mono-num">{totals.totalScore}</div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Catatan Umum / Apresiasi &amp; Saran Perbaikan Penilai
          </label>
          <textarea
            rows={2}
            disabled={isFormLocked}
            value={generalNote}
            onChange={(e) => setGeneralNote(e.target.value)}
            placeholder="Tuliskan catatan umum kondisi kebersihan, kreativitas tema, atau saran perbaikan untuk kelas..."
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg disabled:bg-slate-50"
          />
        </div>

        {totals.errors.length > 0 && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{totals.errors[0]}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Cetak Lembar Penilaian
          </button>

          {canWrite && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={saving || isFormLocked}
                onClick={() => handleSave('DRAFT')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Simpan sebagai Draf
              </button>
              <button
                type="button"
                disabled={saving || isFormLocked}
                onClick={() => handleSave('FINAL')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg disabled:opacity-40 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {revisionMode ? 'Simpan Revisi Penilaian' : 'Simpan Penilaian (Final)'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Audit History of Evaluation Changes */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-700" />
          <h3 className="text-xs font-semibold text-slate-900">
            Riwayat Input &amp; Perubahan Nilai Penilaian
          </h3>
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {evaluationAuditHistory.length > 0 ? (
            evaluationAuditHistory.map((log) => (
              <div key={log.id} className="px-5 py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-semibold text-slate-800">{log.actorName}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="text-slate-600">{log.summary}</span>
                </div>
                <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                  {log.action}
                </span>
              </div>
            ))
          ) : (
            <div className="p-5 text-center text-slate-400">
              Belum ada riwayat perubahan penilaian yang tercatat.
            </div>
          )}
        </div>
      </div>

      {/* Lampiran 1 Print-Ready Preview Modal */}
      {previewEval && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 lg:p-8 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs font-semibold text-emerald-800">
                  PRATINJAU DOKUMEN RESMI — LAMPIRAN 1
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {previewEval.className} · Penilai {previewEval.judgeNumber} ({previewEval.judgeName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEval(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div>
                <strong>Pekan / Bulan:</strong> Pekan Ke-{previewEval.weekNumber} /{' '}
                {INDONESIAN_MONTHS[previewEval.month - 1]} {previewEval.year}
              </div>
              <div>
                <strong>Kelas / Wali:</strong> {previewEval.className} /{' '}
                {previewEval.homeroomTeacherName}
              </div>
              <div>
                <strong>Tanggal:</strong> {formatIndonesianDate(previewEval.evaluationDate)}
              </div>
              <div>
                <strong>Tema:</strong> {previewEval.theme}
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-emerald-950 text-white">
                  <tr>
                    <th className="p-2">Aspek</th>
                    <th className="p-2 text-center">Skor Maksimal</th>
                    <th className="p-2 text-center">Skor Diperoleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2">A. Kebersihan dan Kerapian Kelas</td>
                    <td className="p-2 text-center font-mono-num">45</td>
                    <td className="p-2 text-center font-mono-num font-semibold">{previewEval.subtotalA}</td>
                  </tr>
                  <tr>
                    <td className="p-2">B. Penataan Kelas Bertema</td>
                    <td className="p-2 text-center font-mono-num">35</td>
                    <td className="p-2 text-center font-mono-num font-semibold">{previewEval.subtotalB}</td>
                  </tr>
                  <tr>
                    <td className="p-2">C. Kelengkapan Perangkat dan Tata Ruang Kelas</td>
                    <td className="p-2 text-center font-mono-num">10</td>
                    <td className="p-2 text-center font-mono-num font-semibold">{previewEval.subtotalC}</td>
                  </tr>
                  <tr>
                    <td className="p-2">D. Partisipasi dan Kedisiplinan</td>
                    <td className="p-2 text-center font-mono-num">10</td>
                    <td className="p-2 text-center font-mono-num font-semibold">{previewEval.subtotalD}</td>
                  </tr>
                  <tr className="bg-emerald-50 font-bold">
                    <td className="p-2">TOTAL SKOR AKHIR (A + B + C + D)</td>
                    <td className="p-2 text-center font-mono-num">100</td>
                    <td className="p-2 text-center font-mono-num text-emerald-900">
                      {previewEval.totalScore}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => downloadLampiran1Pdf(previewEval, settings)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh PDF Lampiran 1
              </button>
              <button
                type="button"
                onClick={() => exportLampiran1Excel(previewEval, settings)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Ekspor Excel
              </button>
              <button
                type="button"
                onClick={() => setPreviewEval(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
