import React from 'react';
import { Award, CheckCircle2, Database, HardDrive, LogIn, ShieldCheck } from 'lucide-react';
import { DemoRolePreset, useApp } from '../context/AppContext';

export const AuthScreen: React.FC = () => {
  const { loginWithGoogle, enterDemoMode, settings } = useApp();

  const demoPresets: Array<{ key: DemoRolePreset; label: string; desc: string }> = [
    { key: 'ADMIN', label: 'Administrator', desc: 'Kelola seluruh master data, pengguna, laporan & sertifikat' },
    { key: 'PENILAI_I', label: 'Penilai I', desc: 'Input & revisi lembar penilaian Lampiran 1 (Penilai I)' },
    { key: 'PENILAI_II', label: 'Penilai II', desc: 'Input & revisi lembar penilaian Lampiran 1 (Penilai II)' },
    { key: 'KOORDINATOR', label: 'Koordinator', desc: 'Periksa kelengkapan nilai & usulkan pemenang mingguan' },
    { key: 'KEPALA_MADRASAH', label: 'Kepala Madrasah', desc: 'Sahkan pemenang mingguan, bulanan & Piala Bergilir' },
  ];

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col lg:flex-row">
      {/* Left Institutional Identity Column */}
      <div className="lg:w-5/12 bg-emerald-950 text-white p-8 lg:p-14 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white">
                SIP-KELAS DARUL MAHFUDZ
              </div>
              <div className="text-xs text-emerald-200/80">
                MA Darul Mahfudz · Lekopadis · TP {settings.academicYear}
              </div>
            </div>
          </div>

          <div className="pt-6 space-y-4">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
              Sistem Informasi Penilaian Lomba Penataan &amp; Kebersihan Kelas
            </h1>
            <p className="text-sm lg:text-base text-emerald-100/85 leading-relaxed max-w-xl">
              Pengelolaan terpadu penilaian dua penilai independen (Lampiran 1), rekapitulasi nilai
              mingguan (Lampiran 2), rekapitulasi sertifikat bulanan (Lampiran 3), pengesahan Piala
              Bergilir Kepala Madrasah, serta penerbitan sertifikat otomatis setiap usai upacara
              bendera.
            </p>
          </div>

          <div className="pt-4 border-t border-emerald-800/70 space-y-3 text-sm text-emerald-100/90">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Moto: &ldquo;{settings.motto}&rdquo;</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Slogan: &ldquo;{settings.slogan}&rdquo;</span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Kontrol hak akses 4 peran resmi dengan riwayat audit permanen.</span>
            </div>
          </div>
        </div>

        <div className="pt-8 text-xs text-emerald-300/70">
          {settings.schoolName} · {settings.location} · Tahun Pelajaran {settings.academicYear}
        </div>
      </div>

      {/* Right Authentication & Simulation Workspace */}
      <div className="lg:w-7/12 flex items-center justify-center p-6 lg:p-14">
        <div className="max-w-xl w-full space-y-8">
          {/* Primary Cloud Login */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                <Database className="w-4 h-4" />
                <span>Database Cloud Firestore Aktif</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Masuk Resmi Akun Madrasah</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Gunakan akun Google resmi untuk menyimpan dan menyinkronkan seluruh data penilaian,
                pengesahan, dan sertifikat secara persisten antarperangkat di Cloud Firestore.
              </p>
            </div>

            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              Masuk dengan Google (Cloud Firestore)
            </button>
          </div>

          {/* Honest Local Demo Simulator */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
                <HardDrive className="w-4 h-4" />
                <span>Mode Demonstrasi &amp; Pengujian Multi-Peran (Lokal)</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Uji Coba Langsung dengan Data Awal 12 Kelas (DEMO)
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Mode DEMO menyimpan perubahan pada peramban lokal perangkat ini (belum tersinkronisasi
                ke Cloud) dan memungkinkan pengujian perpindahan peran Administrator, Penilai I,
                Penilai II, Koordinator, serta Kepala Madrasah secara langsung.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {demoPresets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => enterDemoMode(preset.key)}
                  className="text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/40 transition-colors cursor-pointer"
                >
                  <div className="text-sm font-semibold text-slate-900">{preset.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
