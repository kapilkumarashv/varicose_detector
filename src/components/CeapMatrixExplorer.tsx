'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ShieldAlert, CheckCircle, AlertTriangle, AlertOctagon, Stethoscope, ChevronRight, Info } from 'lucide-react';

interface StageInfo {
    stage: string;
    name: string;
    shortDesc: string;
    pathology: string;
    ultrasoundIndication: string;
    treatment: string;
    urgency: 'routine' | 'moderate' | 'urgent';
    badgeColor: string;
    borderColor: string;
}

const CEAP_STAGES: StageInfo[] = [
    {
        stage: 'C0',
        name: 'Asymptomatic / Normal',
        shortDesc: 'No visible or palpable signs of venous disease.',
        pathology: 'Venous valves are competent. Normal unidirectional cephalad return without reflux.',
        ultrasoundIndication: 'Not indicated unless heavy, aching legs persist on prolonged standing.',
        treatment: 'Routine physical activity, leg elevation, avoidance of prolonged sedentary immobility.',
        urgency: 'routine',
        badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        borderColor: 'hover:border-emerald-500/50',
    },
    {
        stage: 'C1',
        name: 'Telangiectasias & Reticular Veins',
        shortDesc: 'Spider veins (<1 mm) and bluish reticular subdermal venules (1–3 mm).',
        pathology: 'Micro-valvular incompetence in intradermal and subdermal vascular plexus.',
        ultrasoundIndication: 'Selective duplex mapping if symptoms (burning, throbbing) are present.',
        treatment: 'Liquid/foam microsclerotherapy, transdermal Nd:YAG laser, Class 1 compression stockings (15–20 mmHg).',
        urgency: 'moderate',
        badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
        borderColor: 'hover:border-sky-500/50',
    },
    {
        stage: 'C2',
        name: 'Truncal Varicose Veins',
        shortDesc: 'Subcutaneous dilated, tortuous, palpable serpentine veins (≥3 mm caliber).',
        pathology: 'Axial reflux through saphenofemoral junction (SFJ) or saphenopopliteal junction (SPJ).',
        ultrasoundIndication: 'High indication: Duplex ultrasound with Doppler reflux time measurement (>0.5s).',
        treatment: 'Endovenous Laser Ablation (EVLA), Radiofrequency Ablation (RFA), Ultrasound-Guided Foam Sclerotherapy (UGFS), ambulatory phlebectomy.',
        urgency: 'moderate',
        badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        borderColor: 'hover:border-amber-500/50',
    },
    {
        stage: 'C3',
        name: 'Venous Edema',
        shortDesc: 'Persistent pitting edema of the ankle and distal calf after standing.',
        pathology: 'Microvascular hypertension exceeds interstitial lymphatic reabsorption capacity.',
        ultrasoundIndication: 'Mandatory: Map deep and superficial venous systems to rule out deep vein thrombosis (DVT).',
        treatment: 'Prescription Class 2 graduated compression (20–30 mmHg), pneumatic compression pumps, surgical ablation of refluxing trunks.',
        urgency: 'moderate',
        badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        borderColor: 'hover:border-orange-500/50',
    },
    {
        stage: 'C4',
        name: 'Skin & Subcutaneous Trophic Changes',
        shortDesc: 'Hemosiderin hyperpigmentation, stasis eczema, lipodermatosclerosis.',
        pathology: 'Chronic extravasation of red blood cells; progressive subcutaneous fat necrosis and fibrosis.',
        ultrasoundIndication: 'Urgent duplex scan to evaluate extensive perforator and saphenous insufficiency.',
        treatment: 'Topical barrier emollients, short-course corticosteroids, pentoxifylline, urgent truncal venous ablation.',
        urgency: 'urgent',
        badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        borderColor: 'hover:border-rose-500/50',
    },
    {
        stage: 'C5 & C6',
        name: 'Healed or Active Venous Ulcers',
        shortDesc: 'Open chronic venous stasis ulceration, typically over the medial malleolus.',
        pathology: 'End-stage capillary thrombosis, severe tissue hypoxia, and dermal breakdown.',
        ultrasoundIndication: 'Emergency vascular surgery consultation and multi-level venous duplex investigation.',
        treatment: 'Multilayer compression bandaging (40 mmHg), advanced hydrocolloid wound dressings, urgent venous ablation, debridement.',
        urgency: 'urgent',
        badgeColor: 'bg-red-500/15 text-red-400 border-red-500/40',
        borderColor: 'hover:border-red-500/60',
    },
];

export default function CeapMatrixExplorer() {
    const [selectedIdx, setSelectedIdx] = useState(2); // C2 Varicose default
    const active = CEAP_STAGES[selectedIdx];

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
            
            {/* Header */}
            <div className="text-center mb-12">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/30">
                    Clinical Standard Reference
                </span>
                <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-white dark:text-white light-mode:text-slate-900 mt-3">
                    CEAP Clinical Classification Matrix
                </h2>
                <p className="text-slate-400 dark:text-slate-400 light-mode:text-slate-600 text-sm max-w-xl mx-auto mt-2">
                    International diagnostic staging framework classifying venous disease severity from asymptomatic (C0) to active ulceration (C6).
                </p>
            </div>

            {/* Stage Selector Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                {CEAP_STAGES.map((s, idx) => (
                    <button
                        key={s.stage}
                        onClick={() => setSelectedIdx(idx)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                            selectedIdx === idx
                                ? 'bg-amber-500/20 border-amber-500/80 shadow-lg shadow-amber-500/10 scale-105'
                                : 'glass border-slate-800 hover:border-slate-700 opacity-80 hover:opacity-100'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-display font-extrabold text-xl text-white dark:text-white light-mode:text-slate-900">
                                {s.stage}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${s.badgeColor}`}>
                                {s.urgency.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-300 dark:text-slate-300 light-mode:text-slate-700 line-clamp-1">
                            {s.name}
                        </p>
                    </button>
                ))}
            </div>

            {/* Active Stage Detail Console */}
            <div className="glass p-6 sm:p-8 rounded-3xl border border-slate-700/50 shadow-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/90 dark:from-slate-900/80 dark:to-slate-950/90 light-mode:from-white light-mode:to-slate-50">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-700/40">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="font-display font-black text-3xl sm:text-4xl text-amber-400">
                                {active.stage}
                            </span>
                            <span className="text-lg sm:text-xl font-bold text-white dark:text-white light-mode:text-slate-900">
                                {active.name}
                            </span>
                        </div>
                        <p className="text-sm text-slate-300 dark:text-slate-300 light-mode:text-slate-600 max-w-2xl">
                            {active.shortDesc}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider ${active.badgeColor}`}>
                            Clinical Triage: {active.urgency}
                        </div>
                    </div>
                </div>

                {/* 3 Pillar Clinical Guidance Cards */}
                <div className="grid md:grid-cols-3 gap-6 mt-6">
                    <div className="p-5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800 dark:border-slate-800 light-mode:border-slate-200">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-2">
                            Hemodynamic Pathophysiology
                        </span>
                        <p className="text-xs text-slate-300 dark:text-slate-300 light-mode:text-slate-700 leading-relaxed">
                            {active.pathology}
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800 dark:border-slate-800 light-mode:border-slate-200">
                        <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block mb-2">
                            Duplex Ultrasound Referral
                        </span>
                        <p className="text-xs text-slate-300 dark:text-slate-300 light-mode:text-slate-700 leading-relaxed">
                            {active.ultrasoundIndication}
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800 dark:border-slate-800 light-mode:border-slate-200">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-2">
                            Recommended Surgical / Conservative Action
                        </span>
                        <p className="text-xs text-slate-300 dark:text-slate-300 light-mode:text-slate-700 leading-relaxed">
                            {active.treatment}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
