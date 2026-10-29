import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  DatabaseBackup,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Printer,
  Settings,
  Trophy,
  UserCheck,
  Users,
  X,
  AlertCircle,
  Info,
} from 'lucide-react';
import { ROLE_LABELS } from '../constants/rubric';
import { DemoRolePreset, useApp } from '../context/AppContext';
import { MenuKey } from '../types';

interface NavItem {
  key: MenuKey;
  label: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Ringkasan Utama', icon: LayoutDashboard },
  { key: 'classes', label: 'Data Kelas', group: 'Data Master', icon: BookOpen },
  { key: 'teachers', label: 'Data Wali Kelas', group: 'Data Master', icon: GraduationCap },
  { key: 'judges', label: 'Data Penilai', group: 'Data Master', icon: UserCheck },
  { key: 'schedule', label: 'Jadwal Penilaian', group: 'Data Master', icon: CalendarDays },
  { key: 'evaluation', label: 'Input Penilaian Mingguan', group: 'Penilaian & Rekap', icon: ClipboardCheck },
  { key: 'weekly_recap', label: 'Rekapitulasi Nilai Mingguan', group: 'Penilaian & Rekap', icon: FileSpreadsheet },
  { key: 'monthly_recap', label: 'Rekapitulasi Sertifikat Bulanan', group: 'Penilaian & Rekap', icon: FileCheck2 },
  { key: 'rankings', label: 'Peringkat Kelas', group: 'Penghargaan', icon: BarChart3 },
  { key: 'trophy', label: 'Piala Bergilir Kepala Madrasah', group: 'Penghargaan', icon: Trophy },
  { key: 'certificates', label: 'Generator Sertifikat', group: 'Penghargaan', icon: Award },
  { key: 'reports', label: 'Laporan dan Cetak', group: 'Administrasi', icon: FileText },
  { key: 'settings', label: 'Pengaturan', group: 'Administrasi', icon: Settings },
  { key: 'backup', label: 'Cadangkan & Pulihkan Data', group: 'Administrasi', icon: DatabaseBackup },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activeMenu,
    setActiveMenu,
    settings,
    currentUser,
    storageMode,
    demoPreset,
    switchDemoPreset,
    logout,
    toasts,
    removeToast,
    classes,
    seedCloudInitialData,
  } = useApp();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const activeNav = NAV_ITEMS.find((n) => n.key === activeMenu) || NAV_ITEMS[0];
  const groups = ['Ringkasan Utama', 'Data Master', 'Penilaian & Rekap', 'Penghargaan', 'Administrasi'];

  const handleSeedCloud = async () => {
    setSeeding(true);
    try {
      await seedCloudInitialData();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] flex text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden no-print"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Left Navigation Sidebar */}
      <aside
        className={`no-print fixed lg:static inset-y-0 left-0 z-50 w-[268px] bg-emerald-950 text-emerald-50 flex flex-col shrink-0 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {settings.logoDataUrl ? (
              <img
                src={settings.logoDataUrl}
                alt="Logo Madrasah"
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-md object-contain bg-white p-0.5 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-md bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <Award className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-white truncate">
                SIP-KELAS
              </div>
              <div className="text-[11px] text-emerald-300/85 truncate">
                {settings.schoolName}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 text-emerald-200 hover:text-white rounded-md"
            aria-label="Tutup navigasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((grp) => (
            <div key={grp} className="space-y-1">
              <div className="px-3 text-[11px] font-medium text-emerald-400/75 tracking-wide">
                {grp}
              </div>
              {NAV_ITEMS.filter((i) => i.group === grp).map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveMenu(item.key);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px] font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-emerald-800/90 text-white shadow-xs'
                        : 'text-emerald-100/80 hover:bg-emerald-900/70 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-amber-300' : 'text-emerald-300/75'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-emerald-900 space-y-3 bg-emerald-950/80">
          {currentUser && (
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-white truncate">
                {currentUser.displayName}
              </div>
              <div className="text-[11px] text-emerald-300/80">
                {ROLE_LABELS[currentUser.role]}
                {currentUser.judgeSlot !== 'NONE' ? ` · Penilai ${currentUser.judgeSlot}` : ''}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-emerald-100 bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar Sesi
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Honest Demo Mode Banner (Requirement 14) */}
        {storageMode === 'DEMO' && (
          <div className="no-print bg-amber-50 border-b border-amber-200 px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>MODE DEMO LOKAL:</strong> Data tersimpan di peramban lokal dan belum
                tersinkronisasi ke Cloud antarperangkat. Masuk dengan Google untuk database Cloud
                Firestore.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <label htmlFor="demo-role-select" className="font-medium whitespace-nowrap">
                Uji Peran:
              </label>
              <select
                id="demo-role-select"
                value={demoPreset}
                onChange={(e) => switchDemoPreset(e.target.value as DemoRolePreset)}
                className="bg-white border border-amber-300 rounded-md px-2 py-1 text-xs font-medium text-slate-900 focus:outline-none"
              >
                <option value="ADMIN">Administrator</option>
                <option value="PENILAI_I">Penilai I</option>
                <option value="PENILAI_II">Penilai II</option>
                <option value="KOORDINATOR">Koordinator Lomba</option>
                <option value="KEPALA_MADRASAH">Kepala Madrasah</option>
              </select>
            </div>
          </div>
        )}

        {/* Top Bar Contract: Breadcrumb/Identity Left — Primary Action Right */}
        <header className="no-print bg-white border-b border-slate-200 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                <span>{settings.schoolName}</span>
                <span aria-hidden="true">·</span>
                <span>TP {settings.academicYear}</span>
                <span aria-hidden="true">·</span>
                <span>{activeNav.group}</span>
              </div>
              <h1 className="text-base lg:text-lg font-bold text-slate-900 truncate">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {storageMode === 'CLOUD' &&
              currentUser?.role === 'administrator' &&
              classes.length === 0 && (
                <button
                  type="button"
                  disabled={seeding}
                  onClick={handleSeedCloud}
                  className="px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {seeding ? 'Memuat Data...' : 'Muat 12 Kelas Awal MA Darul Mahfudz'}
                </button>
              )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Halaman
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto print-container">
          {children}
        </main>

        {/* Quiet Institutional Footer */}
        <footer className="no-print px-4 lg:px-8 py-4 border-t border-slate-200 bg-white text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <div>
            SIP-KELAS DARUL MAHFUDZ · {settings.schoolName} ({settings.location}) · TP{' '}
            {settings.academicYear}
          </div>
          <div>&ldquo;{settings.slogan}&rdquo;</div>
        </footer>
      </div>

      {/* Toast Notification Stack */}
      <div className="no-print fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-white border border-slate-200 rounded-lg shadow-md p-3.5 flex items-start gap-3"
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
            {t.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900">{t.title}</div>
              {t.description && (
                <div className="text-xs text-slate-600 mt-0.5 leading-snug">{t.description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
