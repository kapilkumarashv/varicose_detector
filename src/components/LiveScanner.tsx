'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Camera, Settings, AlertCircle, Play, Pause, RefreshCw, X, 
    Terminal, Info, ShieldAlert, CheckCircle2, Activity, Cpu, 
    Cloud, Sparkles, Video, RotateCcw, ScanLine, ArrowLeft
} from 'lucide-react';
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

interface Props {
    onBack: () => void;
}

interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'warn';
}

const SAMPLE_IMAGE_URL = "https://source.roboflow.com/669Onhc8bHR1J20q06cWf69V2k93/5879a6db6d226a03cc83262d4e8c1c5e/original.jpg";

function normalizeCameraUrl(input: string): string {
    let clean = input.trim();
    if (!clean) return clean;
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'http://' + clean;
    }
    if (clean.includes(':81') && !clean.includes('/stream')) {
        clean = clean.replace(/\/+$/, '') + '/stream';
    }
    return clean;
}

export default function LiveScanner({ onBack }: Props) {
    const [streamUrl, setStreamUrl] = useState('');
    const [cameraSource, setCameraSource] = useState<'ip' | 'webcam' | 'sample'>('ip');
    const [isConfigured, setIsConfigured] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState({ fps: 0, latency: 0 });
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [isFrozen, setIsFrozen] = useState(false);
    const [frozenImage, setFrozenImage] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<AIModelType>('custom-yolo');
    const [isLocalOnline, setIsLocalOnline] = useState<boolean>(true);
    const [useProxy, setUseProxy] = useState<boolean>(true);
    const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);
    const [checkMessage, setCheckMessage] = useState<{ ok: boolean; message: string } | null>(null);

    const imgRef = useRef<HTMLImageElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

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

    // Cleanup media streams on unmount
    useEffect(() => {
        return () => {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [{ time, message, type }, ...prev].slice(0, 50));
        console.log(`[${time}] ${message}`);
    }, []);

    // ── Stop active video tracks ─────────────────────────────────────────────
    const stopMediaStream = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    // ── Start Webcam Stream ──────────────────────────────────────────────────
    const startWebcam = async () => {
        try {
            setError(null);
            stopMediaStream();
            addLog("Requesting local webcam stream...", "info");
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
                audio: false
            });
            mediaStreamRef.current = stream;
            setCameraSource('webcam');
            setIsConfigured(true);
            setIsFrozen(false);
            setFrozenImage(null);
            setResult(null);

            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.warn(e));
                }
            }, 50);

            addLog("Webcam video stream active", "success");
        } catch (err: any) {
            const msg = err.name === 'NotAllowedError' 
                ? 'Camera access denied by browser permissions' 
                : err.message || 'Webcam initialization failed';
            setError(msg);
            addLog("Webcam error: " + msg, "error");
        }
    };

    // ── Pre-flight reachability check ───────────────────────────────────────
    const testStreamConnectivity = async (customUrl?: string) => {
        const target = normalizeCameraUrl(customUrl || streamUrl);
        if (!target) return;
        setIsCheckingConnection(true);
        setCheckMessage(null);
        try {
            const res = await fetch(`/api/camera-check?url=${encodeURIComponent(target)}`);
            const data = await res.json();
            if (data.ok) {
                setCheckMessage({ ok: true, message: `Reachable! Camera answered HTTP ${data.status}` });
                addLog(`Camera check passed for ${target}`, "success");
            } else {
                setCheckMessage({ ok: false, message: data.error || 'Camera unreachable' });
                addLog(`Camera check failed for ${target}: ${data.error}`, "error");
            }
        } catch (err: any) {
            setCheckMessage({ ok: false, message: err.message });
            addLog(`Camera check error: ${err.message}`, "error");
        } finally {
            setIsCheckingConnection(false);
        }
    };

    // ── Connect IP Stream ────────────────────────────────────────────────────
    const handleConnectIpStream = (e: React.FormEvent) => {
        e.preventDefault();
        const normalized = normalizeCameraUrl(streamUrl);
        if (!normalized) return;
        stopMediaStream();
        setStreamUrl(normalized);
        setCameraSource('ip');
        setIsConfigured(true);
        setIsFrozen(false);
        setFrozenImage(null);
        setResult(null);
        setError(null);
        addLog(`Initiating connection to IP stream: ${normalized} (Proxy: ${useProxy ? 'Enabled' : 'Direct'})`, "info");
    };

    // ── Sample mode ──────────────────────────────────────────────────────────
    const startSampleMode = () => {
        stopMediaStream();
        setCameraSource('sample');
        setStreamUrl(SAMPLE_IMAGE_URL);
        setIsConfigured(true);
        setIsFrozen(false);
        setFrozenImage(null);
        setResult(null);
        setError(null);
        addLog("Loaded verified clinical sample stream", "success");
    };

    // ── Freeze Current Frame ─────────────────────────────────────────────────
    const freezeFrame = useCallback((): string | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        let sourceEl: HTMLImageElement | HTMLVideoElement | null = null;
        if (cameraSource === 'webcam') {
            sourceEl = videoRef.current;
        } else {
            sourceEl = imgRef.current;
        }

        if (!sourceEl) {
            addLog("No active stream element found to freeze", "warn");
            return null;
        }

        const width = sourceEl instanceof HTMLImageElement ? sourceEl.naturalWidth : sourceEl.videoWidth || 1280;
        const height = sourceEl instanceof HTMLImageElement ? sourceEl.naturalHeight : sourceEl.videoHeight || 720;

        if (width === 0 || height === 0) {
            addLog("Stream frame not ready yet. Please wait a moment...", "warn");
            return null;
        }

        canvas.width = width;
        canvas.height = height;

        try {
            ctx.drawImage(sourceEl, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/jpeg', 0.92);
            setFrozenImage(base64);
            setIsFrozen(true);
            addLog("Frame frozen. Review frame or proceed to AI analysis.", "info");
            return base64;
        } catch (err: any) {
            if (err.name === 'SecurityError' || err.message?.includes('tainted')) {
                setError("CORS Security Block: Ensure stream proxy is enabled.");
                addLog("Canvas tainted by CORS restrictions", "error");
            } else {
                addLog("Frame capture error: " + err.message, "error");
            }
            return null;
        }
    }, [cameraSource, addLog]);

    // ── Unfreeze & Resume Stream ─────────────────────────────────────────────
    const unfreezeFrame = () => {
        setIsFrozen(false);
        setFrozenImage(null);
        setError(null);
        addLog("Stream unfrozen. Resumed real-time monitoring.", "info");
    };

    // ── Analyze Captured Frame ───────────────────────────────────────────────
    const analyzeCapturedFrame = async (overrideBase64?: string) => {
        const frameData = overrideBase64 || frozenImage;
        if (!frameData || isAnalyzing) return;

        setIsAnalyzing(true);
        setError(null);
        addLog(`Executing ${selectedModel.toUpperCase()} AI analysis on frozen frame...`, "info");
        const startTime = performance.now();

        try {
            let res: ScanResult;

            if (selectedModel === 'custom-yolo') {
                try {
                    res = await analyzeWithCustomLocalModel(frameData);
                    addLog(`Custom YOLOv8 analysis completed in ${Math.round(performance.now() - startTime)}ms`, "success");
                } catch (localErr: any) {
                    addLog(`Local YOLOv8 issue (${localErr.message}), falling back to Roboflow...`, "warn");
                    const fb = await analyzeWithRoboflow(frameData);
                    res = { ...fb, isFallback: true };
                }
            } else if (selectedModel === 'roboflow') {
                res = await analyzeWithRoboflow(frameData);
                addLog(`Roboflow cloud analysis completed in ${Math.round(performance.now() - startTime)}ms`, "success");
            } else {
                try {
                    res = await analyzeBase64WithGemini(frameData);
                    addLog(`Gemini Multimodal analysis completed in ${Math.round(performance.now() - startTime)}ms`, "success");
                } catch (geminiErr: any) {
                    addLog(`Gemini error, trying Custom YOLOv8 fallback...`, "warn");
                    const fb = await analyzeWithCustomLocalModel(frameData);
                    res = { ...fb, isFallback: true };
                }
            }

            setResult(res);
            setStats({ fps: 0, latency: Math.round(performance.now() - startTime) });
        } catch (err: any) {
            const msg = err.message || 'Analysis failed. Please check local AI service.';
            setError(msg);
            addLog("Analysis error: " + msg, "error");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ── 1-Click Freeze & Analyze ─────────────────────────────────────────────
    const handleFreezeAndAnalyze = async () => {
        const base64 = freezeFrame();
        if (base64) {
            await analyzeCapturedFrame(base64);
        }
    };

    // ── Return to live stream from ResultCard ────────────────────────────────
    const returnToLiveStream = () => {
        setResult(null);
        setIsFrozen(false);
        setFrozenImage(null);
        setIsAnalyzing(false);
        setError(null);
        addLog("Returned to live video monitoring", "info");
    };

    // ── Disconnect / Change Camera Source ────────────────────────────────────
    const disconnectCamera = () => {
        stopMediaStream();
        setIsConfigured(false);
        setIsFrozen(false);
        setFrozenImage(null);
        setResult(null);
        setError(null);
        setCheckMessage(null);
        addLog("Camera disconnected. Returned to setup hub.", "info");
    };

    const activeStreamSrc = cameraSource === 'sample'
        ? streamUrl
        : useProxy
            ? `/api/stream-proxy?url=${encodeURIComponent(streamUrl)}`
            : streamUrl;

    return (
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-6 transition-all duration-500 ${result ? 'max-w-7xl' : 'max-w-5xl'}`}>
            
            {/* ── CASE 1: FULL CLINICAL ANALYSIS SUITE (Identical to Image Upload Section) ── */}
            {result && frozenImage ? (
                <motion.div
                    key="live-analysis-result"
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-6"
                >
                    {/* Top Clinical Banner */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 backdrop-blur-xl shadow-2xl">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                                <CheckCircle2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-base flex items-center gap-2">
                                    Live Stream Frame Evaluated
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        {selectedModel.toUpperCase()}
                                    </span>
                                </h3>
                                <p className="text-slate-400 text-xs">
                                    Source: <strong className="text-slate-200">{cameraSource === 'webcam' ? 'Local Laptop / USB Webcam' : cameraSource === 'sample' ? 'Clinical Sample Feed' : streamUrl}</strong> • Findings: <span className="text-amber-400 font-semibold">{result.findings?.length || 0} vascular lesions</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                                onClick={returnToLiveStream}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-all shadow-lg shadow-sky-500/25"
                            >
                                <Play size={15} />
                                <span>Return to Live Stream</span>
                            </button>
                        </div>
                    </div>

                    {/* The Full Clinical Diagnostic Suite (identical to normal upload section) */}
                    <ResultCard
                        result={result}
                        preview={frozenImage}
                        onReset={returnToLiveStream}
                        isLive={true}
                    />
                </motion.div>
            ) : !isConfigured ? (

            /* ── CASE 2: CAMERA CONNECTION HUB ────────────────────────────────────────── */
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-2xl mx-auto space-y-6"
                >
                    {/* Header with Exit */}
                    <div className="flex items-center justify-between">
                        <button 
                            onClick={onBack}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                        >
                            <ArrowLeft size={16} />
                            Exit Live Mode
                        </button>

                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Vascular Vision Engine Ready</span>
                        </div>
                    </div>

                    {/* Choice 1: ESP32-CAM / IP Stream */}
                    <div className="glass p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-5">
                            <Settings size={22} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">Connect Network Camera (ESP32-CAM)</h3>
                        <p className="text-slate-400 text-xs mb-6">
                            Enter the IP address of your ESP32-CAM or network MJPEG video stream.
                        </p>

                        <form onSubmit={handleConnectIpStream} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                                    Stream URL
                                </label>
                                <input 
                                    type="text"
                                    placeholder="http://172.28.84.41:81/stream or http://192.168.4.1:81/stream"
                                    value={streamUrl}
                                    onChange={(e) => {
                                        setStreamUrl(e.target.value);
                                        setCheckMessage(null);
                                    }}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-mono text-sm"
                                />
                            </div>

                            {/* Quick Presets */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-slate-500 text-[11px]">Quick Presets:</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStreamUrl("http://172.28.84.41:81/stream");
                                        setCheckMessage(null);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-[11px] border border-white/10 transition-all"
                                >
                                    172.28.84.41:81
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStreamUrl("http://192.168.4.1:81/stream");
                                        setCheckMessage(null);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-mono text-[11px] border border-emerald-500/20 transition-all"
                                >
                                    192.168.4.1:81 (Direct AP)
                                </button>
                            </div>

                            {/* Reachability Test Feedback */}
                            {checkMessage && (
                                <div className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2 ${
                                    checkMessage.ok 
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                }`}>
                                    {checkMessage.ok ? (
                                        <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                                    ) : (
                                        <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                                    )}
                                    <span className="leading-relaxed">{checkMessage.message}</span>
                                </div>
                            )}

                            {/* Proxy Toggle & Test Button */}
                            <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={useProxy} 
                                        onChange={(e) => setUseProxy(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0" 
                                    />
                                    <span>Stream Proxy (Bypasses CORS restrictions)</span>
                                </label>

                                <button
                                    type="button"
                                    disabled={!streamUrl || isCheckingConnection}
                                    onClick={() => testStreamConnectivity()}
                                    className="text-xs text-sky-400 hover:text-sky-300 font-medium px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 transition-all disabled:opacity-40"
                                >
                                    {isCheckingConnection ? 'Testing IP...' : 'Test Reachability'}
                                </button>
                            </div>

                            <button 
                                type="submit"
                                className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
                            >
                                <Play size={18} />
                                Connect Network Stream
                            </button>
                        </form>
                    </div>

                    {/* Choice 2: Instant Laptop Webcam / USB Camera */}
                    <div className="glass p-6 rounded-3xl border border-sky-500/20 hover:border-sky-500/40 transition-all shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                                <Video size={22} />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm">Laptop / USB Webcam (Direct)</h4>
                                <p className="text-slate-400 text-xs">Test the live stream &amp; freeze analysis immediately using your PC camera.</p>
                            </div>
                        </div>
                        <button
                            onClick={startWebcam}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-bold text-xs transition-all flex items-center justify-center gap-2 shrink-0"
                        >
                            <Camera size={15} />
                            Start Webcam
                        </button>
                    </div>

                    {/* Choice 3: Clinical Sample Stream */}
                    <div className="glass p-6 rounded-3xl border border-amber-500/20 hover:border-amber-500/40 transition-all shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                                <ShieldAlert size={22} />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm">Verified Clinical Sample Stream</h4>
                                <p className="text-slate-400 text-xs">Test your AI model instantly with verified vascular patient footage.</p>
                            </div>
                        </div>
                        <button
                            onClick={startSampleMode}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs transition-all flex items-center justify-center gap-2 shrink-0"
                        >
                            <CheckCircle2 size={15} />
                            Try Sample Feed
                        </button>
                    </div>
                </motion.div>
            ) : (

            /* ── CASE 3: ACTIVE LIVE STREAM & FREEZE VIEWER ────────────────────────────── */
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                >
                    {/* Top Navigation & AI Engine Selector */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <button 
                            onClick={disconnectCamera}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm w-fit"
                        >
                            <ArrowLeft size={16} />
                            <span>Switch Camera Source</span>
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

                    {/* Main High-Definition Video Player */}
                    <div className="relative aspect-video max-h-[72vh] rounded-3xl overflow-hidden glass border border-white/10 bg-slate-950 shadow-2xl group">
                        
                        {/* 1. Live Webcam Feed */}
                        {cameraSource === 'webcam' && !isFrozen && (
                            <video 
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                        )}

                        {/* 2. Live IP / Sample Stream */}
                        {cameraSource !== 'webcam' && !isFrozen && (
                            <img 
                                ref={imgRef}
                                src={activeStreamSrc} 
                                alt="Live Stream"
                                crossOrigin={useProxy ? "anonymous" : undefined}
                                className={`w-full h-full object-cover transition-opacity duration-300 ${error ? 'opacity-10' : 'opacity-100'}`}
                                onLoad={() => {
                                    setError(null);
                                    addLog("Feed source connected", "success");
                                }}
                                onError={() => {
                                    const msg = `Failed to connect to ${streamUrl}. Host unreachable or on a different Wi-Fi subnet.`;
                                    setError(msg);
                                    addLog(msg, "error");
                                }}
                            />
                        )}

                        {/* 3. Frozen Frame Display */}
                        {isFrozen && frozenImage && (
                            <div className="relative w-full h-full bg-black flex items-center justify-center">
                                <img 
                                    src={frozenImage} 
                                    alt="Frozen Frame"
                                    className="w-full h-full object-contain mx-auto"
                                />

                                {/* Moving Laser Scan Line when Analyzing */}
                                {isAnalyzing && (
                                    <motion.div
                                        animate={{ top: ['0%', '100%', '0%'] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                        className="absolute left-0 right-0 h-1 z-20 pointer-events-none"
                                        style={{
                                            background: 'linear-gradient(90deg, transparent, #F59E0B, #38BDF8, #F59E0B, transparent)',
                                            boxShadow: '0 0 20px 4px rgba(245,158,11,0.6)'
                                        }}
                                    />
                                )}
                            </div>
                        )}

                        {/* Status Badges Overlay */}
                        <div className="absolute top-5 left-5 flex items-center gap-2 z-10">
                            {!isFrozen ? (
                                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 backdrop-blur-md shadow-lg">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>Live Monitoring Active</span>
                                </div>
                            ) : (
                                <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 backdrop-blur-md shadow-lg">
                                    <Pause size={12} className="text-amber-400" />
                                    <span>Frame Frozen • Ready for Analysis</span>
                                </div>
                            )}

                            <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-slate-300 text-[10px] font-mono backdrop-blur-md">
                                {cameraSource === 'webcam' ? 'Local Webcam' : cameraSource === 'sample' ? 'Sample Feed' : 'Network Stream'}
                            </div>
                        </div>

                        {/* Analyzing Medical Scanner Overlay */}
                        {isAnalyzing && (
                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-30">
                                <div className="relative mb-5">
                                    <div className="w-16 h-16 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Activity size={24} className="text-amber-400 animate-pulse" />
                                    </div>
                                </div>
                                <h4 className="text-white font-bold text-base mb-1">Executing Vascular Vision Engine</h4>
                                <p className="text-amber-400 text-xs font-mono uppercase tracking-wider mb-2">
                                    {selectedModel === 'custom-yolo' 
                                        ? 'YOLOv8-Medium (25.8M params) + Multiscale Dermal Profiler' 
                                        : selectedModel === 'roboflow' 
                                            ? 'Roboflow Cloud Object Detection' 
                                            : 'Gemini 1.5 Flash Deep Multimodal'}
                                </p>
                                <p className="text-slate-400 text-xs text-center max-w-sm mb-5">
                                    Extracting venous tortuosity, vessel caliber measurements, and CEAP clinical severity...
                                </p>
                                <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: '0%' }}
                                        animate={{ width: '95%' }}
                                        transition={{ duration: 2.2, ease: 'easeOut' }}
                                        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-sky-400 to-emerald-400"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Error Overlay */}
                        {error && (
                            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
                                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                                    <AlertCircle size={26} />
                                </div>
                                <h4 className="text-white font-bold text-base mb-1">Camera Stream Unreachable</h4>
                                <p className="text-slate-400 text-xs max-w-md mb-4 font-mono bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 break-all">
                                    {streamUrl}
                                </p>

                                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-left text-xs text-slate-300 max-w-lg space-y-2 mb-5">
                                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-[11px] uppercase tracking-wider">
                                        <Info size={14} /> Network Diagnostics
                                    </div>
                                    <p className="text-slate-400 leading-relaxed">
                                        • <strong>Wi-Fi Subnet Mismatch:</strong> If your PC changed networks, it cannot reach this IP. Connect to the same network as the camera.
                                    </p>
                                    <p className="text-slate-400 leading-relaxed">
                                        • <strong>Direct AP Mode:</strong> If the ESP32 is broadcasting Wi-Fi <span className="text-emerald-300 font-mono font-semibold">ESP32CAM</span>, connect laptop to it and use <span className="text-emerald-300 font-mono">http://192.168.4.1:81/stream</span>.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-center gap-3">
                                    <button
                                        onClick={() => {
                                            setError(null);
                                            const img = imgRef.current;
                                            if (img) {
                                                img.src = '';
                                                setTimeout(() => { img.src = activeStreamSrc; }, 100);
                                            }
                                        }}
                                        className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-lg shadow-sky-500/20"
                                    >
                                        <RefreshCw size={14} /> Retry Connection
                                    </button>
                                    <button
                                        onClick={startWebcam}
                                        className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-xs transition-all flex items-center gap-2"
                                    >
                                        <Video size={14} /> Switch to Laptop Webcam
                                    </button>
                                    <button
                                        onClick={disconnectCamera}
                                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all"
                                    >
                                        Change IP / Settings
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Hidden canvas for extracting pixel buffers */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* ── STREAM CONTROLS PANEL ─────────────────────────────────── */}
                    <div className="p-5 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            {!isFrozen ? (
                                <>
                                    {/* Primary 1-Click Action */}
                                    <button
                                        onClick={handleFreezeAndAnalyze}
                                        disabled={isAnalyzing}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm transition-all shadow-lg shadow-sky-500/25 active:scale-95 disabled:opacity-50"
                                    >
                                        <Camera size={18} />
                                        <span>Freeze &amp; Analyze</span>
                                    </button>

                                    {/* Secondary Action: Freeze Only */}
                                    <button
                                        onClick={freezeFrame}
                                        disabled={isAnalyzing}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <Pause size={17} />
                                        <span>Freeze Frame</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Primary Action when Frozen: Analyze */}
                                    <button
                                        onClick={() => analyzeCapturedFrame()}
                                        disabled={isAnalyzing}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50"
                                    >
                                        <ScanLine size={18} />
                                        <span>Analyze Frozen Frame</span>
                                    </button>

                                    {/* Secondary Action when Frozen: Resume Stream */}
                                    <button
                                        onClick={unfreezeFrame}
                                        disabled={isAnalyzing}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <Play size={17} />
                                        <span>Unfreeze &amp; Resume</span>
                                    </button>

                                    {/* Re-capture */}
                                    <button
                                        onClick={freezeFrame}
                                        disabled={isAnalyzing}
                                        className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                                        title="Re-capture fresh frame"
                                    >
                                        <RotateCcw size={17} />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Right Utilities */}
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <button
                                onClick={disconnectCamera}
                                className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-medium hover:bg-white/5 transition-all"
                            >
                                Disconnect
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
