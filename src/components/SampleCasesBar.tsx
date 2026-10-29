'use client';

import { Activity, ArrowRight, ShieldCheck, CheckCircle2, Sparkles, Layers } from 'lucide-react';

interface SampleCase {
    id: string;
    title: string;
    category: string;
    ceap: string;
    legs: string;
    src: string;
    desc: string;
}

const SAMPLES: SampleCase[] = [
    {
        id: 'foot-ankle-varices',
        title: 'Perimalleolar Ankle & Dorsal Foot Varices',
        category: 'Foot & Ankle Lesion',
        ceap: 'CEAP C3',
        legs: 'Lower Limb / Foot & Ankle',
        src: '/samples/sample_foot.png',
        desc: 'Subcutaneous tortuous varicosities across dorsal instep and medial ankle with perimalleolar venous stasis pooling.'
    },
    {
        id: 'bilateral-severe',
        title: 'Bilateral Severe Saphenous Varices',
        category: 'Both Legs Affected',
        ceap: 'CEAP C3',
        legs: 'Bilateral (Left & Right)',
        src: '/samples/sample_bilateral.png',
        desc: 'Prominent serpentine tortuosity across both medial calves with ankle stasis and dilated subcutaneous cords.'
    },
    {
        id: 'unilateral-popliteal',
        title: 'Mid-Calf Gastrocnemius Trunk',
        category: 'Unilateral Lesion',
        ceap: 'CEAP C2',
        legs: 'Isolated Lower Limb',
        src: '/samples/sample_case2.png',
        desc: 'Focal bulging varix with perforator reflux causing regional ambulatory venous hypertension.'
    }
];

interface Props {
    onSelectSample: (sampleUrl: string, sampleTitle: string) => void;
}

export default function SampleCasesBar({ onSelectSample }: Props) {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
            <div className="glass p-6 sm:p-8 rounded-3xl border border-slate-700/50 shadow-xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 dark:from-slate-900/90 dark:to-slate-900/90 light-mode:from-white light-mode:to-slate-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                            <Sparkles size={14} />
                            <span>1-Click Test Repository</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-display font-bold text-white dark:text-white light-mode:text-slate-900">
                            Preloaded Clinical Verification Cases
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-400 light-mode:text-slate-600 mt-0.5">
                            Select a verified patient case to run instantaneous bilateral AI detection, AccuVein infrared masking, and 3D limb reconstruction.
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    {SAMPLES.map((sample) => (
                        <div
                            key={sample.id}
                            onClick={() => onSelectSample(sample.src, sample.title)}
                            className="p-4 sm:p-5 rounded-2xl border border-slate-700/60 hover:border-amber-500/60 bg-slate-900/40 dark:bg-slate-900/40 light-mode:bg-white/60 hover:bg-amber-500/5 cursor-pointer transition-all duration-300 group flex items-start justify-between gap-4 shadow-md hover:-translate-y-0.5"
                        >
                            <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                        {sample.ceap}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/30">
                                        {sample.legs}
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-white dark:text-white light-mode:text-slate-900 group-hover:text-amber-400 transition-colors">
                                    {sample.title}
                                </h4>
                                <p className="text-xs text-slate-400 dark:text-slate-400 light-mode:text-slate-600 line-clamp-2">
                                    {sample.desc}
                                </p>
                            </div>

                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all flex-shrink-0 self-center">
                                <ArrowRight size={16} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
