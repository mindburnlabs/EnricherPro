
import React from 'react';
import { Settings as SettingsIcon, Moon, Sun } from 'lucide-react';

interface ChatLayoutProps {
    children: React.ReactNode;
    onSettingsClick: () => void;
    onThemeToggle: () => void;
    theme: 'light' | 'dark';
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ children, onSettingsClick, onThemeToggle, theme }) => {
    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans">
            {/* Header */}
            <header className="flex-none p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-30">
                <div className="flex items-center gap-2">
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500">
                        Enricher Labs
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
                        v2.0
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onThemeToggle}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                        aria-label="Toggle Theme"
                    >
                        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={onSettingsClick}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                        aria-label="Settings"
                    >
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Main Chat Area */}
            <main className="flex-1 overflow-hidden relative">
                {children}
            </main>
        </div>
    );
};
