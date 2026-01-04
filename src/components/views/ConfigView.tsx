import React, { useState } from 'react';
import { SettingsContent } from '../Settings/SettingsContent.js';

export const ConfigView: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Reuse logic from SettingsContent, but as a full page
  return (
    <div className='h-full w-full'>
      <SettingsContent
        onThemeChange={() => {
          // Toggle helper - mostly visuals here since real theme is in App.tsx
          // But we can just pass a dummy or use context if we wanted to toggle globally from here
          // For now, let's assume global theme context might be better, but this works
          document.documentElement.classList.toggle('dark');
        }}
        currentTheme='dark' // Ideally get from props or store
        isModal={false}
      />
    </div>
  );
};
