'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    Sparkles, ArrowRight, ShieldCheck, Activity, Heart, 
    Layers, Stethoscope, ChevronRight, Eye, RefreshCw 
} from 'lucide-react';
import ThreeVascularViewer from './ThreeVascularViewer';

interface Props {
    onLaunchScan: () => void;
}

const anatomicalHotspots = [
    {
        id: 'sfj',
        title: 'Saphenofemoral Junction (SFJ)',
        leg: 'Left Limb (Proximal)',
        caliber: '7.8 mm (Severe Dilation)',
        description: 'Terminal valve incompetence causing hydrostatic column pressure descent down the Great Saphenous Vein (GSV).',
        refluxTime: '1.85s (Pathological >0.5s)',
        color: 'border-red-500/50 text-red-400 bg-red-500/10'
    },
    {
        id: 'gsv',
        title: 'Truncal GSV Calf Varices',
        leg: 'Left Limb (Mid Calf)',
        caliber: '4.8 mm (Tortuous Bulging)',
        description: 'Marked serpentine tortuosity protruding through the subcutaneous fascia with visible bulging cords on the medial calf.',
        refluxTime: '1.42s (Retrograde Reflux)',
        color: 'border-amber-500/50 text-amber-400 bg-amber-500/10'
    },
    {
        id: 'cockett',
        title: 'Cockett Lower Perforator',
        leg: 'Right Limb (Distal)',
        caliber: '3.9 mm (Incompetent)',
        description: 'Deep-to-superficial venous reflux transmitting high ambulatory venous pressure into the perimalleolar dermal plexus.',
        refluxTime: '0.98s (Incompetent Perforator)',
        color: 'border-sky-500/50 text-sky-400 bg-sky-500/10'
    },
    {
        id: 'stasis',
        title: 'Medial Malleolar Venous Stasis',
        leg: 'Bilateral Perimalleolar',
        caliber: 'Micro-capillary pooling',
        description: 'Chronic erythrocyte extravasation and hemosiderin dermal hyperpigmentation (CEAP C4a risk indicator).',
        refluxTime: 'Continuous Stasis',
        color: 'border-purple-500/50 text-purple-400 bg-purple-500/10'
    }
];

export default function Frontpage3DShowcase({ onLaunchScan }: Props) {
    const [selectedHotspot, setSelectedHotspot] = useState(anatomicalHotspots[1]);

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
            
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-bold tracking-wider uppercase mb-3">
                        <Sparkles size={14} className="animate-spin-slow" />
                        <span>Interactive 3D Digital Twin</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-white dark:text-white light-mode:text-slate-900 tracking-tight">
                        Photorealistic Bilateral Human Leg Explorer
                    </h2>
                    <p className="text-slate-400 dark:text-slate-400 light-mode:text-slate-600 text-sm sm:text-base mt-2 max-w-2xl">
                        Inspect the anatomical morphology of both lower limbs in real-time 3D. 
                        Features procedural PBR human skin textures with dermal pores, Fitzpatrick tone adaptation, 
                        3D embossed varicose veins, and animated valvular reflux.
                    </p>
                </div>

                <button
                    onClick={onLaunchScan}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 flex-shrink-0"
                >
                    <span>Run Scan On Your Photo</span>
                    <ArrowRight size={16} />
                </button>
            </div>

            {/* Main Interactive Stage: 3D Viewer & Clinical Lesion Deck */}
            <div className="grid lg:grid-cols-12 gap-8 items-start">
                
                {/* 3D Bilateral Viewer Port */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    <div className="glass p-2 sm:p-3 rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden relative">
                        <ThreeVascularViewer 
                            severity="high" 
                            maxCaliberMm={4.8} 
                            initialFocus="both"
                        />
                    </div>

                    {/* Quick Guidance Sub-bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl glass border border-slate-800 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                            <Eye size={15} className="text-amber-400" />
                            <span>Orbit 360° with mouse or finger to view posterior calf &amp; saphenous trunk.</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
                                Retrograde Reflux Active
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Interactive Clinical Hotspots Deck */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    
                    <div className="glass p-5 rounded-3xl border border-slate-700/50 shadow-xl">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-700/40">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                <Stethoscope size={15} className="text-amber-400" />
                                Anatomical Hotspots
                            </span>
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                                4 Target Lesions
                            </span>
                        </div>

                        <div className="space-y-3">
                            {anatomicalHotspots.map((spot) => (
                                <div
                                    key={spot.id}
                                    onClick={() => setSelectedHotspot(spot)}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                        selectedHotspot.id === spot.id
                                            ? 'bg-amber-500/15 border-amber-500/60 shadow-lg scale-[1.02]'
                                            : 'bg-slate-900/40 dark:bg-slate-900/40 light-mode:bg-white/60 border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="text-xs font-extrabold text-white dark:text-white light-mode:text-slate-900">
                                            {spot.title}
                                        </h4>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${spot.color}`}>
                                            {spot.leg}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                                        <span>Caliber: <strong className="text-amber-300">{spot.caliber}</strong></span>
                                        <span>•</span>
                                        <span>Reflux: <strong className="text-red-400">{spot.refluxTime}</strong></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Selected Hotspot Clinical Dossier */}
                    <div className="glass p-5 rounded-3xl border border-slate-700/50 shadow-xl bg-gradient-to-br from-amber-500/5 to-transparent">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={16} className="text-amber-400" />
                            <h4 className="text-sm font-extrabold text-white dark:text-white light-mode:text-slate-900">
                                {selectedHotspot.title} Dossier
                            </h4>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-400 light-mode:text-slate-600 leading-relaxed mb-4">
                            {selectedHotspot.description}
                        </p>

                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                            <div className="p-2.5 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800">
                                <span className="text-[10px] text-slate-400 block">Hemodynamic Grade</span>
                                <span className="font-extrabold text-amber-400">Pathological Reflux</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800">
                                <span className="text-[10px] text-slate-400 block">Duplex Referral</span>
                                <span className="font-extrabold text-emerald-400">Indicated (&lt;30d)</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
