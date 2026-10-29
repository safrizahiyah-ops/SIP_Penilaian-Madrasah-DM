import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { INDONESIAN_MONTHS, RUBRIC_GROUPS } from '../constants/rubric';
import {
  Certificate,
  Evaluation,
  JudgingPeriod,
  MonthlyResult,
  SchoolSettings,
  WeeklyResult,
} from '../types';
import {
  formatIndonesianDate,
  formatScore,
  MonthlyClassRecapRow,
  WeeklyClassRecapRow,
} from './calculations';
import { getImageDimensions } from './imageCompressor';

function drawOfficialHeader(
  doc: jsPDF,
  settings: SchoolSettings,
  reportTitle: string,
  subtitle: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  if (settings.logoDataUrl) {
    try {
      const fmt = settings.logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(settings.logoDataUrl, fmt, 15, 10, 18, 18);
    } catch {
      // Ignore invalid logo data url gracefully
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(6, 78, 59);
  doc.text(settings.schoolName.toUpperCase(), pageWidth / 2, y, { align: 'center' });

  y += 5.5;
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `LOMBA PENATAAN (BERTEMA) DAN KEBERSIHAN KELAS — TAHUN PELAJARAN ${settings.academicYear}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${settings.address} · "${settings.motto}"`, pageWidth / 2, y, { align: 'center' });

  y += 4;
  doc.setDrawColor(6, 78, 59);
  doc.setLineWidth(0.7);
  doc.line(14, y, pageWidth - 14, y);
  doc.setLineWidth(0.2);
  doc.line(14, y + 1, pageWidth - 14, y + 1);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle, pageWidth / 2, y, { align: 'center' });

  if (subtitle) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
  }

  return y + 5;
}

function addPageNumbers(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `SIP-KELAS Darul Mahfudz · Dicetak ${formatIndonesianDate(new Date().toISOString().slice(0, 10))} · Halaman ${i} dari ${pageCount}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  }
}

/**
 * Generates Lampiran 1 PDF (A4 Portrait)
 */
export function downloadLampiran1Pdf(evaluation: Evaluation, settings: SchoolSettings): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = drawOfficialHeader(
    doc,
    settings,
    'LAMPIRAN 1 — LEMBAR PENILAIAN LOMBA PENATAAN (BERTEMA) DAN KEBERSIHAN KELAS',
    `Perebutan Piala Bergilir Kepala Madrasah · Tahun Pelajaran ${settings.academicYear}`
  );

  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);

  const leftX = 14;
  const rightX = 112;
  doc.setFont('helvetica', 'bold');
  doc.text('Pekan / Bulan:', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pekan Ke-${evaluation.weekNumber} / ${INDONESIAN_MONTHS[evaluation.month - 1]} ${evaluation.year}`, leftX + 28, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Kelas:', rightX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(evaluation.className, rightX + 26, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Hari / Tanggal:', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatIndonesianDate(evaluation.evaluationDate), leftX + 28, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Wali Kelas:', rightX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(evaluation.homeroomTeacherName, rightX + 26, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Tema Kelas:', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(evaluation.theme.slice(0, 48), leftX + 28, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Penilai:', rightX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${evaluation.judgeName} (Penilai ${evaluation.judgeNumber})`, rightX + 26, y);

  y += 4;

  const bodyRows: (string | number)[][] = [];
  for (const group of RUBRIC_GROUPS) {
    bodyRows.push([group.code, group.title.toUpperCase(), String(group.maxSubtotal), '', '']);
    for (const item of group.items) {
      bodyRows.push([
        String(item.number),
        item.label,
        String(item.maxScore),
        String(evaluation.scores[item.key] ?? 0),
        evaluation.itemNotes[item.key] || '-',
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
    bodyRows.push(['', `Jumlah ${group.code}`, String(group.maxSubtotal), String(subVal), '']);
  }

  bodyRows.push(['', 'TOTAL SKOR AKHIR (A + B + C + D)', '100', String(evaluation.totalScore), `Status: ${evaluation.status}`]);

  autoTable(doc, {
    startY: y,
    head: [['No.', 'Aspek / Item Penilaian', 'Skor Maks', 'Skor Penilai', 'Catatan / Komentar']],
    body: bodyRows,
    theme: 'grid',
    styles: { fontSize: 7.8, cellPadding: 1.6, lineColor: [148, 163, 184], lineWidth: 0.15 },
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 11, halign: 'center' },
      1: { cellWidth: 78 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 51 },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rawRow = Array.isArray(data.row.raw) ? data.row.raw : [];
        const firstCol = String(rawRow[0] ?? '');
        const secondCol = String(rawRow[1] ?? '');
        if (['A', 'B', 'C', 'D'].includes(firstCol)) {
          data.cell.styles.fillColor = [236, 253, 245];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [6, 78, 59];
        } else if (secondCol.startsWith('Jumlah ') || secondCol.startsWith('TOTAL SKOR')) {
          data.cell.styles.fillColor = [248, 250, 252];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 120) + 5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Catatan Umum Penilai:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.text(evaluation.generalNote || '-', 14, finalY + 4.5, { maxWidth: 115 });

  const sigX = 140;
  doc.text(`${settings.location}, ${formatIndonesianDate(evaluation.evaluationDate)}`, sigX, finalY);
  doc.text(`Penilai ${evaluation.judgeNumber},`, sigX, finalY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(evaluation.judgeName, sigX, finalY + 21);

  addPageNumbers(doc);
  doc.save(`Lampiran_1_${evaluation.className.replace(/\s+/g, '_')}_Pekan_${evaluation.weekNumber}_Penilai_${evaluation.judgeNumber}.pdf`);
}

/**
 * Generates Lampiran 2 PDF (A4 Landscape)
 */
export function downloadLampiran2Pdf(
  rows: WeeklyClassRecapRow[],
  period: JudgingPeriod,
  settings: SchoolSettings,
  weeklyResult: WeeklyResult | null
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const monthName = INDONESIAN_MONTHS[period.month - 1];
  const y = drawOfficialHeader(
    doc,
    settings,
    'LAMPIRAN 2 — REKAPITULASI NILAI MINGGUAN',
    `Pekan Ke-${period.weekNumber} · Bulan ${monthName} ${period.year} · Tema: "${period.theme}"`
  );

  const tableRows = rows.map((r, i) => [
    String(i + 1),
    r.className,
    r.homeroomTeacherName,
    r.scoreJudge1 !== null ? formatScore(r.scoreJudge1) : 'Belum Dinilai',
    r.scoreJudge2 !== null ? formatScore(r.scoreJudge2) : 'Belum Dinilai',
    r.averageScore !== null ? formatScore(r.averageScore) : 'Belum Lengkap',
    r.avgAspectA !== null ? formatScore(r.avgAspectA) : '-',
    r.avgAspectB !== null ? formatScore(r.avgAspectB) : '-',
    r.rank !== null ? String(r.rank) : '-',
    r.isComplete ? (r.tieBreakReason || 'Lengkap') : r.completionLabel,
  ]);

  autoTable(doc, {
    startY: y,
    head: [[
      'No.',
      'Kelas',
      'Wali Kelas',
      'Skor Penilai I',
      'Skor Penilai II',
      'Rata-rata',
      'Aspek A',
      'Aspek B',
      'Peringkat',
      'Keterangan / Status',
    ]],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2, lineColor: [148, 163, 184], lineWidth: 0.15 },
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 58 },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      9: { cellWidth: 42 },
    },
  });

  let fy = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 90) + 6;
  if (fy > 162) {
    doc.addPage();
    fy = 20;
  }

  const topRow = rows.find((r) => r.rank === 1);
  const winnerName = weeklyResult?.winnerClassName || topRow?.className || 'Belum Ditetapkan';
  const winnerTeacher = weeklyResult?.winnerHomeroomTeacher || topRow?.homeroomTeacherName || '-';
  const winnerScore =
    weeklyResult !== null
      ? formatScore(weeklyResult.winnerScore)
      : topRow?.averageScore !== null && topRow?.averageScore !== undefined
        ? formatScore(topRow.averageScore)
        : '-';

  doc.setDrawColor(6, 78, 59);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(14, fy, 125, 22, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 78, 59);
  doc.text(`KELAS TERBAIK PEKAN KE-${period.weekNumber}: ${winnerName}`, 18, fy + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Wali Kelas: ${winnerTeacher}`, 18, fy + 12.5);
  doc.text(
    `Nilai Akhir: ${winnerScore} · Status Pengesahan: ${weeklyResult?.status === 'APPROVED' ? 'Disahkan Resmi' : 'Menunggu Pengesahan'}`,
    18,
    fy + 18
  );

  // Dual signature block
  doc.setFontSize(9);
  doc.text('Mengetahui,', 155, fy + 3);
  doc.text('Kepala Madrasah', 155, fy + 8);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.principalName, 155, fy + 25);

  doc.setFont('helvetica', 'normal');
  doc.text(`${settings.location}, ${formatIndonesianDate(period.ceremonyDate || period.scheduledDate)}`, 225, fy + 3);
  doc.text('Koordinator Lomba', 225, fy + 8);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.coordinatorName, 225, fy + 25);

  addPageNumbers(doc);
  doc.save(`Lampiran_2_Rekap_Mingguan_P${period.weekNumber}_${monthName}_${period.year}.pdf`);
}

/**
 * Generates Lampiran 3 PDF (A4 Landscape)
 */
export function downloadLampiran3Pdf(
  rows: MonthlyClassRecapRow[],
  month: number,
  year: number,
  settings: SchoolSettings,
  monthlyResult: MonthlyResult | null
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const monthName = INDONESIAN_MONTHS[month - 1];
  const y = drawOfficialHeader(
    doc,
    settings,
    'LAMPIRAN 3 — REKAPITULASI PEROLEHAN SERTIFIKAT BULANAN',
    `Bulan: ${monthName} ${year} · Tahun Pelajaran ${settings.academicYear} · Pemegang Piala Bergilir Saat Ini: ${settings.currentTrophyClassName || 'Belum Ditetapkan'}`
  );

  const formatSlot = (won: boolean, score: number | null) => {
    if (won) return 'V (Terbaik)';
    if (score !== null) return formatScore(score);
    return '-';
  };

  const tableRows = rows.map((r, i) => [
    String(i + 1),
    r.className,
    r.homeroomTeacherName,
    formatSlot(r.weeks[1].wonCertificate, r.weeks[1].weeklyScore),
    formatSlot(r.weeks[2].wonCertificate, r.weeks[2].weeklyScore),
    formatSlot(r.weeks[3].wonCertificate, r.weeks[3].weeklyScore),
    formatSlot(r.weeks[4].wonCertificate, r.weeks[4].weeklyScore),
    formatSlot(r.weeks[5].wonCertificate, r.weeks[5].weeklyScore),
    String(r.certificateCount),
    formatScore(r.totalMonthlyScore),
    r.hasUnfinalizedWeeks ? 'Belum Final' : r.tieBreakerNote || 'Sah / Final',
  ]);

  autoTable(doc, {
    startY: y,
    head: [[
      'No.',
      'Kelas',
      'Wali Kelas',
      'P1',
      'P2',
      'P3',
      'P4',
      'P5',
      'Jml Sertifikat',
      'Total Skor',
      'Keterangan',
    ]],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 8.2, cellPadding: 2, lineColor: [148, 163, 184], lineWidth: 0.15 },
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 11, halign: 'center' },
      1: { cellWidth: 25, fontStyle: 'bold' },
      2: { cellWidth: 54 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 20, halign: 'center' },
      8: { cellWidth: 23, halign: 'center', fontStyle: 'bold' },
      9: { cellWidth: 23, halign: 'center', fontStyle: 'bold' },
      10: { cellWidth: 33 },
    },
  });

  let fy = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 90) + 6;
  if (fy > 162) {
    doc.addPage();
    fy = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 78, 59);
  doc.text('Ketentuan Pertimbangan Pemenang Bulanan:', 14, fy + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`"${settings.winnerRuleText}"`, 14, fy + 9, { maxWidth: 175 });

  if (monthlyResult) {
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Pemenang Bulanan (${monthlyResult.status === 'APPROVED' ? 'Disahkan' : 'Usulan'}): ${monthlyResult.winnerClassName} (${monthlyResult.certificateCount} Sertifikat · Total Skor ${formatScore(monthlyResult.totalMonthlyScore)})`,
      14,
      fy + 16
    );
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${settings.location}, ${formatIndonesianDate(new Date().toISOString().slice(0, 10))}`, 215, fy + 4);
  doc.text('Kepala Madrasah,', 215, fy + 9);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.principalName, 215, fy + 25);

  addPageNumbers(doc);
  doc.save(`Lampiran_3_Rekap_Sertifikat_${monthName}_${year}.pdf`);
}

/**
 * Renders an official A4 Landscape Certificate page onto a jsPDF instance with exact proportions,
 * cream background, deep emerald & gold ornamental borders, building watermark, official logo,
 * gold ribbon, emerald-gold medal emblem, and formal typography.
 */
async function renderCertificatePage(
  doc: jsPDF,
  cert: Certificate,
  settings: SchoolSettings
): Promise<void> {
  const W = 297;
  const H = 210;

  // 1. Soft Cream Parchment Background
  doc.setFillColor(253, 251, 247);
  doc.rect(0, 0, W, H, 'F');

  // 2. Soft Building Watermark if uploaded
  if (settings.buildingDataUrl) {
    try {
      // Create soft faded building backdrop via offscreen canvas so transparency is smooth in PDF
      const dims = await getImageDimensions(settings.buildingDataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 540;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FDFBF7';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.08;
        const img = new Image();
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          img.src = settings.buildingDataUrl;
        });
        const scale = Math.max(canvas.width / dims.width, canvas.height / dims.height);
        const dw = dims.width * scale;
        const dh = dims.height * scale;
        ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
        const fadedUrl = canvas.toDataURL('image/jpeg', 0.85);
        doc.addImage(fadedUrl, 'JPEG', 18, 18, W - 36, H - 36);
      }
    } catch {
      // Fallback cleanly to cream background
    }
  }

  // 3. Outer Deep Emerald Frame & Gold Ornamental Double Borders
  doc.setDrawColor(6, 78, 59); // Deep Emerald #064E3B
  doc.setLineWidth(3.2);
  doc.rect(9, 9, W - 18, H - 18);

  doc.setDrawColor(197, 155, 39); // Refined Gold #C59B27
  doc.setLineWidth(0.9);
  doc.rect(13, 13, W - 26, H - 26);

  doc.setDrawColor(5, 150, 105); // Emerald #059669
  doc.setLineWidth(0.35);
  doc.rect(15.2, 15.2, W - 30.4, H - 30.4);

  // Corner GeometricEmerald-Gold Accents
  const corners = [
    [9, 9, 1, 1],
    [W - 9, 9, -1, 1],
    [9, H - 9, 1, -1],
    [W - 9, H - 9, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    doc.setFillColor(6, 78, 59);
    doc.triangle(cx, cy, cx + dx * 22, cy, cx, cy + dy * 22, 'F');
    doc.setDrawColor(197, 155, 39);
    doc.setLineWidth(0.7);
    doc.line(cx + dx * 4, cy + dy * 17, cx + dx * 17, cy + dy * 4);
  }

  // Top Gold Header Accent Bar
  doc.setFillColor(6, 78, 59);
  doc.rect(W / 2 - 48, 9, 96, 3.5, 'F');

  // 4. Official Madrasah Logo at Top Center (locked aspect ratio; clean empty area if not uploaded)
  let cursorY = 22;
  if (settings.logoDataUrl) {
    try {
      const dims = await getImageDimensions(settings.logoDataUrl);
      const maxH = 21;
      const maxW = 28;
      const ratio = Math.min(maxW / dims.width, maxH / dims.height);
      const drawW = dims.width * ratio;
      const drawH = dims.height * ratio;
      const fmt = settings.logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(settings.logoDataUrl, fmt, (W - drawW) / 2, cursorY, drawW, drawH);
    } catch {
      // Leave clean space if corrupt
    }
  } else {
    // Subtle dashed frame space reserved when logo not yet uploaded
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.circle(W / 2, cursorY + 10, 9.5, 'S');
  }

  cursorY += 25;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(6, 78, 59);
  doc.text(settings.schoolName.toUpperCase(), W / 2, cursorY, { align: 'center' });

  // 5. SERTIFIKAT PENGHARGAAN Title + Gold Ribbon Banner
  cursorY += 10.5;
  doc.setFont('times', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(6, 78, 59);
  doc.text('SERTIFIKAT', W / 2, cursorY, { align: 'center' });

  cursorY += 4.5;
  // Gold Award Ribbon
  doc.setFillColor(197, 155, 39);
  doc.roundedRect(W / 2 - 36, cursorY, 72, 7.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('P E N G H A R G A A N', W / 2, cursorY + 5.2, { align: 'center' });

  cursorY += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Nomor: ${cert.certificateNumber}`, W / 2, cursorY, { align: 'center' });

  // 6. Recipient Section
  cursorY += 7.5;
  doc.setFont('times', 'italic');
  doc.setFontSize(11.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Diberikan kepada:', W / 2, cursorY, { align: 'center' });

  cursorY += 9.5;
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(6, 78, 59);
  doc.text(cert.recipientDisplay, W / 2, cursorY, { align: 'center', maxWidth: 235 });

  // Decorative Gold Underline beneath Recipient
  doc.setDrawColor(197, 155, 39);
  doc.setLineWidth(0.5);
  doc.line(W / 2 - 75, cursorY + 2.5, W / 2 + 75, cursorY + 2.5);

  // 7. Role & Competition Wording
  cursorY += 9;
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text('Sebagai:', W / 2, cursorY, { align: 'center' });

  cursorY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(180, 83, 9);
  doc.text(cert.roleTitle.toUpperCase(), W / 2, cursorY, { align: 'center' });

  cursorY += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(6, 78, 59);
  doc.text('LOMBA PENATAAN (BERTEMA) DAN KEBERSIHAN KELAS', W / 2, cursorY, { align: 'center' });

  cursorY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Antar Kelas Perebutan Piala Bergilir Kepala Madrasah · Tahun Pelajaran ${settings.academicYear} (${cert.periodLabel})`,
    W / 2,
    cursorY,
    { align: 'center' }
  );

  // 8. Motivational Quote
  cursorY += 7.5;
  doc.setFont('times', 'italic');
  doc.setFontSize(10.2);
  doc.setTextColor(71, 85, 105);
  doc.text(
    '"Semoga prestasi ini menjadi motivasi untuk terus berkarya, berinovasi, dan menjaga lingkungan madrasah yang bersih, indah, dan nyaman."',
    W / 2,
    cursorY,
    { align: 'center', maxWidth: 220 }
  );

  // 9. Medal Emblem in Bottom Center + Dual Signatories
  const sigTopY = 156;

  // Emerald & Gold Ribbons under Medal
  const medalX = W / 2;
  const medalY = sigTopY + 13;
  doc.setFillColor(6, 78, 59);
  doc.triangle(medalX - 6, medalY + 4, medalX - 11, medalY + 21, medalX - 1, medalY + 18, 'F');
  doc.setFillColor(5, 150, 105);
  doc.triangle(medalX + 6, medalY + 4, medalX + 11, medalY + 21, medalX + 1, medalY + 18, 'F');

  doc.setFillColor(197, 155, 39);
  doc.circle(medalX, medalY, 10.5, 'F');
  doc.setFillColor(6, 78, 59);
  doc.circle(medalX, medalY, 8.2, 'F');
  doc.setDrawColor(253, 230, 138);
  doc.setLineWidth(0.5);
  doc.circle(medalX, medalY, 6.8, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(253, 230, 138);
  doc.text('TERBAIK', medalX, medalY - 0.5, { align: 'center' });
  doc.setFontSize(6);
  doc.text(`${formatScore(cert.finalScore)}`, medalX, medalY + 3, { align: 'center' });

  // Left Signatory: Wakil Kepala Madrasah Bidang Kesiswaan
  const leftSigX = 68;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(30, 41, 59);
  doc.text('Wakil Kepala Madrasah Bidang Kesiswaan', leftSigX, sigTopY + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(cert.vicePrincipalName, leftSigX, sigTopY + 25, { align: 'center' });
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(leftSigX - 34, sigTopY + 26.5, leftSigX + 34, sigTopY + 26.5);
  if (settings.vicePrincipalNip) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`NIP. ${settings.vicePrincipalNip}`, leftSigX, sigTopY + 30.5, { align: 'center' });
  }

  // Right Signatory: Location + Date + Kepala Madrasah
  const rightSigX = W - 68;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(30, 41, 59);
  doc.text(`${settings.location}, ${formatIndonesianDate(cert.issueDate)}`, rightSigX, sigTopY, { align: 'center' });
  doc.text('Kepala Madrasah', rightSigX, sigTopY + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(cert.principalName, rightSigX, sigTopY + 25, { align: 'center' });
  doc.line(rightSigX - 34, sigTopY + 26.5, rightSigX + 34, sigTopY + 26.5);
  if (settings.principalNip) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`NIP. ${settings.principalNip}`, rightSigX, sigTopY + 30.5, { align: 'center' });
  }
}

export async function downloadSingleCertificatePdf(
  cert: Certificate,
  settings: SchoolSettings
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await renderCertificatePage(doc, cert, settings);
  doc.save(`Sertifikat_${cert.className.replace(/\s+/g, '_')}_${cert.certificateNumber.replace(/\//g, '-')}.pdf`);
}

export async function downloadBatchCertificatesPdf(
  certs: Certificate[],
  settings: SchoolSettings
): Promise<void> {
  const activeCerts = certs.filter((c) => c.status === 'ISSUED');
  if (activeCerts.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  for (let i = 0; i < activeCerts.length; i++) {
    if (i > 0) doc.addPage('a4', 'landscape');
    await renderCertificatePage(doc, activeCerts[i], settings);
  }
  doc.save(`Seluruh_Sertifikat_MA_Darul_Mahfudz_${settings.academicYear.replace('/', '-')}.pdf`);
}

/**
 * Generic Official A4 Report PDF Exporter (Portrait or Landscape)
 */
export function downloadOfficialReportPdf(params: {
  settings: SchoolSettings;
  title: string;
  subtitle: string;
  orientation: 'portrait' | 'landscape';
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}): void {
  const doc = new jsPDF({
    orientation: params.orientation,
    unit: 'mm',
    format: 'a4',
  });
  const y = drawOfficialHeader(doc, params.settings, params.title, params.subtitle);

  autoTable(doc, {
    startY: y,
    head: [params.headers],
    body: params.rows,
    theme: 'grid',
    styles: { fontSize: 8.2, cellPadding: 2, lineColor: [148, 163, 184], lineWidth: 0.15 },
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let fy = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 60) + 8;
  if (fy > pageHeight - 38) {
    doc.addPage();
    fy = 20;
  }

  const sigX = pageWidth - 78;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`${params.settings.location}, ${formatIndonesianDate(new Date().toISOString().slice(0, 10))}`, sigX, fy);
  doc.text('Kepala Madrasah,', sigX, fy + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(params.settings.principalName, sigX, fy + 22);

  addPageNumbers(doc);
  doc.save(`${params.filename}.pdf`);
}
