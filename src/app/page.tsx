'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import SampleCasesBar from '@/components/SampleCasesBar';
import Frontpage3DShowcase from '@/components/Frontpage3DShowcase';
import AnalyzerSelection from '@/components/AnalyzerSelection';
import CeapMatrixExplorer from '@/components/CeapMatrixExplorer';
import DopplerSimulator from '@/components/DopplerSimulator';
import ScannerUpload from '@/components/ScannerUpload';
import LiveScanner from '@/components/LiveScanner';
import { Activity, ShieldCheck, Cpu, Heart, Stethoscope, ChevronRight, Sparkles } from 'lucide-react';

export default function Home() {
  const [mode, setMode] = useState<'idle' | 'image' | 'live'>('idle');
  const [selectedSampleUrl, setSelectedSampleUrl] = useState<string | null>(null);

  const handleLaunchSample = (sampleUrl: string) => {
    setSelectedSampleUrl(sampleUrl);
    setMode('image');
  };

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans selection:bg-amber-500/30 transition-colors duration-300">
      
      {/* Top Clinical Navigation Bar */}
      <Navbar currentMode={mode} onSelectMode={(m) => { setMode(m); setSelectedSampleUrl(null); }} />

      {/* Main Mode Viewports */}
      <AnimatePresence mode="wait">
        
        {/* ── MODE 1: COMPREHENSIVE CLINICAL HOMEPAGE (IDLE) ──────────────── */}
        {mode === 'idle' && (
          <motion.div
            key="homepage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
          >
            {/* Hero Section */}
            <HeroSection compact={false} onStartScan={setMode} />

            {/* 1-Click Verification Test Cases Bar */}
            <SampleCasesBar onSelectSample={handleLaunchSample} />

            {/* Interactive 3D Digital Twin Human Leg Showcase */}
            <Frontpage3DShowcase onLaunchScan={() => setMode('image')} />

            {/* Diagnostic Modality Selection (Image vs Live) */}
            <AnalyzerSelection onSelect={setMode} />

            {/* Interactive CEAP Clinical Staging Matrix (C0 to C6) */}
            <CeapMatrixExplorer />

            {/* Interactive Spectral Doppler Hemodynamic Simulator */}
            <DopplerSimulator />

            {/* Production-Grade Clinical Footer */}
            <footer className="mt-20 border-t border-slate-700/40 bg-slate-950/80 dark:bg-slate-950/80 light-mode:bg-white/90 backdrop-blur-xl py-12 px-4 sm:px-8">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
                    <Activity size={22} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="font-display font-extrabold text-base text-white dark:text-white light-mode:text-slate-900 tracking-tight">
                      VascuScan <span className="text-amber-400">Pro 2.0</span>
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-400 light-mode:text-slate-500">
                      Bilateral Computer Vision &amp; 3D Hemodynamic Digital Twin
                    </p>
                  </div>
                </div>

                <div className="text-center md:text-right text-xs text-slate-400 dark:text-slate-400 light-mode:text-slate-500 space-y-1">
                  <p>Model Architecture: <strong>YOLOv8-Medium (25.8M params)</strong> • Input: 800px Dual-Zone CV</p>
                  <p>Clinical Reference: CEAP Classification Guidelines • FDA Class II CADe Research Framework</p>
                  <p className="text-[10px] text-slate-500 mt-2">© 2026 VascuScan Medical AI Systems. For clinical screening assistance and triage.</p>
                </div>

              </div>
            </footer>
          </motion.div>
        )}

        {/* ── MODE 2: DIAGNOSTIC IMAGE STUDIO ─────────────────────────────── */}
        {mode === 'image' && (
          <motion.div
            key="scanner"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="pb-20"
          >
            <HeroSection compact={true} />
            <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-4">
              <ScannerUpload 
                onBack={() => { setMode('idle'); setSelectedSampleUrl(null); }} 
                initialSampleUrl={selectedSampleUrl}
              />
            </div>
          </motion.div>
        )}

        {/* ── MODE 3: LIVE HARDWARE STREAM SCANNER ────────────────────────── */}
        {mode === 'live' && (
          <motion.div
            key="live"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="pb-20"
          >
            <HeroSection compact={true} />
            <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-4">
              <LiveScanner onBack={() => setMode('idle')} />
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Dynamic Ambient Background Glow */}
      <div className="fixed bottom-0 left-0 right-0 h-[30vh] bg-gradient-to-t from-amber-500/5 via-sky-500/5 to-transparent pointer-events-none -z-10" />
    </main>
  );
}
