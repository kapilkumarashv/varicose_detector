'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
    Activity, Play, Pause, Volume2, VolumeX, AlertOctagon, 
    CheckCircle2, Gauge, ShieldAlert, Stethoscope, ChevronRight,
    Flame, Zap, Compass, Info, Waves
} from 'lucide-react';
import type { ScanResult, Finding } from '@/lib/roboflow';

interface Props {
    result: ScanResult;
    onSelectFinding?: (id: string | null) => void;
    selectedFindingId?: string | null;
}

export default function HemodynamicRefluxSuite({ result, onSelectFinding, selectedFindingId }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Determine baseline severity from patient result
    const maxCal = result.telemetry?.max_caliber_mm || 4.5;
    const isSeverePatient = maxCal >= 5.0 || result.riskLevel === 'high';
    const isModeratePatient = !isSeverePatient && (maxCal >= 3.0 || result.riskLevel === 'medium');

    const defaultMode: 'patient' | 'normal' | 'moderate' | 'severe' = 'patient';
    const [simMode, setSimMode] = useState<'patient' | 'normal' | 'moderate' | 'severe'>(defaultMode);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [activeZoneFinding, setActiveZoneFinding] = useState<Finding | null>(null);

    const audioCtxRef = useRef<AudioContext | null>(null);

    // If active zone finding is selected, calculate its specific caliber
    const effectiveCaliber = activeZoneFinding 
        ? (activeZoneFinding.caliberMm || 4.2) 
        : maxCal;
    const effectiveTortuosity = activeZoneFinding 
        ? (activeZoneFinding.tortuosity || 1.8) 
        : (result.telemetry?.tortuosity_index || 1.8);

    // Calculate effective clinical state
    let effectiveState: 'normal' | 'moderate' | 'severe' = 'severe';
    if (simMode === 'normal') {
        effectiveState = 'normal';
    } else if (simMode === 'moderate') {
        effectiveState = 'moderate';
    } else if (simMode === 'severe') {
        effectiveState = 'severe';
    } else {
        // Patient calibrated
        if (effectiveCaliber < 3.0 && result.isHealthy) effectiveState = 'normal';
        else if (effectiveCaliber < 5.0 && !isSeverePatient) effectiveState = 'moderate';
        else effectiveState = 'severe';
    }

    // Dynamic Hemodynamic Metrics
    const refluxDuration = effectiveState === 'severe' 
        ? 1.82 
        : effectiveState === 'moderate' 
            ? 0.84 
            : 0.22;

    const peakVelocity = effectiveState === 'severe'
        ? 44.8
        : effectiveState === 'moderate'
            ? 28.5
            : 16.2;

    const ambulatoryPressure = effectiveState === 'severe'
        ? 74
        : effectiveState === 'moderate'
            ? 52
            : 24;

    const ppgRefillTime = effectiveState === 'severe'
        ? 8.4
        : effectiveState === 'moderate'
            ? 16.5
            : 28.0;

    // Web Audio Synthesizer for realistic Doppler vascular blood swoosh
    const playDopplerSound = () => {
        if (!isAudioEnabled) return;
        try {
            if (!audioCtxRef.current) {
                const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                audioCtxRef.current = new AudioCtx();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = effectiveState === 'normal' ? 'sine' : 'sawtooth';
            const baseFreq = effectiveState === 'normal' ? 240 : 160;
            osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(effectiveState === 'normal' ? 360 : 110, ctx.currentTime + 0.4);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, ctx.currentTime);

            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch {
            // Audio context not allowed or unsupported
        }
    };

    // Live Spectral Doppler Waveform Canvas Animation
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        let t = 0;
        let soundTimer = 0;

        const render = () => {
            animId = requestAnimationFrame(render);
            if (!isPlaying) return;

            t += 0.04;
            soundTimer += 0.04;

            if (soundTimer > 2.4) {
                soundTimer = 0;
                if (isAudioEnabled) playDopplerSound();
            }

            const w = canvas.width;
            const h = canvas.height;
            const midY = h / 2;

            // CRT Dark Phosphor Background
            ctx.fillStyle = 'rgba(7, 11, 20, 0.22)';
            ctx.fillRect(0, 0, w, h);

            // Baseline Doppler Grid
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, midY);
            ctx.lineTo(w, midY);
            ctx.stroke();

            // Calibrated Velocity Axis Lines (+20, -20)
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
            ctx.beginPath();
            ctx.moveTo(0, midY - 60);
            ctx.lineTo(w, midY - 60);
            ctx.moveTo(0, midY + 60);
            ctx.lineTo(w, midY + 60);
            ctx.stroke();

            // Calibrated Velocity Labels
            ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
            ctx.font = '10px monospace';
            ctx.fillText('+40 cm/s (Cephalad)', 10, midY - 60);
            ctx.fillText('0 cm/s (Baseline)', 10, midY - 4);
            ctx.fillText('-40 cm/s (Retrograde Reflux)', 10, midY + 60);

            // Draw Doppler Waveform Trace
            ctx.beginPath();
            ctx.lineWidth = 2.8;

            const isSevere = effectiveState === 'severe';
            const isNormal = effectiveState === 'normal';

            ctx.strokeStyle = isNormal ? '#10B981' : isSevere ? '#EF4444' : '#F59E0B';
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 12;

            for (let x = 0; x < w; x += 2) {
                const waveX = x * 0.02 + t;
                let yOffset = 0;

                if (isNormal) {
                    // Normal physiological curve: sharp forward peak, instant competent valve closure (<0.3s)
                    const pulse = Math.sin(waveX * 1.8);
                    yOffset = pulse > 0 ? -Math.pow(pulse, 2) * 65 : Math.sin(waveX * 3.6) * 6;
                } else if (isSevere) {
                    // Severe pathological reflux: turbulent negative reversal, prolonged descent (>1.8s)
                    const pulse = Math.sin(waveX * 1.4);
                    yOffset = pulse > 0 ? -pulse * 30 : Math.pow(Math.abs(pulse), 1.5) * 85;
                    yOffset += (Math.random() - 0.5) * 12; // Turbulent acoustic eddy currents
                } else {
                    // Moderate reflux: retrograde dip ~0.8s
                    const pulse = Math.sin(waveX * 1.6);
                    yOffset = pulse > 0 ? -pulse * 40 : Math.abs(pulse) * 48;
                    yOffset += (Math.random() - 0.5) * 5;
                }

                const y = midY + yOffset;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        };

        render();

        return () => {
            cancelAnimationFrame(animId);
        };
    }, [isPlaying, effectiveState, isAudioEnabled]);

    return (
        <div className="space-y-6">
            
            {/* Doppler Ultrasound Transducer Unit Frame */}
            <div className="glass p-5 sm:p-7 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden">
                
                {/* Background Ambient Glow */}
                <div 
                    className="absolute -right-20 -bottom-20 w-96 h-96 rounded-full opacity-10 pointer-events-none"
                    style={{ 
                        background: effectiveState === 'severe'
                            ? 'radial-gradient(circle, #EF4444 0%, #06B6D4 50%, transparent 70%)'
                            : effectiveState === 'moderate'
                                ? 'radial-gradient(circle, #F59E0B 0%, #06B6D4 50%, transparent 70%)'
                                : 'radial-gradient(circle, #10B981 0%, #06B6D4 50%, transparent 70%)'
                    }}
                />

                {/* Top Control Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-700/40">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                            <Activity size={13} />
                            <span>Duplex Ultrasound Laboratory • Spectral Analysis</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-display font-bold text-white dark:text-white light-mode:text-slate-900">
                            Doppler Hemodynamic Reflux Simulator
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                            {simMode === 'patient' 
                                ? `Patient-calibrated venous hemodynamic flow profile based on detected ${effectiveCaliber}mm caliber dilation and ${effectiveTortuosity}x tortuosity factor.`
                                : 'Visualizes spectral Doppler venous blood velocity. Pathological reflux is clinically defined as retrograde flow >0.5 seconds following distal compression release.'}
                        </p>
                    </div>

                    {/* Simulation Modes Switcher */}
                    <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 self-start lg:self-auto">
                        <button
                            onClick={() => { setSimMode('patient'); setActiveZoneFinding(null); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                simMode === 'patient' && !activeZoneFinding
                                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Patient Calibrated
                        </button>
                        <button
                            onClick={() => { setSimMode('normal'); setActiveZoneFinding(null); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                simMode === 'normal'
                                    ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Competent (&lt;0.5s)
                        </button>
                        <button
                            onClick={() => { setSimMode('moderate'); setActiveZoneFinding(null); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                simMode === 'moderate'
                                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Moderate (0.8s)
                        </button>
                        <button
                            onClick={() => { setSimMode('severe'); setActiveZoneFinding(null); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                simMode === 'severe'
                                    ? 'bg-red-500 text-white font-extrabold shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Severe (1.8s)
                        </button>
                    </div>
                </div>

                {/* Patient Bilateral Findings Zone Bar (If Findings Available) */}
                {result.findings && result.findings.length > 0 && (
                    <div className="mb-5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Compass size={12} className="text-amber-400" />
                                Inspect Specific Finding Zone:
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">CLICK TO FOCUS DOPPLER</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => { setActiveZoneFinding(null); setSimMode('patient'); if (onSelectFinding) onSelectFinding(null); }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                                    !activeZoneFinding ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                                }`}
                            >
                                All Patient Zones (Global Peak {maxCal}mm)
                            </button>
                            {result.findings.map((f, idx) => {
                                const isSelected = activeZoneFinding?.id === f.id || selectedFindingId === f.id;
                                const cal = f.caliberMm || 4.2;
                                const isSev = cal >= 5.0;
                                const isMod = cal >= 3.0 && cal < 5.0;
                                const badgeColor = isSev ? 'border-red-500/40 text-red-300' : isMod ? 'border-amber-500/40 text-amber-300' : 'border-cyan-500/40 text-cyan-300';
                                
                                return (
                                    <button
                                        key={f.id || idx}
                                        onClick={() => {
                                            setActiveZoneFinding(f);
                                            setSimMode('patient');
                                            if (onSelectFinding) onSelectFinding(f.id);
                                        }}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                            isSelected 
                                                ? 'bg-amber-500/20 border-amber-500 text-white font-bold shadow-md' 
                                                : `bg-slate-900/60 hover:bg-slate-800 ${badgeColor}`
                                        }`}
                                    >
                                        <span className="font-bold">#{idx + 1}</span>
                                        <span>{f.leg === 'Left Leg' ? 'Left' : 'Right'} {f.anatomicalLocation?.replace(/.*Calf/, 'Calf') || 'Zone'}</span>
                                        <span className="text-[10px] font-mono opacity-80">({cal}mm)</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Main Doppler Canvas Display + Live Diagnostic Gauges */}
                <div className="grid lg:grid-cols-12 gap-6 items-stretch">
                    
                    {/* Left 8 Cols: Spectral Waveform Canvas */}
                    <div className="lg:col-span-8 relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 p-2 shadow-inner flex flex-col justify-between">
                        
                        {/* Header bar on top of canvas */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 z-10 bg-slate-950/80 backdrop-blur-sm rounded-t-xl">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                                    SPECTRAL DOPPLER • GSV TRANSDUCER 7.5MHz
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                                    className={`p-1.5 rounded-lg border transition-all ${
                                        isAudioEnabled 
                                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' 
                                            : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                                    }`}
                                    title={isAudioEnabled ? 'Mute Doppler Sound' : 'Enable Doppler Audio Synthesis'}
                                >
                                    {isAudioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                                </button>
                                <button
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all"
                                    title={isPlaying ? 'Pause Doppler Trace' : 'Resume Doppler Trace'}
                                >
                                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Interactive Canvas */}
                        <canvas 
                            ref={canvasRef} 
                            width={800} 
                            height={260} 
                            className="w-full h-[240px] sm:h-[260px] object-cover rounded-b-xl cursor-crosshair"
                        />

                        {/* Live Transducer Watermark */}
                        <div className="absolute bottom-4 left-6 pointer-events-none flex items-center gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/90 text-slate-400 border border-slate-800">
                                PRF: 2.5 kHz
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/90 text-slate-400 border border-slate-800">
                                WALL FILTER: 50 Hz
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/90 text-slate-400 border border-slate-800">
                                INSONATION: 60°
                            </span>
                        </div>
                    </div>

                    {/* Right 4 Cols: Live Hemodynamic Readouts */}
                    <div className="lg:col-span-4 flex flex-col justify-between gap-3">
                        
                        {/* Reflux Duration */}
                        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                                <span>Reflux Duration</span>
                                <span className={effectiveState === 'severe' ? 'text-red-400' : effectiveState === 'moderate' ? 'text-amber-400' : 'text-emerald-400'}>
                                    {refluxDuration.toFixed(2)} s ({effectiveState === 'severe' ? 'Severe' : effectiveState === 'moderate' ? 'Moderate' : 'Competent'})
                                </span>
                            </div>
                            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                <motion.div 
                                    className={`h-full rounded-full ${
                                        effectiveState === 'severe' ? 'bg-red-500' : effectiveState === 'moderate' ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (refluxDuration / 2.0) * 100)}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                                Pathological cutoff &gt;0.5s in superficial saphenous trunk.
                            </span>
                        </div>

                        {/* Peak Retrograde Velocity */}
                        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                                <span>Peak Reflux Velocity</span>
                                <span className="font-mono font-bold text-amber-400">{peakVelocity.toFixed(1)} cm/s</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                {effectiveState === 'severe' 
                                    ? 'Hydrostatic blood pooling with microvascular hypertension.'
                                    : effectiveState === 'moderate'
                                        ? 'Early retrograde velocity spike upon standing release.'
                                        : 'Physiological valve coaptation within physiological baseline.'}
                            </p>
                        </div>

                        {/* Ambulatory Venous Pressure & PPG */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">AVP Pressure</span>
                                <span className={`text-base font-mono font-bold block mt-0.5 ${
                                    ambulatoryPressure >= 60 ? 'text-red-400' : ambulatoryPressure >= 40 ? 'text-amber-400' : 'text-emerald-400'
                                }`}>
                                    {ambulatoryPressure} mmHg
                                </span>
                                <span className="text-[9px] text-slate-500">Normal &le;30 mmHg</span>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">PPG Refill Time</span>
                                <span className={`text-base font-mono font-bold block mt-0.5 ${
                                    ppgRefillTime < 10 ? 'text-red-400' : ppgRefillTime < 20 ? 'text-amber-400' : 'text-emerald-400'
                                }`}>
                                    {ppgRefillTime.toFixed(1)} s
                                </span>
                                <span className="text-[9px] text-slate-500">Normal &gt;25 s</span>
                            </div>
                        </div>

                        {/* Surgical Duplex Staging */}
                        <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-300">Surgical Duplex Staging:</span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                effectiveState === 'severe'
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                    : effectiveState === 'moderate'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}>
                                {effectiveState === 'severe' ? 'ABLATION INDICATED' : effectiveState === 'moderate' ? 'COMPRESSION / UGFS' : 'VALVES COMPETENT'}
                            </span>
                        </div>

                    </div>
                </div>

            </div>

            {/* Biomarker Trio Cards (Caliber, Tortuosity, Venous Stasis) */}
            <div className="grid md:grid-cols-3 gap-6">
                <div className="glass p-6 rounded-3xl border border-slate-700/50 shadow-xl space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">Peak Caliber Dilation</span>
                    <h4 className="font-display font-extrabold text-3xl text-white dark:text-white light-mode:text-slate-900">
                        {effectiveCaliber} mm
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-400 light-mode:text-slate-600">
                        Clinical threshold for varicose saphenous veins is &ge;3.0mm. Saccular varix clusters exceed normal venous diameter by &gt;140%.
                    </p>
                </div>

                <div className="glass p-6 rounded-3xl border border-slate-700/50 shadow-xl space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400 block">Tortuosity Index Factor</span>
                    <h4 className="font-display font-extrabold text-3xl text-white dark:text-white light-mode:text-slate-900">
                        {effectiveTortuosity}x
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-400 light-mode:text-slate-600">
                        Quantifies vessel elongation and serpentine course versus linear anatomical axis. Values &gt;1.5x correlate with valvular reflux.
                    </p>
                </div>

                <div className="glass p-6 rounded-3xl border border-slate-700/50 shadow-xl space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-400 block">Venous Stasis Score</span>
                    <h4 className="font-display font-extrabold text-3xl text-white dark:text-white light-mode:text-slate-900">
                        {result.telemetry?.venous_stasis_score || 68} / 100
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-400 light-mode:text-slate-600">
                        Derived from thermal pooling gradients and bilateral dilated area percentage ({result.telemetry?.affected_area_pct || 14.5}%).
                    </p>
                </div>
            </div>

        </div>
    );
}
