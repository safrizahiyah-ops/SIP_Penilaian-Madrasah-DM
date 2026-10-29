import { ALL_RUBRIC_ITEMS, INDONESIAN_MONTHS } from '../constants/rubric';
import {
  Certificate,
  Evaluation,
  JudgingPeriod,
  MonthlyResult,
  RubricItemKey,
  SchoolClass,
  ScoresMap,
  WeeklyResult,
} from '../types';

export interface EvaluationTotalsResult {
  subtotalA: number;
  subtotalB: number;
  subtotalC: number;
  subtotalD: number;
  totalScore: number;
  errors: string[];
}

/**
 * Centralized Lampiran 1 calculation & validation engine (Requirement 17.1 & 17.2).
 */
export function calculateEvaluationTotals(scores: Partial<ScoresMap>): EvaluationTotalsResult {
  let subtotalA = 0;
  let subtotalB = 0;
  let subtotalC = 0;
  let subtotalD = 0;
  const errors: string[] = [];

  for (const item of ALL_RUBRIC_ITEMS) {
    const raw = scores[item.key];
    if (raw === undefined || raw === null || Number.isNaN(Number(raw))) {
      errors.push(`Skor "${item.label}" harus berupa angka yang valid.`);
      continue;
    }
    const val = Number(raw);
    if (val < 0) {
      errors.push(`Skor "${item.label}" tidak boleh negatif.`);
    } else if (val > item.maxScore) {
      errors.push(`Skor "${item.label}" (${val}) melebihi batas maksimal (${item.maxScore}).`);
    }

    const clamped = Math.max(0, Math.min(item.maxScore, val));
    if (item.aspect === 'A') subtotalA += clamped;
    if (item.aspect === 'B') subtotalB += clamped;
    if (item.aspect === 'C') subtotalC += clamped;
    if (item.aspect === 'D') subtotalD += clamped;
  }

  // Keep full floating precision internally
  const totalScore = subtotalA + subtotalB + subtotalC + subtotalD;
  if (totalScore < 0 || totalScore > 100) {
    errors.push('Total skor akhir harus berada pada rentang 0–100.');
  }

  return {
    subtotalA,
    subtotalB,
    subtotalC,
    subtotalD,
    totalScore,
    errors,
  };
}

export interface WeeklyClassRecapRow {
  classId: string;
  classCode: string;
  className: string;
  grade: string;
  homeroomTeacherName: string;
  evalJudge1: Evaluation | null;
  evalJudge2: Evaluation | null;
  scoreJudge1: number | null;
  scoreJudge2: number | null;
  avgAspectA: number | null;
  avgAspectB: number | null;
  avgAspectC: number | null;
  avgAspectD: number | null;
  averageScore: number | null; // High precision; null if incomplete!
  isComplete: boolean; // True ONLY when both Judge I & Judge II are FINAL or LOCKED
  completionLabel: 'Lengkap' | 'Belum Lengkap (Draf)' | 'Belum Lengkap';
  missingJudges: ('I' | 'II')[];
  rank: number | null; // Null until all required evaluations for this class are complete & valid
  isTiedForRank: boolean;
  tieBreakReason: string;
}

export interface WeeklyRecapComputation {
  rows: WeeklyClassRecapRow[];
  allClassesComplete: boolean;
  completedCount: number;
  incompleteCount: number;
  topCandidates: WeeklyClassRecapRow[];
  hasExactTopTie: boolean;
}

const EPSILON = 1e-9;

/**
 * Centralized Lampiran 2 Weekly Recap & Tie-Breaker Engine (Requirement 8 & 17).
 * Rules:
 * - Only FINAL or LOCKED evaluations count toward official recap.
 * - Incomplete classes NEVER receive score 0; averageScore and rank remain null.
 * - Final ranking is only established when ALL active classes have both Judge I & Judge II finalized,
 *   while provisional ordering is clearly marked if any class is still incomplete.
 * - Transparent tie-breaker: Average -> Avg Aspect A -> Avg Aspect B -> Avg Aspect C -> Avg Aspect D -> Exact Tie ("Nilai Seri").
 */
export function computeWeeklyRecap(
  classes: SchoolClass[],
  evaluations: Evaluation[],
  periodId: string
): WeeklyRecapComputation {
  const activeClasses = classes.filter((c) => c.active);
  const periodEvals = evaluations.filter((e) => e.periodId === periodId);

  const rawRows: WeeklyClassRecapRow[] = activeClasses.map((cls) => {
    const e1 = periodEvals.find((e) => e.classId === cls.id && e.judgeNumber === 'I') || null;
    const e2 = periodEvals.find((e) => e.classId === cls.id && e.judgeNumber === 'II') || null;

    const e1Valid = e1 !== null && (e1.status === 'FINAL' || e1.status === 'LOCKED');
    const e2Valid = e2 !== null && (e2.status === 'FINAL' || e2.status === 'LOCKED');

    const missingJudges: ('I' | 'II')[] = [];
    if (!e1Valid) missingJudges.push('I');
    if (!e2Valid) missingJudges.push('II');

    const hasDraft = (e1 && e1.status === 'DRAFT') || (e2 && e2.status === 'DRAFT');

    if (!e1Valid || !e2Valid || !e1 || !e2) {
      return {
        classId: cls.id,
        classCode: cls.code,
        className: cls.name,
        grade: cls.grade,
        homeroomTeacherName: cls.homeroomTeacherName,
        evalJudge1: e1,
        evalJudge2: e2,
        scoreJudge1: e1Valid && e1 ? e1.totalScore : null,
        scoreJudge2: e2Valid && e2 ? e2.totalScore : null,
        avgAspectA: null,
        avgAspectB: null,
        avgAspectC: null,
        avgAspectD: null,
        averageScore: null,
        isComplete: false,
        completionLabel: hasDraft ? 'Belum Lengkap (Draf)' : 'Belum Lengkap',
        missingJudges,
        rank: null,
        isTiedForRank: false,
        tieBreakReason: '',
      };
    }

    const averageScore = (e1.totalScore + e2.totalScore) / 2;
    const avgAspectA = (e1.subtotalA + e2.subtotalA) / 2;
    const avgAspectB = (e1.subtotalB + e2.subtotalB) / 2;
    const avgAspectC = (e1.subtotalC + e2.subtotalC) / 2;
    const avgAspectD = (e1.subtotalD + e2.subtotalD) / 2;

    return {
      classId: cls.id,
      classCode: cls.code,
      className: cls.name,
      grade: cls.grade,
      homeroomTeacherName: cls.homeroomTeacherName,
      evalJudge1: e1,
      evalJudge2: e2,
      scoreJudge1: e1.totalScore,
      scoreJudge2: e2.totalScore,
      avgAspectA,
      avgAspectB,
      avgAspectC,
      avgAspectD,
      averageScore,
      isComplete: true,
      completionLabel: 'Lengkap',
      missingJudges: [],
      rank: null,
      isTiedForRank: false,
      tieBreakReason: '',
    };
  });

  const completeRows = rawRows.filter((r) => r.isComplete);
  const incompleteRows = rawRows.filter((r) => !r.isComplete);
  const allClassesComplete = activeClasses.length > 0 && incompleteRows.length === 0;

  // Sort complete rows using strict 5-stage tie-breaker (NEVER judge name!)
  completeRows.sort((a, b) => {
    const diffAvg = (b.averageScore ?? 0) - (a.averageScore ?? 0);
    if (Math.abs(diffAvg) > EPSILON) return diffAvg;

    const diffA = (b.avgAspectA ?? 0) - (a.avgAspectA ?? 0);
    if (Math.abs(diffA) > EPSILON) return diffA;

    const diffB = (b.avgAspectB ?? 0) - (a.avgAspectB ?? 0);
    if (Math.abs(diffB) > EPSILON) return diffB;

    const diffC = (b.avgAspectC ?? 0) - (a.avgAspectC ?? 0);
    if (Math.abs(diffC) > EPSILON) return diffC;

    const diffD = (b.avgAspectD ?? 0) - (a.avgAspectD ?? 0);
    if (Math.abs(diffD) > EPSILON) return diffD;

    return a.className.localeCompare(b.className, 'id');
  });

  // Assign ranks and annotate transparent tie-break reasons
  for (let i = 0; i < completeRows.length; i++) {
    const curr = completeRows[i];
    if (i === 0) {
      curr.rank = allClassesComplete ? 1 : null;
      continue;
    }
    const prev = completeRows[i - 1];
    const sameAvg = Math.abs((curr.averageScore ?? 0) - (prev.averageScore ?? 0)) <= EPSILON;
    if (!sameAvg) {
      curr.rank = allClassesComplete ? i + 1 : null;
      continue;
    }

    const sameA = Math.abs((curr.avgAspectA ?? 0) - (prev.avgAspectA ?? 0)) <= EPSILON;
    const sameB = Math.abs((curr.avgAspectB ?? 0) - (prev.avgAspectB ?? 0)) <= EPSILON;
    const sameC = Math.abs((curr.avgAspectC ?? 0) - (prev.avgAspectC ?? 0)) <= EPSILON;
    const sameD = Math.abs((curr.avgAspectD ?? 0) - (prev.avgAspectD ?? 0)) <= EPSILON;

    if (!sameA) {
      curr.rank = allClassesComplete ? i + 1 : null;
      prev.tieBreakReason = prev.tieBreakReason || 'Unggul Skor Aspek A (Kebersihan)';
      curr.tieBreakReason = 'Selisih Skor Aspek A';
    } else if (!sameB) {
      curr.rank = allClassesComplete ? i + 1 : null;
      prev.tieBreakReason = prev.tieBreakReason || 'Unggul Skor Aspek B (Penataan Bertema)';
      curr.tieBreakReason = 'Selisih Skor Aspek B';
    } else if (!sameC) {
      curr.rank = allClassesComplete ? i + 1 : null;
      prev.tieBreakReason = prev.tieBreakReason || 'Unggul Skor Aspek C (Perangkat Kelas)';
      curr.tieBreakReason = 'Selisih Skor Aspek C';
    } else if (!sameD) {
      curr.rank = allClassesComplete ? i + 1 : null;
      prev.tieBreakReason = prev.tieBreakReason || 'Unggul Skor Aspek D (Partisipasi)';
      curr.tieBreakReason = 'Selisih Skor Aspek D';
    } else {
      // Exact tie across Avg and all 4 aspects! Share rank and mark Nilai Seri
      curr.rank = prev.rank;
      prev.isTiedForRank = true;
      curr.isTiedForRank = true;
      prev.tieBreakReason = 'Nilai Seri Identik — Keputusan Panitia/Kepala Madrasah';
      curr.tieBreakReason = 'Nilai Seri Identik — Keputusan Panitia/Kepala Madrasah';
    }
  }

  incompleteRows.sort((a, b) => a.className.localeCompare(b.className, 'id'));

  const topCandidates = allClassesComplete
    ? completeRows.filter((r) => r.rank === 1)
    : completeRows.slice(0, 1);

  const hasExactTopTie = allClassesComplete && topCandidates.length > 1;

  return {
    rows: [...completeRows, ...incompleteRows],
    allClassesComplete,
    completedCount: completeRows.length,
    incompleteCount: incompleteRows.length,
    topCandidates,
    hasExactTopTie,
  };
}

export interface MonthlyWeekSlot {
  weekNumber: 1 | 2 | 3 | 4 | 5;
  periodId: string | null;
  wonCertificate: boolean;
  weeklyScore: number | null; // Only populated when weekly evaluation for that week is complete & final
  isWeekFinal: boolean;
}

export interface MonthlyClassRecapRow {
  classId: string;
  classCode: string;
  className: string;
  homeroomTeacherName: string;
  weeks: Record<1 | 2 | 3 | 4 | 5, MonthlyWeekSlot>;
  certificateCount: number;
  totalMonthlyScore: number;
  cumulativeAspectA: number;
  lastWeekScore: number;
  hasUnfinalizedWeeks: boolean;
  rank: number;
  tieBreakerNote: string;
}

export interface MonthlyRecapComputation {
  rows: MonthlyClassRecapRow[];
  periodsInMonth: JudgingPeriod[];
  isMonthFullyFinalized: boolean;
  hasExactTopTie: boolean;
  topCandidates: MonthlyClassRecapRow[];
}

/**
 * Centralized Lampiran 3 Monthly Certificate & Cumulative Score Engine (Requirement 9 & 17).
 * Consideration order when certificateCount is equal:
 * Jumlah sertifikat sama -> total skor kumulatif -> skor Aspek A -> nilai pekan terakhir -> keputusan Kepala Madrasah.
 */
export function computeMonthlyRecap(
  classes: SchoolClass[],
  allPeriods: JudgingPeriod[],
  evaluations: Evaluation[],
  weeklyResults: WeeklyResult[],
  certificates: Certificate[],
  month: number,
  year: number
): MonthlyRecapComputation {
  const activeClasses = classes.filter((c) => c.active);
  const periodsInMonth = allPeriods
    .filter((p) => p.month === month && p.year === year)
    .sort((a, b) => a.weekNumber - b.weekNumber);

  // Precompute weekly recaps for each period in this month
  const weeklyMap = new Map<string, WeeklyRecapComputation>();
  for (const p of periodsInMonth) {
    weeklyMap.set(p.id, computeWeeklyRecap(activeClasses, evaluations, p.id));
  }

  let isMonthFullyFinalized = periodsInMonth.length > 0;
  for (const p of periodsInMonth) {
    const wr = weeklyResults.find((w) => w.periodId === p.id && w.status === 'APPROVED');
    const comp = weeklyMap.get(p.id);
    if (!wr || !comp || !comp.allClassesComplete) {
      isMonthFullyFinalized = false;
    }
  }

  const rows: MonthlyClassRecapRow[] = activeClasses.map((cls) => {
    const weeks = {} as Record<1 | 2 | 3 | 4 | 5, MonthlyWeekSlot>;
    let certificateCount = 0;
    let totalMonthlyScore = 0;
    let cumulativeAspectA = 0;
    let lastWeekScore = 0;
    let hasUnfinalizedWeeks = false;

    ([1, 2, 3, 4, 5] as const).forEach((wn) => {
      const period = periodsInMonth.find((p) => p.weekNumber === wn) || null;
      if (!period) {
        weeks[wn] = {
          weekNumber: wn,
          periodId: null,
          wonCertificate: false,
          weeklyScore: null,
          isWeekFinal: true,
        };
        return;
      }

      const comp = weeklyMap.get(period.id);
      const clsRow = comp?.rows.find((r) => r.classId === cls.id);
      const approvedWeekly = weeklyResults.find(
        (w) => w.periodId === period.id && w.status === 'APPROVED'
      );

      // Active non-revoked certificate check or approved weekly winner check
      const hasRevokedCert = certificates.some(
        (cert) =>
          cert.awardType === 'WEEKLY' &&
          cert.periodId === period.id &&
          cert.classId === cls.id &&
          cert.status === 'REVOKED'
      );

      const wonCertificate =
        Boolean(approvedWeekly && approvedWeekly.winnerClassId === cls.id) && !hasRevokedCert;

      const isWeekFinal = Boolean(clsRow?.isComplete && comp?.allClassesComplete && approvedWeekly);
      if (!isWeekFinal) {
        hasUnfinalizedWeeks = true;
      }

      // Only include valid completed scores in official monthly sum; incomplete weeks are NEVER counted as 0 or half-baked
      const validWeeklyScore = clsRow?.isComplete && clsRow.averageScore !== null ? clsRow.averageScore : null;
      if (isWeekFinal && validWeeklyScore !== null) {
        totalMonthlyScore += validWeeklyScore;
        cumulativeAspectA += clsRow?.avgAspectA ?? 0;
        lastWeekScore = validWeeklyScore;
      }

      if (wonCertificate) {
        certificateCount += 1;
      }

      weeks[wn] = {
        weekNumber: wn,
        periodId: period.id,
        wonCertificate,
        weeklyScore: validWeeklyScore,
        isWeekFinal,
      };
    });

    return {
      classId: cls.id,
      classCode: cls.code,
      className: cls.name,
      homeroomTeacherName: cls.homeroomTeacherName,
      weeks,
      certificateCount,
      totalMonthlyScore,
      cumulativeAspectA,
      lastWeekScore,
      hasUnfinalizedWeeks,
      rank: 0,
      tieBreakerNote: '',
    };
  });

  // Sort according to Lampiran 3 rule:
  // Jumlah sertifikat -> total skor kumulatif -> skor Aspek A -> nilai pekan terakhir
  rows.sort((a, b) => {
    if (b.certificateCount !== a.certificateCount) {
      return b.certificateCount - a.certificateCount;
    }
    const diffTotal = b.totalMonthlyScore - a.totalMonthlyScore;
    if (Math.abs(diffTotal) > EPSILON) return diffTotal;

    const diffA = b.cumulativeAspectA - a.cumulativeAspectA;
    if (Math.abs(diffA) > EPSILON) return diffA;

    const diffLast = b.lastWeekScore - a.lastWeekScore;
    if (Math.abs(diffLast) > EPSILON) return diffLast;

    return a.className.localeCompare(b.className, 'id');
  });

  rows.forEach((curr, idx) => {
    if (idx === 0) {
      curr.rank = 1;
      return;
    }
    const prev = rows[idx - 1];
    if (curr.certificateCount !== prev.certificateCount) {
      curr.rank = idx + 1;
      return;
    }
    const sameTotal = Math.abs(curr.totalMonthlyScore - prev.totalMonthlyScore) <= EPSILON;
    const sameA = Math.abs(curr.cumulativeAspectA - prev.cumulativeAspectA) <= EPSILON;
    const sameLast = Math.abs(curr.lastWeekScore - prev.lastWeekScore) <= EPSILON;

    if (!sameTotal) {
      curr.rank = idx + 1;
      prev.tieBreakerNote = prev.tieBreakerNote || 'Unggul Total Skor Kumulatif';
    } else if (!sameA) {
      curr.rank = idx + 1;
      prev.tieBreakerNote = prev.tieBreakerNote || 'Unggul Akumulasi Aspek A';
    } else if (!sameLast) {
      curr.rank = idx + 1;
      prev.tieBreakerNote = prev.tieBreakerNote || 'Unggul Nilai Pekan Terakhir';
    } else {
      curr.rank = prev.rank;
      prev.tieBreakerNote = 'Seri — Menunggu Keputusan Kepala Madrasah';
      curr.tieBreakerNote = 'Seri — Menunggu Keputusan Kepala Madrasah';
    }
  });

  const topCandidates = rows.filter((r) => r.rank === 1);
  const hasExactTopTie = topCandidates.length > 1;

  return {
    rows,
    periodsInMonth,
    isMonthFullyFinalized,
    hasExactTopTie,
    topCandidates,
  };
}

export function formatScore(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

export function formatIndonesianDate(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const year = Number(parts[0]);
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (monthIdx < 0 || monthIdx > 11) return isoDate;
  return `${day} ${INDONESIAN_MONTHS[monthIdx]} ${year}`;
}

export function generateCertificateNumber(
  pattern: string,
  year: number,
  month: number,
  sequenceNumber: number
): string {
  const paddedMonth = String(month).padStart(2, '0');
  const paddedSeq = String(sequenceNumber).padStart(3, '0');
  const base = pattern && pattern.trim().length >= 5
    ? pattern.trim()
    : 'SERT/MDM/{TAHUN}/{BULAN}/{URUT}';

  return base
    .replace(/\[TAHUN\]|\{TAHUN\}/gi, String(year))
    .replace(/\[BULAN\]|\{BULAN\}/gi, paddedMonth)
    .replace(/\[NOMOR URUT\]|\[URUT\]|\{URUT\}|\{NOMOR_URUT\}/gi, paddedSeq);
}
