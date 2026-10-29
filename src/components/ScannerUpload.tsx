'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ClipboardList, X, AlertCircle, Cpu, Cloud, Sparkles, CheckCircle2 } from 'lucide-react';
import { analyzeImageWithGemini } from '@/lib/gemini';
import { 
    analyzeImage, 
    analyzeWithCustomLocalModel, 
    analyzeWithRoboflow, 
    checkLocalAIServerHealth,
    type ScanResult, 
    type AIModelType 
} from '@/lib/roboflow';
import ResultCard from './ResultCard';

// ── Animation variants ──────────────────────────────────────────────────────
const dropzoneVariants = {
    idle: { scale: 1, borderColor: 'rgba(148,163,184,0.2)' },
    hover: { scale: 1.02, borderColor: 'rgba(245,158,11,0.6)' },
    active: { scale: 0.98, borderColor: 'rgba(14,165,233,0.6)' },
};

const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
};

// ── Types ───────────────────────────────────────────────────────────────────
type Stage = 'idle' | 'preview' | 'scanning' | 'result' | 'error';

interface Props {
    onBack?: () => void;
    initialSampleUrl?: string | null;
}

export default function ScannerUpload({ onBack, initialSampleUrl }: Props) {
    const [stage, setStage] = useState<Stage>('idle');
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<AIModelType>('custom-yolo');
    const [isLocalOnline, setIsLocalOnline] = useState<boolean>(true);

    const fileRef = useRef<File | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scan initial sample if passed from frontpage
    useEffect(() => {
        if (!initialSampleUrl) return;
        const loadInitial = async () => {
            try {
                setStage('scanning');
                setError(null);
                setFileName('Clinical Verification Case');
                setPreview(initialSampleUrl);
                const resp = await fetch(initialSampleUrl);
                const blob = await resp.blob();
                const file = new File([blob], 'clinical_sample.png', { type: 'image/png' });
                fileRef.current = file;

                const res = await analyzeWithCustomLocalModel(file);
                setResult(res);
                setStage('result');
            } catch (err: unknown) {
                console.warn("Failed to auto-scan initial sample, trying fallback:", err);
                try {
                    if (fileRef.current) {
                        const fallback = await analyzeImage(fileRef.current, 'custom-yolo');
                        setResult(fallback);
                        setStage('result');
                    }
                } catch {
                    setError('Failed to analyze sample image.');
                    setStage('error');
                }
            }
        };
        loadInitial();
    }, [initialSampleUrl]);

    // Check health of local AI server
    useEffect(() => {
        const checkHealth = async () => {
            const online = await checkLocalAIServerHealth();
            setIsLocalOnline(online);
        };
        checkHealth();
        const interval = setInterval(checkHealth, 6000);
        return () => clearInterval(interval);
    }, []);

    // ── File handling ──────────────────────────────────────────────────────
    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Please upload a valid image file (JPG, PNG, WEBP).');
            setStage('error');
            return;
        }
        const url = URL.createObjectURL(file);
        fileRef.current = file;
        setPreview(url);
        setFileName(file.name);
        setStage('preview');
        setResult(null);
        setError(null);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, [processFile]);

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = () => setIsDragging(false);

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    // ── Scan Logic with Model Selection ────────────────────────────────────
    const runScan = async () => {
        if (!fileRef.current) return;
        setStage('scanning');
        setError(null);

        try {
            if (selectedModel === 'custom-yolo') {
                // Run Custom Local YOLOv8 Model
                const customResult = await analyzeWithCustomLocalModel(fileRef.current);
                setResult(customResult);
                setStage('result');
            } else if (selectedModel === 'roboflow') {
                // Run Roboflow Cloud Model
                const roboflowResult = await analyzeWithRoboflow(fileRef.current);
                setResult(roboflowResult);
                setStage('result');
            } else {
                // Run Google Gemini Multimodal
                const geminiResult = await analyzeImageWithGemini(fileRef.current);
                setResult(geminiResult);
                setStage('result');
            }
        } catch (err: unknown) {
            console.warn(`Selected model (${selectedModel}) error, trying fallback...`, err);
            try {
                // Smart fallback to another engine
                const fallbackResult = await analyzeImage(fileRef.current, selectedModel === 'custom-yolo' ? 'roboflow' : 'custom-yolo');
                setResult({ ...fallbackResult, isFallback: true });
                setStage('result');
            } catch (fallbackErr: unknown) {
                const msg = err instanceof Error ? err.message : 'Analysis failed. Please check backend connection.';
                setError(msg);
                setStage('error');
            }
        }
    };

    // ── Load Sample Directly ─────────────────────────────────────────────
    const loadSampleDirectly = async (url: string, title: string) => {
        try {
            setStage('scanning');
            setError(null);
            setFileName(title);
            setPreview(url);
            const resp = await fetch(url);
            const blob = await resp.blob();
            const file = new File([blob], title + '.png', { type: 'image/png' });
            fileRef.current = file;

            const res = await analyzeWithCustomLocalModel(file);
            setResult(res);
            setStage('result');
        } catch (err: unknown) {
            console.warn("Failed direct sample analysis, fallback:", err);
            try {
                if (fileRef.current) {
                    const fallback = await analyzeImage(fileRef.current, 'custom-yolo');
                    setResult(fallback);
                    setStage('result');
                }
            } catch {
                setError('Failed to analyze sample image.');
                setStage('error');
            }
        }
    };

    // ── Reset ──────────────────────────────────────────────────────────────
    const reset = () => {
        setStage('idle');
        setPreview(null);
        setResult(null);
        setError(null);
        setFileName('');
        fileRef.current = null;
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <section className={`relative px-4 sm:px-6 pb-24 transition-all duration-500 mx-auto ${stage === 'result' ? 'max-w-7xl' : 'max-w-4xl'}`}>
            {/* Header controls & AI Engine Selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                {onBack ? (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                    >
                        <X size={16} />
                        Exit Scanner
                    </motion.button>
                ) : <div />}

                {/* Model Selector Dropdown & Tabs */}
                <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
                    <span className="text-[11px] font-semibold text-slate-400 px-2 uppercase tracking-wider hidden md:inline">
                        AI Engine:
                    </span>

                    {/* Custom Local Model Tab */}
                    <button
                        type="button"
                        onClick={() => setSelectedModel('custom-yolo')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            selectedModel === 'custom-yolo'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Cpu size={14} className="text-emerald-400" />
                        <span>Custom Model (Local)</span>
                        <span className={`w-2 h-2 rounded-full ${isLocalOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} 
                              title={isLocalOnline ? "Local server is running" : "Local server offline"} />
                    </button>

                    {/* Roboflow Cloud Tab */}
                    <button
                        type="button"
                        onClick={() => setSelectedModel('roboflow')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            selectedModel === 'roboflow'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Cloud size={14} className="text-purple-400" />
                        <span>Roboflow Cloud</span>
                    </button>

                    {/* Gemini AI Tab */}
                    <button
                        type="button"
                        onClick={() => setSelectedModel('gemini')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            selectedModel === 'gemini'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Sparkles size={14} className="text-amber-400" />
                        <span>Gemini AI</span>
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {/* ── IDLE / DROPZONE ─────────────────────────────────── */}
                {stage === 'idle' && (
                    <motion.div
                        key="dropzone"
                        variants={dropzoneVariants}
                        animate={isDragging ? 'hover' : 'idle'}
                        initial="idle"
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.2 }}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onClick={() => inputRef.current?.click()}
                        className="relative cursor-pointer rounded-3xl border-2 border-dashed"
                        style={{ borderColor: isDragging ? 'rgba(245,158,11,0.6)' : 'rgba(148,163,184,0.2)' }}
                    >
                        <div className="glass rounded-3xl p-10 md:p-16 text-center transition-colors duration-300"
                            style={{ background: isDragging ? 'rgba(245,158,11,0.05)' : undefined }}>

                            <motion.div
                                animate={isDragging ? { y: -8, scale: 1.1 } : { y: 0, scale: 1 }}
                                transition={{ duration: 0.3 }}
                                className="flex justify-center mb-6"
                            >
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                                        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                                        <Activity className="text-amber-400" size={32} />
                                    </div>
                                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                                        <ClipboardList className="text-teal-400" size={13} />
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div variants={contentVariants} initial="hidden" animate="visible">
                                <motion.h2 variants={itemVariants} className="font-display text-2xl md:text-3xl text-white mb-2">
                                    {isDragging ? 'Release to Scan' : 'Clinical Diagnostic Scanner'}
                                </motion.h2>
                                <motion.p variants={itemVariants} className="text-slate-400 mb-2 text-sm">
                                    Upload patient leg imagery to evaluate with your selected AI model
                                </motion.p>
                                
                                {/* Engine Info Tag */}
                                <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/50 text-xs text-slate-300 mb-6">
                                    {selectedModel === 'custom-yolo' && (
                                        <>
                                            <Cpu size={12} className="text-emerald-400" />
                                            <span>Active: <strong>Custom Local Model (YOLOv8 best.pt)</strong></span>
                                        </>
                                    )}
                                    {selectedModel === 'roboflow' && (
                                        <>
                                            <Cloud size={12} className="text-purple-400" />
                                            <span>Active: <strong>Roboflow Hosted Detection API</strong></span>
                                        </>
                                    )}
                                    {selectedModel === 'gemini' && (
                                        <>
                                            <Sparkles size={12} className="text-amber-400" />
                                            <span>Active: <strong>Google Gemini Multimodal AI</strong></span>
                                        </>
                                    )}
                                </motion.div>

                                <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-3">
                                    {['Clear lighting', 'Full leg visible', 'No filters'].map(tip => (
                                        <span key={tip}
                                            className="px-3 py-1.5 text-xs rounded-full text-amber-400"
                                            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                            ✓ {tip}
                                        </span>
                                    ))}
                                </motion.div>

                                {/* Preloaded Clinical Samples Quick Bar */}
                                <motion.div variants={itemVariants} className="mt-8 pt-6 border-t border-slate-700/40 flex flex-wrap items-center justify-center gap-2.5">
                                    <span className="text-xs text-slate-400">Or verify with 1-click patient sample:</span>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); loadSampleDirectly('/samples/sample_foot.png', 'Perimalleolar Ankle & Dorsal Foot Varices'); }}
                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all shadow-sm"
                                    >
                                        Case 1: Foot &amp; Ankle (C3)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); loadSampleDirectly('/samples/sample_bilateral.png', 'Bilateral Severe Saphenous Varices'); }}
                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all shadow-sm"
                                    >
                                        Case 2: Bilateral Varices (C3)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); loadSampleDirectly('/samples/sample_case2.png', 'Mid-Calf Gastrocnemius Trunk'); }}
                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-all shadow-sm"
                                    >
                                        Case 3: Mid-Calf Trunk (C2)
                                    </button>
                                </motion.div>
                            </motion.div>
                        </div>

                        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
                    </motion.div>
                )}

                {/* ── PREVIEW ─────────────────────────────────────────── */}
                {stage === 'preview' && preview && (
                    <motion.div key="preview"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass rounded-3xl overflow-hidden"
                    >
                        <div className="p-4 flex items-center justify-between border-b border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="text-slate-300 text-sm truncate max-w-xs">{fileName}</span>
                            </div>
                            <button onClick={reset} className="p-2 rounded-full hover:bg-slate-700/50 transition-colors">
                                <X className="text-slate-400" size={16} />
                            </button>
                        </div>

                        <div className="relative">
                            <img src={preview} alt="Uploaded leg" className="w-full max-h-[420px] object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-transparent to-transparent" />
                            
                            {/* Selected model watermark */}
                            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs flex items-center gap-2">
                                {selectedModel === 'custom-yolo' && <Cpu size={14} className="text-emerald-400" />}
                                {selectedModel === 'roboflow' && <Cloud size={14} className="text-purple-400" />}
                                {selectedModel === 'gemini' && <Sparkles size={14} className="text-amber-400" />}
                                <span className="text-white font-medium">
                                    Target Engine: {selectedModel === 'custom-yolo' ? 'Custom YOLOv8 (Local)' : selectedModel === 'roboflow' ? 'Roboflow Cloud' : 'Gemini AI'}
                                </span>
                            </div>
                        </div>

                        <div className="p-6 flex flex-col sm:flex-row gap-3">
                            <button onClick={reset}
                                className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700/50 transition-all font-medium">
                                Choose Different Image
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={runScan}
                                className="flex-1 py-3 rounded-xl font-semibold text-navy-mid transition-all shadow-lg flex items-center justify-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #F59E0B, #FCD34D)', color: '#0B1120' }}
                            >
                                <span>Run Analysis</span>
                                <span>→</span>
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* ── SCANNING ────────────────────────────────────────── */}
                {stage === 'scanning' && preview && (
                    <motion.div key="scanning"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="glass rounded-3xl overflow-hidden"
                    >
                        <div className="relative">
                            <img src={preview} alt="Scanning" className="w-full max-h-[420px] object-cover opacity-70" />

                            {/* Scan beam */}
                            <div className="absolute inset-0 overflow-hidden">
                                <div className="absolute left-0 right-0 h-1 scan-line"
                                    style={{
                                        background: 'linear-gradient(90deg, transparent, #F59E0B, #FCD34D, #F59E0B, transparent)',
                                        boxShadow: '0 0 20px 4px rgba(245,158,11,0.4)'
                                    }} />
                            </div>

                            {/* Overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center"
                                style={{ background: 'rgba(11,17,32,0.6)' }}>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    className="w-14 h-14 rounded-full border-2 border-transparent border-t-amber-400 mb-4"
                                />
                                <p className="text-amber-400 font-semibold text-lg">
                                    {selectedModel === 'custom-yolo' 
                                        ? 'Executing Custom Local YOLOv8 Model...'
                                        : selectedModel === 'roboflow' 
                                            ? 'Calling Roboflow Cloud Detector...' 
                                            : 'Analyzing with Gemini Multimodal AI...'}
                                </p>
                                <p className="text-slate-400 text-xs mt-1">Extracting venous vascular anomalies & CEAP severity</p>
                            </div>
                        </div>

                        <div className="p-4">
                            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: '0%' }}
                                    animate={{ width: '95%' }}
                                    transition={{ duration: 2.2, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{ background: 'linear-gradient(90deg, #F59E0B, #FCD34D)' }}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── RESULT ──────────────────────────────────────────── */}
                {stage === 'result' && result && preview && (
                    <motion.div key={`result-${preview.slice(-25)}`}
                        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <ResultCard result={result} preview={preview} onReset={reset} />
                    </motion.div>
                )}

                {/* ── ERROR ───────────────────────────────────────────── */}
                {stage === 'error' && (
                    <motion.div key="error"
                        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                        className="glass rounded-3xl p-10 text-center"
                    >
                        <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30
                            flex items-center justify-center mx-auto mb-5">
                            <AlertCircle className="text-red-400" size={28} />
                        </div>
                        <h3 className="text-white font-display text-2xl mb-2">Analysis Error</h3>
                        <p className="text-slate-400 text-sm max-w-md mx-auto mb-8">{error}</p>
                        <button onClick={reset}
                            className="px-8 py-3 rounded-xl font-semibold transition-all"
                            style={{
                                background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
                                border: '1px solid rgba(245,158,11,0.3)'
                            }}>
                            Try Again
                        </button>
                    </motion.div>
                )}

            </AnimatePresence>
        </section>
    );
}