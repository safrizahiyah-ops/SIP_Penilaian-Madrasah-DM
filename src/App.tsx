/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthScreen } from './components/AuthScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { AppProvider, useApp } from './context/AppContext';
import { CertificateGeneratorPage } from './pages/CertificateGeneratorPage';
import { DashboardPage } from './pages/DashboardPage';
import { EvaluationPage } from './pages/EvaluationPage';
import {
  ClassesPage,
  JudgesPage,
  SchedulePage,
  TeachersPage,
} from './pages/MasterDataPages';
import { MonthlyRecapPage } from './pages/MonthlyRecapPage';
import { RankingsPage, TrophyPage } from './pages/RankingsAndTrophyPages';
import {
  BackupRestorePage,
  ReportsPage,
  SettingsPage,
} from './pages/ReportsSettingsBackupPages';
import { WeeklyRecapPage } from './pages/WeeklyRecapPage';

const AppWorkspace: React.FC = () => {
  const { storageMode, authLoading, activeMenu } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-medium text-slate-600">
            Menghubungkan SIP-KELAS DARUL MAHFUDZ...
          </div>
        </div>
      </div>
    );
  }

  if (storageMode === 'UNAUTHENTICATED') {
    return <AuthScreen />;
  }

  return (
    <Layout>
      {activeMenu === 'dashboard' && <DashboardPage />}
      {activeMenu === 'classes' && <ClassesPage />}
      {activeMenu === 'teachers' && <TeachersPage />}
      {activeMenu === 'judges' && <JudgesPage />}
      {activeMenu === 'schedule' && <SchedulePage />}
      {activeMenu === 'evaluation' && <EvaluationPage />}
      {activeMenu === 'weekly_recap' && <WeeklyRecapPage />}
      {activeMenu === 'monthly_recap' && <MonthlyRecapPage />}
      {activeMenu === 'rankings' && <RankingsPage />}
      {activeMenu === 'trophy' && <TrophyPage />}
      {activeMenu === 'certificates' && <CertificateGeneratorPage />}
      {activeMenu === 'reports' && <ReportsPage />}
      {activeMenu === 'settings' && <SettingsPage />}
      {activeMenu === 'backup' && <BackupRestorePage />}
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppWorkspace />
      </AppProvider>
    </ErrorBoundary>
  );
}
