
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsView } from './components/Settings/SettingsView.js';
import { ChatLayout } from './components/Chat/ChatLayout.js';
import { ChatInterface } from './components/Chat/ChatInterface.js';
import { useSettingsStore } from './stores/settingsStore.js';

const App: React.FC = () => {
  const { t } = useTranslation('common');
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

  // API Key Enforcement: Auto-open settings if keys are missing
  const { apiKeys } = useSettingsStore();

  useEffect(() => {
    // Check if keys are missing on mount
    if (!apiKeys.firecrawl || !apiKeys.openRouter) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        setIsSettingsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [apiKeys.firecrawl, apiKeys.openRouter]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ChatLayout
      onSettingsClick={() => setIsSettingsOpen(true)}
      onThemeToggle={toggleTheme}
      theme={theme}
    >
      <ChatInterface />

      <SettingsView
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onThemeChange={toggleTheme}
        currentTheme={theme}
      />
    </ChatLayout>
  );
};

export default App;
