'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle, AlertTriangle, AlertOctagon, RotateCcw, Activity, 
    MapPin, Download, FileText, Cpu, Cloud, Sparkles, Layers,
    Eye, Flame, Cuboid, BarChart3, Stethoscope, ChevronRight,
    ShieldAlert, Zap, Compass, Info, ArrowUpRight, SplitSquareVertical,
    Columns, Loader2
} from 'lucide-react';
import type { ScanResult, RiskLevel, Finding } from '@/lib/roboflow';
import AnatomyOverlay from './AnatomyOverlay';
import ThreeVascularViewer from './ThreeVascularViewer';
import HemodynamicRefluxSuite from './HemodynamicRefluxSuite';
import { generateClinicalVascularPdfReport } from '@/lib/pdfReportGenerator';

interface Props {
    result: ScanResult;
    preview?: string;
    onReset?: () => void;
    isLive?: boolean;
}

// ── Risk-level config ────────────────────────────────────────────────────────
const riskConfig: Record<NonNullable<RiskLevel>, {
    label: string; sublabel: string; color: string; bgColor: string;
    borderColor: string; icon: typeof CheckCircle; glow: string;
    recommendation: string;
}> = {
    low: {
        label: 'Low Risk',
        sublabel: 'Physiologically Competent Valves',
        color: '#34D399',
        bgColor: 'rgba(52,211,153,0.1)',
        borderColor: 'rgba(52,211,153,0.3)',
        glow: 'rgba(52,211,153,0.25)',
        icon: CheckCircle,
        recommendation: 'Superficial venous circulation appears within physiological norms. Maintain routine low-impact ambulation, adequate hydration, and periodic annual monitoring.',
    },
    medium: {
        label: 'Moderate Risk',
        sublabel: 'Early Chronic Venous Insufficiency',
        color: '#FBBF24',
        bgColor: 'rgba(251,191,36,0.1)',
        borderColor: 'rgba(251,191,36,0.3)',
        glow: 'rgba(251,191,36,0.25)',
        icon: AlertTriangle,
        recommendation: 'Telangiectatic or reticular branch dilation detected. Recommend prophylactic Class 1-2 graduated compression hosiery (18–22 mmHg) and specialist vascular consultation within 90 days.',
    },
    high: {
        label: 'Severe Risk',
        sublabel: 'Truncal Saphenous Incompetence',
        color: '#F87171',
        bgColor: 'rgba(248,113,113,0.1)',
        borderColor: 'rgba(248,113,113,0.3)',
        glow: 'rgba(248,113,113,0.3)',
        icon: AlertOctagon,
        recommendation: 'Significant subcutaneous varicose tortuosity and reflux indicators observed. Immediate bilateral duplex ultrasound mapping is advised to evaluate for thermal ablation (EVLA/RFA) or foam sclerotherapy.',
    },
};

export default function ResultCard({ result, preview, onReset, isLive }: Props) {
    // Default to 'split' view so both the patient photo and 3D digital twin are visible immediately!
    const [activeTab, setActiveTab] = useState<'split' | 'scan' | '3d' | 'telemetry' | 'surgical'>('split');
    const [showReticles, setShowReticles] = useState(true);
    const [showVesselGlow, setShowVesselGlow] = useState(true);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [heatmapOpacity, setHeatmapOpacity] = useState(0.65);
    const [hoveredFindingId, setHoveredFindingId] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const cfg = result.riskLevel ? riskConfig[result.riskLevel] : riskConfig.medium;
    const Icon = cfg.icon;

    const leftFindings = result.findings.filter(f => f.leg === 'Left Leg');
    const rightFindings = result.findings.filter(f => f.leg === 'Right Leg');

    const formatRegionName = (reg?: string) => {
        if (!reg) return 'Bilateral Lower Extremity';
        switch (reg) {
            case 'foot_ankle': return '🦶 Foot & Ankle Junction';
            case 'calf': return '🦵 Mid / Lower Calf';
            case 'popliteal': return '🦿 Popliteal Knee Fossa';
            case 'thigh': return '🩱 Mid-Thigh GSV';
            case 'bilateral': return '🧍 Bilateral Standing Limbs';
            default: return 'Lower Extremity';
        }
    };

    // Automatically focus 3D viewer on the exact anatomical region detected by AI (Gemini or Vision)
    const region = result.anatomicalRegion;
    let autoFocus: 'foot' | 'calf' | 'popliteal' | 'thigh' | 'both' = 'both';
    if (region === 'foot_ankle') autoFocus = 'foot';
    else if (region === 'calf') autoFocus = 'calf';
    else if (region === 'popliteal') autoFocus = 'popliteal';
    else if (region === 'thigh') autoFocus = 'thigh';
    else if (region === 'bilateral') autoFocus = 'both';
    else {
        const hasFootOrAnkle = result.findings.some(f => 
            f.anatomicalLocation?.toLowerCase().includes('foot') || 
            f.anatomicalLocation?.toLowerCase().includes('ankle') || 
            f.anatomicalLocation?.toLowerCase().includes('malleol') ||
            f.anatomicalLocation?.toLowerCase().includes('instep') ||
            f.anatomicalLocation?.toLowerCase().includes('supramalleolar')
        );
        autoFocus = hasFootOrAnkle ? 'foot' : 'both';
    }

    const viewerKey = `viewer-${preview ? preview.slice(-25) : 'twin'}-${result.findings.map(f => `${f.id}_${f.bbox.x.toFixed(2)}_${f.bbox.y.toFixed(2)}`).join('-')}-${result.anatomicalRegion || 'reg'}-${result.viewAspect || 'asp'}`;

    const handleDownloadReport = async () => {
        try {
            setIsGeneratingPdf(true);
            await generateClinicalVascularPdfReport({
                result,
                preview
            });
        } catch (err) {
            console.error("PDF Report generation failed:", err);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6">
            
            {/* Top Diagnostic Header Bar */}
            <div className="glass p-5 sm:p-6 rounded-3xl border border-slate-700/50 shadow-2xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div 
                        className="w-13 h-13 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: cfg.bgColor, borderColor: cfg.borderColor, borderWidth: 1 }}
                    >
                        <Icon size={26} style={{ color: cfg.color }} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display font-extrabold text-xl sm:text-2xl text-white dark:text-white light-mode:text-slate-900">
                                {cfg.label}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {result.ceapClassification}
                            </span>
                            {result.anatomicalRegion && (
                                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                                    {formatRegionName(result.anatomicalRegion)}
                                </span>
                            )}
                            {result.isHealthy && (
                                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                    <CheckCircle size={12} className="text-emerald-400" />
                                    Healthy Venous Return
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.sublabel}</p>
                    </div>
                </div>

                {/* Studio Tab Navigation */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 dark:bg-slate-900/80 light-mode:bg-slate-100 p-1.5 rounded-2xl border border-slate-800 dark:border-slate-800 light-mode:border-slate-200">
                    <button
                        onClick={() => setActiveTab('split')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'split'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                        title="Side-by-Side Dual View: Patient Scan + 3D Twin"
                    >
                        <Columns size={13} />
                        <span>Side-by-Side Dual View</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('scan')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'scan'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                    >
                        <Eye size={13} />
                        <span>Photo Scanner</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('3d')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === '3d'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                    >
                        <Cuboid size={13} />
                        <span>3D Bilateral Twin</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('telemetry')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'telemetry'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                    >
                        <BarChart3 size={13} />
                        <span>Hemodynamics</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('surgical')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'surgical'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                    >
                        <Stethoscope size={13} />
                        <span>Surgical Pathway</span>
                    </button>
                </div>

                {/* Actions: Download PDF & Reset */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownloadReport}
                        disabled={isGeneratingPdf}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20"
                    >
                        {isGeneratingPdf ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Generating Report...</span>
                            </>
                        ) : (
                            <>
                                <Download size={14} />
                                <span>PDF Report</span>
                            </>
                        )}
                    </button>
                    {onReset && (
                        <button
                            onClick={onReset}
                            className="p-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
                            title="Reset Scanner"
                        >
                            <RotateCcw size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* MAIN DIAGNOSTIC VIEWPORT */}

            {/* Option A: SIDE-BY-SIDE SPLIT VIEW (Patient Photo Left + 3D Bilateral Twin Right) */}
            {activeTab === 'split' && (
                <div className="grid lg:grid-cols-12 gap-6 items-stretch">
                    
                    {/* Left Column: Patient Photograph with Overlays */}
                    <div className="lg:col-span-6 flex flex-col gap-3">
                        <div className="glass p-4 rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col gap-3 h-full justify-between">
                            
                            {/* Layer Toggles */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-700/40">
                                <span className="text-xs font-bold text-slate-300 dark:text-slate-300 light-mode:text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Eye size={14} className="text-amber-400" />
                                    Patient Scan Overlays:
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setShowReticles(!showReticles)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                            showReticles ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        🎯 Reticles ({result.findings.length})
                                    </button>
                                    <button
                                        onClick={() => setShowVesselGlow(!showVesselGlow)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                            showVesselGlow ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        ⚡ AccuVein
                                    </button>
                                    <button
                                        onClick={() => setShowHeatmap(!showHeatmap)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                            showHeatmap ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        🔥 Thermal
                                    </button>
                                </div>
                            </div>

                            {/* Image Container */}
                            <div className="relative w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center min-h-[380px] max-h-[460px]">
                                {preview ? (
                                    <div className="relative inline-block max-w-full">
                                        <img 
                                            src={preview} 
                                            alt="Clinical Vascular Scan" 
                                            className="max-h-[440px] w-auto max-w-full object-contain mx-auto block rounded-xl"
                                        />
                                        <AnatomyOverlay 
                                            findings={result.findings}
                                            vesselMask={result.vesselMask}
                                            heatmap={result.heatmap}
                                            showReticles={showReticles}
                                            showVesselGlow={showVesselGlow}
                                            showHeatmap={showHeatmap}
                                            heatmapOpacity={heatmapOpacity}
                                            hoveredFindingId={hoveredFindingId}
                                            onSelectFinding={(id) => setHoveredFindingId(id)}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-12 text-slate-500 text-sm">
                                        <Activity size={32} className="text-amber-500/40 mb-3 animate-pulse" />
                                        <span>No image buffer available</span>
                                    </div>
                                )}
                            </div>

                            {/* Bilateral Quick Summary */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="p-3 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Left Limb Status</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-sm font-bold text-white dark:text-white light-mode:text-slate-900">{leftFindings.length} Lesion(s)</span>
                                        {(() => {
                                            const maxCal = Math.max(...leftFindings.map(f => f.caliberMm || 0), 0);
                                            if (maxCal >= 5.0) {
                                                return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40">Severe C2S</span>;
                                            } else if (maxCal >= 3.0 || leftFindings.some(f => f.label.includes('varicose'))) {
                                                return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">Varicose C2</span>;
                                            } else if (leftFindings.length > 0) {
                                                return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Spider C1</span>;
                                            }
                                            return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Competent C0</span>;
                                        })()}
                                    </div>
                                </div>
                                <div className="p-3 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Right Limb Status</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-sm font-bold text-white dark:text-white light-mode:text-slate-900">{rightFindings.length} Lesion(s)</span>
                                        {(() => {
                                            const maxCal = Math.max(...rightFindings.map(f => f.caliberMm || 0), 0);
                                            if (maxCal >= 5.0) {
                                                return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40">Severe C2S</span>;
                                            } else if (maxCal >= 3.0 || rightFindings.some(f => f.label.includes('varicose'))) {
                                                return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">Varicose C2</span>;
                                            } else if (rightFindings.length > 0) {
                                                return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Spider C1</span>;
                                            }
                                            return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Competent C0</span>;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: 3D Bilateral Human Anatomy Model */}
                    <div className="lg:col-span-6 flex flex-col gap-3">
                        <div className="glass p-2 sm:p-3 rounded-3xl border border-slate-700/50 shadow-2xl h-full flex flex-col justify-between">
                            <ThreeVascularViewer 
                                key={viewerKey}
                                findings={result.findings}
                                severity={result.riskLevel || 'high'}
                                maxCaliberMm={result.telemetry?.max_caliber_mm || 4.2}
                                initialFocus={autoFocus}
                                anatomicalRegion={result.anatomicalRegion}
                                viewAspect={result.viewAspect}
                                isHealthy={result.isHealthy}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Option B: FULL WIDTH 2D PHOTO SCANNER */}
            {activeTab === 'scan' && (
                <div className="grid lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-8 glass p-4 rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col gap-3">
                        <div className="relative w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center min-h-[460px]">
                            {preview && (
                                <div className="relative inline-block max-w-full">
                                    <img 
                                        src={preview} 
                                        alt="Clinical Vascular Scan" 
                                        className="max-h-[500px] w-auto max-w-full object-contain mx-auto block rounded-xl"
                                    />
                                    <AnatomyOverlay 
                                        findings={result.findings}
                                        vesselMask={result.vesselMask}
                                        heatmap={result.heatmap}
                                        showReticles={showReticles}
                                        showVesselGlow={showVesselGlow}
                                        showHeatmap={showHeatmap}
                                        heatmapOpacity={heatmapOpacity}
                                        hoveredFindingId={hoveredFindingId}
                                        onSelectFinding={(id) => setHoveredFindingId(id)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Telemetry Column */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <div className="glass p-5 rounded-3xl border border-slate-700/50 shadow-xl space-y-4">
                            <h4 className="text-sm font-bold text-white dark:text-white light-mode:text-slate-900 flex items-center gap-2">
                                <Activity size={16} className="text-amber-400" />
                                <span>Hemodynamic Biomarkers</span>
                            </h4>
                            <div className="space-y-3">
                                <div className="p-3.5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800 flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Peak Vessel Caliber</span>
                                    <span className="text-base font-bold font-mono text-amber-400">{result.telemetry?.max_caliber_mm || 4.2} mm</span>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800 flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Tortuosity Index</span>
                                    <span className="text-base font-bold font-mono text-sky-400">{result.telemetry?.tortuosity_index || 1.8}x</span>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800 flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Venous Stasis Score</span>
                                    <span className="text-base font-bold font-mono text-red-400">{result.telemetry?.venous_stasis_score || 68}/100</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Option C: FULL WIDTH 3D BILATERAL ANATOMY STUDIO */}
            {activeTab === '3d' && (
                <div className="glass p-3 sm:p-4 rounded-3xl border border-slate-700/50 shadow-2xl">
                    <ThreeVascularViewer 
                        key={viewerKey}
                        findings={result.findings} 
                        severity={result.riskLevel || 'high'}
                        maxCaliberMm={result.telemetry?.max_caliber_mm || 4.2}
                        initialFocus={autoFocus}
                        anatomicalRegion={result.anatomicalRegion}
                        viewAspect={result.viewAspect}
                        isHealthy={result.isHealthy}
                    />
                </div>
            )}

            {/* Option D: DETAILED HEMODYNAMIC TELEMETRY TAB */}
            {activeTab === 'telemetry' && (
                <HemodynamicRefluxSuite 
                    result={result}
                    selectedFindingId={hoveredFindingId}
                    onSelectFinding={(id) => setHoveredFindingId(id)}
                />
            )}

            {/* Option E: SURGICAL PATHWAY TAB */}
            {activeTab === 'surgical' && (
                <div className="glass p-8 rounded-3xl border border-slate-700/50 shadow-2xl space-y-6">
                    <div className="flex items-center gap-3">
                        <Stethoscope size={24} className="text-amber-400" />
                        <div>
                            <h4 className="text-xl font-bold text-white dark:text-white light-mode:text-slate-900">
                                Clinical Phlebology Interventional Algorithm
                            </h4>
                            <p className="text-xs text-slate-400">CEAP {result.ceapClassification} Staged Protocol</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="p-5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800">
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-2">Step 1: Duplex Ultrasound</span>
                            <p className="text-xs text-slate-300 dark:text-slate-300 light-mode:text-slate-700 leading-relaxed">
                                Complete standing duplex mapping of Great Saphenous Vein (GSV), Small Saphenous Vein (SSV), and perforators with reflux duration measurement.
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800">
                            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block mb-2">Step 2: Conservative Therapy</span>
                            <p className="text-xs text-slate-300 dark:text-slate-300 light-mode:text-slate-700 leading-relaxed">
                                Class 2 graduated compression stockings (20–30 mmHg), daytime ambulation breaks, elevation of limbs during recumbency.
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-2">Step 3: Endovenous Ablation</span>
                            <p className="text-xs text-slate-300 dark:text-slate-300 light-mode:text-slate-700 leading-relaxed">
                                If reflux &gt;0.5s is confirmed: Endovenous Laser Ablation (EVLA) 1470nm radial fiber or Radiofrequency Ablation (RFA) with ultrasound guidance.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Localized Anomaly Registry & Clinical Summary (Shown in all tabs for diagnostic completeness) */}
            <div className="grid lg:grid-cols-12 gap-6 items-start">
                
                {/* Findings Registry */}
                <div className="lg:col-span-7 glass p-5 rounded-3xl border border-slate-700/50 shadow-xl space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
                        <h4 className="text-sm font-bold text-white dark:text-white light-mode:text-slate-900 flex items-center gap-2">
                            <MapPin size={16} className="text-amber-400" />
                            <span>Bilateral Anomaly Registry ({result.findings.length} Zones)</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">HOVER TO HIGHLIGHT RETICLE</span>
                    </div>

                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                        {result.findings.map((f, idx) => {
                            const isSelected = hoveredFindingId === f.id;
                            const cal = f.caliberMm || (f.label.includes('varicose') ? 4.8 : 1.2);
                            const isSevere = cal >= 5.0;
                            const isModerate = cal >= 3.0 && cal < 5.0;

                            const tierColor = isSevere ? '#ef4444' : isModerate ? '#f59e0b' : '#06b6d4';
                            const badgeBg = isSevere ? 'bg-red-500/20 text-red-300 border-red-500/40' : isModerate ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';

                            return (
                                <motion.div
                                    key={f.id || idx}
                                    onMouseEnter={() => setHoveredFindingId(f.id)}
                                    onMouseLeave={() => setHoveredFindingId(null)}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                        isSelected 
                                            ? 'bg-amber-500/15 border-amber-500/80 shadow-lg shadow-amber-500/10' 
                                            : 'bg-slate-900/40 dark:bg-slate-900/40 light-mode:bg-white/70 border-slate-700/40 hover:border-slate-600'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div 
                                                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold border"
                                                style={{ backgroundColor: `${tierColor}20`, color: tierColor, borderColor: `${tierColor}40` }}
                                            >
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h5 className="text-xs font-bold text-white dark:text-white light-mode:text-slate-900 uppercase tracking-wide">
                                                        {f.anatomicalLocation}
                                                    </h5>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                                        {f.leg || 'Lower Limb'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 dark:text-slate-400 light-mode:text-slate-600 leading-relaxed mt-0.5">
                                                    {f.clinicalDescription}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeBg}`}>
                                                {isSevere ? 'Severe Dilation' : isModerate ? 'Moderate Varix' : 'Spider Vein'}
                                            </span>
                                            {f.caliberMm && (
                                                <span className="text-[10px] font-mono font-bold mt-1" style={{ color: tierColor }}>
                                                    Ø {f.caliberMm}mm
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Clinical Dossier & Interventional Recommendation */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="glass p-5 rounded-3xl border border-slate-700/50 shadow-xl space-y-3">
                        <div className="flex items-center gap-2 text-white dark:text-white light-mode:text-slate-900 font-bold text-sm">
                            <Info size={16} className="text-amber-400" />
                            <span>Physiological Evaluation Summary</span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-300 dark:text-slate-300 light-mode:text-slate-600">
                            {result.clinicalSummary}
                        </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/25 shadow-xl space-y-2">
                        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                            <Stethoscope size={15} />
                            <span>Specialist Referral Advice</span>
                        </div>
                        <p className="text-xs text-slate-300 dark:text-slate-300 light-mode:text-slate-700 leading-relaxed">
                            {cfg.recommendation}
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}