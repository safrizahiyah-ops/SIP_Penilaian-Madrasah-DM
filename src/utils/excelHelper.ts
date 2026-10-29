import * as XLSX from 'xlsx';
import { INDONESIAN_MONTHS, RUBRIC_GROUPS } from '../constants/rubric';
import {
  AppDatabaseSnapshot,
  ClassGrade,
  Evaluation,
  JudgingPeriod,
  SchoolSettings,
} from '../types';
import {
  formatScore,
  MonthlyClassRecapRow,
  WeeklyClassRecapRow,
} from './calculations';

export function exportLampiran1Excel(evaluation: Evaluation, settings: SchoolSettings): void {
  const rows: (string | number)[][] = [
    [settings.schoolName.toUpperCase()],
    ['LAMPIRAN 1 — LEMBAR PENILAIAN LOMBA PENATAAN (BERTEMA) DAN KEBERSIHAN KELAS'],
    [`Tahun Pelajaran ${settings.academicYear}`],
    [],
    ['Pekan Ke', evaluation.weekNumber, 'Kelas', evaluation.className],
    ['Bulan / Tahun', `${INDONESIAN_MONTHS[evaluation.month - 1]} ${evaluation.year}`, 'Wali Kelas', evaluation.homeroomTeacherName],
    ['Tanggal Penilaian', evaluation.evaluationDate, 'Penilai', `${evaluation.judgeName} (Penilai ${evaluation.judgeNumber})`],
    ['Tema Kelas', evaluation.theme, 'Status', evaluation.status],
    [],
    ['Kelompok / No', 'Item Penilaian', 'Skor Maksimal', 'Skor Diperoleh', 'Catatan Penilai'],
  ];

  for (const group of RUBRIC_GROUPS) {
    rows.push([group.code, group.title, group.maxSubtotal, '', '']);
    for (const item of group.items) {
      rows.push([
        `${group.code}.${item.number}`,
        item.label,
        item.maxScore,
        evaluation.scores[item.key] ?? 0,
        evaluation.itemNotes[item.key] || '',
      ]);
    }
    const subVal =
      group.code === 'A'
        ? evaluation.subtotalA
        : group.code === 'B'
          ? evaluation.subtotalB
          : group.code === 'C'
            ? evaluation.subtotalC
            : evaluation.subtotalD;
    rows.push(['', `Jumlah ${group.code}`, group.maxSubtotal, subVal, '']);
  }

  rows.push([]);
  rows.push(['', 'TOTAL SKOR AKHIR (A + B + C + D)', 100, evaluation.totalScore, evaluation.generalNote || '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 48 }, { wch: 15 }, { wch: 16 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lampiran 1');
  XLSX.writeFile(wb, `Lampiran_1_${evaluation.className.replace(/\s+/g, '_')}_P${evaluation.weekNumber}_Penilai_${evaluation.judgeNumber}.xlsx`);
}

export function exportLampiran2Excel(
  rows: WeeklyClassRecapRow[],
  period: JudgingPeriod,
  settings: SchoolSettings,
  winnerSummary?: { className: string; homeroomTeacher: string; score: string }
): void {
  const aoa: (string | number)[][] = [
    [settings.schoolName.toUpperCase()],
    ['LAMPIRAN 2 — REKAPITULASI NILAI MINGGUAN LOMBA PENATAAN DAN KEBERSIHAN KELAS'],
    [`Pekan Ke-${period.weekNumber} · Bulan ${INDONESIAN_MONTHS[period.month - 1]} ${period.year} · Tema: ${period.theme}`],
    [],
    ['No.', 'Kelas', 'Wali Kelas', 'Skor Penilai I', 'Skor Penilai II', 'Rata-rata', 'Aspek A', 'Aspek B', 'Aspek C', 'Aspek D', 'Peringkat', 'Status / Keterangan'],
  ];

  rows.forEach((r, idx) => {
    aoa.push([
      idx + 1,
      r.className,
      r.homeroomTeacherName,
      r.scoreJudge1 !== null ? r.scoreJudge1 : 'Belum Dinilai',
      r.scoreJudge2 !== null ? r.scoreJudge2 : 'Belum Dinilai',
      r.averageScore !== null ? Number(r.averageScore.toFixed(2)) : 'Belum Lengkap',
      r.avgAspectA !== null ? Number(r.avgAspectA.toFixed(2)) : '-',
      r.avgAspectB !== null ? Number(r.avgAspectB.toFixed(2)) : '-',
      r.avgAspectC !== null ? Number(r.avgAspectC.toFixed(2)) : '-',
      r.avgAspectD !== null ? Number(r.avgAspectD.toFixed(2)) : '-',
      r.rank !== null ? r.rank : '-',
      r.isComplete ? (r.tieBreakReason || 'Lengkap') : r.completionLabel,
    ]);
  });

  if (winnerSummary) {
    aoa.push([]);
    aoa.push(['Kelas Terbaik Pekan Ini', winnerSummary.className]);
    aoa.push(['Wali Kelas', winnerSummary.homeroomTeacher]);
    aoa.push(['Nilai Akhir', winnerSummary.score]);
  }
  aoa.push([]);
  aoa.push(['Koordinator Lomba', settings.coordinatorName, '', 'Kepala Madrasah', settings.principalName]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 6 }, { wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 28 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lampiran 2');
  XLSX.writeFile(wb, `Lampiran_2_Rekap_Mingguan_Pekan_${period.weekNumber}_${INDONESIAN_MONTHS[period.month - 1]}_${period.year}.xlsx`);
}

export function exportLampiran3Excel(
  rows: MonthlyClassRecapRow[],
  month: number,
  year: number,
  settings: SchoolSettings
): void {
  const monthName = INDONESIAN_MONTHS[month - 1];
  const aoa: (string | number)[][] = [
    [settings.schoolName.toUpperCase()],
    ['LAMPIRAN 3 — REKAPITULASI PEROLEHAN SERTIFIKAT BULANAN'],
    [`Bulan: ${monthName} ${year} · Tahun Pelajaran: ${settings.academicYear} · Pemegang Piala Bergilir: ${settings.currentTrophyClassName || '-'}`],
    [],
    ['No.', 'Kelas', 'Wali Kelas', 'P1', 'P2', 'P3', 'P4', 'P5', 'Jumlah Sertifikat', 'Total Skor Bulanan', 'Status / Keterangan'],
  ];

  rows.forEach((r, idx) => {
    aoa.push([
      idx + 1,
      r.className,
      r.homeroomTeacherName,
      r.weeks[1].wonCertificate ? '✓' : r.weeks[1].weeklyScore !== null ? formatScore(r.weeks[1].weeklyScore) : '-',
      r.weeks[2].wonCertificate ? '✓' : r.weeks[2].weeklyScore !== null ? formatScore(r.weeks[2].weeklyScore) : '-',
      r.weeks[3].wonCertificate ? '✓' : r.weeks[3].weeklyScore !== null ? formatScore(r.weeks[3].weeklyScore) : '-',
      r.weeks[4].wonCertificate ? '✓' : r.weeks[4].weeklyScore !== null ? formatScore(r.weeks[4].weeklyScore) : '-',
      r.weeks[5].wonCertificate ? '✓' : r.weeks[5].weeklyScore !== null ? formatScore(r.weeks[5].weeklyScore) : '-',
      r.certificateCount,
      Number(r.totalMonthlyScore.toFixed(2)),
      r.hasUnfinalizedWeeks ? 'Belum Final' : r.tieBreakerNote || 'Final',
    ]);
  });

  aoa.push([]);
  aoa.push(['Ketentuan Pertimbangan:', settings.winnerRuleText]);
  aoa.push(['Kepala Madrasah:', settings.principalName]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 6 }, { wch: 16 }, { wch: 30 }, { wch: 8 }, { wch: 8 },
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 18 }, { wch: 20 }, { wch: 28 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lampiran 3');
  XLSX.writeFile(wb, `Lampiran_3_Rekap_Sertifikat_${monthName}_${year}.xlsx`);
}

export function exportGenericTable(
  title: string,
  headers: string[],
  dataRows: (string | number)[][],
  format: 'xlsx' | 'csv',
  filenameBase: string
): void {
  const aoa: (string | number)[][] = [[title], [], headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan');

  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([headers, ...dataRows]));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    XLSX.writeFile(wb, `${filenameBase}.xlsx`);
  }
}

export function exportFullEvaluationsWorkbook(snapshot: AppDatabaseSnapshot): void {
  const wb = XLSX.utils.book_new();

  const classesSheet = XLSX.utils.json_to_sheet(
    snapshot.classes.map((c) => ({
      ID_Kelas: c.code,
      Kode_Sistem: c.id,
      Nama_Kelas: c.name,
      Tingkat: c.grade,
      Wali_Kelas: c.homeroomTeacherName,
      Status: c.active ? 'Aktif' : 'Nonaktif',
    }))
  );
  XLSX.utils.book_append_sheet(wb, classesSheet, 'Data Kelas');

  const evalsSheet = XLSX.utils.json_to_sheet(
    snapshot.evaluations.map((e) => ({
      Periode: e.periodId,
      Pekan: e.weekNumber,
      Bulan: INDONESIAN_MONTHS[e.month - 1],
      Tahun: e.year,
      Tanggal: e.evaluationDate,
      Kelas: e.className,
      Wali_Kelas: e.homeroomTeacherName,
      Penilai: e.judgeName,
      Jenis_Penilai: `Penilai ${e.judgeNumber}`,
      Jumlah_A: e.subtotalA,
      Jumlah_B: e.subtotalB,
      Jumlah_C: e.subtotalC,
      Jumlah_D: e.subtotalD,
      Total_Skor: e.totalScore,
      Status: e.status,
      Catatan: e.generalNote,
    }))
  );
  XLSX.utils.book_append_sheet(wb, evalsSheet, 'Data Penilaian');

  const certSheet = XLSX.utils.json_to_sheet(
    snapshot.certificates.map((c) => ({
      Nomor_Sertifikat: c.certificateNumber,
      Jenis: c.awardType,
      Periode: c.periodLabel,
      Kelas: c.className,
      Wali_Kelas: c.homeroomTeacherName,
      Skor: c.finalScore,
      Tanggal_Terbit: c.issueDate,
      Status: c.status,
    }))
  );
  XLSX.utils.book_append_sheet(wb, certSheet, 'Sertifikat');

  XLSX.writeFile(wb, `SIP_KELAS_Darul_Mahfudz_Data_Lengkap_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export interface ImportedClassCandidate {
  code: string;
  name: string;
  grade: ClassGrade;
  homeroomTeacherName: string;
  active: boolean;
}

export function downloadClassImportTemplate(): void {
  const rows = [
    ['ID Kelas', 'Nama Kelas', 'Tingkat Kelas', 'Nama Wali Kelas', 'Status Aktif'],
    ['KLS-X05', 'X Agama 1', 'X', 'Ust. Zainuddin, Lc.', 'Aktif'],
    ['KLS-XI05', 'XI Agama 1', 'XI', 'St. Hajar, S.Pd.I.', 'Aktif'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Kelas');
  XLSX.writeFile(wb, 'Template_Impor_Kelas_MA_Darul_Mahfudz.xlsx');
}

export async function parseClassImportFile(file: File): Promise<{
  items: ImportedClassCandidate[];
  warnings: string[];
}> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Berkas Excel/CSV tidak memiliki lembar kerja.');
  }
  const sheet = wb.Sheets[firstSheetName];
  const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const items: ImportedClassCandidate[] = [];
  const warnings: string[] = [];

  rawJson.forEach((row, index) => {
    const rowNum = index + 2;
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k.trim().toLowerCase()] = String(v ?? '').trim();
    }

    const code =
      normalized['id kelas'] ||
      normalized['id_kelas'] ||
      normalized['kode'] ||
      normalized['id'] ||
      `KLS-${String(index + 1).padStart(2, '0')}`;

    const name =
      normalized['nama kelas'] ||
      normalized['nama_kelas'] ||
      normalized['kelas'] ||
      normalized['name'] ||
      '';

    const rawGrade = (
      normalized['tingkat kelas'] ||
      normalized['tingkat'] ||
      normalized['grade'] ||
      ''
    ).toUpperCase();

    const homeroomTeacherName =
      normalized['nama wali kelas'] ||
      normalized['wali kelas'] ||
      normalized['wali_kelas'] ||
      normalized['homeroom'] ||
      'Belum Ditentukan';

    const rawStatus = (
      normalized['status aktif'] ||
      normalized['status'] ||
      'aktif'
    ).toLowerCase();

    if (!name) {
      warnings.push(`Baris ${rowNum}: Nama kelas kosong, dilewati.`);
      return;
    }

    let grade: ClassGrade = 'X';
    if (rawGrade === 'XII' || rawGrade === '12' || name.toUpperCase().startsWith('XII')) {
      grade = 'XII';
    } else if (rawGrade === 'XI' || rawGrade === '11' || name.toUpperCase().startsWith('XI')) {
      grade = 'XI';
    } else {
      grade = 'X';
    }

    const active = !['nonaktif', 'tidak', 'false', '0', 'inactive'].includes(rawStatus);

    items.push({
      code: code.slice(0, 30),
      name: name.slice(0, 80),
      grade,
      homeroomTeacherName: homeroomTeacherName.slice(0, 120),
      active,
    });
  });

  return { items, warnings };
}
