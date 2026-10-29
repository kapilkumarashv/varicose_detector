'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Settings, AlertCircle, Play, Pause, RefreshCw, X, Terminal, Info, ShieldAlert, CheckCircle2, Activity, Cpu, Cloud, Sparkles } from 'lucide-react';
import { 
    analyzeImage, 
    analyzeWithCustomLocalModel, 
    analyzeWithRoboflow, 
    checkLocalAIServerHealth,
    type ScanResult, 
    type AIModelType 
} from '@/lib/roboflow';
import { analyzeBase64WithGemini } from '@/lib/gemini';
import ResultCard from './ResultCard';
import AnatomyOverlay from './AnatomyOverlay';

interface Props {
    onBack: () => void;
}

interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'warn';
}

const SAMPLE_IMAGE_URL = "https://source.roboflow.com/669Onhc8bHR1J20q06cWf69V2k93/5879a6db6d226a03cc83262d4e8c1c5e/original.jpg";

export default function LiveScanner({ onBack }: Props) {
    const [streamUrl, setStreamUrl] = useState('');
    const [isConfigured, setIsConfigured] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSampleMode, setIsSampleMode] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState({ fps: 0, latency: 0 });
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [isFrozen, setIsFrozen] = useState(false);
    const [frozenImage, setFrozenImage] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<AIModelType>('custom-yolo');
    const [isLocalOnline, setIsLocalOnline] = useState<boolean>(true);

    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [{ time, message, type }, ...prev].slice(0, 50));
        console.log(`[${time}] ${message}`);
    }, []);

    // Single frame capture and analysis
    const captureAndAnalyze = useCallback(async () => {
        if (!imgRef.current || !canvasRef.current || isAnalyzing) return;

        setIsAnalyzing(true);
        addLog(`Capturing frame and executing ${selectedModel.toUpperCase()} engine...`, "info");

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = imgRef.current;

        if (!ctx || (img instanceof HTMLImageElement && img.naturalWidth === 0)) {
            addLog("Still waiting for valid camera frame...", "warn");
            setIsAnalyzing(false);
            return;
        }

        const MAX_DIM = 1280;
        let width = img instanceof HTMLImageElement ? img.naturalWidth : (img as any).videoWidth || 800;
        let height = img instanceof HTMLImageElement ? img.naturalHeight : (img as any).videoHeight || 600;

        if (width > MAX_DIM || height > MAX_DIM) {
            const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
            width *= ratio;
            height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        
        try {
            ctx.drawImage(img, 0, 0, width, height);
            
            const base64 = canvas.toDataURL('image/jpeg', 0.9);
            setFrozenImage(base64);
            setIsFrozen(true);

            const startTime = performance.now();
            
            if (selectedModel === 'custom-yolo') {
                try {
                    const customRes = await analyzeWithCustomLocalModel(base64);
                    setResult(customRes);
                    addLog(`Custom Local YOLOv8 analysis complete in ${Math.round(performance.now() - startTime)}ms`, "success");
                } catch (e: any) {
                    addLog(`Local model issue (${e.message}), switching to Roboflow fallback...`, "warn");
                    const fb = await analyzeWithRoboflow(base64);
                    setResult({ ...fb, isFallback: true });
                    addLog(`Fallback Roboflow completed in ${Math.round(performance.now() - startTime)}ms`, "info");
                }
            } else if (selectedModel === 'roboflow') {
                const roboflowRes = await analyzeWithRoboflow(base64);
                setResult(roboflowRes);
                addLog(`Roboflow cloud analysis complete in ${Math.round(performance.now() - startTime)}ms`, "success");
            } else {
                try {
                    const geminiRes = await analyzeBase64WithGemini(base64);
                    setResult(geminiRes);
                    addLog(`Gemini AI analysis complete in ${Math.round(performance.now() - startTime)}ms`, "success");
                } catch (e: any) {
                    addLog(`Gemini failed, trying Custom Model fallback...`, "warn");
                    const fb = await analyzeWithCustomLocalModel(base64);
                    setResult({ ...fb, isFallback: true });
                }
            }
            
            setError(null);
            const endTime = performance.now();
            setStats(prev => ({
                fps: 0,
                latency: Math.round(endTime - startTime)
            }));
        } catch (err: any) {
            if (err.name === 'SecurityError' || err.message.includes('tainted')) {
                const msg = "CORS Security Block: Camera IP is denying access. Add 'Access-Control-Allow-Origin: *' to ESP32 code.";
                setError(msg);
                addLog(msg, "error");
            } else {
                addLog(`Analysis error: ${err.message}`, "error");
            }
        } finally {
            setIsAnalyzing(false);
        }
    }, [isAnalyzing, selectedModel, addLog]);

    const handleConnect = (e: React.FormEvent) => {
        e.preventDefault();
        if (!streamUrl) return;
        setIsSampleMode(false);
        setIsConfigured(true);
        setIsFrozen(false);
        setResult(null);
        setError(null);
        addLog(`Initiating connection to stream: ${streamUrl}`, "info");
    };

    const startSampleMode = () => {
        setIsSampleMode(true);
        setStreamUrl(SAMPLE_IMAGE_URL);
        setIsConfigured(true);
        setIsFrozen(false);
        setResult(null);
        setError(null);
        addLog("Loaded verified sample clinical imagery (supports CORS)", "success");
    };

    const nextAnalysis = () => {
        setIsFrozen(false);
        setResult(null);
        setFrozenImage(null);
        addLog("View unfrozen. Ready for next capture.", "info");
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header with Exit & Engine Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm w-fit"
                >
                    <X size={18} />
                    Exit Live Mode
                </button>

                {/* Model Selector Tabs */}
                <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
                    <span className="text-[11px] font-semibold text-slate-400 px-2 uppercase tracking-wider hidden sm:inline">
                        Engine:
                    </span>

                    <button
                        type="button"
                        onClick={() => setSelectedModel('custom-yolo')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            selectedModel === 'custom-yolo'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Cpu size={13} className="text-emerald-400" />
                        <span>Custom Model (Local)</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${isLocalOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedModel('roboflow')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            selectedModel === 'roboflow'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Cloud size={13} className="text-purple-400" />
                        <span>Roboflow</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedModel('gemini')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            selectedModel === 'gemini'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Sparkles size={13} className="text-amber-400" />
                        <span>Gemini</span>
                    </button>
                </div>
            </div>

            {/* Connection / Main Layout */}
            {!isConfigured ? (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-xl mx-auto grid gap-6"
                >
                    <div className="glass p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 mb-6">
                            <Settings size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Connect Camera Feed</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Enter your ESP32-CAM stream URL or network camera address.
                        </p>

                        <form onSubmit={handleConnect} className="space-y-4">
                            <input 
                                type="text"
                                placeholder="http://192.168.x.x:81/stream"
                                value={streamUrl}
                                onChange={(e) => setStreamUrl(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-mono text-sm"
                            />
                            <button 
                                type="submit"
                                className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
                            >
                                <Play size={18} />
                                Connect Stream
                            </button>
                        </form>
                    </div>

                    {/* Test Mode */}
                    <div className="glass p-8 rounded-3xl border border-amber-500/20 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3">
                            <div className="px-2 py-0.5 rounded bg-amber-500 text-[10px] font-bold text-navy-mid">TESTING</div>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
                            <ShieldAlert size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Clinical Sample Feed</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Test your selected AI model instantly with our clinical sample stream.
                        </p>
                        <button 
                            onClick={startSampleMode}
                            className="w-full border border-amber-500/30 hover:bg-amber-500/10 text-amber-400 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 size={18} />
                            Try Sample Feed
                        </button>
                    </div>
                </motion.div>
            ) : (
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Feed */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="relative aspect-video rounded-3xl overflow-hidden glass border border-white/10 bg-black group shadow-2xl">
                            {streamUrl && !isFrozen ? (
                                <img 
                                    ref={imgRef}
                                    src={streamUrl} 
                                    alt="Live Stream"
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-cover"
                                    onLoad={() => addLog("Feed source connected", "success")}
                                    onError={() => {
                                        setError("Failed to load stream. Ensure camera IP is reachable.");
                                        addLog("Stream connection error", "error");
                                    }}
                                />
                            ) : frozenImage ? (
                                <img 
                                    src={frozenImage} 
                                    alt="Frozen Frame"
                                    className="w-full h-full object-contain mx-auto"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 font-mono text-slate-500 text-sm">
                                    INITIALIZING SECURE VIDEO PIPELINE...
                                </div>
                            )}

                            {isFrozen && streamUrl && (
                                <img 
                                    ref={imgRef}
                                    src={streamUrl} 
                                    alt="Live Stream Ref"
                                    crossOrigin="anonymous"
                                    className="hidden"
                                />
                            )}

                            {result && result.findings && (
                                <AnatomyOverlay 
                                    findings={result.findings} 
                                    vesselMask={result.vesselMask}
                                    heatmap={result.heatmap}
                                />
                            )}

                            {/* Analyzing Overlay */}
                            {isAnalyzing && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-sky-400 animate-spin" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Activity size={24} className="text-sky-400 animate-pulse" />
                                            </div>
                                        </div>
                                        <span className="text-white text-xs font-semibold tracking-widest uppercase bg-black/60 px-4 py-1.5 rounded-full border border-white/10">
                                            Running {selectedModel === 'custom-yolo' ? 'Custom YOLOv8' : selectedModel === 'roboflow' ? 'Roboflow' : 'Gemini'}...
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Top Badge */}
                            {!isFrozen && !isAnalyzing && !error && (
                                <div className="absolute top-6 left-6 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Live Stream Active
                                </div>
                            )}

                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex items-end justify-between">
                                <div className="flex gap-3">
                                    {!isFrozen ? (
                                        <button 
                                            onClick={captureAndAnalyze}
                                            disabled={isAnalyzing}
                                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50"
                                        >
                                            <Camera size={20} />
                                            Freeze & Analyze
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={nextAnalysis}
                                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold transition-all shadow-lg shadow-emerald-500/20"
                                        >
                                            <RefreshCw size={20} />
                                            Next Analysis
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => {
                                            setIsConfigured(false);
                                            setIsAnalyzing(false);
                                            setIsFrozen(false);
                                        }}
                                        className="text-white/60 hover:text-white text-xs font-medium uppercase tracking-widest px-4 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Hidden processing canvas */}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>

                    {/* Sidebar / Results Panel */}
                    <div className="space-y-6">
                        {result ? (
                            <div className="glass p-6 rounded-3xl border border-white/10 shadow-2xl">
                                <ResultCard result={result} preview={frozenImage || undefined} isLive onReset={nextAnalysis} />
                            </div>
                        ) : (
                            <div className="glass p-8 rounded-3xl border border-white/10 text-center space-y-4">
                                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 mx-auto">
                                    <Camera size={24} />
                                </div>
                                <h4 className="text-white font-bold text-lg">Awaiting Capture</h4>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Align the patient leg inside the camera frame and click <strong>Freeze & Analyze</strong>.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
