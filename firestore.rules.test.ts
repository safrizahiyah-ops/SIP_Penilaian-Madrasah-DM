/**
 * Phase 0 Firestore Security Rules Test Suite (Dirty Dozen Verification)
 * Verifies all 12 adversarial payloads against SIP-KELAS DARUL MAHFUDZ rules.
 */

export interface SimulatedContext {
  uid: string | null;
  email?: string;
  emailVerified?: boolean;
}

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: SimulatedContext;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Privilege Escalation on User Registration',
    operation: 'create',
    path: '/users/attacker_1',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', emailVerified: true },
    payload: {
      uid: 'attacker_1',
      displayName: 'Attacker',
      role: 'administrator',
      judgeSlot: 'NONE',
      linkedJudgeId: '',
      active: true,
      readerUids: ['attacker_1'],
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Class Creation',
    operation: 'create',
    path: '/classes/X_A',
    auth: { uid: 'admin_1', email: 'safrialwahyu@gmail.com', emailVerified: true },
    payload: {
      id: 'X_A',
      code: 'KLS-XA',
      name: 'X-A',
      grade: 'X',
      homeroomTeacherId: 'tch_1',
      homeroomTeacherName: 'Ahmad Fauzi, S.Pd.',
      active: true,
      readerUids: ['admin_1'],
      createdBy: 'admin_1',
      isSuperClass: true, // Ghost field rejected by hasOnly()
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Bootstrapped Admin Email Spoof',
    operation: 'update',
    path: '/school_settings/main',
    auth: { uid: 'spoof_uid', email: 'safrialwahyu@gmail.com', emailVerified: false },
    payload: { schoolName: 'Hacked School' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'PII Blanket Read Leak on Isolated User Private Info',
    operation: 'get',
    path: '/user_private/victim_uid',
    auth: { uid: 'judge_1', email: 'judge1@example.com', emailVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unscoped Collection Scraping Bypassing readerUids',
    operation: 'list',
    path: '/evaluations',
    auth: { uid: 'outsider_uid', email: 'outsider@example.com', emailVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Evaluation Rubric Item Score Overflow',
    operation: 'create',
    path: '/evaluations/eval_p1_X_A_I',
    auth: { uid: 'judge_1', email: 'judge1@example.com', emailVerified: true },
    payload: {
      id: 'eval_p1_X_A_I',
      scores: { a1: 99 }, // Max allowed for a1 is 5
      totalScore: 105,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Evaluation Referencing Non-Existent Class',
    operation: 'create',
    path: '/evaluations/eval_orphan',
    auth: { uid: 'judge_1', email: 'judge1@example.com', emailVerified: true },
    payload: {
      id: 'eval_orphan',
      classId: 'ghost_class_999',
      periodId: 'period_1',
      judgeId: 'judge_1',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Unauthorized Weekly Winner Ratification by Coordinator',
    operation: 'create',
    path: '/weekly_results/weekly_p1',
    auth: { uid: 'koord_1', email: 'koord@example.com', emailVerified: true },
    payload: {
      id: 'weekly_p1',
      status: 'APPROVED', // Only Kepala Madrasah or Admin can ratify APPROVED
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Terminal State Tampering on Approved Weekly Result',
    operation: 'update',
    path: '/weekly_results/weekly_p1',
    auth: { uid: 'koord_1', email: 'koord@example.com', emailVerified: true },
    payload: {
      winnerClassId: 'X_B',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Value Poisoning on Whitelisted Update Key',
    operation: 'update',
    path: '/users/user_1',
    auth: { uid: 'user_1', email: 'user1@example.com', emailVerified: true },
    payload: {
      displayName: true, // Invalid type boolean instead of string 1..120
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'ID Poisoning with Special Characters',
    operation: 'create',
    path: '/classes/bad$id!spaces',
    auth: { uid: 'admin_1', email: 'safrialwahyu@gmail.com', emailVerified: true },
    payload: { id: 'bad$id!spaces' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Audit Log Deletion Attempt by Admin',
    operation: 'delete',
    path: '/audit_logs/log_001',
    auth: { uid: 'admin_1', email: 'safrialwahyu@gmail.com', emailVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
