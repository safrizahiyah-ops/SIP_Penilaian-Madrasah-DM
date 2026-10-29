export type UserRole =
  | 'administrator'
  | 'penilai'
  | 'koordinator'
  | 'kepala_madrasah'
  | 'viewer';

export type JudgeSlot = 'NONE' | 'I' | 'II';
export type JudgeNumber = 'I' | 'II';
export type ClassGrade = 'X' | 'XI' | 'XII';
export type PeriodStatus = 'SCHEDULED' | 'OPEN' | 'CLOSED';
export type EvaluationStatus = 'DRAFT' | 'FINAL' | 'LOCKED';
export type ApprovalStatus = 'PROPOSED' | 'APPROVED';
export type CertificateStatus = 'ISSUED' | 'REVOKED';
export type AwardType = 'WEEKLY' | 'MONTHLY';

export type MenuKey =
  | 'dashboard'
  | 'classes'
  | 'teachers'
  | 'judges'
  | 'schedule'
  | 'evaluation'
  | 'weekly_recap'
  | 'monthly_recap'
  | 'rankings'
  | 'trophy'
  | 'certificates'
  | 'reports'
  | 'settings'
  | 'backup';

export type RubricItemKey =
  | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8' | 'a9'
  | 'b1' | 'b2' | 'b3' | 'b4' | 'b5'
  | 'c1' | 'c2' | 'c3' | 'c4' | 'c5'
  | 'd1' | 'd2' | 'd3';

export type AspectCode = 'A' | 'B' | 'C' | 'D';

export interface RubricItemDef {
  key: RubricItemKey;
  aspect: AspectCode;
  number: number;
  label: string;
  maxScore: number;
}

export interface RubricGroupDef {
  code: AspectCode;
  title: string;
  maxSubtotal: number;
  items: RubricItemDef[];
}

export type ScoresMap = Record<RubricItemKey, number>;
export type ItemNotesMap = Record<RubricItemKey, string>;

export interface UserProfile {
  uid: string;
  displayName: string;
  role: UserRole;
  judgeSlot: JudgeSlot;
  linkedJudgeId: string;
  active: boolean;
  readerUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  phone: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SchoolClass {
  id: string;
  code: string;
  name: string;
  grade: ClassGrade;
  homeroomTeacherId: string;
  homeroomTeacherName: string;
  active: boolean;
  readerUids: string[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Teacher {
  id: string;
  fullName: string;
  nip: string;
  assignedClassId: string;
  assignedClassName: string;
  active: boolean;
  readerUids: string[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TeacherContact {
  teacherId: string;
  phone: string;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Judge {
  id: string;
  fullName: string;
  position: string;
  identityNumber: string;
  judgeRole: JudgeNumber;
  linkedUserUid: string;
  active: boolean;
  readerUids: string[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface JudgingPeriod {
  id: string;
  weekNumber: number; // 1..5 in month
  globalWeekNumber: number; // 1..53 in academic year
  month: number; // 1..12
  year: number;
  academicYear: string;
  scheduledDate: string; // YYYY-MM-DD
  ceremonyDate: string; // YYYY-MM-DD
  theme: string;
  status: PeriodStatus;
  readerUids: string[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Evaluation {
  id: string;
  periodId: string;
  weekNumber: number;
  month: number;
  year: number;
  evaluationDate: string;
  classId: string;
  className: string;
  homeroomTeacherName: string;
  theme: string;
  judgeId: string;
  judgeName: string;
  judgeNumber: JudgeNumber;
  scores: ScoresMap;
  itemNotes: ItemNotesMap;
  subtotalA: number;
  subtotalB: number;
  subtotalC: number;
  subtotalD: number;
  totalScore: number;
  generalNote: string;
  status: EvaluationStatus;
  revisionCount: number;
  readerUids: string[];
  createdBy: string;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EvaluationItem {
  id: string;
  evaluationId: string;
  classId: string;
  periodId: string;
  aspectCode: AspectCode;
  itemCode: string;
  maxScore: number;
  score: number;
  note: string;
  readerUids: string[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WeeklyResult {
  id: string;
  periodId: string;
  weekNumber: number;
  month: number;
  year: number;
  theme: string;
  winnerClassId: string;
  winnerClassName: string;
  winnerHomeroomTeacher: string;
  winnerScore: number;
  hasTie: boolean;
  tieResolutionNote: string;
  coordinatorName: string;
  principalName: string;
  status: ApprovalStatus;
  approvedByUid: string;
  approvedByName: string;
  approvedAtIso: string;
  readerUids: string[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MonthlyResult {
  id: string;
  month: number;
  year: number;
  academicYear: string;
  winnerClassId: string;
  winnerClassName: string;
  winnerHomeroomTeacher: string;
  certificateCount: number;
  totalMonthlyScore: number;
  tieBreakerUsed: string;
  principalDecisionNote: string;
  principalName: string;
  status: ApprovalStatus;
  approvedByUid: string;
  approvedByName: string;
  approvedAtIso: string;
  readerUids: string[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrophyRecord {
  id: string;
  periodLabel: string;
  month: number;
  year: number;
  academicYear: string;
  classId: string;
  className: string;
  homeroomTeacherName: string;
  certificateCount: number;
  cumulativeScore: number;
  isActiveHolder: boolean;
  ratifiedByUid: string;
  ratifiedByName: string;
  ratifiedByTitle: string;
  ratifiedDate: string;
  notes: string;
  status: 'RATIFIED' | 'ARCHIVED';
  readerUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  sequenceNumber: number;
  awardType: AwardType;
  periodId: string;
  periodLabel: string;
  classId: string;
  className: string;
  homeroomTeacherName: string;
  recipientDisplay: string;
  roleTitle: string;
  finalScore: number;
  issueDate: string;
  principalName: string;
  vicePrincipalName: string;
  status: CertificateStatus;
  reissueCount: number;
  revokedReason: string;
  revokedByName: string;
  issuedByUid: string;
  issuedByName: string;
  readerUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SchoolSettings {
  id: string;
  schoolName: string;
  academicYear: string;
  location: string;
  address: string;
  motto: string;
  slogan: string;
  principalName: string;
  principalNip: string;
  vicePrincipalName: string;
  vicePrincipalNip: string;
  coordinatorName: string;
  certificateFormat: string;
  winnerRuleText: string;
  logoDataUrl: string;
  buildingDataUrl: string;
  currentTrophyClassId: string;
  currentTrophyClassName: string;
  staffUids: string[];
  readerUids: string[];
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  action: string;
  module: string;
  entityId: string;
  summary: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  readerUids: string[];
  createdAt?: unknown;
  createdAtIso?: string;
}

export interface AppDatabaseSnapshot {
  version: string;
  exportedAt: string;
  schoolSettings: SchoolSettings;
  users: UserProfile[];
  classes: SchoolClass[];
  teachers: Teacher[];
  teacherContacts: Record<string, string>;
  judges: Judge[];
  judgingPeriods: JudgingPeriod[];
  evaluations: Evaluation[];
  evaluationItems: EvaluationItem[];
  weeklyResults: WeeklyResult[];
  monthlyResults: MonthlyResult[];
  trophyHistory: TrophyRecord[];
  certificates: Certificate[];
  auditLogs: AuditLog[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
}
