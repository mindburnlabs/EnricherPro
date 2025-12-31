
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useResearchConfig } from './hooks/useResearchConfig.js';
import { SettingsView } from './components/Settings/SettingsView.js';
import { ChatLayout } from './components/Chat/ChatLayout.js';
import { ChatInterface } from './components/Chat/ChatInterface.js';

const App: React.FC = () => {
  const { t } = useTranslation('common');
  const { config, updateConfig } = useResearchConfig();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Theme Management
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ChatLayout
      onSettingsClick={() => setIsSettingsOpen(true)}
      onThemeToggle={toggleTheme}
      theme={theme}
    >
      <ChatInterface config={config} />

      <SettingsView
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onThemeChange={toggleTheme}
        currentTheme={theme}
        config={config}
        onSave={updateConfig}
      />
    </ChatLayout>
  );
};

export default App;
