import React from 'react';
import { SettingsContent } from './SettingsContent.js';

interface SettingsViewProps {
    isOpen: boolean;
    onClose: () => void;
    onThemeChange: () => void;
    currentTheme: 'light' | 'dark';
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isOpen, onClose, onThemeChange, currentTheme }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-5xl h-[90vh] md:h-[85vh]">
                <SettingsContent
                    onClose={onClose}
                    onThemeChange={onThemeChange}
                    currentTheme={currentTheme}
                    isModal={true}
                />
            </div>
        </div>
    );
};
