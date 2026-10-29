'use client';

import { useState, useEffect } from 'react';
import { Activity, Sparkles, Cpu, Camera, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { checkLocalAIServerHealth } from '@/lib/roboflow';

interface Props {
    currentMode: 'idle' | 'image' | 'live';
    onSelectMode: (mode: 'idle' | 'image' | 'live') => void;
}

export default function Navbar({ currentMode, onSelectMode }: Props) {
    const [isServerOnline, setIsServerOnline] = useState(true);

    useEffect(() => {
        const check = async () => {
            const online = await checkLocalAIServerHealth();
            setIsServerOnline(online);
        };
        check();
        const interval = setInterval(check, 6000);
        return () => clearInterval(interval);
    }, []);

    return (
        <header className="sticky top-0 z-50 w-full px-4 sm:px-8 py-3.5 transition-colors duration-300 backdrop-blur-xl border-b border-slate-700/20 bg-slate-950/70 dark:bg-slate-950/70 light-mode:bg-white/80">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                
                {/* Brand Logo */}
                <div 
                    onClick={() => onSelectMode('idle')}
                    className="flex items-center gap-3 cursor-pointer group"
                >
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                        <Activity size={22} className="stroke-[2.5]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-display font-extrabold text-lg tracking-tight text-white dark:text-white light-mode:text-slate-900">
                                Vascular<span className="text-amber-400">Vision</span>
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/30">
                                PRO 2.0
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono tracking-wider">CLINICAL VASCULAR AI</p>
                    </div>
                </div>

                {/* Center Navigation Links */}
                <div className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800 dark:border-slate-800 light-mode:border-slate-200">
                    <button
                        onClick={() => onSelectMode('idle')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            currentMode === 'idle'
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => onSelectMode('image')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            currentMode === 'image'
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                    >
                        <ImageIcon size={13} />
                        <span>Image Studio</span>
                    </button>
                    <button
                        onClick={() => onSelectMode('live')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            currentMode === 'live'
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                    >
                        <Camera size={13} />
                        <span>Live Stream</span>
                    </button>
                </div>

                {/* Right Controls: AI Engine Status & Theme Switcher */}
                <div className="flex items-center gap-3">
                    
                    {/* Live AI Health Dot */}
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 dark:bg-slate-900/80 light-mode:bg-slate-100 border border-slate-800 dark:border-slate-800 light-mode:border-slate-200 text-xs">
                        <Cpu size={14} className={isServerOnline ? "text-emerald-400" : "text-amber-400"} />
                        <span className="text-[11px] font-semibold text-slate-300 dark:text-slate-300 light-mode:text-slate-700">
                            {isServerOnline ? 'YOLOv8m Online' : 'Cloud Fallback'}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${isServerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    </div>


                    {/* Launch Scanner Button */}
                    {currentMode === 'idle' && (
                        <button
                            onClick={() => onSelectMode('image')}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25"
                        >
                            <span>Launch Scanner</span>
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
