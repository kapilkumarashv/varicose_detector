'use client';

import { motion } from 'framer-motion';
import { Camera, Image as ImageIcon, ArrowRight, Sparkles, Layers, Cuboid, Flame, CheckCircle2, Shield } from 'lucide-react';

interface Props {
    onSelect: (mode: 'image' | 'live') => void;
}

export default function AnalyzerSelection({ onSelect }: Props) {
    const modes = [
        {
            id: 'image' as const,
            title: 'Diagnostic Image Studio',
            badge: 'Bilateral Scanning + 3D Model',
            description: 'Upload high-resolution patient lower extremity photography for multi-zone bilateral vascular mapping, tortuosity quantification, and photorealistic 3D human leg modeling.',
            features: [
                'Multi-Zone Bilateral Mapping (Left & Right Legs)',
                'AccuVein-Style Infrared Subdermal Vessel Glow',
                'Hemodynamic Venous Stasis Heatmap',
                '3D Human Leg with Realistic Skin & Valve Reflux',
                'Exportable 2-Page Surgical PDF Clinical Records'
            ],
            icon: ImageIcon,
            accent: 'amber',
            borderColor: 'border-amber-500/30 hover:border-amber-500/60',
            bgGradient: 'from-amber-500/15 via-amber-500/5 to-transparent',
            iconBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        },
        {
            id: 'live' as const,
            title: 'Live Clinical Stream',
            badge: 'ESP32 / Network Camera Support',
            description: 'Connect directly to an ESP32-CAM or network IP stream for real-time video monitoring. Capture and freeze frames with instant vascular ridge analysis.',
            features: [
                'Live Frame-by-Frame Video Processing',
                'Instant Freeze & Diagnostic Capture',
                'Integrated CORS-Verified Clinical Sample Feed',
                'Sub-500ms Local AI Model Inference',
                'Live Latency, FPS, & Telemetry Console'
            ],
            icon: Camera,
            accent: 'sky',
            borderColor: 'border-sky-500/30 hover:border-sky-500/60',
            bgGradient: 'from-sky-500/15 via-sky-500/5 to-transparent',
            iconBg: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
        }
    ];

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
            <div className="text-center mb-10">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/30">
                    Clinical Workflow Selection
                </span>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-white dark:text-white light-mode:text-slate-900 mt-3">
                    Choose Your Diagnostic Modality
                </h2>
                <p className="text-slate-400 dark:text-slate-400 light-mode:text-slate-600 text-sm mt-1 max-w-lg mx-auto">
                    Select a workflow to begin clinical vascular evaluation, hemodynamic stasis tracking, or hardware stream integration.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {modes.map((mode, idx) => (
                    <motion.div
                        key={mode.id}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.12 }}
                        onClick={() => onSelect(mode.id)}
                        className={`group relative p-8 sm:p-9 rounded-3xl border ${mode.borderColor} bg-gradient-to-br ${mode.bgGradient} glass hover:bg-opacity-30 cursor-pointer transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/50 flex flex-col justify-between`}
                    >
                        <div>
                            {/* Card Header & Badge */}
                            <div className="flex items-center justify-between gap-4 mb-6">
                                <div className={`p-4 rounded-2xl ${mode.iconBg} shadow-md group-hover:scale-110 transition-transform`}>
                                    <mode.icon size={28} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-900/80 dark:bg-slate-900/80 light-mode:bg-white text-slate-300 dark:text-slate-300 light-mode:text-slate-700 border border-slate-700/60 shadow-sm">
                                    {mode.badge}
                                </span>
                            </div>

                            <h3 className="text-2xl font-bold text-white dark:text-white light-mode:text-slate-900 mb-3 flex items-center gap-2 group-hover:text-amber-400 transition-colors">
                                {mode.title}
                                <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-amber-400" size={20} />
                            </h3>

                            <p className="text-slate-400 dark:text-slate-400 light-mode:text-slate-600 text-sm leading-relaxed mb-6">
                                {mode.description}
                            </p>

                            {/* Features Checklist */}
                            <div className="space-y-2 mb-8 pt-4 border-t border-slate-700/40">
                                {mode.features.map((feat) => (
                                    <div key={feat} className="flex items-center gap-2 text-xs text-slate-300 dark:text-slate-300 light-mode:text-slate-700">
                                        <CheckCircle2 size={13} className="text-amber-400 flex-shrink-0" />
                                        <span>{feat}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Card Action Footer */}
                        <div className="pt-4 border-t border-slate-700/40 flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-400 tracking-wide uppercase">
                                Open {mode.title}
                            </span>
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                                <ArrowRight size={16} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
