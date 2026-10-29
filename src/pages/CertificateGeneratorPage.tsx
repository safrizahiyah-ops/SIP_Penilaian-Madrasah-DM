import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Ban,
  CheckCircle2,
  Download,
  FolderDown,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import { INDONESIAN_MONTHS } from '../constants/rubric';
import { useApp } from '../context/AppContext';
import { Certificate } from '../types';
import {
  formatIndonesianDate,
  formatScore,
  generateCertificateNumber,
} from '../utils/calculations';
import {
  downloadBatchCertificatesPdf,
  downloadSingleCertificatePdf,
} from '../utils/pdfGenerator';

export const CertificateGeneratorPage: React.FC = () => {
  const {
    weeklyResults,
    certificates,
    settings,
    currentUser,
    issueCertificate,
    revokeCertificate,
    addToast,
  } = useApp();

  const approvedWeeklyWins = useMemo(
    () =>
      weeklyResults
        .filter((w) => w.status === 'APPROVED')
        .sort((a, b) =>
          b.year !== a.year
            ? b.year - a.year
            : b.month !== a.month
              ? b.month - a.month
              : b.weekNumber - a.weekNumber
        ),
    [weeklyResults]
  );

  const [selectedWinId, setSelectedWinId] = useState(approvedWeeklyWins[0]?.id || '');
  const [recipientDisplay, setRecipientDisplay] = useState('');
  const [roleTitle, setRoleTitle] = useState('PEMENANG / KELAS TERBAIK MINGGUAN');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [principalName, setPrincipalName] = useState(settings.principalName);
  const [vicePrincipalName, setVicePrincipalName] = useState(settings.vicePrincipalName);
  const [reissueMode, setReissueMode] = useState(false);

  const [revokeModalCert, setRevokeModalCert] = useState<Certificate | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedWinId && approvedWeeklyWins[0]) {
      setSelectedWinId(approvedWeeklyWins[0].id);
    }
  }, [approvedWeeklyWins, selectedWinId]);

  const selectedWin = useMemo(
    () => approvedWeeklyWins.find((w) => w.id === selectedWinId) || null,
    [approvedWeeklyWins, selectedWinId]
  );

  const existingCertificateForWin = useMemo(() => {
    if (!selectedWin) return null;
    return (
      certificates.find(
        (c) =>
          c.awardType === 'WEEKLY' &&
          c.periodId === selectedWin.periodId &&
          c.classId === selectedWin.winnerClassId
      ) || null
    );
  }, [certificates, selectedWin]);

  useEffect(() => {
    if (existingCertificateForWin) {
      setRecipientDisplay(existingCertificateForWin.recipientDisplay);
      setRoleTitle(existingCertificateForWin.roleTitle);
      setIssueDate(existingCertificateForWin.issueDate);
      setPrincipalName(existingCertificateForWin.principalName);
      setVicePrincipalName(existingCertificateForWin.vicePrincipalName);
      setReissueMode(false);
    } else if (selectedWin) {
      setRecipientDisplay(
        `KELAS ${selectedWin.winnerClassName} (Wali Kelas: ${selectedWin.winnerHomeroomTeacher})`
      );
      setRoleTitle('PEMENANG / KELAS TERBAIK MINGGUAN');
      setIssueDate(new Date().toISOString().slice(0, 10));
      setPrincipalName(settings.principalName);
      setVicePrincipalName(settings.vicePrincipalName);
      setReissueMode(false);
    }
  }, [existingCertificateForWin, selectedWin, settings.principalName, settings.vicePrincipalName]);

  const previewCertificate: Certificate | null = useMemo(() => {
    if (!selectedWin) return null;
    const maxSeq = certificates.reduce((m, c) => Math.max(m, c.sequenceNumber || 0), 0);
    const seq = existingCertificateForWin ? existingCertificateForWin.sequenceNumber : maxSeq + 1;
    const yr = Number(issueDate.slice(0, 4)) || selectedWin.year;
    const mo = Number(issueDate.slice(5, 7)) || selectedWin.month;
    const certNo = existingCertificateForWin
      ? existingCertificateForWin.certificateNumber
      : generateCertificateNumber(settings.certificateFormat, yr, mo, seq);

    return {
      id: existingCertificateForWin?.id || `preview_${selectedWin.id}`,
      certificateNumber: certNo,
      sequenceNumber: seq,
      awardType: 'WEEKLY',
      periodId: selectedWin.periodId,
      periodLabel: `Pekan Ke-${selectedWin.weekNumber} Bulan ${INDONESIAN_MONTHS[selectedWin.month - 1]} ${selectedWin.year}`,
      classId: selectedWin.winnerClassId,
      className: selectedWin.winnerClassName,
      homeroomTeacherName: selectedWin.winnerHomeroomTeacher,
      recipientDisplay,
      roleTitle,
      finalScore: selectedWin.winnerScore,
      issueDate,
      principalName,
      vicePrincipalName,
      status: existingCertificateForWin?.status || 'ISSUED',
      reissueCount: existingCertificateForWin?.reissueCount || 0,
      revokedReason: existingCertificateForWin?.revokedReason || '',
      revokedByName: existingCertificateForWin?.revokedByName || '',
      issuedByUid: currentUser?.uid || '',
      issuedByName: currentUser?.displayName || '',
      readerUids: [],
    };
  }, [
    selectedWin,
    certificates,
    existingCertificateForWin,
    issueDate,
    settings.certificateFormat,
    recipientDisplay,
    roleTitle,
    principalName,
    vicePrincipalName,
    currentUser,
  ]);

  const canIssue =
    currentUser?.role === 'administrator' ||
    currentUser?.role === 'kepala_madrasah' ||
    currentUser?.role === 'koordinator';

  const canRevoke =
    currentUser?.role === 'administrator' || currentUser?.role === 'kepala_madrasah';

  const handleIssue = async () => {
    if (!selectedWin || !previewCertificate) return;
    setBusy(true);
    try {
      await issueCertificate({
        awardType: 'WEEKLY',
        periodId: selectedWin.periodId,
        periodLabel: previewCertificate.periodLabel,
        classId: selectedWin.winnerClassId,
        recipientDisplay,
        roleTitle,
        finalScore: selectedWin.winnerScore,
        issueDate,
        principalName,
        vicePrincipalName,
        isReissue: reissueMode || existingCertificateForWin?.status === 'REVOKED',
      });
      setReissueMode(false);
    } catch (err) {
      addToast('error', 'Gagal Menerbitkan Sertifikat', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadSingle = async (cert: Certificate) => {
    setBusy(true);
    try {
      await downloadSingleCertificatePdf(cert, settings);
      addToast('success', 'PDF Sertifikat Diunduh', `Nomor: ${cert.certificateNumber}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadAll = async () => {
    const active = certificates.filter((c) => c.status === 'ISSUED');
    if (active.length === 0) {
      addToast('info', 'Belum Ada Sertifikat Aktif', 'Terbitkan sertifikat terlebih dahulu.');
      return;
    }
    setBusy(true);
    try {
      await downloadBatchCertificatesPdf(active, settings);
      addToast('success', 'Seluruh Sertifikat Diunduh', `${active.length} sertifikat dalam 1 berkas PDF A4 Landscape.`);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeModalCert) return;
    try {
      await revokeCertificate(revokeModalCert.id, revokeReason);
      setRevokeModalCert(null);
      setRevokeReason('');
    } catch (err) {
      addToast('error', 'Gagal Membatalkan', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Control & Correction Panel */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Generator Sertifikat Penghargaan Otomatis (A4 Landscape)
            </h2>
            <p className="text-xs text-slate-500">
              Terhubung ke hasil pengesahan mingguan resmi dengan penomoran unik permanen{' '}
              <code className="font-mono-num">{settings.certificateFormat}</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleDownloadAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <FolderDown className="w-4 h-4 text-emerald-700" />
              Unduh Semua Sertifikat ({certificates.filter((c) => c.status === 'ISSUED').length})
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Cetak Sertifikat
            </button>
          </div>
        </div>

        {approvedWeeklyWins.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Pilih Periode Kemenangan Resmi (Telah Disahkan)
              </label>
              <select
                value={selectedWinId}
                onChange={(e) => setSelectedWinId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
              >
                {approvedWeeklyWins.map((w) => (
                  <option key={w.id} value={w.id}>
                    Pekan Ke-{w.weekNumber} {INDONESIAN_MONTHS[w.month - 1]} {w.year} — Kelas{' '}
                    {w.winnerClassName} (Skor {formatScore(w.winnerScore)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Tanggal Penerbitan Sertifikat
              </label>
              <input
                type="date"
                value={issueDate}
                disabled={Boolean(existingCertificateForWin && existingCertificateForWin.status === 'ISSUED' && !reissueMode)}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num disabled:bg-slate-50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Nama Penerima pada Sertifikat (Dapat Dikoreksi Sebelum Diterbitkan)
              </label>
              <input
                type="text"
                value={recipientDisplay}
                disabled={Boolean(existingCertificateForWin && existingCertificateForWin.status === 'ISSUED' && !reissueMode)}
                onChange={(e) => setRecipientDisplay(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Predikat Penghargaan</label>
              <input
                type="text"
                value={roleTitle}
                disabled={Boolean(existingCertificateForWin && existingCertificateForWin.status === 'ISSUED' && !reissueMode)}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Nama Kepala Madrasah</label>
              <input
                type="text"
                value={principalName}
                disabled={Boolean(existingCertificateForWin && existingCertificateForWin.status === 'ISSUED' && !reissueMode)}
                onChange={(e) => setPrincipalName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Wakil Kepala Madrasah Bidang Kesiswaan
              </label>
              <input
                type="text"
                value={vicePrincipalName}
                disabled={Boolean(existingCertificateForWin && existingCertificateForWin.status === 'ISSUED' && !reissueMode)}
                onChange={(e) => setVicePrincipalName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div className="flex items-end justify-end gap-2">
              {existingCertificateForWin && existingCertificateForWin.status === 'ISSUED' ? (
                <>
                  {canIssue && !reissueMode && (
                    <button
                      type="button"
                      onClick={() => setReissueMode(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-200 hover:bg-amber-300 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Koreksi &amp; Terbitkan Ulang
                    </button>
                  )}
                  {reissueMode && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleIssue}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Simpan Penerbitan Ulang
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDownloadSingle(existingCertificateForWin)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    Unduh Sertifikat PDF
                  </button>
                </>
              ) : (
                canIssue && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleIssue}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Award className="w-4 h-4" />
                    {existingCertificateForWin?.status === 'REVOKED'
                      ? 'Terbitkan Ulang Sertifikat'
                      : 'Terbitkan & Simpan Sertifikat'}
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
            Belum ada pemenang mingguan yang disahkan. Sahkan pemenang terlebih dahulu pada menu
            Rekapitulasi Nilai Mingguan (Lampiran 2).
          </div>
        )}
      </div>

      {/* Live A4 Landscape Certificate Visual Preview (Print-Clean) */}
      {previewCertificate && (
        <div className="print-landscape bg-[#fdfbf7] border-4 border-emerald-950 rounded-lg p-3 sm:p-5 shadow-xs relative overflow-hidden max-w-[1050px] mx-auto aspect-[297/210] flex flex-col justify-between">
          {/* Soft Building Backdrop Watermark if Uploaded */}
          {settings.buildingDataUrl && (
            <img
              src={settings.buildingDataUrl}
              alt="Bangunan MA Darul Mahfudz"
              referrerPolicy="no-referrer"
              className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] object-cover opacity-[0.08] pointer-events-none select-none"
            />
          )}

          {/* Inner Ornamental Gold & Emerald Frame */}
          <div className="relative z-10 flex-1 border-2 border-amber-500/80 p-4 sm:p-8 flex flex-col items-center justify-between text-center">
            {/* Top Logo & Madrasah Identity */}
            <div className="flex flex-col items-center space-y-1.5">
              {settings.logoDataUrl ? (
                <img
                  src={settings.logoDataUrl}
                  alt="Logo Resmi MA Darul Mahfudz"
                  referrerPolicy="no-referrer"
                  className="h-14 sm:h-16 w-auto object-contain"
                />
              ) : (
                <div className="w-14 h-14 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400 px-2">
                  Area Logo Madrasah
                </div>
              )}
              <div className="text-[11px] sm:text-xs font-bold tracking-widest text-emerald-950">
                {settings.schoolName.toUpperCase()}
              </div>
            </div>

            {/* Title & Gold Ribbon */}
            <div className="space-y-1.5 my-1">
              <div className="font-serif-formal text-3xl sm:text-5xl font-bold tracking-wider text-emerald-950 leading-none">
                SERTIFIKAT
              </div>
              <div className="inline-block bg-amber-600 text-white text-[10px] sm:text-xs font-bold tracking-[0.25em] px-5 py-1 rounded-xs">
                PENGHARGAAN
              </div>
              <div className="text-[10px] sm:text-xs font-mono-num text-slate-500 pt-0.5">
                Nomor: {previewCertificate.certificateNumber}
              </div>
            </div>

            {/* Recipient & Competition Body */}
            <div className="space-y-2 max-w-3xl">
              <div className="font-serif-formal italic text-xs sm:text-base text-slate-600">
                Diberikan kepada:
              </div>
              <div className="font-serif-formal text-xl sm:text-3xl font-bold text-emerald-950 border-b border-amber-500/70 pb-1 px-4">
                {previewCertificate.recipientDisplay}
              </div>
              <div className="font-serif-formal italic text-xs sm:text-sm text-slate-600 pt-0.5">
                Sebagai:
              </div>
              <div className="text-xs sm:text-base font-bold text-amber-800 tracking-wide">
                {previewCertificate.roleTitle}
              </div>
              <div className="text-[11px] sm:text-sm font-bold text-emerald-950">
                LOMBA PENATAAN (BERTEMA) DAN KEBERSIHAN KELAS
              </div>
              <div className="text-[10px] sm:text-xs text-slate-700">
                Antar Kelas Perebutan Piala Bergilir Kepala Madrasah · Tahun Pelajaran{' '}
                {settings.academicYear} ({previewCertificate.periodLabel})
              </div>
              <p className="font-serif-formal italic text-[11px] sm:text-sm text-slate-600 max-w-2xl mx-auto pt-1">
                &ldquo;Semoga prestasi ini menjadi motivasi untuk terus berkarya, berinovasi, dan
                menjaga lingkungan madrasah yang bersih, indah, dan nyaman.&rdquo;
              </p>
            </div>

            {/* Dual Signatories & Center Medal */}
            <div className="w-full grid grid-cols-3 items-end pt-4 text-[10px] sm:text-xs">
              <div className="space-y-8 sm:space-y-12 text-center">
                <div className="text-slate-700">Wakil Kepala Madrasah Bidang Kesiswaan</div>
                <div>
                  <div className="font-bold text-slate-900 underline">
                    {previewCertificate.vicePrincipalName}
                  </div>
                  {settings.vicePrincipalNip && (
                    <div className="text-[10px] font-mono-num text-slate-500">
                      NIP. {settings.vicePrincipalNip}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-950 border-4 border-amber-500 flex flex-col items-center justify-center text-amber-300 shadow-xs">
                  <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[9px] font-mono-num font-bold">
                    {formatScore(previewCertificate.finalScore)}
                  </span>
                </div>
              </div>

              <div className="space-y-8 sm:space-y-12 text-center">
                <div>
                  <div className="text-slate-600">
                    {settings.location}, {formatIndonesianDate(previewCertificate.issueDate)}
                  </div>
                  <div className="text-slate-700">Kepala Madrasah</div>
                </div>
                <div>
                  <div className="font-bold text-slate-900 underline">
                    {previewCertificate.principalName}
                  </div>
                  {settings.principalNip && (
                    <div className="text-[10px] font-mono-num text-slate-500">
                      NIP. {settings.principalNip}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issued & Revoked Certificates Registry */}
      <div className="no-print bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">
            Daftar Sertifikat yang Telah Diterbitkan &amp; Riwayat Tindakan
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold">Nomor Sertifikat</th>
                <th className="py-3 px-4 font-semibold">Kelas Penerima</th>
                <th className="py-3 px-4 font-semibold">Periode</th>
                <th className="py-3 px-4 font-semibold">Tgl Terbit</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {certificates.length > 0 ? (
                certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono-num font-semibold text-slate-900">
                      {cert.certificateNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-900">
                      {cert.className} · <span className="font-normal text-slate-600">{cert.homeroomTeacherName}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{cert.periodLabel}</td>
                    <td className="py-3 px-4 font-mono-num text-slate-600">
                      {formatIndonesianDate(cert.issueDate)}
                    </td>
                    <td className="py-3 px-4">
                      {cert.status === 'ISSUED' ? (
                        <span className="text-emerald-800 font-medium">
                          Aktif{cert.reissueCount > 0 ? ` (Terbit Ulang #${cert.reissueCount})` : ''}
                        </span>
                      ) : (
                        <span className="text-red-700 font-medium">
                          Dibatalkan ({cert.revokedReason})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      {cert.status === 'ISSUED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDownloadSingle(cert)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 rounded-md cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                          {canRevoke && (
                            <button
                              type="button"
                              onClick={() => {
                                setRevokeModalCert(cert);
                                setRevokeReason('');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Batalkan
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada sertifikat yang diterbitkan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revoke Certificate Modal */}
      {revokeModalCert && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Batalkan Sertifikat Resmi</h3>
              <button
                type="button"
                onClick={() => setRevokeModalCert(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Anda akan membatalkan sertifikat{' '}
              <strong className="font-mono-num">{revokeModalCert.certificateNumber}</strong> milik{' '}
              <strong>{revokeModalCert.className}</strong>. Tindakan ini dicatat permanen pada
              riwayat audit.
            </p>
            <div className="text-xs">
              <label className="block font-medium text-slate-700 mb-1">
                Alasan Pembatalan Sertifikat (Wajib)
              </label>
              <textarea
                rows={3}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Contoh: Koreksi hasil revisi nilai sah panitia..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeModalCert(null)}
                className="px-4 py-2 text-xs border border-slate-200 rounded-lg text-slate-600"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Konfirmasi Pembatalan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
