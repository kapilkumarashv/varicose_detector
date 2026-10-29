'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { Finding } from '@/lib/roboflow';

interface Props {
    findings: Finding[];
    vesselMask?: string;
    heatmap?: number[][];
    showReticles?: boolean;
    showVesselGlow?: boolean;
    showHeatmap?: boolean;
    heatmapOpacity?: number;
    hoveredFindingId?: string | null;
    onSelectFinding?: (id: string) => void;
}

export default function AnatomyOverlay({
    findings = [],
    vesselMask,
    heatmap,
    showReticles = true,
    showVesselGlow = true,
    showHeatmap = false,
    heatmapOpacity = 0.55,
    hoveredFindingId,
    onSelectFinding,
}: Props) {
    const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);

    // Render smooth hemodynamic heatmap on HTML5 canvas
    useEffect(() => {
        if (!showHeatmap || !heatmap || heatmap.length === 0 || !heatmapCanvasRef.current) return;
        const canvas = heatmapCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rows = heatmap.length;
        const cols = heatmap[0].length;
        canvas.width = cols;
        canvas.height = rows;

        const imgData = ctx.createImageData(cols, rows);
        const data = imgData.data;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const val = heatmap[r][c]; // 0.0 to 1.0
                const idx = (r * cols + c) * 4;

                // Color map: 0.0 = transparent/blue, 0.4 = yellow/amber, 0.8+ = crimson red
                if (val < 0.15) {
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = 0; // transparent
                } else if (val < 0.45) {
                    // Cyan to Emerald
                    data[idx] = 6;
                    data[idx + 1] = Math.floor(182 * (val / 0.45));
                    data[idx + 2] = 212;
                    data[idx + 3] = Math.floor(val * 180);
                } else if (val < 0.75) {
                    // Amber / Orange (Moderate stasis)
                    data[idx] = 245;
                    data[idx + 1] = 158;
                    data[idx + 2] = 11;
                    data[idx + 3] = Math.floor(val * 220);
                } else {
                    // Crimson Red (Severe blood pooling)
                    data[idx] = 239;
                    data[idx + 1] = 68;
                    data[idx + 2] = 68;
                    data[idx + 3] = Math.floor(val * 255);
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
    }, [heatmap, showHeatmap]);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
            {/* 1. Hemodynamic Heatmap Thermal Layer */}
            {showHeatmap && heatmap && (
                <div 
                    className="absolute inset-0 mix-blend-screen transition-opacity duration-500 pointer-events-none"
                    style={{ opacity: heatmapOpacity }}
                >
                    <canvas 
                        ref={heatmapCanvasRef} 
                        className="w-full h-full object-cover filter blur-[8px]" 
                    />
                </div>
            )}

            {/* 2. AccuVein Infrared Fluorescent Vessel Mask */}
            {showVesselGlow && vesselMask && (
                <motion.img
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.85 }}
                    transition={{ duration: 0.5 }}
                    src={vesselMask}
                    alt="Vessel Mask Overlay"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-screen filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                />
            )}

            {/* 3. Targeted Clinical Reticles & Bounding Boxes */}
            {showReticles && findings.map((finding, idx) => {
                const isVaricose = finding.label.toLowerCase().includes('varicose');
                const isHovered = hoveredFindingId === finding.id;

                const borderColor = isVaricose ? 'rgba(245, 158, 11, 0.9)' : 'rgba(6, 182, 212, 0.9)';
                const bgColor = isVaricose ? 'rgba(245, 158, 11, 0.12)' : 'rgba(6, 182, 212, 0.12)';
                const badgeColor = isVaricose ? '#F59E0B' : '#06B6D4';
                const glow = isHovered 
                    ? `0 0 20px ${isVaricose ? 'rgba(245, 158, 11, 0.8)' : 'rgba(6, 182, 212, 0.8)'}`
                    : `0 0 10px ${isVaricose ? 'rgba(245, 158, 11, 0.35)' : 'rgba(6, 182, 212, 0.35)'}`;

                const leftPercent = Math.max(0, Math.min(95, (finding.bbox.x - finding.bbox.width / 2) * 100));
                const topPercent = Math.max(0, Math.min(95, (finding.bbox.y - finding.bbox.height / 2) * 100));
                const widthPercent = Math.max(5, Math.min(100 - leftPercent, finding.bbox.width * 100));
                const heightPercent = Math.max(5, Math.min(100 - topPercent, finding.bbox.height * 100));
                const isNearTop = topPercent < 7;

                return (
                    <motion.div
                        key={finding.id || idx}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ 
                            opacity: 1, 
                            scale: isHovered ? 1.02 : 1,
                            borderColor: isHovered ? '#ffffff' : borderColor,
                        }}
                        transition={{ duration: 0.25, delay: idx * 0.08 }}
                        onClick={() => onSelectFinding?.(finding.id)}
                        className="pointer-events-auto cursor-pointer group"
                        style={{
                            position: 'absolute',
                            left: `${leftPercent}%`,
                            top: `${topPercent}%`,
                            width: `${widthPercent}%`,
                            height: `${heightPercent}%`,
                            border: `2px solid ${borderColor}`,
                            background: isHovered ? (isVaricose ? 'rgba(245, 158, 11, 0.25)' : 'rgba(6, 182, 212, 0.25)') : bgColor,
                            borderRadius: '8px',
                            boxShadow: glow,
                        }}
                    >
                        {/* Clinical Target Reticle Corners */}
                        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2" style={{ borderColor: badgeColor }} />
                        <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2" style={{ borderColor: badgeColor }} />
                        <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2" style={{ borderColor: badgeColor }} />
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2" style={{ borderColor: badgeColor }} />

                        {/* Clinical Header Badge */}
                        <div 
                            className={`absolute ${isNearTop ? 'top-1 left-1' : '-top-6 left-0'} text-[#0B1120] text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 z-30 transition-transform ${isHovered ? 'scale-105' : ''}`}
                            style={{ backgroundColor: badgeColor }}
                        >
                            <span>#{idx + 1} {finding.label.replace('-', ' ')}</span>
                            {finding.caliberMm && (
                                <span className="bg-black/25 px-1 py-0.2 rounded text-[8px] font-mono text-white">
                                    {finding.caliberMm}mm
                                </span>
                            )}
                            <span className="opacity-90">({finding.confidence}%)</span>
                        </div>

                        {/* Bottom Anatomical Tag on Hover */}
                        <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] text-slate-200 font-mono pointer-events-none z-30">
                            {finding.anatomicalLocation.split(' - ')[1] || finding.anatomicalLocation}
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
