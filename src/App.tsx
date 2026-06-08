import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { EnvList } from './pages/EnvList';
import { EnvDetail } from './pages/EnvDetail';
import { TaskProgress } from './pages/TaskProgress';
import { Settings } from './pages/Settings';

const RouteDispatcher: React.FC = () => {
  const { currentTab } = useApp();

  const renderContent = () => {
    if (currentTab === 'home') {
      return <Home />;
    }
    if (currentTab === 'env') {
      return <EnvList />;
    }
    if (currentTab === 'progress') {
      return <TaskProgress />;
    }
    if (currentTab === 'settings') {
      return <Settings />;
    }
    if (currentTab.startsWith('detail-')) {
      const pkgName = currentTab.replace('detail-', '');
      return <EnvDetail packageName={pkgName} />;
    }
    return <Home />;
  };

  return <Layout>{renderContent()}</Layout>;
};

export default function App() {
  return (
    <AppProvider>
      <RouteDispatcher />
    </AppProvider>
  );
}
