'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Activity, Play, Pause, AlertOctagon, CheckCircle2, Volume2, VolumeX, Gauge, Zap } from 'lucide-react';

export default function DopplerSimulator() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [state, setState] = useState<'normal' | 'reflux_moderate' | 'reflux_severe'>('reflux_severe');
    const [isPlaying, setIsPlaying] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Audio synthesizer for Doppler swoosh sound
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

            osc.type = state === 'normal' ? 'sine' : 'sawtooth';
            const baseFreq = state === 'normal' ? 240 : 160;
            osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(state === 'normal' ? 360 : 120, ctx.currentTime + 0.4);

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

    // Doppler Ultrasound Waveform Canvas Animation
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

            // Trigger subtle audio swoosh every cycle
            if (soundTimer > 2.5) {
                soundTimer = 0;
                if (isAudioEnabled) playDopplerSound();
            }

            const w = canvas.width;
            const h = canvas.height;
            const midY = h / 2;

            // Fade background trail
            ctx.fillStyle = 'rgba(7, 11, 20, 0.22)';
            ctx.fillRect(0, 0, w, h);

            // Baseline Doppler Grid
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, midY);
            ctx.lineTo(w, midY);
            ctx.stroke();

            // Calibrated Velocity Labels
            ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.font = '9px monospace';
            ctx.fillText('+40 cm/s (Cephalad)', 8, midY - 60);
            ctx.fillText('0 cm/s (Baseline)', 8, midY - 4);
            ctx.fillText('-40 cm/s (Retrograde Reflux)', 8, midY + 60);

            // Draw Doppler Waveform
            ctx.beginPath();
            ctx.lineWidth = 2.5;

            const isSevere = state === 'reflux_severe';
            const isNormal = state === 'normal';

            ctx.strokeStyle = isNormal ? '#10B981' : isSevere ? '#EF4444' : '#F59E0B';
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 10;

            for (let x = 0; x < w; x += 2) {
                const waveX = x * 0.02 + t;
                let yOffset = 0;

                if (isNormal) {
                    // Normal physiological curve: sharp forward peak, rapid valve closure (<0.3s)
                    const pulse = Math.sin(waveX * 1.8);
                    yOffset = pulse > 0 ? -Math.pow(pulse, 2) * 65 : Math.sin(waveX * 3.6) * 6;
                } else if (isSevere) {
                    // Severe pathological reflux: turbulent negative reversal, prolonged descent (>1.8s)
                    const pulse = Math.sin(waveX * 1.4);
                    yOffset = pulse > 0 ? -pulse * 30 : Math.pow(Math.abs(pulse), 1.5) * 85;
                    yOffset += (Math.random() - 0.5) * 12; // Turbulent eddy currents
                } else {
                    // Moderate reflux
                    const pulse = Math.sin(waveX * 1.6);
                    yOffset = pulse > 0 ? -pulse * 40 : Math.abs(pulse) * 45;
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
    }, [isPlaying, state, isAudioEnabled]);

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
            <div className="glass p-6 sm:p-10 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden">
                
                {/* Background Radiance */}
                <div 
                    className="absolute -right-20 -bottom-20 w-96 h-96 rounded-full opacity-10 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #EF4444 0%, #06B6D4 50%, transparent 70%)' }}
                />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 pb-6 border-b border-slate-700/40">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                            <Activity size={13} />
                            <span>Duplex Ultrasound Laboratory</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-display font-bold text-white dark:text-white light-mode:text-slate-900">
                            Doppler Hemodynamic Reflux Simulator
                        </h3>
                        <p className="text-slate-400 dark:text-slate-400 light-mode:text-slate-600 text-xs sm:text-sm mt-1 max-w-xl">
                            Visualizes spectral Doppler venous blood velocity. Pathological reflux is clinically defined as retrograde flow &gt;0.5 seconds following distal compression release.
                        </p>
                    </div>

                    {/* Mode Toggle Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setState('normal')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                state === 'normal' 
                                    ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md' 
                                    : 'glass text-slate-400 hover:text-white'
                            }`}
                        >
                            Physiological Competent (&lt;0.5s)
                        </button>
                        <button
                            onClick={() => setState('reflux_moderate')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                state === 'reflux_moderate' 
                                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md' 
                                    : 'glass text-slate-400 hover:text-white'
                            }`}
                        >
                            Moderate Reflux (0.8s)
                        </button>
                        <button
                            onClick={() => setState('reflux_severe')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                state === 'reflux_severe' 
                                    ? 'bg-red-500 text-slate-950 font-extrabold shadow-md' 
                                    : 'glass text-slate-400 hover:text-white'
                            }`}
                        >
                            Severe GSV Reflux (1.8s)
                        </button>
                    </div>
                </div>

                {/* Canvas Container & Metrics */}
                <div className="grid lg:grid-cols-12 gap-6 items-center">
                    
                    {/* Spectral Waveform Screen */}
                    <div className="lg:col-span-8 bg-black/80 rounded-2xl p-4 border border-slate-800 shadow-inner relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-mono text-cyan-400 tracking-wider">
                                SPECTRAL DOPPLER • GSV TRANSDUCER 7.5MHz
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                                    className={`p-1.5 rounded-lg border text-xs transition-colors ${
                                        isAudioEnabled 
                                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                                            : 'border-slate-700 text-slate-500 hover:text-slate-300'
                                    }`}
                                    title={isAudioEnabled ? "Mute Doppler Audio" : "Enable Doppler Audio Swoosh"}
                                >
                                    {isAudioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                                </button>
                                <button
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors"
                                >
                                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                                </button>
                            </div>
                        </div>

                        <canvas 
                            ref={canvasRef} 
                            width={720} 
                            height={220} 
                            className="w-full h-[200px] rounded-lg block" 
                        />
                    </div>

                    {/* Diagnostic Metric Gauges */}
                    <div className="lg:col-span-4 flex flex-col gap-3">
                        <div className="p-4 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800">
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-slate-400 font-medium">Reflux Duration</span>
                                <span className={`font-mono font-extrabold ${state === 'normal' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {state === 'normal' ? '0.22 s (Normal)' : state === 'reflux_moderate' ? '0.84 s (Mild)' : '1.82 s (Severe)'}
                                </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 ${state === 'normal' ? 'bg-emerald-400 w-1/4' : state === 'reflux_moderate' ? 'bg-amber-400 w-2/3' : 'bg-red-500 w-full'}`} 
                                />
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800">
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-slate-400 font-medium">Peak Reflux Velocity</span>
                                <span className="font-mono font-extrabold text-amber-400">
                                    {state === 'normal' ? '12.4 cm/s' : state === 'reflux_moderate' ? '28.1 cm/s' : '44.8 cm/s'}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {state === 'normal' 
                                    ? 'Unidirectional cephalad return with prompt valve closure.'
                                    : 'Hydrostatic blood pooling with microvascular hypertension.'}
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 border border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-300 dark:text-slate-300 light-mode:text-slate-700">
                                Surgical Duplex Staging:
                            </span>
                            <span className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg ${
                                state === 'normal' 
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                                {state === 'normal' ? 'Competent' : 'Ablation Indicated'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
