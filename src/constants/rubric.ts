import {
  AppDatabaseSnapshot,
  Evaluation,
  ItemNotesMap,
  Judge,
  JudgingPeriod,
  MonthlyResult,
  RubricGroupDef,
  RubricItemDef,
  RubricItemKey,
  SchoolClass,
  SchoolSettings,
  ScoresMap,
  Teacher,
  TrophyRecord,
  UserProfile,
  UserRole,
  WeeklyResult,
  Certificate,
} from '../types';

export const INDONESIAN_MONTHS: string[] = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrator',
  penilai: 'Penilai Lomba',
  koordinator: 'Koordinator Lomba',
  kepala_madrasah: 'Kepala Madrasah',
  viewer: 'Tamu / Menunggu Peran',
};

export const RUBRIC_GROUPS: RubricGroupDef[] = [
  {
    code: 'A',
    title: 'A. Kebersihan dan Kerapian Kelas',
    maxSubtotal: 45,
    items: [
      { key: 'a1', aspect: 'A', number: 1, label: 'Lantai', maxScore: 5 },
      { key: 'a2', aspect: 'A', number: 2, label: 'Dinding, jendela, pintu, dan plafon', maxScore: 5 },
      { key: 'a3', aspect: 'A', number: 3, label: 'Meja, kursi, laci, dan kolong', maxScore: 5 },
      { key: 'a4', aspect: 'A', number: 4, label: 'Papan tulis dan perlengkapannya', maxScore: 5 },
      { key: 'a5', aspect: 'A', number: 5, label: 'Tempat sampah', maxScore: 5 },
      { key: 'a6', aspect: 'A', number: 6, label: 'Area luar kelas', maxScore: 5 },
      { key: 'a7', aspect: 'A', number: 7, label: 'Sirkulasi udara dan pencahayaan', maxScore: 5 },
      { key: 'a8', aspect: 'A', number: 8, label: 'Perlengkapan kebersihan', maxScore: 5 },
      { key: 'a9', aspect: 'A', number: 9, label: 'Kerapian barang pribadi siswa', maxScore: 5 },
    ],
  },
  {
    code: 'B',
    title: 'B. Penataan Kelas Bertema',
    maxSubtotal: 35,
    items: [
      { key: 'b1', aspect: 'B', number: 1, label: 'Kesesuaian dengan tema', maxScore: 10 },
      { key: 'b2', aspect: 'B', number: 2, label: 'Kreativitas dan orisinalitas', maxScore: 7 },
      { key: 'b3', aspect: 'B', number: 3, label: 'Estetika dan keserasian', maxScore: 6 },
      { key: 'b4', aspect: 'B', number: 4, label: 'Nilai edukatif dan islami', maxScore: 8 },
      { key: 'b5', aspect: 'B', number: 5, label: 'Ramah lingkungan, kerapian, dan perawatan', maxScore: 4 },
    ],
  },
  {
    code: 'C',
    title: 'C. Kelengkapan Perangkat dan Tata Ruang Kelas',
    maxSubtotal: 10,
    items: [
      { key: 'c1', aspect: 'C', number: 1, label: 'Struktur organisasi dan jadwal piket', maxScore: 2 },
      { key: 'c2', aspect: 'C', number: 2, label: 'Perangkat informasi kelas', maxScore: 2 },
      { key: 'c3', aspect: 'C', number: 3, label: 'Pojok baca/literasi', maxScore: 2 },
      { key: 'c4', aspect: 'C', number: 4, label: 'Atribut kenegaraan dan madrasah', maxScore: 2 },
      { key: 'c5', aspect: 'C', number: 5, label: 'Tata letak meja-kursi dan fasilitas', maxScore: 2 },
    ],
  },
  {
    code: 'D',
    title: 'D. Partisipasi dan Kedisiplinan',
    maxSubtotal: 10,
    items: [
      { key: 'd1', aspect: 'D', number: 1, label: 'Peran wali kelas', maxScore: 4 },
      { key: 'd2', aspect: 'D', number: 2, label: 'Keterlibatan dan kekompakan siswa', maxScore: 3 },
      { key: 'd3', aspect: 'D', number: 3, label: 'Kedisiplinan piket harian', maxScore: 3 },
    ],
  },
];

export const ALL_RUBRIC_ITEMS: RubricItemDef[] = RUBRIC_GROUPS.flatMap((g) => g.items);

export const ALL_RUBRIC_KEYS: RubricItemKey[] = ALL_RUBRIC_ITEMS.map((i) => i.key);

export function createEmptyScores(): ScoresMap {
  const s = {} as ScoresMap;
  for (const item of ALL_RUBRIC_ITEMS) {
    s[item.key] = 0;
  }
  return s;
}

export function createEmptyItemNotes(): ItemNotesMap {
  const n = {} as ItemNotesMap;
  for (const item of ALL_RUBRIC_ITEMS) {
    n[item.key] = '';
  }
  return n;
}

export function createDefaultSchoolSettings(uid: string): SchoolSettings {
  return {
    id: 'main',
    schoolName: 'MA Darul Mahfudz',
    academicYear: '2026/2027',
    location: 'Lekopadis',
    address: 'Jl. Pendidikan Islam Lekopadis, Kec. Tinambung, Kab. Polewali Mandar',
    motto: 'Kebersihan adalah sebagian dari iman.',
    slogan: 'Kelas Bersih, Kelas Indah, Prestasi Meningkat.',
    principalName: 'H. Muhammad Mahfudz, S.Ag., M.Pd.I.',
    principalNip: '197504122003121002',
    vicePrincipalName: 'Drs. Abdul Rahman, M.Pd.',
    vicePrincipalNip: '197808192006041005',
    coordinatorName: 'Siti Aminah, S.Pd.I.',
    certificateFormat: 'SERT/MDM/{TAHUN}/{BULAN}/{URUT}',
    winnerRuleText:
      'Jumlah sertifikat sama → total skor kumulatif → skor Aspek A → nilai pekan terakhir → keputusan Kepala Madrasah.',
    logoDataUrl: '',
    buildingDataUrl: '',
    currentTrophyClassId: 'XI_IPA_1',
    currentTrophyClassName: 'XI IPA 1',
    staffUids: [uid],
    readerUids: [uid],
    updatedBy: uid,
  };
}

/**
 * Generates initial 12 classes, 12 homeroom teachers, 2 judges, judging schedules,
 * and realistic initial evaluations for MA Darul Mahfudz TP 2026/2027.
 */
export function buildInitialSeedData(adminUid: string, readerUids: string[]): AppDatabaseSnapshot {
  const settings = createDefaultSchoolSettings(adminUid);
  settings.staffUids = readerUids;
  settings.readerUids = readerUids;

  const classSpecs: Array<{
    id: string;
    code: string;
    name: string;
    grade: 'X' | 'XI' | 'XII';
    teacherId: string;
    teacherName: string;
    nip: string;
    phone: string;
  }> = [
    { id: 'X_IPA_1', code: 'KLS-X01', name: 'X IPA 1', grade: 'X', teacherId: 'TCH_01', teacherName: 'Ahmad Fauzi, S.Pd.', nip: '198603142011011004', phone: '081241001001' },
    { id: 'X_IPA_2', code: 'KLS-X02', name: 'X IPA 2', grade: 'X', teacherId: 'TCH_02', teacherName: 'Nurul Hidayah, S.Si.', nip: '198907222014022003', phone: '081241001002' },
    { id: 'X_IPS_1', code: 'KLS-X03', name: 'X IPS 1', grade: 'X', teacherId: 'TCH_03', teacherName: 'Muh. Ridwan, S.E.', nip: '198511092010011008', phone: '081241001003' },
    { id: 'X_IPS_2', code: 'KLS-X04', name: 'X IPS 2', grade: 'X', teacherId: 'TCH_04', teacherName: 'Rahmawati, S.Pd.', nip: '199002182015032005', phone: '081241001004' },
    { id: 'XI_IPA_1', code: 'KLS-XI01', name: 'XI IPA 1', grade: 'XI', teacherId: 'TCH_05', teacherName: 'Hj. St. Maryam, S.Pd., M.Si.', nip: '198205052008012011', phone: '081241001005' },
    { id: 'XI_IPA_2', code: 'KLS-XI02', name: 'XI IPA 2', grade: 'XI', teacherId: 'TCH_06', teacherName: 'Lukman Hakim, S.Pd.', nip: '198809122013021002', phone: '081241001006' },
    { id: 'XI_IPS_1', code: 'KLS-XI03', name: 'XI IPS 1', grade: 'XI', teacherId: 'TCH_07', teacherName: 'Fatimah Azzahra, S.Sos.', nip: '199104272016032006', phone: '081241001007' },
    { id: 'XI_IPS_2', code: 'KLS-XI04', name: 'XI IPS 2', grade: 'XI', teacherId: 'TCH_08', teacherName: 'Syamsul Bahri, S.Pd.I.', nip: '198412012009011007', phone: '081241001008' },
    { id: 'XII_IPA_1', code: 'KLS-XII01', name: 'XII IPA 1', grade: 'XII', teacherId: 'TCH_09', teacherName: 'Dr. H. Hasanuddin, M.Pd.', nip: '197906172005011003', phone: '081241001009' },
    { id: 'XII_IPA_2', code: 'KLS-XII02', name: 'XII IPA 2', grade: 'XII', teacherId: 'TCH_10', teacherName: 'Aisyah Munawarah, S.Pd.', nip: '198708302012012009', phone: '081241001010' },
    { id: 'XII_IPS_1', code: 'KLS-XII03', name: 'XII IPS 1', grade: 'XII', teacherId: 'TCH_11', teacherName: 'Burhanuddin, S.Hum.', nip: '198301252009041002', phone: '081241001011' },
    { id: 'XII_IPS_2', code: 'KLS-XII04', name: 'XII IPS 2', grade: 'XII', teacherId: 'TCH_12', teacherName: 'Khadijah Tahir, S.Ag.', nip: '198110112007012004', phone: '081241001012' },
  ];

  const classes: SchoolClass[] = classSpecs.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    grade: c.grade,
    homeroomTeacherId: c.teacherId,
    homeroomTeacherName: c.teacherName,
    active: true,
    readerUids,
    createdBy: adminUid,
  }));

  const teachers: Teacher[] = classSpecs.map((c) => ({
    id: c.teacherId,
    fullName: c.teacherName,
    nip: c.nip,
    assignedClassId: c.id,
    assignedClassName: c.name,
    active: true,
    readerUids,
    createdBy: adminUid,
  }));

  const teacherContacts: Record<string, string> = {};
  for (const c of classSpecs) {
    teacherContacts[c.teacherId] = c.phone;
  }

  const judges: Judge[] = [
    {
      id: 'JDG_I',
      fullName: 'Ust. M. Yusuf Al-Mandari, S.Pd.I.',
      position: 'Pembina OSIM / Tim Ketertiban',
      identityNumber: '198402102010011005',
      judgeRole: 'I',
      linkedUserUid: 'demo_penilai_1',
      active: true,
      readerUids,
      createdBy: adminUid,
    },
    {
      id: 'JDG_II',
      fullName: 'Hj. Mardiana, S.KM., M.Pd.',
      position: 'Pembina UKS & Lingkungan Hidup',
      identityNumber: '198611232011012008',
      judgeRole: 'II',
      linkedUserUid: 'demo_penilai_2',
      active: true,
      readerUids,
      createdBy: adminUid,
    },
  ];

  const judgingPeriods: JudgingPeriod[] = [
    {
      id: 'PRD_2026_10_P1',
      weekNumber: 1,
      globalWeekNumber: 12,
      month: 10,
      year: 2026,
      academicYear: '2026/2027',
      scheduledDate: '2026-10-03',
      ceremonyDate: '2026-10-05',
      theme: 'Literasi Islami & Jejak Peradaban Nusantara',
      status: 'CLOSED',
      readerUids,
      createdBy: adminUid,
    },
    {
      id: 'PRD_2026_10_P2',
      weekNumber: 2,
      globalWeekNumber: 13,
      month: 10,
      year: 2026,
      academicYear: '2026/2027',
      scheduledDate: '2026-10-10',
      ceremonyDate: '2026-10-12',
      theme: 'Madrasah Hijau Ramah Lingkungan (Eco-Madrasah)',
      status: 'CLOSED',
      readerUids,
      createdBy: adminUid,
    },
    {
      id: 'PRD_2026_10_P3',
      weekNumber: 3,
      globalWeekNumber: 14,
      month: 10,
      year: 2026,
      academicYear: '2026/2027',
      scheduledDate: '2026-10-17',
      ceremonyDate: '2026-10-19',
      theme: 'Semangat Hari Santri & Kemandirian Umat',
      status: 'CLOSED',
      readerUids,
      createdBy: adminUid,
    },
    {
      id: 'PRD_2026_10_P4',
      weekNumber: 4,
      globalWeekNumber: 15,
      month: 10,
      year: 2026,
      academicYear: '2026/2027',
      scheduledDate: '2026-10-24',
      ceremonyDate: '2026-10-26',
      theme: 'Sumpah Pemuda & Inovasi Generasi Madrasah',
      status: 'OPEN',
      readerUids,
      createdBy: adminUid,
    },
  ];

  const makeScores = (targetTotal: number, seedOffset: number): {
    scores: ScoresMap;
    subtotalA: number;
    subtotalB: number;
    subtotalC: number;
    subtotalD: number;
    totalScore: number;
  } => {
    const scores = createEmptyScores();
    // Distribute realistically across A (max 45), B (max 35), C (max 10), D (max 10)
    const ratio = Math.min(1, Math.max(0.6, targetTotal / 100));
    let subtotalA = 0;
    let subtotalB = 0;
    let subtotalC = 0;
    let subtotalD = 0;

    ALL_RUBRIC_ITEMS.forEach((item, idx) => {
      const jitter = ((idx + seedOffset) % 3 === 0 ? 0.04 : (idx + seedOffset) % 3 === 1 ? -0.03 : 0);
      const val = Math.min(item.maxScore, Math.max(1, Math.round(item.maxScore * (ratio + jitter))));
      scores[item.key] = val;
      if (item.aspect === 'A') subtotalA += val;
      if (item.aspect === 'B') subtotalB += val;
      if (item.aspect === 'C') subtotalC += val;
      if (item.aspect === 'D') subtotalD += val;
    });

    return {
      scores,
      subtotalA,
      subtotalB,
      subtotalC,
      subtotalD,
      totalScore: subtotalA + subtotalB + subtotalC + subtotalD,
    };
  };

  const evaluations: Evaluation[] = [];

  // P1, P2, P3 complete for all 12 classes; P4 complete for 10 classes & incomplete Judge II on 2 classes (shows live alert on Dashboard!)
  const baseTargetsP1 = [86, 84, 82, 80, 93, 88, 85, 83, 91, 87, 84, 82];
  const baseTargetsP2 = [87, 85, 83, 81, 91, 89, 86, 84, 94, 88, 85, 83];
  const baseTargetsP3 = [88, 86, 84, 82, 95, 90, 87, 85, 92, 89, 86, 84];
  const baseTargetsP4 = [90, 87, 85, 83, 94, 91, 88, 86, 93, 89, 87, 85];

  const periodTargets = [
    { period: judgingPeriods[0], targets: baseTargetsP1, completeAll: true, locked: true },
    { period: judgingPeriods[1], targets: baseTargetsP2, completeAll: true, locked: true },
    { period: judgingPeriods[2], targets: baseTargetsP3, completeAll: true, locked: true },
    { period: judgingPeriods[3], targets: baseTargetsP4, completeAll: false, locked: false },
  ];

  for (const pt of periodTargets) {
    classes.forEach((cls, idx) => {
      const s1 = makeScores(pt.targets[idx] + 1, idx + pt.period.weekNumber);
      const notes1 = createEmptyItemNotes();
      notes1.a1 = 'Lantai bersih dan bebas debu.';
      notes1.b1 = 'Dekorasi selaras dengan tema pekan ini.';

      evaluations.push({
        id: `eval_${pt.period.id}_${cls.id}_I`,
        periodId: pt.period.id,
        weekNumber: pt.period.weekNumber,
        month: pt.period.month,
        year: pt.period.year,
        evaluationDate: pt.period.scheduledDate,
        classId: cls.id,
        className: cls.name,
        homeroomTeacherName: cls.homeroomTeacherName,
        theme: pt.period.theme,
        judgeId: 'JDG_I',
        judgeName: judges[0].fullName,
        judgeNumber: 'I',
        scores: s1.scores,
        itemNotes: notes1,
        subtotalA: s1.subtotalA,
        subtotalB: s1.subtotalB,
        subtotalC: s1.subtotalC,
        subtotalD: s1.subtotalD,
        totalScore: s1.totalScore,
        generalNote: 'Penataan kelas rapi, sirkulasi udara terjaga baik.',
        status: pt.locked ? 'LOCKED' : 'FINAL',
        revisionCount: 0,
        readerUids,
        createdBy: adminUid,
        updatedBy: adminUid,
      });

      // Leave last 2 classes on P4 without Judge II yet so Dashboard alerts are live & testable
      if (pt.completeAll || idx < 10) {
        const s2 = makeScores(pt.targets[idx] - 1, idx * 2 + pt.period.weekNumber);
        const notes2 = createEmptyItemNotes();
        notes2.b4 = 'Kutipan ayat dan pojok literasi sangat edukatif.';

        evaluations.push({
          id: `eval_${pt.period.id}_${cls.id}_II`,
          periodId: pt.period.id,
          weekNumber: pt.period.weekNumber,
          month: pt.period.month,
          year: pt.period.year,
          evaluationDate: pt.period.scheduledDate,
          classId: cls.id,
          className: cls.name,
          homeroomTeacherName: cls.homeroomTeacherName,
          theme: pt.period.theme,
          judgeId: 'JDG_II',
          judgeName: judges[1].fullName,
          judgeNumber: 'II',
          scores: s2.scores,
          itemNotes: notes2,
          subtotalA: s2.subtotalA,
          subtotalB: s2.subtotalB,
          subtotalC: s2.subtotalC,
          subtotalD: s2.subtotalD,
          totalScore: s2.totalScore,
          generalNote: 'Partisipasi piket siswa kompak dan atribut lengkap.',
          status: pt.locked ? 'LOCKED' : 'FINAL',
          revisionCount: 0,
          readerUids,
          createdBy: adminUid,
          updatedBy: adminUid,
        });
      }
    });
  }

  // Compute accurate P1, P2, P3 winners from generated scores
  const getAvg = (periodId: string, classId: string) => {
    const e1 = evaluations.find((e) => e.periodId === periodId && e.classId === classId && e.judgeNumber === 'I');
    const e2 = evaluations.find((e) => e.periodId === periodId && e.classId === classId && e.judgeNumber === 'II');
    return e1 && e2 ? (e1.totalScore + e2.totalScore) / 2 : 0;
  };

  const weeklyResults: WeeklyResult[] = [
    {
      id: 'weekly_PRD_2026_10_P1',
      periodId: 'PRD_2026_10_P1',
      weekNumber: 1,
      month: 10,
      year: 2026,
      theme: judgingPeriods[0].theme,
      winnerClassId: 'XI_IPA_1',
      winnerClassName: 'XI IPA 1',
      winnerHomeroomTeacher: 'Hj. St. Maryam, S.Pd., M.Si.',
      winnerScore: getAvg('PRD_2026_10_P1', 'XI_IPA_1'),
      hasTie: false,
      tieResolutionNote: '',
      coordinatorName: settings.coordinatorName,
      principalName: settings.principalName,
      status: 'APPROVED',
      approvedByUid: adminUid,
      approvedByName: settings.principalName,
      approvedAtIso: '2026-10-05T07:30:00.000Z',
      readerUids,
      createdBy: adminUid,
    },
    {
      id: 'weekly_PRD_2026_10_P2',
      periodId: 'PRD_2026_10_P2',
      weekNumber: 2,
      month: 10,
      year: 2026,
      theme: judgingPeriods[1].theme,
      winnerClassId: 'XII_IPA_1',
      winnerClassName: 'XII IPA 1',
      winnerHomeroomTeacher: 'Dr. H. Hasanuddin, M.Pd.',
      winnerScore: getAvg('PRD_2026_10_P2', 'XII_IPA_1'),
      hasTie: false,
      tieResolutionNote: '',
      coordinatorName: settings.coordinatorName,
      principalName: settings.principalName,
      status: 'APPROVED',
      approvedByUid: adminUid,
      approvedByName: settings.principalName,
      approvedAtIso: '2026-10-12T07:30:00.000Z',
      readerUids,
      createdBy: adminUid,
    },
    {
      id: 'weekly_PRD_2026_10_P3',
      periodId: 'PRD_2026_10_P3',
      weekNumber: 3,
      month: 10,
      year: 2026,
      theme: judgingPeriods[2].theme,
      winnerClassId: 'XI_IPA_1',
      winnerClassName: 'XI IPA 1',
      winnerHomeroomTeacher: 'Hj. St. Maryam, S.Pd., M.Si.',
      winnerScore: getAvg('PRD_2026_10_P3', 'XI_IPA_1'),
      hasTie: false,
      tieResolutionNote: '',
      coordinatorName: settings.coordinatorName,
      principalName: settings.principalName,
      status: 'APPROVED',
      approvedByUid: adminUid,
      approvedByName: settings.principalName,
      approvedAtIso: '2026-10-19T07:30:00.000Z',
      readerUids,
      createdBy: adminUid,
    },
  ];

  const certificates: Certificate[] = [
    {
      id: 'cert_WEEKLY_PRD_2026_10_P1_XI_IPA_1',
      certificateNumber: 'SERT/MDM/2026/10/001',
      sequenceNumber: 1,
      awardType: 'WEEKLY',
      periodId: 'PRD_2026_10_P1',
      periodLabel: 'Pekan Ke-1 Bulan Oktober 2026',
      classId: 'XI_IPA_1',
      className: 'XI IPA 1',
      homeroomTeacherName: 'Hj. St. Maryam, S.Pd., M.Si.',
      recipientDisplay: 'KELAS XI IPA 1 (Wali Kelas: Hj. St. Maryam, S.Pd., M.Si.)',
      roleTitle: 'PEMENANG / KELAS TERBAIK MINGGUAN',
      finalScore: weeklyResults[0].winnerScore,
      issueDate: '2026-10-05',
      principalName: settings.principalName,
      vicePrincipalName: settings.vicePrincipalName,
      status: 'ISSUED',
      reissueCount: 0,
      revokedReason: '',
      revokedByName: '',
      issuedByUid: adminUid,
      issuedByName: settings.principalName,
      readerUids,
    },
    {
      id: 'cert_WEEKLY_PRD_2026_10_P2_XII_IPA_1',
      certificateNumber: 'SERT/MDM/2026/10/002',
      sequenceNumber: 2,
      awardType: 'WEEKLY',
      periodId: 'PRD_2026_10_P2',
      periodLabel: 'Pekan Ke-2 Bulan Oktober 2026',
      classId: 'XII_IPA_1',
      className: 'XII IPA 1',
      homeroomTeacherName: 'Dr. H. Hasanuddin, M.Pd.',
      recipientDisplay: 'KELAS XII IPA 1 (Wali Kelas: Dr. H. Hasanuddin, M.Pd.)',
      roleTitle: 'PEMENANG / KELAS TERBAIK MINGGUAN',
      finalScore: weeklyResults[1].winnerScore,
      issueDate: '2026-10-12',
      principalName: settings.principalName,
      vicePrincipalName: settings.vicePrincipalName,
      status: 'ISSUED',
      reissueCount: 0,
      revokedReason: '',
      revokedByName: '',
      issuedByUid: adminUid,
      issuedByName: settings.principalName,
      readerUids,
    },
    {
      id: 'cert_WEEKLY_PRD_2026_10_P3_XI_IPA_1',
      certificateNumber: 'SERT/MDM/2026/10/003',
      sequenceNumber: 3,
      awardType: 'WEEKLY',
      periodId: 'PRD_2026_10_P3',
      periodLabel: 'Pekan Ke-3 Bulan Oktober 2026',
      classId: 'XI_IPA_1',
      className: 'XI IPA 1',
      homeroomTeacherName: 'Hj. St. Maryam, S.Pd., M.Si.',
      recipientDisplay: 'KELAS XI IPA 1 (Wali Kelas: Hj. St. Maryam, S.Pd., M.Si.)',
      roleTitle: 'PEMENANG / KELAS TERBAIK MINGGUAN',
      finalScore: weeklyResults[2].winnerScore,
      issueDate: '2026-10-19',
      principalName: settings.principalName,
      vicePrincipalName: settings.vicePrincipalName,
      status: 'ISSUED',
      reissueCount: 0,
      revokedReason: '',
      revokedByName: '',
      issuedByUid: adminUid,
      issuedByName: settings.principalName,
      readerUids,
    },
  ];

  const monthlyResults: MonthlyResult[] = [];

  const trophyHistory: TrophyRecord[] = [
    {
      id: 'trophy_2026_09_XI_IPA_1',
      periodLabel: 'September 2026',
      month: 9,
      year: 2026,
      academicYear: '2026/2027',
      classId: 'XI_IPA_1',
      className: 'XI IPA 1',
      homeroomTeacherName: 'Hj. St. Maryam, S.Pd., M.Si.',
      certificateCount: 2,
      cumulativeScore: 374.5,
      isActiveHolder: true,
      ratifiedByUid: adminUid,
      ratifiedByName: settings.principalName,
      ratifiedByTitle: 'Kepala Madrasah',
      ratifiedDate: '2026-09-28',
      notes: 'Penetapan resmi pemegang Piala Bergilir Kepala Madrasah periode September 2026 usai upacara bendera.',
      status: 'RATIFIED',
      readerUids,
    },
  ];

  const demoUsers: UserProfile[] = [
    {
      uid: adminUid,
      displayName: 'Administrator Madrasah',
      role: 'administrator',
      judgeSlot: 'NONE',
      linkedJudgeId: '',
      active: true,
      readerUids,
    },
  ];

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    schoolSettings: settings,
    users: demoUsers,
    classes,
    teachers,
    teacherContacts,
    judges,
    judgingPeriods,
    evaluations,
    evaluationItems: [],
    weeklyResults,
    monthlyResults,
    trophyHistory,
    certificates,
    auditLogs: [
      {
        id: 'log_init_001',
        action: 'INISIALISASI_DATA',
        module: 'Sistem',
        entityId: 'main',
        summary: 'Inisialisasi awal 12 kelas, wali kelas, 2 penilai, dan jadwal lomba MA Darul Mahfudz TP 2026/2027.',
        actorUid: adminUid,
        actorName: 'Administrator Madrasah',
        actorRole: 'administrator',
        readerUids,
        createdAtIso: '2026-10-01T08:00:00.000Z',
      },
    ],
  };
}
