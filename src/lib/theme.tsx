'use client';

import React, { createContext, useContext, useEffect } from 'react';

type Theme = 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'dark',
    toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Enforce dark clinical theme permanently
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.remove('light-mode');
        document.documentElement.classList.add('dark');
        if (typeof window !== 'undefined') {
            localStorage.setItem('vasc_theme', 'dark');
        }
    }, []);

    return (
        <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: () => {} }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
