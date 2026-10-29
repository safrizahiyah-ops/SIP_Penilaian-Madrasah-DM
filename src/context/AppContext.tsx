import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ALL_RUBRIC_ITEMS,
  buildInitialSeedData,
  createDefaultSchoolSettings,
  INDONESIAN_MONTHS,
} from '../constants/rubric';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  AppDatabaseSnapshot,
  AuditLog,
  AwardType,
  Certificate,
  Evaluation,
  EvaluationItem,
  Judge,
  JudgeNumber,
  JudgeSlot,
  JudgingPeriod,
  MenuKey,
  MonthlyResult,
  SchoolClass,
  SchoolSettings,
  Teacher,
  ToastMessage,
  TrophyRecord,
  UserProfile,
  UserRole,
  WeeklyResult,
} from '../types';
import { calculateEvaluationTotals, generateCertificateNumber } from '../utils/calculations';

const DEMO_STORAGE_KEY = 'sip_kelas_darul_mahfudz_demo_v1';
const BOOTSTRAPPED_ADMIN_EMAIL = 'safrialwahyu@gmail.com';

export type StorageMode = 'UNAUTHENTICATED' | 'CLOUD' | 'DEMO';

export type DemoRolePreset =
  | 'ADMIN'
  | 'PENILAI_I'
  | 'PENILAI_II'
  | 'KOORDINATOR'
  | 'KEPALA_MADRASAH';

function sanitizeId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return (cleaned || `id_${Date.now()}`).slice(0, 64);
}

interface AppContextValue {
  storageMode: StorageMode;
  authLoading: boolean;
  firebaseOnline: boolean;
  firebaseUser: User | null;
  currentUser: UserProfile | null;
  demoPreset: DemoRolePreset;

  // Navigation & Notifications
  activeMenu: MenuKey;
  setActiveMenu: (menu: MenuKey) => void;
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], title: string, description?: string) => void;
  removeToast: (id: string) => void;

  // Data Entities
  settings: SchoolSettings;
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

  // Auth Actions
  loginWithGoogle: () => Promise<void>;
  enterDemoMode: (preset?: DemoRolePreset) => void;
  switchDemoPreset: (preset: DemoRolePreset) => void;
  logout: () => Promise<void>;
  seedCloudInitialData: () => Promise<void>;

  // Master Data Mutations
  saveClass: (input: Omit<SchoolClass, 'readerUids' | 'createdBy' | 'createdAt' | 'updatedAt'>, isEdit: boolean) => Promise<void>;
  importClassesBulk: (items: Array<{ code: string; name: string; grade: 'X' | 'XI' | 'XII'; homeroomTeacherName: string; active: boolean }>) => Promise<number>;
  deleteClass: (classId: string) => Promise<void>;

  saveTeacher: (input: Omit<Teacher, 'readerUids' | 'createdBy' | 'createdAt' | 'updatedAt'>, phone: string, isEdit: boolean) => Promise<void>;
  deleteTeacher: (teacherId: string) => Promise<void>;

  saveJudge: (input: Omit<Judge, 'readerUids' | 'createdBy' | 'createdAt' | 'updatedAt'>, isEdit: boolean) => Promise<void>;
  deleteJudge: (judgeId: string) => Promise<void>;

  saveJudgingPeriod: (input: Omit<JudgingPeriod, 'readerUids' | 'createdBy' | 'createdAt' | 'updatedAt'>, isEdit: boolean) => Promise<void>;
  deleteJudgingPeriod: (periodId: string) => Promise<void>;

  // Evaluation Mutations (Lampiran 1)
  saveEvaluation: (params: {
    periodId: string;
    evaluationDate: string;
    classId: string;
    theme: string;
    judgeId: string;
    judgeNumber: JudgeNumber;
    scores: Evaluation['scores'];
    itemNotes: Evaluation['itemNotes'];
    generalNote: string;
    status: 'DRAFT' | 'FINAL';
    allowRevision: boolean;
  }) => Promise<Evaluation>;

  // Weekly & Monthly Ratification (Lampiran 2 & 3 & Piala Bergilir)
  submitWeeklyDecision: (params: {
    periodId: string;
    winnerClassId: string;
    winnerScore: number;
    hasTie: boolean;
    tieResolutionNote: string;
    action: 'PROPOSE' | 'APPROVE';
  }) => Promise<void>;

  submitMonthlyDecision: (params: {
    month: number;
    year: number;
    winnerClassId: string;
    certificateCount: number;
    totalMonthlyScore: number;
    tieBreakerUsed: string;
    principalDecisionNote: string;
    action: 'PROPOSE' | 'APPROVE';
  }) => Promise<void>;

  ratifyTrophyHolder: (params: {
    month: number;
    year: number;
    periodLabel: string;
    classId: string;
    certificateCount: number;
    cumulativeScore: number;
    ratifiedDate: string;
    notes: string;
  }) => Promise<void>;

  // Certificates
  issueCertificate: (params: {
    awardType: AwardType;
    periodId: string;
    periodLabel: string;
    classId: string;
    recipientDisplay: string;
    roleTitle: string;
    finalScore: number;
    issueDate: string;
    principalName: string;
    vicePrincipalName: string;
    isReissue?: boolean;
  }) => Promise<Certificate>;

  revokeCertificate: (certificateId: string, reason: string) => Promise<void>;

  // Settings, Users & Backup
  updateSchoolSettings: (updated: Partial<SchoolSettings>) => Promise<void>;
  updateUserRole: (targetUid: string, role: UserRole, judgeSlot: JudgeSlot, linkedJudgeId: string, active: boolean) => Promise<void>;
  getSnapshot: () => AppDatabaseSnapshot;
  restoreSnapshot: (snapshot: AppDatabaseSnapshot) => Promise<void>;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const DEMO_USERS_BY_PRESET: Record<DemoRolePreset, UserProfile> = {
  ADMIN: {
    uid: 'demo_admin',
    displayName: 'Administrator Madrasah (Demo)',
    role: 'administrator',
    judgeSlot: 'NONE',
    linkedJudgeId: '',
    active: true,
    readerUids: ['demo_admin'],
  },
  PENILAI_I: {
    uid: 'demo_penilai_1',
    displayName: 'Ust. M. Yusuf Al-Mandari (Penilai I)',
    role: 'penilai',
    judgeSlot: 'I',
    linkedJudgeId: 'JDG_I',
    active: true,
    readerUids: ['demo_admin', 'demo_penilai_1'],
  },
  PENILAI_II: {
    uid: 'demo_penilai_2',
    displayName: 'Hj. Mardiana, S.KM. (Penilai II)',
    role: 'penilai',
    judgeSlot: 'II',
    linkedJudgeId: 'JDG_II',
    active: true,
    readerUids: ['demo_admin', 'demo_penilai_2'],
  },
  KOORDINATOR: {
    uid: 'demo_koordinator',
    displayName: 'Siti Aminah, S.Pd.I. (Koordinator)',
    role: 'koordinator',
    judgeSlot: 'NONE',
    linkedJudgeId: '',
    active: true,
    readerUids: ['demo_admin', 'demo_koordinator'],
  },
  KEPALA_MADRASAH: {
    uid: 'demo_kepala',
    displayName: 'H. Muhammad Mahfudz, M.Pd.I. (Kamad)',
    role: 'kepala_madrasah',
    judgeSlot: 'NONE',
    linkedJudgeId: '',
    active: true,
    readerUids: ['demo_admin', 'demo_kepala'],
  },
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storageMode, setStorageMode] = useState<StorageMode>('UNAUTHENTICATED');
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [firebaseOnline, setFirebaseOnline] = useState<boolean>(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [demoPreset, setDemoPreset] = useState<DemoRolePreset>('ADMIN');
  const [activeMenu, setActiveMenu] = useState<MenuKey>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [settings, setSettings] = useState<SchoolSettings>(() => createDefaultSchoolSettings('init'));
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherContacts, setTeacherContacts] = useState<Record<string, string>>({});
  const [judges, setJudges] = useState<Judge[]>([]);
  const [judgingPeriods, setJudgingPeriods] = useState<JudgingPeriod[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [evaluationItems, setEvaluationItems] = useState<EvaluationItem[]>([]);
  const [weeklyResults, setWeeklyResults] = useState<WeeklyResult[]>([]);
  const [monthlyResults, setMonthlyResults] = useState<MonthlyResult[]>([]);
  const [trophyHistory, setTrophyHistory] = useState<TrophyRecord[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const addToast = useCallback((type: ToastMessage['type'], title: string, description?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Validate connection to Firestore on boot (Mandatory Firebase Skill requirement)
  useEffect(() => {
    testFirestoreConnection().then((ok) => setFirebaseOnline(ok));
  }, []);

  // Persist Demo Snapshot whenever Demo entities change
  const saveDemoToLocalStorage = useCallback((snap: AppDatabaseSnapshot) => {
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(snap));
    } catch (e) {
      console.warn('LocalStorage quota warning:', e);
    }
  }, []);

  const applySnapshotToState = useCallback((snap: AppDatabaseSnapshot) => {
    setSettings(snap.schoolSettings);
    setUsers(snap.users || []);
    setClasses(snap.classes || []);
    setTeachers(snap.teachers || []);
    setTeacherContacts(snap.teacherContacts || {});
    setJudges(snap.judges || []);
    setJudgingPeriods(snap.judgingPeriods || []);
    setEvaluations(snap.evaluations || []);
    setEvaluationItems(snap.evaluationItems || []);
    setWeeklyResults(snap.weeklyResults || []);
    setMonthlyResults(snap.monthlyResults || []);
    setTrophyHistory(snap.trophyHistory || []);
    setCertificates(snap.certificates || []);
    setAuditLogs(snap.auditLogs || []);
  }, []);

  // Check if user previously entered Demo Mode in this session
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        setStorageMode('CLOUD');
        try {
          const userRef = doc(db, 'users', fbUser.uid);
          let userSnap;
          try {
            userSnap = await getDoc(userRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
          }

          const isBootstrapAdmin =
            fbUser.email === BOOTSTRAPPED_ADMIN_EMAIL && fbUser.emailVerified === true;

          let profile: UserProfile;
          if (!userSnap || !userSnap.exists()) {
            const role: UserRole = isBootstrapAdmin ? 'administrator' : 'viewer';
            profile = {
              uid: fbUser.uid,
              displayName: (fbUser.displayName || fbUser.email || 'Pengguna Madrasah').slice(0, 120),
              role,
              judgeSlot: 'NONE',
              linkedJudgeId: '',
              active: true,
              readerUids: [fbUser.uid],
            };
            try {
              await setDoc(userRef, {
                ...profile,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              await setDoc(doc(db, 'user_private', fbUser.uid), {
                uid: fbUser.uid,
                email: (fbUser.email || 'unknown@example.com').slice(0, 200),
                phone: '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `users/${fbUser.uid}`);
            }
          } else {
            profile = userSnap.data() as UserProfile;
          }

          // Ensure school_settings/main exists if Admin logs in
          if (profile.role === 'administrator' || isBootstrapAdmin) {
            const settingsRef = doc(db, 'school_settings', 'main');
            let setSnap;
            try {
              setSnap = await getDoc(settingsRef);
            } catch (err) {
              handleFirestoreError(err, OperationType.GET, 'school_settings/main');
            }
            if (!setSnap || !setSnap.exists()) {
              const defSettings = createDefaultSchoolSettings(fbUser.uid);
              try {
                await setDoc(settingsRef, {
                  ...defSettings,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, 'school_settings/main');
              }
            }
          }

          setCurrentUser(profile);
        } finally {
          setAuthLoading(false);
        }
      } else {
        setFirebaseUser(null);
        // Check saved session flag for demo mode
        const savedMode = sessionStorage.getItem('sip_kelas_active_mode');
        if (savedMode === 'DEMO') {
          const savedRaw = localStorage.getItem(DEMO_STORAGE_KEY);
          const snap = savedRaw
            ? (JSON.parse(savedRaw) as AppDatabaseSnapshot)
            : buildInitialSeedData('demo_admin', ['demo_admin']);
          if (!savedRaw) {
            localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(snap));
          }
          applySnapshotToState(snap);
          setStorageMode('DEMO');
          setCurrentUser(DEMO_USERS_BY_PRESET.ADMIN);
        } else {
          setStorageMode('UNAUTHENTICATED');
          setCurrentUser(null);
        }
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, [applySnapshotToState]);

  // Attach Real-Time Firestore Listeners when in CLOUD mode
  useEffect(() => {
    if (storageMode !== 'CLOUD' || !firebaseUser || !currentUser) return;

    const uid = firebaseUser.uid;
    const unsubs: Array<() => void> = [];

    const listenCol = <T,>(colName: string, setter: (items: T[]) => void) => {
      const q = query(collection(db, colName), where('readerUids', 'array-contains', uid));
      const u = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => d.data() as T);
          setter(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, colName);
        }
      );
      unsubs.push(u);
    };

    // Listen to current user's own profile updates
    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            setCurrentUser(snap.data() as UserProfile);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
      )
    );

    listenCol<SchoolSettings>('school_settings', (items) => {
      const main = items.find((i) => i.id === 'main');
      if (main) setSettings(main);
    });
    listenCol<UserProfile>('users', setUsers);
    listenCol<SchoolClass>('classes', setClasses);
    listenCol<Teacher>('teachers', setTeachers);
    listenCol<Judge>('judges', setJudges);
    listenCol<JudgingPeriod>('judging_periods', setJudgingPeriods);
    listenCol<Evaluation>('evaluations', setEvaluations);
    listenCol<EvaluationItem>('evaluation_items', setEvaluationItems);
    listenCol<WeeklyResult>('weekly_results', setWeeklyResults);
    listenCol<MonthlyResult>('monthly_results', setMonthlyResults);
    listenCol<TrophyRecord>('trophy_history', setTrophyHistory);
    listenCol<Certificate>('certificates', setCertificates);
    listenCol<AuditLog>('audit_logs', setAuditLogs);

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [storageMode, firebaseUser, currentUser?.uid]);

  const getReaderUids = useCallback((): string[] => {
    const set = new Set<string>(settings.staffUids || []);
    if (currentUser?.uid) set.add(currentUser.uid);
    return Array.from(set).slice(0, 50);
  }, [settings.staffUids, currentUser?.uid]);

  const assertRole = useCallback(
    (allowed: UserRole[], actionLabel: string) => {
      if (!currentUser || !currentUser.active || !allowed.includes(currentUser.role)) {
        throw new Error(
          `Akses ditolak: Peran "${currentUser?.role || 'Tamu'}" tidak memiliki izin untuk ${actionLabel}.`
        );
      }
    },
    [currentUser]
  );

  const appendAudit = useCallback(
    async (action: string, module: string, entityId: string, summary: string) => {
      if (!currentUser) return;
      const logId = sanitizeId(`log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      const safeEntityId = sanitizeId(entityId || 'main');
      const readerUids = getReaderUids();

      if (storageMode === 'CLOUD') {
        try {
          await setDoc(doc(db, 'audit_logs', logId), {
            id: logId,
            action: action.slice(0, 80),
            module: module.slice(0, 60),
            entityId: safeEntityId,
            summary: summary.slice(0, 500),
            actorUid: currentUser.uid,
            actorName: currentUser.displayName.slice(0, 120),
            actorRole: currentUser.role,
            readerUids,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `audit_logs/${logId}`);
        }
      } else if (storageMode === 'DEMO') {
        const newLog: AuditLog = {
          id: logId,
          action: action.slice(0, 80),
          module: module.slice(0, 60),
          entityId: safeEntityId,
          summary: summary.slice(0, 500),
          actorUid: currentUser.uid,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          readerUids,
          createdAtIso: new Date().toISOString(),
        };
        setAuditLogs((prev) => [newLog, ...prev]);
      }
    },
    [currentUser, getReaderUids, storageMode]
  );

  // Sync Demo state changes to localStorage automatically
  useEffect(() => {
    if (storageMode !== 'DEMO') return;
    const snap: AppDatabaseSnapshot = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      schoolSettings: settings,
      users,
      classes,
      teachers,
      teacherContacts,
      judges,
      judgingPeriods,
      evaluations,
      evaluationItems,
      weeklyResults,
      monthlyResults,
      trophyHistory,
      certificates,
      auditLogs,
    };
    saveDemoToLocalStorage(snap);
  }, [
    storageMode,
    settings,
    users,
    classes,
    teachers,
    teacherContacts,
    judges,
    judgingPeriods,
    evaluations,
    evaluationItems,
    weeklyResults,
    monthlyResults,
    trophyHistory,
    certificates,
    auditLogs,
    saveDemoToLocalStorage,
  ]);

  const loginWithGoogle = useCallback(async () => {
    try {
      sessionStorage.removeItem('sip_kelas_active_mode');
      await signInWithPopup(auth, googleProvider);
      addToast('success', 'Berhasil Masuk Cloud', 'Terhubung ke database Cloud Firestore MA Darul Mahfudz.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      addToast('error', 'Autentikasi Gagal', msg);
    }
  }, [addToast]);

  const enterDemoMode = useCallback(
    (preset: DemoRolePreset = 'ADMIN') => {
      sessionStorage.setItem('sip_kelas_active_mode', 'DEMO');
      const savedRaw = localStorage.getItem(DEMO_STORAGE_KEY);
      const snap = savedRaw
        ? (JSON.parse(savedRaw) as AppDatabaseSnapshot)
        : buildInitialSeedData('demo_admin', ['demo_admin']);
      if (!savedRaw) {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(snap));
      }
      applySnapshotToState(snap);
      setDemoPreset(preset);
      setCurrentUser(DEMO_USERS_BY_PRESET[preset]);
      setStorageMode('DEMO');
      addToast(
        'info',
        'Mode DEMO Lokal Aktif',
        'Data tersimpan pada peramban lokal dan belum tersinkronisasi ke Cloud.'
      );
    },
    [addToast, applySnapshotToState]
  );

  const switchDemoPreset = useCallback(
    (preset: DemoRolePreset) => {
      if (storageMode !== 'DEMO') return;
      setDemoPreset(preset);
      setCurrentUser(DEMO_USERS_BY_PRESET[preset]);
      addToast('info', 'Peran Simulasi Diubah', `Aktif sebagai ${DEMO_USERS_BY_PRESET[preset].displayName}`);
    },
    [storageMode, addToast]
  );

  const logout = useCallback(async () => {
    sessionStorage.removeItem('sip_kelas_active_mode');
    if (storageMode === 'CLOUD') {
      await signOut(auth);
    }
    setStorageMode('UNAUTHENTICATED');
    setCurrentUser(null);
    addToast('info', 'Sesi Berakhir', 'Anda telah keluar dari aplikasi.');
  }, [storageMode, addToast]);

  const seedCloudInitialData = useCallback(async () => {
    assertRole(['administrator'], 'memuat data awal madrasah');
    if (storageMode !== 'CLOUD' || !currentUser) return;

    const readerUids = getReaderUids();
    const seed = buildInitialSeedData(currentUser.uid, readerUids);

    try {
      // Batch 1: Settings, Classes, Teachers, Judges, Periods
      const batch1 = writeBatch(db);
      batch1.set(doc(db, 'school_settings', 'main'), {
        ...seed.schoolSettings,
        staffUids: readerUids,
        readerUids,
        updatedBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const c of seed.classes) {
        batch1.set(doc(db, 'classes', c.id), {
          ...c,
          readerUids,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const t of seed.teachers) {
        batch1.set(doc(db, 'teachers', t.id), {
          ...t,
          readerUids,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const j of seed.judges) {
        batch1.set(doc(db, 'judges', j.id), {
          ...j,
          readerUids,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const p of seed.judgingPeriods) {
        batch1.set(doc(db, 'judging_periods', p.id), {
          ...p,
          readerUids,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch1.commit();

      // Batch 2: Evaluations, Weekly Results, Trophy, Certificates (dependent on classes/periods existing)
      const batch2 = writeBatch(db);
      for (const ev of seed.evaluations) {
        batch2.set(doc(db, 'evaluations', ev.id), {
          ...ev,
          status: ev.status === 'LOCKED' ? 'FINAL' : ev.status, // Create requires DRAFT or FINAL
          revisionCount: 0,
          readerUids,
          createdBy: currentUser.uid,
          updatedBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const wr of seed.weeklyResults) {
        batch2.set(doc(db, 'weekly_results', wr.id), {
          ...wr,
          approvedByUid: currentUser.uid,
          readerUids,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const tr of seed.trophyHistory) {
        batch2.set(doc(db, 'trophy_history', tr.id), {
          ...tr,
          ratifiedByUid: currentUser.uid,
          readerUids,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const cert of seed.certificates) {
        batch2.set(doc(db, 'certificates', cert.id), {
          ...cert,
          issuedByUid: currentUser.uid,
          readerUids,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch2.commit();

      await appendAudit(
        'SEED_DATA_CLOUD',
        'Sistem',
        'main',
        'Memuat 12 kelas, wali kelas, 2 penilai, jadwal, dan data penilaian awal ke Cloud Firestore.'
      );
      addToast('success', 'Data Awal Cloud Dimuat', '12 kelas MA Darul Mahfudz siap digunakan di Cloud Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seed_initial_data');
    }
  }, [assertRole, storageMode, currentUser, getReaderUids, appendAudit, addToast]);

  // =========================================================================
  // Master Data: Classes
  // =========================================================================
  const saveClass = useCallback(
    async (
      input: Omit<SchoolClass, 'readerUids' | 'createdBy' | 'createdAt' | 'updatedAt'>,
      isEdit: boolean
    ) => {
      assertRole(['administrator'], 'mengelola data kelas');
      if (!currentUser) return;
      const id = sanitizeId(input.id || input.name);
      const readerUids = getReaderUids();

      const record: SchoolClass = {
        id,
        code: input.code.trim().slice(0, 30),
        name: input.name.trim().slice(0, 80),
        grade: input.grade,
        homeroomTeacherId: (input.homeroomTeacherId || '').slice(0, 128),
        homeroomTeacherName: input.homeroomTeacherName.trim().slice(0, 120),
        active: Boolean(input.active),
        readerUids,
        createdBy: currentUser.uid,
      };

      if (storageMode === 'CLOUD') {
        const ref = doc(db, 'classes', id);
        try {
          if (isEdit) {
            await updateDoc(ref, {
              code: record.code,
              name: record.name,
              grade: record.grade,
              homeroomTeacherId: record.homeroomTeacherId,
              homeroomTeacherName: record.homeroomTeacherName,
              active: record.active,
              readerUids,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(ref, {
              ...record,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, isEdit ? OperationType.UPDATE : OperationType.CREATE, `classes/${id}`);
        }
      } else {
        setClasses((prev) =>
          isEdit ? prev.map((c) => (c.id === id ? { ...c, ...record } : c)) : [...prev.filter((c) => c.id !== id), record]
        );
      }

      await appendAudit(isEdit ? 'UBAH_KELAS' : 'TAMBAH_KELAS', 'Data Kelas', id, `Kelas ${record.name} disimpan.`);
      addToast('success', isEdit ? 'Data Kelas Diperbarui' : 'Kelas Ditambahkan', `Kelas ${record.name} berhasil disimpan.`);
    },
    [assertRole, currentUser, getReaderUids, storageMode, appendAudit, addToast]
  );

  const importClassesBulk = useCallback(
    async (
      items: Array<{
        code: string;
        name: string;
        grade: 'X' | 'XI' | 'XII';
        homeroomTeacherName: string;
        active: boolean;
      }>
    ): Promise<number> => {
      assertRole(['administrator'], 'mengimpor data kelas');
      if (!currentUser || items.length === 0) return 0;
      const readerUids = getReaderUids();

      if (storageMode === 'CLOUD') {
        try {
          const batch = writeBatch(db);
          items.forEach((item) => {
            const id = sanitizeId(item.name);
            const existing = classes.find((c) => c.id === id);
            const ref = doc(db, 'classes', id);
            if (existing) {
              batch.update(ref, {
                code: item.code.slice(0, 30),
                name: item.name.slice(0, 80),
                grade: item.grade,
                homeroomTeacherName: item.homeroomTeacherName.slice(0, 120),
                active: item.active,
                readerUids,
                updatedAt: serverTimestamp(),
              });
            } else {
              batch.set(ref, {
                id,
                code: item.code.slice(0, 30),
                name: item.name.slice(0, 80),
                grade: item.grade,
                homeroomTeacherId: '',
                homeroomTeacherName: item.homeroomTeacherName.slice(0, 120),
                active: item.active,
                readerUids,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          });
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'classes_bulk_import');
        }
      } else {
        setClasses((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]));
          items.forEach((item) => {
            const id = sanitizeId(item.name);
            map.set(id, {
              id,
              code: item.code.slice(0, 30),
              name: item.name.slice(0, 80),
              grade: item.grade,
              homeroomTeacherId: map.get(id)?.homeroomTeacherId || '',
              homeroomTeacherName: item.homeroomTeacherName.slice(0, 120),
              active: item.active,
              readerUids,
              createdBy: currentUser.uid,
            });
          });
          return Array.from(map.values());
        });
      }

      await appendAudit('IMPOR_KELAS', 'Data Kelas', 'bulk_classes', `Mengimpor ${items.length} data kelas dari Excel/CSV.`);
      addToast('success', 'Impor Kelas Berhasil', `${items.length} kelas telah ditambahkan/diperbarui.`);
      return items.length;
    },
    [assertRole, currentUser, getReaderUids, storageMode, classes, appendAudit, addToast]
  );

  const deleteClass = useCallback(
    async (classId: string) => {
      assertRole(['administrator'], 'menghapus data kelas');
      if (storageMode === 'CLOUD') {
        try {
          await deleteDoc(doc(db, 'classes', classId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `classes/${classId}`);
        }
      } else {
        setClasses((prev) => prev.filter((c) => c.id !== classId));
      }
      await appendAudit('HAPUS_KELAS', 'Data Kelas', classId, `Menghapus kelas ID ${classId}.`);
      addToast('success', 'Kelas Dihapus', 'Data kelas berhasil dihapus.');
    },
    [assertRole, storageMode, appendAudit, addToast]
  );

  // =========================================================================
  // Master Data: Teachers & Isolated Contacts
  // =========================================================================
  const saveTeacher = useCallback(
    async (
      input: Omit<Teacher, 'readerUids' | 'createdBy' | 'createdAt' | 'updatedAt'>,
      phone: string,
      isEdit: boolean
    ) => {
      assertRole(['administrator'], 'mengelola data wali kelas');
      if (!currentUser) return;
      const id = sanitizeId(input.id || `TCH_${Date.now()}`);
      const readerUids = getReaderUids();

      const record: Teacher = {
        id,
        fullName: input.fullName.trim().slice(0, 120),
        nip: (input.nip || '').trim().slice(0, 50),
        assignedClassId: (input.assignedClassId || '').slice(0, 64),
        assignedClassName: (input.assignedClassName || '').slice(0, 80),
        active: Boolean(input.active),
        readerUids,
        createdBy: currentUser.uid,
      };

      if (storageMode === 'CLOUD') {
        const ref = doc(db, 'teachers', id);
        try {
          if (isEdit) {
            await updateDoc(ref, {
              fullName: record.fullName,
              nip: record.nip,
              assignedClassId: record.assignedClassId,
              assignedClassName: record.assignedClassName,
              active: record.active,
              readerUids,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(ref, {
              ...record,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          // Save isolated PII phone in teacher_contacts/{id}
          const contactRef = doc(db, 'teacher_contacts', id);
          const contactSnap = await getDoc(contactRef);
          if (contactSnap.exists()) {
            await updateDoc(contactRef, {
              phone: (phone || '').trim().slice(0, 40),
              updatedBy: currentUser.uid,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(contactRef, {
              teacherId: id,
              phone: (phone || '').trim().slice(0, 40),
              updatedBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, isEdit ? OperationType.UPDATE : OperationType.CREATE, `teachers/${id}`);
        }
      } else {
        setTeachers((prev) =>
          isEdit ? prev.map((t) => (t.id === id ? { ...t, ...record } : t)) : [...prev.filter((t) => t.id !== id), record]
        );
      }

      setTeacherContacts((prev) => ({ ...prev, [id]: (phone || '').trim().slice(0, 40) }));

      // Also sync homeroom teacher name onto assigned class if selected
      if (record.assignedClassId) {
        const targetCls = classes.find((c) => c.id === record.assignedClassId);
        if (targetCls && targetCls.homeroomTeacherName !== record.fullName) {
          await saveClass(
            {
              id: targetCls.id,
              code: targetCls.code,
              name: targetCls.name,
              grade: targetCls.grade,
              homeroomTeacherId: id,
              homeroomTeacherName: record.fullName,
              active: targetCls.active,
            },
            true
          );
        }
      }

      await appendAudit(isEdit ? 'UBAH_WALI_KELAS' : 'TAMBAH_WALI_KELAS', 'Wali Kelas', id, `Wali kelas ${record.fullName} disimpan.`);
      addToast('success', 'Wali Kelas Disimpan', `${record.fullName} berhasil disimpan.`);
    },
    [assertRole, currentUser, getReaderUids, storageMode, classes, saveClass, appendAudit, addToast]
  );

  const deleteTeacher = useCallback(
    async (teacherId: string) => {
      assertRole(['administrator'], 'menghapus wali kelas');
      if (storageMode === 'CLOUD') {
        try {
          await deleteDoc(doc(db, 'teachers', teacherId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `teachers/${teacherId}`);
        }
      } else {
        setTeachers((prev) => prev.filter((t) => t.id !== teacherId));
      }
      await appendAudit('HAPUS_WALI_KELAS', 'Wali Kelas', teacherId, `Menghapus wali kelas ${teacherId}.`);
      addToast('success', 'Wali Kelas Dihapus', 'Data wali kelas telah dihapus.');
    },
    [assertRole, storageMode, appendAudit, addToast]
  );

  // =========================================================================
  // Master Data: Judges
  // =========================================================================
  const saveJudge = useCallback(
    async (
      input: Omit<Judge, 'readerUids' | 'createdBy' | 'createdAt' | 'updatedAt'>,
      isEdit: boolean
    ) => {
      assertRole(['administrator'], 'mengelola data penilai');
      if (!currentUser) return;
      const id = sanitizeId(input.id || `JDG_${Date.now()}`);
      const readerUids = getReaderUids();

      const record: Judge = {
        id,
        fullName: input.fullName.trim().slice(0, 120),
        position: input.position.trim().slice(0, 100),
        identityNumber: (input.identityNumber || '').trim().slice(0, 50),
        judgeRole: input.judgeRole,
        linkedUserUid: (input.linkedUserUid || '').trim().slice(0, 128),
        active: Boolean(input.active),
        readerUids,
        createdBy: currentUser.uid,
      };

      if (storageMode === 'CLOUD') {
        const ref = doc(db, 'judges', id);
        try {
          if (isEdit) {
            await updateDoc(ref, {
              fullName: record.fullName,
              position: record.position,
              identityNumber: record.identityNumber,
              judgeRole: record.judgeRole,
              linkedUserUid: record.linkedUserUid,
              active: record.active,
              readerUids,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(ref, {
              ...record,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, isEdit ? OperationType.UPDATE : OperationType.CREATE, `judges/${id}`);
        }
      } else {
        setJudges((prev) =>
          isEdit ? prev.map((j) => (j.id === id ? { ...j, ...record } : j)) : [...prev.filter((j) => j.id !== id), record]
        );
      }

      await appendAudit(isEdit ? 'UBAH_PENILAI' : 'TAMBAH_PENILAI', 'Data Penilai', id, `Penilai ${record.fullName} (Penilai ${record.judgeRole}) disimpan.`);
      addToast('success', 'Data Penilai Disimpan', `${record.fullName} berhasil disimpan.`);
    },
    [assertRole, currentUser, getReaderUids, storageMode, appendAudit, addToast]
  );

  const deleteJudge = useCallback(
    async (judgeId: string) => {
      assertRole(['administrator'], 'menghapus penilai');
      if (storageMode === 'CLOUD') {
        try {
          await deleteDoc(doc(db, 'judges', judgeId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `judges/${judgeId}`);
        }
      } else {
        setJudges((prev) => prev.filter((j) => j.id !== judgeId));
      }
      await appendAudit('HAPUS_PENILAI', 'Data Penilai', judgeId, `Menghapus penilai ${judgeId}.`);
      addToast('success', 'Penilai Dihapus', 'Data penilai berhasil dihapus.');
    },
    [assertRole, storageMode, appendAudit, addToast]
  );

  // =========================================================================
  // Master Data: Judging Periods
  // =========================================================================
  const saveJudgingPeriod = useCallback(
    async (
      input: Omit<JudgingPeriod, 'readerUids' | 'createdBy' | 'createdAt' | 'updatedAt'>,
      isEdit: boolean
    ) => {
      assertRole(['administrator', 'koordinator'], 'mengelola jadwal penilaian');
      if (!currentUser) return;
      const id = sanitizeId(
        input.id || `PRD_${input.year}_${String(input.month).padStart(2, '0')}_P${input.weekNumber}`
      );
      const readerUids = getReaderUids();

      const record: JudgingPeriod = {
        id,
        weekNumber: Math.max(1, Math.min(5, Math.round(Number(input.weekNumber)))),
        globalWeekNumber: Math.max(1, Math.min(53, Math.round(Number(input.globalWeekNumber || 1)))),
        month: Math.max(1, Math.min(12, Math.round(Number(input.month)))),
        year: Math.max(2024, Math.min(2035, Math.round(Number(input.year)))),
        academicYear: (input.academicYear || settings.academicYear).slice(0, 20),
        scheduledDate: input.scheduledDate.slice(0, 10),
        ceremonyDate: (input.ceremonyDate || '').slice(0, 10),
        theme: input.theme.trim().slice(0, 160),
        status: input.status,
        readerUids,
        createdBy: currentUser.uid,
      };

      if (storageMode === 'CLOUD') {
        const ref = doc(db, 'judging_periods', id);
        try {
          if (isEdit) {
            if (currentUser.role === 'koordinator') {
              await updateDoc(ref, {
                scheduledDate: record.scheduledDate,
                ceremonyDate: record.ceremonyDate,
                theme: record.theme,
                status: record.status,
                updatedAt: serverTimestamp(),
              });
            } else {
              await updateDoc(ref, {
                weekNumber: record.weekNumber,
                globalWeekNumber: record.globalWeekNumber,
                month: record.month,
                year: record.year,
                academicYear: record.academicYear,
                scheduledDate: record.scheduledDate,
                ceremonyDate: record.ceremonyDate,
                theme: record.theme,
                status: record.status,
                readerUids,
                updatedAt: serverTimestamp(),
              });
            }
          } else {
            await setDoc(ref, {
              ...record,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, isEdit ? OperationType.UPDATE : OperationType.CREATE, `judging_periods/${id}`);
        }
      } else {
        setJudgingPeriods((prev) =>
          isEdit ? prev.map((p) => (p.id === id ? { ...p, ...record } : p)) : [...prev.filter((p) => p.id !== id), record]
        );
      }

      await appendAudit(
        isEdit ? 'UBAH_JADWAL' : 'TAMBAH_JADWAL',
        'Jadwal Penilaian',
        id,
        `Jadwal Pekan ${record.weekNumber} ${INDONESIAN_MONTHS[record.month - 1]} ${record.year} disimpan.`
      );
      addToast('success', 'Jadwal Penilaian Disimpan', `Pekan Ke-${record.weekNumber} berhasil disimpan.`);
    },
    [assertRole, currentUser, getReaderUids, settings.academicYear, storageMode, appendAudit, addToast]
  );

  const deleteJudgingPeriod = useCallback(
    async (periodId: string) => {
      assertRole(['administrator'], 'menghapus jadwal penilaian');
      if (storageMode === 'CLOUD') {
        try {
          await deleteDoc(doc(db, 'judging_periods', periodId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `judging_periods/${periodId}`);
        }
      } else {
        setJudgingPeriods((prev) => prev.filter((p) => p.id !== periodId));
      }
      await appendAudit('HAPUS_JADWAL', 'Jadwal Penilaian', periodId, `Menghapus jadwal ${periodId}.`);
      addToast('success', 'Jadwal Dihapus', 'Periode penilaian telah dihapus.');
    },
    [assertRole, storageMode, appendAudit, addToast]
  );

  // =========================================================================
  // Module 7: Lampiran 1 Evaluation Save & Revision
  // =========================================================================
  const saveEvaluation = useCallback(
    async (params: {
      periodId: string;
      evaluationDate: string;
      classId: string;
      theme: string;
      judgeId: string;
      judgeNumber: JudgeNumber;
      scores: Evaluation['scores'];
      itemNotes: Evaluation['itemNotes'];
      generalNote: string;
      status: 'DRAFT' | 'FINAL';
      allowRevision: boolean;
    }): Promise<Evaluation> => {
      assertRole(['administrator', 'penilai'], 'menyimpan penilaian mingguan');
      if (!currentUser) throw new Error('Belum masuk.');

      if (
        currentUser.role === 'penilai' &&
        currentUser.judgeSlot !== 'NONE' &&
        currentUser.judgeSlot !== params.judgeNumber
      ) {
        throw new Error(
          `Hak akses terbatas: Akun Anda terdaftar sebagai Penilai ${currentUser.judgeSlot}, tidak dapat mengisi kolom Penilai ${params.judgeNumber}.`
        );
      }

      const period = judgingPeriods.find((p) => p.id === params.periodId);
      const cls = classes.find((c) => c.id === params.classId);
      const judge = judges.find((j) => j.id === params.judgeId);

      if (!period || !cls || !judge || !params.evaluationDate || !params.theme.trim()) {
        throw new Error('Identitas wajib penilaian (Periode, Tanggal, Kelas, Tema, dan Penilai) harus lengkap.');
      }

      const calc = calculateEvaluationTotals(params.scores);
      if (calc.errors.length > 0) {
        throw new Error(calc.errors[0]);
      }

      const evalId = sanitizeId(`eval_${period.id}_${cls.id}_${params.judgeNumber}`);
      const existing = evaluations.find((e) => e.id === evalId);

      if (existing && !params.allowRevision) {
        throw new Error(
          `Penilaian Penilai ${params.judgeNumber} untuk ${cls.name} pada Pekan Ke-${period.weekNumber} sudah tersimpan. Aktifkan mode "Edit / Revisi Penilaian" untuk memperbarui nilai.`
        );
      }

      if (existing && existing.status === 'LOCKED' && currentUser.role !== 'administrator') {
        throw new Error(
          'Penilaian ini telah dikunci karena rekapitulasi mingguan sudah disahkan Kepala Madrasah. Hubungi Administrator untuk koreksi resmi.'
        );
      }

      const sanitizedNotes = {} as Evaluation['itemNotes'];
      for (const item of ALL_RUBRIC_ITEMS) {
        sanitizedNotes[item.key] = (params.itemNotes[item.key] || '').trim().slice(0, 250);
      }

      const readerUids = getReaderUids();
      const nextRevision = existing ? existing.revisionCount + 1 : 0;

      const evalRecord: Evaluation = {
        id: evalId,
        periodId: period.id,
        weekNumber: period.weekNumber,
        month: period.month,
        year: period.year,
        evaluationDate: params.evaluationDate.slice(0, 10),
        classId: cls.id,
        className: cls.name.slice(0, 80),
        homeroomTeacherName: cls.homeroomTeacherName.slice(0, 120),
        theme: params.theme.trim().slice(0, 160),
        judgeId: judge.id,
        judgeName: judge.fullName.slice(0, 120),
        judgeNumber: params.judgeNumber,
        scores: params.scores,
        itemNotes: sanitizedNotes,
        subtotalA: calc.subtotalA,
        subtotalB: calc.subtotalB,
        subtotalC: calc.subtotalC,
        subtotalD: calc.subtotalD,
        totalScore: calc.totalScore,
        generalNote: (params.generalNote || '').trim().slice(0, 1000),
        status: params.status,
        revisionCount: nextRevision,
        readerUids,
        createdBy: existing ? existing.createdBy : currentUser.uid,
        updatedBy: currentUser.uid,
      };

      if (storageMode === 'CLOUD') {
        const ref = doc(db, 'evaluations', evalId);
        try {
          if (existing) {
            await updateDoc(ref, {
              evaluationDate: evalRecord.evaluationDate,
              theme: evalRecord.theme,
              scores: evalRecord.scores,
              itemNotes: evalRecord.itemNotes,
              subtotalA: evalRecord.subtotalA,
              subtotalB: evalRecord.subtotalB,
              subtotalC: evalRecord.subtotalC,
              subtotalD: evalRecord.subtotalD,
              totalScore: evalRecord.totalScore,
              generalNote: evalRecord.generalNote,
              status: evalRecord.status,
              revisionCount: nextRevision,
              updatedBy: currentUser.uid,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(ref, {
              ...evalRecord,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `evaluations/${evalId}`);
        }
      } else {
        setEvaluations((prev) =>
          existing ? prev.map((e) => (e.id === evalId ? evalRecord : e)) : [...prev, evalRecord]
        );
      }

      await appendAudit(
        existing ? 'REVISI_PENILAIAN' : params.status === 'DRAFT' ? 'SIMPAN_DRAF_PENILAIAN' : 'SIMPAN_PENILAIAN_FINAL',
        'Penilaian Mingguan',
        evalId,
        `${existing ? `Revisi #${nextRevision}` : 'Input'} Penilai ${params.judgeNumber} Kelas ${cls.name} (Pekan ${period.weekNumber}): Total ${calc.totalScore}/100 (${params.status}).`
      );

      addToast(
        'success',
        params.status === 'DRAFT' ? 'Draf Penilaian Disimpan' : 'Penilaian Berhasil Disimpan',
        `Kelas ${cls.name} · Penilai ${params.judgeNumber} · Skor ${calc.totalScore}/100`
      );

      return evalRecord;
    },
    [assertRole, currentUser, judgingPeriods, classes, judges, evaluations, getReaderUids, storageMode, appendAudit, addToast]
  );

  // =========================================================================
  // Module 8: Weekly Recap Proposal & Ratification
  // =========================================================================
  const submitWeeklyDecision = useCallback(
    async (params: {
      periodId: string;
      winnerClassId: string;
      winnerScore: number;
      hasTie: boolean;
      tieResolutionNote: string;
      action: 'PROPOSE' | 'APPROVE';
    }) => {
      if (params.action === 'PROPOSE') {
        assertRole(['administrator', 'koordinator', 'kepala_madrasah'], 'mengusulkan pemenang mingguan');
      } else {
        assertRole(['administrator', 'kepala_madrasah'], 'mengesahkan pemenang mingguan');
      }
      if (!currentUser) return;

      const period = judgingPeriods.find((p) => p.id === params.periodId);
      const cls = classes.find((c) => c.id === params.winnerClassId);
      if (!period || !cls) throw new Error('Periode atau kelas pemenang tidak ditemukan.');

      const resultId = sanitizeId(`weekly_${period.id}`);
      const existing = weeklyResults.find((w) => w.id === resultId);
      if (existing && existing.status === 'APPROVED' && currentUser.role !== 'administrator') {
        throw new Error('Hasil pengesahan mingguan sudah bersifat final dan terkunci.');
      }

      const status = params.action === 'APPROVE' ? 'APPROVED' : 'PROPOSED';
      const nowIso = new Date().toISOString();
      const readerUids = getReaderUids();

      const record: WeeklyResult = {
        id: resultId,
        periodId: period.id,
        weekNumber: period.weekNumber,
        month: period.month,
        year: period.year,
        theme: period.theme,
        winnerClassId: cls.id,
        winnerClassName: cls.name,
        winnerHomeroomTeacher: cls.homeroomTeacherName,
        winnerScore: Number(params.winnerScore),
        hasTie: Boolean(params.hasTie),
        tieResolutionNote: (params.tieResolutionNote || '').trim().slice(0, 500),
        coordinatorName: settings.coordinatorName,
        principalName: settings.principalName,
        status,
        approvedByUid: status === 'APPROVED' ? currentUser.uid : '',
        approvedByName: status === 'APPROVED' ? currentUser.displayName.slice(0, 120) : '',
        approvedAtIso: status === 'APPROVED' ? nowIso : '',
        readerUids,
        createdBy: existing ? existing.createdBy : currentUser.uid,
      };

      if (storageMode === 'CLOUD') {
        const ref = doc(db, 'weekly_results', resultId);
        try {
          if (existing) {
            if (currentUser.role === 'koordinator') {
              await updateDoc(ref, {
                winnerClassId: record.winnerClassId,
                winnerClassName: record.winnerClassName,
                winnerHomeroomTeacher: record.winnerHomeroomTeacher,
                winnerScore: record.winnerScore,
                hasTie: record.hasTie,
                tieResolutionNote: record.tieResolutionNote,
                coordinatorName: record.coordinatorName,
                principalName: record.principalName,
                updatedAt: serverTimestamp(),
              });
            } else if (currentUser.role === 'kepala_madrasah') {
              await updateDoc(ref, {
                winnerClassId: record.winnerClassId,
                winnerClassName: record.winnerClassName,
                winnerHomeroomTeacher: record.winnerHomeroomTeacher,
                winnerScore: record.winnerScore,
                hasTie: record.hasTie,
                tieResolutionNote: record.tieResolutionNote,
                status: 'APPROVED',
                approvedByUid: currentUser.uid,
                approvedByName: record.approvedByName,
                approvedAtIso: nowIso,
                updatedAt: serverTimestamp(),
              });
            } else {
              await updateDoc(ref, {
                winnerClassId: record.winnerClassId,
                winnerClassName: record.winnerClassName,
                winnerHomeroomTeacher: record.winnerHomeroomTeacher,
                winnerScore: record.winnerScore,
                hasTie: record.hasTie,
                tieResolutionNote: record.tieResolutionNote,
                coordinatorName: record.coordinatorName,
                principalName: record.principalName,
                status: record.status,
                approvedByUid: record.approvedByUid,
                approvedByName: record.approvedByName,
                approvedAtIso: record.approvedAtIso,
                readerUids,
                updatedAt: serverTimestamp(),
              });
            }
          } else {
            await setDoc(ref, {
              ...record,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `weekly_results/${resultId}`);
        }
      } else {
        setWeeklyResults((prev) =>
          existing ? prev.map((w) => (w.id === resultId ? record : w)) : [...prev, record]
        );
      }

      await appendAudit(
        status === 'APPROVED' ? 'SAHKAN_PEMENANG_MINGGUAN' : 'USULKAN_PEMENANG_MINGGUAN',
        'Rekapitulasi Mingguan',
        resultId,
        `${status === 'APPROVED' ? 'Pengesahan' : 'Pengusulan'} Kelas Terbaik Pekan Ke-${period.weekNumber}: ${cls.name} (Rata-rata ${params.winnerScore.toFixed(2)}).`
      );

      addToast(
        'success',
        status === 'APPROVED' ? 'Pemenang Mingguan Disahkan' : 'Usulan Pemenang Disimpan',
        `Kelas ${cls.name} ditetapkan pada Pekan Ke-${period.weekNumber}.`
      );
    },
    [assertRole, currentUser, judgingPeriods, classes, weeklyResults, getReaderUids, settings, storageMode, appendAudit, addToast]
  );

  // =========================================================================
  // Module 9: Monthly Recap Proposal & Ratification
  // =========================================================================
  const submitMonthlyDecision = useCallback(
    async (params: {
      month: number;
      year: number;
      winnerClassId: string;
      certificateCount: number;
      totalMonthlyScore: number;
      tieBreakerUsed: string;
      principalDecisionNote: string;
      action: 'PROPOSE' | 'APPROVE';
    }) => {
      if (params.action === 'PROPOSE') {
        assertRole(['administrator', 'koordinator', 'kepala_madrasah'], 'mengusulkan rekap bulanan');
      } else {
        assertRole(['administrator', 'kepala_madrasah'], 'mengesahkan pemenang bulanan');
      }
      if (!currentUser) return;

      const cls = classes.find((c) => c.id === params.winnerClassId);
      if (!cls) throw new Error('Kelas pemenang bulanan tidak ditemukan.');

      const resultId = sanitizeId(`monthly_${params.year}_${String(params.month).padStart(2, '0')}`);
      const existing = monthlyResults.find((m) => m.id === resultId);
      if (existing && existing.status === 'APPROVED' && currentUser.role !== 'administrator') {
        throw new Error('Pengesahan pemenang bulanan sudah terkunci.');
      }

      const status = params.action === 'APPROVE' ? 'APPROVED' : 'PROPOSED';
      const nowIso = new Date().toISOString();
      const readerUids = getReaderUids();

      const record: MonthlyResult = {
        id: resultId,
        month: params.month,
        year: params.year,
        academicYear: settings.academicYear,
        winnerClassId: cls.id,
        winnerClassName: cls.name,
        winnerHomeroomTeacher: cls.homeroomTeacherName,
        certificateCount: params.certificateCount,
        totalMonthlyScore: Number(params.totalMonthlyScore),
        tieBreakerUsed: (params.tieBreakerUsed || '').trim().slice(0, 200),
        principalDecisionNote: (params.principalDecisionNote || '').trim().slice(0, 500),
        principalName: settings.principalName,
        status,
        approvedByUid: status === 'APPROVED' ? currentUser.uid : '',
        approvedByName: status === 'APPROVED' ? currentUser.displayName.slice(0, 120) : '',
        approvedAtIso: status === 'APPROVED' ? nowIso : '',
        readerUids,
        createdBy: existing ? existing.createdBy : currentUser.uid,
      };

      if (storageMode === 'CLOUD') {
        const ref = doc(db, 'monthly_results', resultId);
        try {
          if (existing) {
            if (currentUser.role === 'koordinator') {
              await updateDoc(ref, {
                winnerClassId: record.winnerClassId,
                winnerClassName: record.winnerClassName,
                winnerHomeroomTeacher: record.winnerHomeroomTeacher,
                certificateCount: record.certificateCount,
                totalMonthlyScore: record.totalMonthlyScore,
                tieBreakerUsed: record.tieBreakerUsed,
                principalDecisionNote: record.principalDecisionNote,
                updatedAt: serverTimestamp(),
              });
            } else if (currentUser.role === 'kepala_madrasah') {
              await updateDoc(ref, {
                winnerClassId: record.winnerClassId,
                winnerClassName: record.winnerClassName,
                winnerHomeroomTeacher: record.winnerHomeroomTeacher,
                certificateCount: record.certificateCount,
                totalMonthlyScore: record.totalMonthlyScore,
                tieBreakerUsed: record.tieBreakerUsed,
                principalDecisionNote: record.principalDecisionNote,
                status: 'APPROVED',
                approvedByUid: currentUser.uid,
                approvedByName: record.approvedByName,
                approvedAtIso: nowIso,
                updatedAt: serverTimestamp(),
              });
            } else {
              await updateDoc(ref, {
                winnerClassId: record.winnerClassId,
                winnerClassName: record.winnerClassName,
                winnerHomeroomTeacher: record.winnerHomeroomTeacher,
                certificateCount: record.certificateCount,
                totalMonthlyScore: record.totalMonthlyScore,
                tieBreakerUsed: record.tieBreakerUsed,
                principalDecisionNote: record.principalDecisionNote,
                status: record.status,
                approvedByUid: record.approvedByUid,
                approvedByName: record.approvedByName,
                approvedAtIso: record.approvedAtIso,
                readerUids,
                updatedAt: serverTimestamp(),
              });
            }
          } else {
            await setDoc(ref, {
              ...record,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `monthly_results/${resultId}`);
        }
      } else {
        setMonthlyResults((prev) =>
          existing ? prev.map((m) => (m.id === resultId ? record : m)) : [...prev, record]
        );
      }

      await appendAudit(
        status === 'APPROVED' ? 'SAHKAN_PEMENANG_BULANAN' : 'USULKAN_PEMENANG_BULANAN',
        'Rekapitulasi Bulanan',
        resultId,
        `${status === 'APPROVED' ? 'Pengesahan' : 'Usulan'} Pemenang Bulanan ${INDONESIAN_MONTHS[params.month - 1]} ${params.year}: ${cls.name}.`
      );

      addToast(
        'success',
        status === 'APPROVED' ? 'Pemenang Bulanan Disahkan' : 'Usulan Bulanan Disimpan',
        `Kelas ${cls.name} tercatat untuk periode ${INDONESIAN_MONTHS[params.month - 1]} ${params.year}.`
      );
    },
    [assertRole, currentUser, classes, monthlyResults, getReaderUids, settings, storageMode, appendAudit, addToast]
  );

  // =========================================================================
  // Module 10: Rotating Principal Trophy Explicit Ratification
  // =========================================================================
  const ratifyTrophyHolder = useCallback(
    async (params: {
      month: number;
      year: number;
      periodLabel: string;
      classId: string;
      certificateCount: number;
      cumulativeScore: number;
      ratifiedDate: string;
      notes: string;
    }) => {
      assertRole(['administrator', 'kepala_madrasah'], 'mengesahkan pemegang Piala Bergilir Kepala Madrasah');
      if (!currentUser) return;

      const cls = classes.find((c) => c.id === params.classId);
      if (!cls) throw new Error('Kelas pemegang piala tidak valid.');

      const trophyId = sanitizeId(`trophy_${params.year}_${String(params.month).padStart(2, '0')}_${cls.id}`);
      const readerUids = getReaderUids();

      const newRecord: TrophyRecord = {
        id: trophyId,
        periodLabel: params.periodLabel.trim().slice(0, 120),
        month: params.month,
        year: params.year,
        academicYear: settings.academicYear,
        classId: cls.id,
        className: cls.name,
        homeroomTeacherName: cls.homeroomTeacherName,
        certificateCount: params.certificateCount,
        cumulativeScore: Number(params.cumulativeScore),
        isActiveHolder: true,
        ratifiedByUid: currentUser.uid,
        ratifiedByName: settings.principalName,
        ratifiedByTitle: 'Kepala Madrasah',
        ratifiedDate: params.ratifiedDate.slice(0, 10),
        notes: (params.notes || '').trim().slice(0, 500),
        status: 'RATIFIED',
        readerUids,
      };

      if (storageMode === 'CLOUD') {
        try {
          const batch = writeBatch(db);
          // Archive any previous active holder without deleting history!
          for (const prev of trophyHistory.filter((t) => t.isActiveHolder && t.id !== trophyId)) {
            batch.update(doc(db, 'trophy_history', prev.id), {
              isActiveHolder: false,
              status: 'ARCHIVED',
              updatedAt: serverTimestamp(),
            });
          }
          batch.set(doc(db, 'trophy_history', trophyId), {
            ...newRecord,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batch.update(doc(db, 'school_settings', 'main'), {
            currentTrophyClassId: cls.id,
            currentTrophyClassName: cls.name,
            updatedBy: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `trophy_history/${trophyId}`);
        }
      } else {
        setTrophyHistory((prev) => [
          newRecord,
          ...prev.filter((t) => t.id !== trophyId).map((t) => ({ ...t, isActiveHolder: false, status: 'ARCHIVED' as const })),
        ]);
        setSettings((prev) => ({
          ...prev,
          currentTrophyClassId: cls.id,
          currentTrophyClassName: cls.name,
          updatedBy: currentUser.uid,
        }));
      }

      await appendAudit(
        'SAHKAN_PIALA_BERGILIR',
        'Piala Bergilir',
        trophyId,
        `Pengesahan resmi Pemegang Piala Bergilir Kepala Madrasah: Kelas ${cls.name} untuk periode ${params.periodLabel}.`
      );
      addToast(
        'success',
        'Pemegang Piala Bergilir Disahkan',
        `Kelas ${cls.name} resmi ditetapkan sebagai pemegang Piala Bergilir Kepala Madrasah.`
      );
    },
    [assertRole, currentUser, classes, getReaderUids, settings, storageMode, trophyHistory, appendAudit, addToast]
  );

  // =========================================================================
  // Module 11: Certificates Issuance, Reissue & Revocation
  // =========================================================================
  const issueCertificate = useCallback(
    async (params: {
      awardType: AwardType;
      periodId: string;
      periodLabel: string;
      classId: string;
      recipientDisplay: string;
      roleTitle: string;
      finalScore: number;
      issueDate: string;
      principalName: string;
      vicePrincipalName: string;
      isReissue?: boolean;
    }): Promise<Certificate> => {
      assertRole(['administrator', 'kepala_madrasah', 'koordinator'], 'menerbitkan sertifikat penghargaan');
      if (!currentUser) throw new Error('Belum masuk.');

      const cls = classes.find((c) => c.id === params.classId);
      if (!cls) throw new Error('Kelas penerima tidak ditemukan.');

      const certId = sanitizeId(`cert_${params.awardType}_${params.periodId}_${cls.id}`);
      const existing = certificates.find((c) => c.id === certId);

      if (existing && existing.status === 'ISSUED' && !params.isReissue) {
        throw new Error(
          `Sertifikat untuk kemenangan ${cls.name} pada periode ini sudah diterbitkan (${existing.certificateNumber}). Gunakan fitur "Terbitkan Ulang" jika ada koreksi.`
        );
      }

      const year = Number(params.issueDate.slice(0, 4)) || 2026;
      const month = Number(params.issueDate.slice(5, 7)) || 10;
      const maxSeq = certificates.reduce((m, c) => Math.max(m, c.sequenceNumber || 0), 0);
      const seq = existing ? existing.sequenceNumber : maxSeq + 1;
      const certNumber = existing
        ? existing.certificateNumber
        : generateCertificateNumber(settings.certificateFormat, year, month, seq);

      const readerUids = getReaderUids();
      const record: Certificate = {
        id: certId,
        certificateNumber: certNumber,
        sequenceNumber: seq,
        awardType: params.awardType,
        periodId: sanitizeId(params.periodId),
        periodLabel: params.periodLabel.trim().slice(0, 120),
        classId: cls.id,
        className: cls.name,
        homeroomTeacherName: cls.homeroomTeacherName,
        recipientDisplay: params.recipientDisplay.trim().slice(0, 180),
        roleTitle: params.roleTitle.trim().slice(0, 120),
        finalScore: Number(params.finalScore),
        issueDate: params.issueDate.slice(0, 10),
        principalName: params.principalName.trim().slice(0, 120),
        vicePrincipalName: params.vicePrincipalName.trim().slice(0, 120),
        status: 'ISSUED',
        reissueCount: existing ? existing.reissueCount + 1 : 0,
        revokedReason: '',
        revokedByName: '',
        issuedByUid: existing ? existing.issuedByUid : currentUser.uid,
        issuedByName: existing ? existing.issuedByName : currentUser.displayName.slice(0, 120),
        readerUids,
      };

      if (storageMode === 'CLOUD') {
        const ref = doc(db, 'certificates', certId);
        try {
          if (existing) {
            await updateDoc(ref, {
              recipientDisplay: record.recipientDisplay,
              roleTitle: record.roleTitle,
              issueDate: record.issueDate,
              principalName: record.principalName,
              vicePrincipalName: record.vicePrincipalName,
              status: 'ISSUED',
              reissueCount: record.reissueCount,
              revokedReason: '',
              revokedByName: '',
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(ref, {
              ...record,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `certificates/${certId}`);
        }
      } else {
        setCertificates((prev) =>
          existing ? prev.map((c) => (c.id === certId ? record : c)) : [record, ...prev]
        );
      }

      await appendAudit(
        existing ? 'TERBIT_ULANG_SERTIFIKAT' : 'TERBIT_SERTIFIKAT',
        'Sertifikat',
        certId,
        `${existing ? 'Penerbitan ulang' : 'Penerbitan'} sertifikat ${certNumber} untuk Kelas ${cls.name}.`
      );
      addToast('success', existing ? 'Sertifikat Diterbitkan Ulang' : 'Sertifikat Diterbitkan', `Nomor: ${certNumber}`);
      return record;
    },
    [assertRole, currentUser, classes, certificates, settings.certificateFormat, getReaderUids, storageMode, appendAudit, addToast]
  );

  const revokeCertificate = useCallback(
    async (certificateId: string, reason: string) => {
      assertRole(['administrator', 'kepala_madrasah'], 'membatalkan sertifikat');
      if (!currentUser) return;
      const trimmedReason = reason.trim();
      if (trimmedReason.length < 3) {
        throw new Error('Alasan pembatalan sertifikat wajib diisi (minimal 3 karakter).');
      }

      const existing = certificates.find((c) => c.id === certificateId);
      if (!existing) throw new Error('Sertifikat tidak ditemukan.');

      if (storageMode === 'CLOUD') {
        try {
          await updateDoc(doc(db, 'certificates', certificateId), {
            status: 'REVOKED',
            revokedReason: trimmedReason.slice(0, 300),
            revokedByName: currentUser.displayName.slice(0, 120),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `certificates/${certificateId}`);
        }
      } else {
        setCertificates((prev) =>
          prev.map((c) =>
            c.id === certificateId
              ? {
                  ...c,
                  status: 'REVOKED',
                  revokedReason: trimmedReason.slice(0, 300),
                  revokedByName: currentUser.displayName,
                }
              : c
          )
        );
      }

      await appendAudit(
        'BATALKAN_SERTIFIKAT',
        'Sertifikat',
        certificateId,
        `Pembatalan sertifikat ${existing.certificateNumber} (${existing.className}). Alasan: ${trimmedReason}`
      );
      addToast('warning', 'Sertifikat Dibatalkan', `Sertifikat ${existing.certificateNumber} telah dibatalkan.`);
    },
    [assertRole, currentUser, certificates, storageMode, appendAudit, addToast]
  );

  // =========================================================================
  // Module 13 & 16: Settings, RBAC User Management, Backup & Restore
  // =========================================================================
  const updateSchoolSettings = useCallback(
    async (updated: Partial<SchoolSettings>) => {
      assertRole(['administrator'], 'mengubah pengaturan madrasah');
      if (!currentUser) return;

      const merged: SchoolSettings = {
        ...settings,
        ...updated,
        id: 'main',
        schoolName: (updated.schoolName ?? settings.schoolName).trim().slice(0, 120),
        academicYear: (updated.academicYear ?? settings.academicYear).trim().slice(0, 20),
        location: (updated.location ?? settings.location).trim().slice(0, 100),
        address: (updated.address ?? settings.address).trim().slice(0, 250),
        motto: (updated.motto ?? settings.motto).trim().slice(0, 200),
        slogan: (updated.slogan ?? settings.slogan).trim().slice(0, 200),
        principalName: (updated.principalName ?? settings.principalName).trim().slice(0, 120),
        principalNip: (updated.principalNip ?? settings.principalNip).trim().slice(0, 50),
        vicePrincipalName: (updated.vicePrincipalName ?? settings.vicePrincipalName).trim().slice(0, 120),
        vicePrincipalNip: (updated.vicePrincipalNip ?? settings.vicePrincipalNip).trim().slice(0, 50),
        coordinatorName: (updated.coordinatorName ?? settings.coordinatorName).trim().slice(0, 120),
        certificateFormat: (updated.certificateFormat ?? settings.certificateFormat).trim().slice(0, 80),
        winnerRuleText: (updated.winnerRuleText ?? settings.winnerRuleText).trim().slice(0, 400),
        logoDataUrl: (updated.logoDataUrl ?? settings.logoDataUrl).slice(0, 250000),
        buildingDataUrl: (updated.buildingDataUrl ?? settings.buildingDataUrl).slice(0, 350000),
        updatedBy: currentUser.uid,
      };

      if (storageMode === 'CLOUD') {
        try {
          await updateDoc(doc(db, 'school_settings', 'main'), {
            schoolName: merged.schoolName,
            academicYear: merged.academicYear,
            location: merged.location,
            address: merged.address,
            motto: merged.motto,
            slogan: merged.slogan,
            principalName: merged.principalName,
            principalNip: merged.principalNip,
            vicePrincipalName: merged.vicePrincipalName,
            vicePrincipalNip: merged.vicePrincipalNip,
            coordinatorName: merged.coordinatorName,
            certificateFormat: merged.certificateFormat,
            winnerRuleText: merged.winnerRuleText,
            logoDataUrl: merged.logoDataUrl,
            buildingDataUrl: merged.buildingDataUrl,
            currentTrophyClassId: merged.currentTrophyClassId,
            currentTrophyClassName: merged.currentTrophyClassName,
            staffUids: merged.staffUids,
            readerUids: merged.readerUids,
            updatedBy: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, 'school_settings/main');
        }
      } else {
        setSettings(merged);
      }

      await appendAudit('UBAH_PENGATURAN', 'Pengaturan', 'main', 'Memperbarui identitas dan pengaturan madrasah.');
      addToast('success', 'Pengaturan Disimpan', 'Identitas dan konfigurasi madrasah berhasil diperbarui.');
    },
    [assertRole, currentUser, settings, storageMode, appendAudit, addToast]
  );

  const updateUserRole = useCallback(
    async (
      targetUid: string,
      role: UserRole,
      judgeSlot: JudgeSlot,
      linkedJudgeId: string,
      active: boolean
    ) => {
      assertRole(['administrator'], 'mengelola hak akses pengguna');
      if (!currentUser) return;

      const nextStaffSet = new Set<string>(settings.staffUids || []);
      nextStaffSet.add(currentUser.uid);
      if (active && role !== 'viewer') {
        nextStaffSet.add(targetUid);
      }
      const nextReaderUids = Array.from(nextStaffSet).slice(0, 50);

      if (storageMode === 'CLOUD') {
        try {
          await updateDoc(doc(db, 'users', targetUid), {
            role,
            judgeSlot,
            linkedJudgeId: linkedJudgeId.slice(0, 128),
            active,
            readerUids: nextReaderUids,
            updatedAt: serverTimestamp(),
          });

          await updateDoc(doc(db, 'school_settings', 'main'), {
            staffUids: nextReaderUids,
            readerUids: nextReaderUids,
            updatedBy: currentUser.uid,
            updatedAt: serverTimestamp(),
          });

          // Sync readerUids on school collections so the authorized staff user can list records seamlessly
          const colNames = [
            'classes',
            'teachers',
            'judges',
            'judging_periods',
            'evaluations',
            'weekly_results',
            'monthly_results',
            'trophy_history',
            'certificates',
          ];
          for (const colName of colNames) {
            const snap = await getDocs(
              query(collection(db, colName), where('readerUids', 'array-contains', currentUser.uid))
            );
            if (!snap.empty) {
              const batch = writeBatch(db);
              snap.docs.forEach((d) => {
                batch.update(d.ref, { readerUids: nextReaderUids, updatedAt: serverTimestamp() });
              });
              await batch.commit();
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
        }
      } else {
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === targetUid ? { ...u, role, judgeSlot, linkedJudgeId, active, readerUids: nextReaderUids } : u
          )
        );
      }

      await appendAudit(
        'UBAH_PERAN_PENGGUNA',
        'Pengguna',
        targetUid,
        `Mengatur peran pengguna ${targetUid} menjadi ${role} (${judgeSlot}).`
      );
      addToast('success', 'Hak Akses Diperbarui', `Peran pengguna berhasil diatur menjadi ${role}.`);
    },
    [assertRole, currentUser, settings.staffUids, storageMode, appendAudit, addToast]
  );

  const getSnapshot = useCallback((): AppDatabaseSnapshot => {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      schoolSettings: settings,
      users,
      classes,
      teachers,
      teacherContacts,
      judges,
      judgingPeriods,
      evaluations,
      evaluationItems,
      weeklyResults,
      monthlyResults,
      trophyHistory,
      certificates,
      auditLogs,
    };
  }, [
    settings,
    users,
    classes,
    teachers,
    teacherContacts,
    judges,
    judgingPeriods,
    evaluations,
    evaluationItems,
    weeklyResults,
    monthlyResults,
    trophyHistory,
    certificates,
    auditLogs,
  ]);

  const restoreSnapshot = useCallback(
    async (snap: AppDatabaseSnapshot) => {
      assertRole(['administrator'], 'memulihkan cadangan data');
      if (!currentUser) return;

      if (storageMode === 'CLOUD') {
        const readerUids = getReaderUids();
        try {
          const b1 = writeBatch(db);
          if (snap.schoolSettings) {
            b1.set(doc(db, 'school_settings', 'main'), {
              ...snap.schoolSettings,
              id: 'main',
              staffUids: readerUids,
              readerUids,
              updatedBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          (snap.classes || []).forEach((c) => {
            b1.set(doc(db, 'classes', c.id), {
              ...c,
              readerUids,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          (snap.teachers || []).forEach((t) => {
            b1.set(doc(db, 'teachers', t.id), {
              ...t,
              readerUids,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          (snap.judges || []).forEach((j) => {
            b1.set(doc(db, 'judges', j.id), {
              ...j,
              readerUids,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          (snap.judgingPeriods || []).forEach((p) => {
            b1.set(doc(db, 'judging_periods', p.id), {
              ...p,
              readerUids,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          await b1.commit();

          const b2 = writeBatch(db);
          (snap.evaluations || []).forEach((ev) => {
            b2.set(doc(db, 'evaluations', ev.id), {
              ...ev,
              status: ev.status === 'LOCKED' ? 'FINAL' : ev.status,
              revisionCount: 0,
              readerUids,
              createdBy: currentUser.uid,
              updatedBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          (snap.weeklyResults || []).forEach((wr) => {
            b2.set(doc(db, 'weekly_results', wr.id), {
              ...wr,
              approvedByUid: wr.status === 'APPROVED' ? currentUser.uid : '',
              readerUids,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          (snap.monthlyResults || []).forEach((mr) => {
            b2.set(doc(db, 'monthly_results', mr.id), {
              ...mr,
              approvedByUid: mr.status === 'APPROVED' ? currentUser.uid : '',
              readerUids,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          (snap.trophyHistory || []).forEach((tr) => {
            b2.set(doc(db, 'trophy_history', tr.id), {
              ...tr,
              ratifiedByUid: currentUser.uid,
              readerUids,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          (snap.certificates || []).forEach((cert) => {
            b2.set(doc(db, 'certificates', cert.id), {
              ...cert,
              reissueCount: 0,
              status: 'ISSUED',
              issuedByUid: currentUser.uid,
              readerUids,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          await b2.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'restore_snapshot');
        }
      } else {
        applySnapshotToState(snap);
        saveDemoToLocalStorage(snap);
      }

      await appendAudit('PULIHKAN_CADANGAN', 'Cadangan Data', 'restore_all', 'Memulihkan seluruh data dari berkas cadangan JSON.');
      addToast('success', 'Data Berhasil Dipulihkan', 'Seluruh entitas telah dipulihkan dari cadangan.');
    },
    [assertRole, currentUser, storageMode, getReaderUids, applySnapshotToState, saveDemoToLocalStorage, appendAudit, addToast]
  );

  const resetDemoData = useCallback(() => {
    if (storageMode !== 'DEMO') return;
    assertRole(['administrator'], 'mereset data demo');
    const fresh = buildInitialSeedData('demo_admin', ['demo_admin']);
    applySnapshotToState(fresh);
    saveDemoToLocalStorage(fresh);
    addToast('info', 'Data Demo Direset', 'Data contoh 12 kelas MA Darul Mahfudz dikembalikan ke kondisi awal.');
  }, [storageMode, assertRole, applySnapshotToState, saveDemoToLocalStorage, addToast]);

  const value = useMemo<AppContextValue>(
    () => ({
      storageMode,
      authLoading,
      firebaseOnline,
      firebaseUser,
      currentUser,
      demoPreset,
      activeMenu,
      setActiveMenu,
      toasts,
      addToast,
      removeToast,
      settings,
      users,
      classes,
      teachers,
      teacherContacts,
      judges,
      judgingPeriods,
      evaluations,
      evaluationItems,
      weeklyResults,
      monthlyResults,
      trophyHistory,
      certificates,
      auditLogs,
      loginWithGoogle,
      enterDemoMode,
      switchDemoPreset,
      logout,
      seedCloudInitialData,
      saveClass,
      importClassesBulk,
      deleteClass,
      saveTeacher,
      deleteTeacher,
      saveJudge,
      deleteJudge,
      saveJudgingPeriod,
      deleteJudgingPeriod,
      saveEvaluation,
      submitWeeklyDecision,
      submitMonthlyDecision,
      ratifyTrophyHolder,
      issueCertificate,
      revokeCertificate,
      updateSchoolSettings,
      updateUserRole,
      getSnapshot,
      restoreSnapshot,
      resetDemoData,
    }),
    [
      storageMode,
      authLoading,
      firebaseOnline,
      firebaseUser,
      currentUser,
      demoPreset,
      activeMenu,
      toasts,
      addToast,
      removeToast,
      settings,
      users,
      classes,
      teachers,
      teacherContacts,
      judges,
      judgingPeriods,
      evaluations,
      evaluationItems,
      weeklyResults,
      monthlyResults,
      trophyHistory,
      certificates,
      auditLogs,
      loginWithGoogle,
      enterDemoMode,
      switchDemoPreset,
      logout,
      seedCloudInitialData,
      saveClass,
      importClassesBulk,
      deleteClass,
      saveTeacher,
      deleteTeacher,
      saveJudge,
      deleteJudge,
      saveJudgingPeriod,
      deleteJudgingPeriod,
      saveEvaluation,
      submitWeeklyDecision,
      submitMonthlyDecision,
      ratifyTrophyHolder,
      issueCertificate,
      revokeCertificate,
      updateSchoolSettings,
      updateUserRole,
      getSnapshot,
      restoreSnapshot,
      resetDemoData,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp harus digunakan di dalam AppProvider.');
  return ctx;
}
