'use client';

import { motion } from 'framer-motion';
import { Activity, ShieldCheck, Zap, ArrowRight, Eye, Cuboid, Flame, Stethoscope, ChevronRight } from 'lucide-react';

interface Props {
    compact?: boolean;
    onStartScan?: (mode: 'image' | 'live') => void;
}

const stats = [
    { icon: ShieldCheck, value: '25.8M', label: 'AI Model Parameters' },
    { icon: Zap, value: '<500ms', label: 'Inference Latency' },
    { icon: Activity, value: 'C0 – C6', label: 'CEAP Clinical Scoring' },
    { icon: Cuboid, value: '3D PBR', label: 'Photorealistic Limb Modeling' },
];

export default function HeroSection({ compact, onStartScan }: Props) {
    return (
        <section className={`relative overflow-hidden grid-bg transition-all duration-700 ${compact ? 'pt-6 pb-4 px-4 sm:px-6' : 'pt-16 pb-16 px-4 sm:px-8'}`}>
            
            {/* Ambient Backlight Radiance */}
            <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] rounded-full opacity-15 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse, #F59E0B 0%, #0EA5E9 40%, transparent 70%)' }} 
            />

            <div className="relative z-10 max-w-6xl mx-auto text-center">
                
                {/* Clinical Eyebrow Badge */}
                {!compact && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-bold tracking-wide uppercase mb-8 shadow-lg shadow-amber-500/5 backdrop-blur-md"
                    >
                        <span className="w-2 h-2 rounded-full bg-amber-400 pulse-glow inline-block" />
                        Next-Gen Clinical Vascular AI &amp; 3D Saphenous Modeling
                    </motion.div>
                )}

                {/* Main Headline */}
                <motion.h1
                    layout
                    className={`font-display font-extrabold text-white dark:text-white light-mode:text-slate-900 tracking-tight leading-[1.1] ${
                        compact ? 'text-2xl md:text-3xl mb-0' : 'text-4xl sm:text-6xl lg:text-7xl mb-6'
                    }`}
                >
                    Detect Varicose Veins{' '}
                    <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                        With Clinical Precision.
                    </span>
                    {!compact && (
                        <span className="block text-slate-400 dark:text-slate-400 light-mode:text-slate-600 text-3xl sm:text-5xl lg:text-6xl font-medium mt-2">
                            Bilateral Mapping &amp; 3D Reconstruction.
                        </span>
                    )}
                </motion.h1>

                {/* Subtitle */}
                {!compact && (
                    <motion.p
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="text-slate-400 dark:text-slate-400 light-mode:text-slate-600 text-base sm:text-lg max-w-3xl mx-auto mb-10 leading-relaxed"
                    >
                        Equipped with a self-trained 25.8M parameter YOLOv8-Medium engine, AccuVein-style 
                        subdermal ridge extraction, hemodynamic thermal pooling heatmaps, and photorealistic 
                        3D human leg modeling with retrograde valvular reflux simulation.
                    </motion.p>
                )}

                {/* Quick Action CTA Buttons (If not compact) */}
                {!compact && onStartScan && (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="flex flex-wrap items-center justify-center gap-4 mb-14"
                    >
                        <button
                            onClick={() => onStartScan('image')}
                            className="flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all shadow-xl shadow-amber-500/25 hover:scale-105 active:scale-95"
                        >
                            <span>Launch Image Studio</span>
                            <ArrowRight size={17} />
                        </button>
                        <button
                            onClick={() => onStartScan('live')}
                            className="flex items-center gap-2.5 px-7 py-4 rounded-2xl glass hover:bg-slate-800/80 text-white dark:text-white light-mode:text-slate-900 font-bold text-sm transition-all border border-slate-700/60 shadow-lg hover:scale-105 active:scale-95"
                        >
                            <span>Connect Hardware Camera (ESP32)</span>
                            <ChevronRight size={17} className="text-slate-400" />
                        </button>
                    </motion.div>
                )}

                {/* Clinical Telemetry Metric Cards */}
                {!compact && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
                    >
                        {stats.map(({ icon: Icon, value, label }) => (
                            <div 
                                key={label} 
                                className="glass rounded-2xl p-4.5 flex flex-col items-center justify-center text-center group hover:border-amber-500/40 transition-all hover:-translate-y-1 shadow-lg"
                            >
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-2.5 group-hover:scale-110 transition-transform">
                                    <Icon size={20} />
                                </div>
                                <p className="font-display font-extrabold text-2xl text-white dark:text-white light-mode:text-slate-900 leading-none">
                                    {value}
                                </p>
                                <p className="text-slate-400 dark:text-slate-400 light-mode:text-slate-500 text-xs mt-1.5 font-medium">
                                    {label}
                                </p>
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>

            {/* Subtle Divider */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-700/60 to-transparent" />
        </section>
    );
}