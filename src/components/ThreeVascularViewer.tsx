'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { 
    RotateCw, ZoomIn, ZoomOut, AlertOctagon, 
    CheckCircle2, Sparkles, RefreshCw, Palette,
    Loader2, X, Activity, Info, Gauge, ChevronRight,
    Eye, Flame, ShieldAlert, Crosshair
} from 'lucide-react';
import type { Finding } from '@/lib/roboflow';

interface Props {
    findings?: Finding[];
    severity?: 'low' | 'medium' | 'high';
    maxCaliberMm?: number;
    initialFocus?: 'foot' | 'calf' | 'popliteal' | 'thigh' | 'both';
    anatomicalRegion?: 'foot_ankle' | 'calf' | 'popliteal' | 'thigh' | 'bilateral' | 'non_leg';
    viewAspect?: 'anterior' | 'posterior' | 'lateral' | 'both';
    isHealthy?: boolean;
}

export const SKIN_TONES = [
    { 
        name: 'Fair Alabaster (Fitzpatrick I-II)', 
        color: 0xF4D6C6, 
        subColor: 0xdc8676, 
        sheenColor: 0xffded4,
        desc: 'Fair European / Northern' 
    },
    { 
        name: 'Warm Honey Beige (Fitzpatrick III-IV)', 
        color: 0xD5A687, 
        subColor: 0xa86040, 
        sheenColor: 0xedd0be,
        desc: 'Mediterranean / Asian / Olive' 
    },
    { 
        name: 'Deep Melanin Bronze (Fitzpatrick V-VI)', 
        color: 0x6F432B, 
        subColor: 0x442010, 
        sheenColor: 0x9e684a,
        desc: 'Rich Melanin African / Indian' 
    },
];

export interface LandmarkPin {
    id: string;
    title: string;
    zone: string;
    leg: 'Left Limb' | 'Right Limb';
    pos: THREE.Vector3;
    caliber: string;
    caliberNum: number;
    tortuosity: string;
    tortuosityNum: number;
    ceap: string;
    refluxTime: string;
    stasisPressure: string;
    severityTier: 'severe' | 'moderate' | 'mild' | 'competent';
    severityColor: string;
    description: string;
    clinicalProtocol: string;
}

export default function ThreeVascularViewer({ 
    findings = [], 
    severity = 'high', 
    maxCaliberMm = 6.5,
    initialFocus = 'both',
    anatomicalRegion,
    viewAspect,
    isHealthy = false
}: Props) {
    const mountRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [autoRotate, setAutoRotate] = useState(false);
    const [viewMode, setViewMode] = useState<'realistic' | 'translucent' | 'heatmap'>('realistic');
    const [selectedToneIdx, setSelectedToneIdx] = useState(1); // Warm Honey Beige default
    const [showSeverityGuide, setShowSeverityGuide] = useState(false);

    const effectiveIsHealthy = isHealthy || severity === 'low' || (findings && findings.length === 0);

    const isBilateral = anatomicalRegion === 'bilateral' || 
        anatomicalRegion === 'calf' ||
        (findings && findings.filter(f => f.leg === 'Left Leg').length > 0 && findings.filter(f => f.leg === 'Right Leg').length > 0);

    const hasFootAnatomy = !isBilateral && (
        anatomicalRegion === 'foot_ankle' ||
        initialFocus === 'foot' ||
        (findings && findings.some(f => {
            const loc = (f.anatomicalLocation || '').toLowerCase();
            return loc.includes('foot') || loc.includes('instep') || (loc.includes('ankle') && !loc.includes('perimalleolar'));
        }))
    );

    const resolveFocus = useCallback((): 'foot' | 'calf' | 'popliteal' | 'thigh' | 'both' => {
        if (hasFootAnatomy) return 'foot';
        if (anatomicalRegion === 'calf') return 'calf';
        if (anatomicalRegion === 'popliteal') return 'popliteal';
        if (anatomicalRegion === 'thigh') return 'thigh';
        if (anatomicalRegion === 'bilateral' || isBilateral) return 'both';
        return initialFocus || 'both';
    }, [anatomicalRegion, initialFocus, hasFootAnatomy, isBilateral]);

    const isInitiallyPosterior = !hasFootAnatomy && (
        viewAspect === 'posterior' || 
        anatomicalRegion === 'calf' || 
        anatomicalRegion === 'popliteal' ||
        isBilateral
    );

    const [anatomicalFocus, setAnatomicalFocus] = useState<'foot' | 'calf' | 'popliteal' | 'thigh' | 'both'>(resolveFocus);
    const [viewPerspective, setViewPerspective] = useState<'anterior' | 'posterior'>(
        isInitiallyPosterior ? 'posterior' : 'anterior'
    );
    const [simulateReflux, setSimulateReflux] = useState(!effectiveIsHealthy);
    const [selectedPin, setSelectedPin] = useState<LandmarkPin | null>(null);

    useEffect(() => {
        setAnatomicalFocus(resolveFocus());
    }, [resolveFocus]);

    useEffect(() => {
        if (hasFootAnatomy) {
            setViewPerspective('anterior');
            setAnatomicalFocus('foot');
        } else if (isInitiallyPosterior) {
            setViewPerspective('posterior');
        } else if (viewAspect === 'anterior') {
            setViewPerspective('anterior');
        }
    }, [viewAspect, anatomicalRegion, isInitiallyPosterior, hasFootAnatomy]);

    useEffect(() => {
        setSimulateReflux(!effectiveIsHealthy);
    }, [effectiveIsHealthy]);

    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const modelGroupRef = useRef<THREE.Group | null>(null);
    const particlesRef = useRef<THREE.Points | null>(null);
    const cachedGeometryRef = useRef<THREE.BufferGeometry | null>(null);
    const pinMeshesRef = useRef<THREE.Group[]>([]);

    const isRightLegDominant = findings && findings.length > 0 && 
        findings.filter(f => f.leg === 'Right Leg').length >= findings.filter(f => f.leg === 'Left Leg').length;

    // Target camera positions: immediately initialize to foot if foot scan, posterior if calf scan
    const initialCamPos = useMemo(() => {
        if (hasFootAnatomy) {
            return isRightLegDominant 
                ? new THREE.Vector3(0.38, -2.20, 2.15) 
                : new THREE.Vector3(-0.38, -2.20, 2.15);
        }
        if (isInitiallyPosterior) {
            return new THREE.Vector3(0.0, -1.05, -3.90);
        }
        return new THREE.Vector3(0.0, -0.7, 5.40);
    }, [hasFootAnatomy, isRightLegDominant, isInitiallyPosterior]);

    const initialLookAt = useMemo(() => {
        if (hasFootAnatomy) {
            return isRightLegDominant 
                ? new THREE.Vector3(0.48, -2.55, 0.40) 
                : new THREE.Vector3(-0.48, -2.55, 0.40);
        }
        if (isInitiallyPosterior) {
            return new THREE.Vector3(0.0, -1.15, -0.30);
        }
        return new THREE.Vector3(0.0, -1.05, 0.10);
    }, [hasFootAnatomy, isRightLegDominant, isInitiallyPosterior]);

    const targetCameraPos = useRef<THREE.Vector3>(initialCamPos.clone());
    const targetLookAt = useRef<THREE.Vector3>(initialLookAt.clone());
    const currentLookAt = useRef<THREE.Vector3>(initialLookAt.clone());

    // ── RESET STATE ON NEW PATIENT SCAN / FINDINGS (AVOID STALE DATA) ────────
    useEffect(() => {
        setSelectedPin(null);
        if (modelGroupRef.current) {
            modelGroupRef.current.rotation.set(0, 0, 0);
        }
        targetCameraPos.current.copy(initialCamPos);
        targetLookAt.current.copy(initialLookAt);
        currentLookAt.current.copy(initialLookAt);
        if (cameraRef.current) {
            cameraRef.current.position.copy(initialCamPos);
            cameraRef.current.lookAt(initialLookAt);
        }
    }, [findings, anatomicalRegion, initialCamPos, initialLookAt]);

    // ── DYNAMIC CLINICAL LANDMARKS TAILORED TO PATIENT FINDINGS ───────────────
    const clinicalLandmarks: LandmarkPin[] = useMemo(() => {
        const isPost = viewPerspective === 'posterior';

        if (findings && findings.length > 0) {
            return findings.map((f, idx) => {
                // Exact Leg Resolution: Respect finding's designated limb!
                let isLeft = false;
                if (f.leg && f.leg.toLowerCase().includes('left')) {
                    isLeft = true;
                } else if (f.leg && f.leg.toLowerCase().includes('right')) {
                    isLeft = false;
                } else {
                    isLeft = (f.bbox?.x ?? 0.5) < 0.5;
                }

                const isVaricose = f.label.toLowerCase().includes('varicose');
                const caliberNum = Number(f.caliberMm) || (isVaricose ? 5.2 : 1.4);
                const tortuosityNum = Number(f.tortuosity) || 1.8;
                
                // Clinically accurate 4-tier severity color coding
                let severityColor = '#ef4444'; // Crimson: Severe dilation (>= 5.0mm)
                let severityTier: LandmarkPin['severityTier'] = 'severe';
                let clinicalProtocol = 'Grade 1A Indication: Endovenous Laser Ablation (EVLA 1470nm radial fiber) or Radiofrequency Ablation (RFA) to seal incompetent refluxing saphenous axial trunk.';
                let stasisPressure = '74 mmHg (Severe Ambulatory Hypertension)';

                if (caliberNum < 3.0) {
                    severityColor = '#06b6d4'; // Cyan: Spider / Reticular (< 3.0mm)
                    severityTier = 'mild';
                    clinicalProtocol = 'Microvascular Sclerotherapy (0.25% - 0.5% Polidocanol) or Transdermal 1064nm Nd:YAG Laser for intradermal telangiectasias.';
                    stasisPressure = '26 mmHg (Mild Capillary Venous Stasis)';
                } else if (caliberNum < 5.0) {
                    severityColor = '#f59e0b'; // Amber: Moderate varices (3.0 - 4.9mm)
                    severityTier = 'moderate';
                    clinicalProtocol = 'Ultrasound-Guided Foam Sclerotherapy (UGFS 1% Polidocanol) + Medical Grade Class II (20-30 mmHg) graduated compression hosiery.';
                    stasisPressure = '52 mmHg (Moderate Venous Pooling)';
                }

                const locLower = (f.anatomicalLocation || '').toLowerCase();
                const isFootZone = hasFootAnatomy || locLower.includes('foot') || locLower.includes('instep') || locLower.includes('ankle') || locLower.includes('malleol') || locLower.includes('supramalleolar');
                const isPosteriorZone = !isFootZone && (locLower.includes('popliteal') || locLower.includes('calf') || locLower.includes('gastrocnemius') || locLower.includes('soleus') || locLower.includes('posterior') || viewPerspective === 'posterior' || isPost);

                const bboxX = f.bbox?.x ?? 0.5;
                const bboxY = f.bbox?.y ?? (0.15 + idx * 0.25);

                let posX = isLeft ? -0.54 : 0.54;
                let posY = -1.25;
                let posZ = -0.72;

                if (isFootZone) {
                    const clampedY = Math.max(0.08, Math.min(0.92, bboxY));
                    posY = -2.28 - clampedY * 0.44;
                    const t = clampedY;

                    const isMedial = locLower.includes('medial') || locLower.includes('malleol') || bboxX < 0.45;
                    const isLateral = locLower.includes('lateral') || bboxX > 0.65;

                    let xOffset = 0;
                    if (isMedial) xOffset = isLeft ? 0.11 : -0.11; // Medial side toward midline X=0
                    else if (isLateral) xOffset = isLeft ? -0.11 : 0.11; // Lateral side away from midline
                    else xOffset = (bboxX - 0.50) * 0.14;

                    const baseFootX = isLeft ? -0.48 : 0.48;
                    posX = baseFootX + xOffset;

                    // Exact 3D skin surface depth on foot:
                    if (isMedial) {
                        posZ = 0.06 + t * 0.06 + 0.015;
                    } else if (isLateral) {
                        posZ = 0.04 + t * 0.08 + 0.015;
                    } else {
                        posZ = 0.06 + t * 0.18 + t * t * 0.18 + 0.015;
                    }
                } else if (isPosteriorZone) {
                    // Accurate anatomical posterior calf positioning based on patient scan
                    const clampedY = Math.max(0.06, Math.min(0.94, bboxY));
                    posY = -0.75 - (clampedY * 1.65); // Ranges from -0.75 (upper gastrocnemius) to -2.30 (Achilles / supramalleolar)

                    // Interpolate exact posterior skin surface depth Z for this Y
                    let surfaceZ = -0.68;
                    if (posY >= -0.8) {
                        surfaceZ = -0.72 + (posY + 0.6) * (-0.29);
                    } else if (posY >= -1.2) {
                        const t = (posY + 0.8) / (-0.4);
                        surfaceZ = -0.778 + t * 0.087;
                    } else if (posY >= -1.6) {
                        const t = (posY + 1.2) / (-0.4);
                        surfaceZ = -0.691 + t * 0.101;
                    } else if (posY >= -2.0) {
                        const t = (posY + 1.6) / (-0.4);
                        surfaceZ = -0.590 + t * 0.039;
                    } else {
                        const t = (posY + 2.0) / (-0.4);
                        surfaceZ = -0.551 + t * (-0.042);
                    }
                    posZ = surfaceZ - 0.014; // Flush on posterior skin surface

                    // Interpolate leg center X at this Y height to follow natural limb tapering
                    let centerX = 0.54;
                    if (posY >= -1.0) centerX = 0.55;
                    else if (posY >= -1.4) centerX = 0.64;
                    else if (posY >= -1.8) centerX = 0.53;
                    else if (posY >= -2.2) centerX = 0.46;
                    else centerX = 0.50;

                    const legCenterX = isLeft ? -centerX : centerX;
                    const relX = isLeft 
                        ? (bboxX - 0.28) * 0.48 
                        : (bboxX - 0.72) * 0.48;
                    posX = legCenterX + Math.max(-0.14, Math.min(0.14, relX));
                } else {
                    // Anterior Shin / Mid-Calf GSV
                    const legCenterX = isLeft ? -0.48 : 0.48;
                    posX = legCenterX + (bboxX - 0.5) * 0.18;
                    posY = -1.15 - (bboxY * 0.80);
                    posZ = 0.06;
                }

                return {
                    id: f.id || `pin-${idx + 1}`,
                    title: `#${idx + 1} ${f.label.replace('-', ' ').toUpperCase()}`,
                    zone: f.anatomicalLocation || (isFootZone ? 'Foot & Ankle Junction' : isPost ? 'Posterior Gastrocnemius Calf Sulcus' : 'Medial GSV Lower Limb'),
                    leg: isLeft ? 'Left Limb' : 'Right Limb',
                    pos: new THREE.Vector3(posX, posY, posZ),
                    caliber: `${caliberNum} mm`,
                    caliberNum,
                    tortuosity: `${tortuosityNum}x`,
                    tortuosityNum,
                    ceap: f.ceapCategory || (caliberNum >= 5.0 ? 'C2S / C3' : caliberNum >= 3.0 ? 'C2' : 'C1'),
                    refluxTime: caliberNum >= 5.0 
                        ? '>1.40s (Severe Retrograde Flow)' 
                        : caliberNum >= 3.0 
                        ? '0.85s (Pathological Reflux)' 
                        : 'Microvascular Reflux (<0.50s)',
                    stasisPressure,
                    severityTier,
                    severityColor,
                    description: f.clinicalDescription || `Dilated subcutaneous varicose lesion (caliber ${caliberNum}mm) mapped precisely from patient photograph onto anatomical 3D extremity. Demonstrates loss of venous wall tone and sustained reflux.`,
                    clinicalProtocol
                };
            });
        }

        if (effectiveIsHealthy) {
            if (isPost) {
                return [
                    {
                        id: 'pin-ssv-competent',
                        title: 'SSV Saphenous Trunk (Competent)',
                        zone: 'Mid-Calf SSV Main Trunk',
                        leg: 'Left Limb',
                        pos: new THREE.Vector3(-0.54, -1.25, -0.66),
                        caliber: '1.6 mm',
                        caliberNum: 1.6,
                        tortuosity: '1.0x (Linear)',
                        tortuosityNum: 1.0,
                        ceap: 'C0 (Competent)',
                        refluxTime: '<0.20s (Rapid Valve Closure)',
                        stasisPressure: '18 mmHg (Normal Physiological Return)',
                        severityTier: 'competent',
                        severityColor: '#10b981',
                        description: 'Competent Small Saphenous Vein (SSV) with intact bicuspid valves preventing retrograde reflux into the superficial gastrocnemius bed.',
                        clinicalProtocol: 'No surgical or sclerotherapy intervention indicated. Preserved venous valvular competence.'
                    }
                ];
            }

            return [
                {
                    id: 'pin-gsv-competent',
                    title: 'GSV Saphenous Trunk (Competent)',
                    zone: 'Mid-Calf GSV Main Trunk',
                    leg: 'Left Limb',
                    pos: new THREE.Vector3(-0.48, -1.15, 0.08),
                    caliber: '1.8 mm',
                    caliberNum: 1.8,
                    tortuosity: '1.0x (Linear)',
                    tortuosityNum: 1.0,
                    ceap: 'C0 (Competent)',
                    refluxTime: '<0.25s (Rapid Valve Closure)',
                    stasisPressure: '18 mmHg (Physiological)',
                    severityTier: 'competent',
                    severityColor: '#10b981',
                    description: 'Competent saphenous vein with normal laminar cephalad flow. Intact bicuspid venous valves preventing retrograde reflux.',
                    clinicalProtocol: 'Competent venous return. No treatment required.'
                }
            ];
        }

        // Fallback default pins
        return [
            {
                id: 'pin-post-gastro-1',
                title: 'Perimalleolar Reflux Varix',
                zone: 'Perimalleolar Ankle Plexus',
                leg: 'Right Limb',
                pos: new THREE.Vector3(0.46, -2.44, 0.32),
                caliber: `${maxCaliberMm} mm`,
                caliberNum: maxCaliberMm,
                tortuosity: '2.2x',
                tortuosityNum: 2.2,
                ceap: 'C2S / C3',
                refluxTime: '>1.40s (Pathological Reflux)',
                stasisPressure: '72 mmHg (High Stasis Pressure)',
                severityTier: 'severe',
                severityColor: '#ef4444',
                description: 'Prominent varicose dilation with retrograde reflux cascading into distal subcutaneous tributaries.',
                clinicalProtocol: 'Endovenous Thermal Ablation (EVLA) indicated.'
            }
        ];
    }, [findings, maxCaliberMm, effectiveIsHealthy, viewPerspective, hasFootAnatomy]);

    // Smooth camera targeting based on anatomical focus & view perspective
    useEffect(() => {
        if (viewPerspective === 'posterior') {
            if (anatomicalFocus === 'foot') {
                targetCameraPos.current.set(0.0, -2.15, -2.45);
                targetLookAt.current.set(0.0, -2.35, -0.55);
            } else if (anatomicalFocus === 'calf') {
                targetCameraPos.current.set(0.0, -1.15, -2.60);
                targetLookAt.current.set(0.0, -1.20, -0.65);
            } else if (anatomicalFocus === 'popliteal') {
                targetCameraPos.current.set(0.0, -0.55, -2.40);
                targetLookAt.current.set(0.0, -0.65, -0.75);
            } else if (anatomicalFocus === 'thigh') {
                targetCameraPos.current.set(0.0, 0.45, -2.70);
                targetLookAt.current.set(0.0, 0.40, -0.15);
            } else {
                targetCameraPos.current.set(0.0, -1.05, -3.90);
                targetLookAt.current.set(0.0, -1.15, -0.30);
            }
        } else {
            // Anterior (Front) View
            if (anatomicalFocus === 'foot') {
                if (isRightLegDominant) {
                    targetCameraPos.current.set(0.38, -2.20, 2.15);
                    targetLookAt.current.set(0.48, -2.55, 0.40);
                } else {
                    targetCameraPos.current.set(-0.38, -2.20, 2.15);
                    targetLookAt.current.set(-0.48, -2.55, 0.40);
                }
            } else if (anatomicalFocus === 'calf') {
                targetCameraPos.current.set(-0.25, -1.05, 2.90);
                targetLookAt.current.set(-0.50, -1.15, 0.15);
            } else if (anatomicalFocus === 'popliteal') {
                targetCameraPos.current.set(0.0, -0.05, -2.90);
                targetLookAt.current.set(0.0, -0.15, 0.0);
            } else if (anatomicalFocus === 'thigh') {
                targetCameraPos.current.set(0.0, 0.55, 2.70);
                targetLookAt.current.set(0.0, 0.45, 0.05);
            } else {
                targetCameraPos.current.set(0.0, -0.7, 5.40);
                targetLookAt.current.set(0.0, -1.05, 0.10);
            }
        }
    }, [anatomicalFocus, viewPerspective, isRightLegDominant]);

    // Focus camera smoothly on a specific 3D landmark pin
    const focusPin = useCallback((pin: LandmarkPin) => {
        setSelectedPin(pin);
        const isPost = pin.pos.z < 0;
        const zOffset = isPost ? -1.25 : 1.25;
        targetCameraPos.current.set(
            pin.pos.x + (pin.pos.x < 0 ? 0.15 : -0.15), 
            pin.pos.y + 0.08, 
            pin.pos.z + zOffset
        );
        targetLookAt.current.copy(pin.pos);
    }, []);

    // ── 1. PROCEDURAL PBR DERMATOLOGICAL SKIN TEXTURE ────────────────────────
    const createPhotorealisticSkinTexture = (baseColorHex: number, subColorHex: number) => {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        const baseColor = new THREE.Color(baseColorHex);
        const subColor = new THREE.Color(subColorHex);

        ctx.fillStyle = `#${baseColor.getHexString()}`;
        ctx.fillRect(0, 0, size, size);

        // Subsurface dermal vascular warmth gradient
        const rad1 = ctx.createRadialGradient(size * 0.45, size * 0.5, 50, size * 0.45, size * 0.5, size * 0.48);
        rad1.addColorStop(0, `rgba(${subColor.r * 255}, ${subColor.g * 255}, ${subColor.b * 255}, 0.28)`);
        rad1.addColorStop(0.5, `rgba(${subColor.r * 255}, ${subColor.g * 255}, ${subColor.b * 255}, 0.12)`);
        rad1.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rad1;
        ctx.fillRect(0, 0, size, size);

        // Microscopic cellular grain
        const imgData = ctx.getImageData(0, 0, size, size);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            const grain = (Math.random() - 0.5) * 14;
            d[i] = Math.min(255, Math.max(0, d[i] + grain));
            d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + grain * 0.85));
            d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + grain * 0.75));
        }
        ctx.putImageData(imgData, 0, 0);

        const diffuseTex = new THREE.CanvasTexture(canvas);
        diffuseTex.wrapS = THREE.RepeatWrapping;
        diffuseTex.wrapT = THREE.RepeatWrapping;

        const bumpCanvas = document.createElement('canvas');
        bumpCanvas.width = 512;
        bumpCanvas.height = 512;
        const bCtx = bumpCanvas.getContext('2d')!;
        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 512, 512);
        const bImgData = bCtx.getImageData(0, 0, 512, 512);
        for (let i = 0; i < bImgData.data.length; i += 4) {
            const n = (Math.random() - 0.5) * 28;
            const val = Math.min(255, Math.max(0, 128 + n));
            bImgData.data[i] = val;
            bImgData.data[i + 1] = val;
            bImgData.data[i + 2] = val;
        }
        bCtx.putImageData(bImgData, 0, 0);

        const bumpTex = new THREE.CanvasTexture(bumpCanvas);
        bumpTex.wrapS = THREE.RepeatWrapping;
        bumpTex.wrapT = THREE.RepeatWrapping;
        bumpTex.repeat.set(6, 6);

        return { diffuseTex, bumpTex };
    };

    // ── 2. SURGICAL TRANSVERSE CROSS-SECTION TEXTURE (CAPPING MID-THIGH) ───────
    const createThighCrossSectionTexture = () => {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, size, size);

        ctx.save();
        ctx.translate(size / 2, size / 2);

        // Subcutaneous Adipose Rim
        ctx.beginPath();
        ctx.ellipse(0, 0, 242, 242, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#b48c62';
        ctx.fill();

        // Fascia Lata
        ctx.beginPath();
        ctx.ellipse(0, 0, 226, 226, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f8fafc';
        ctx.fill();

        // Muscle Base Matrix
        ctx.beginPath();
        ctx.ellipse(0, 0, 220, 220, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#5c1722';
        ctx.fill();

        const muscleGroups = [
            { x: -75, y: -70, rx: 78, ry: 62, rot: -0.4, color: '#7a1f2e' },
            { x: 0, y: -110, rx: 58, ry: 48, rot: 0, color: '#882233' },
            { x: 80, y: -65, rx: 70, ry: 58, rot: 0.35, color: '#7a1f2e' },
            { x: -65, y: 75, rx: 72, ry: 58, rot: 0.45, color: '#681926' },
            { x: 65, y: 80, rx: 68, ry: 52, rot: -0.4, color: '#681926' },
            { x: 0, y: 40, rx: 54, ry: 42, rot: 0, color: '#581420' },
        ];

        muscleGroups.forEach(m => {
            ctx.save();
            ctx.translate(m.x, m.y);
            ctx.rotate(m.rot);
            ctx.beginPath();
            ctx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
            ctx.fillStyle = m.color;
            ctx.fill();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#e2e8f0';
            ctx.stroke();
            ctx.restore();
        });

        // Femur Bone
        ctx.beginPath();
        ctx.arc(0, -22, 44, 0, Math.PI * 2);
        ctx.fillStyle = '#f1f5f9';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#94a3b8';
        ctx.stroke();

        ctx.restore();
        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        return tex;
    };

    // ── 3. 3D THERMAL STASIS HEATMAP SURFACE TEXTURE ─────────────────────────
    const create3DThermalHeatmapTexture = () => {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        const baseGrad = ctx.createLinearGradient(0, 0, 0, size);
        baseGrad.addColorStop(0, '#0c4a6e');
        baseGrad.addColorStop(0.45, '#0284c7');
        baseGrad.addColorStop(0.70, '#f59e0b');
        baseGrad.addColorStop(1.0, '#ef4444');
        ctx.fillStyle = baseGrad;
        ctx.fillRect(0, 0, size, size);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    };

    // ── MAIN THREE.JS MOUNT EFFECT ───────────────────────────────────────────
    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        let isMounted = true;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 560;

        // 1. Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // 2. Camera: Positioned precisely according to the target anatomical region
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
        camera.position.copy(targetCameraPos.current);
        camera.lookAt(targetLookAt.current);
        cameraRef.current = camera;

        // 3. WebGL Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // 4. Studio Lighting
        const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.4);
        keyLight.position.set(4, 5, 5);
        keyLight.castShadow = true;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.5);
        fillLight.position.set(-5, 2, 4);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xf59e0b, 1.8);
        rimLight.position.set(0, -1, -5);
        scene.add(rimLight);

        const spotLight = new THREE.SpotLight(0xffffff, 2.2, 12, Math.PI / 4, 0.5);
        spotLight.position.set(0, 1.2, 3.8);
        spotLight.target.position.set(0.4, -2.5, 0.4);
        scene.add(spotLight);
        scene.add(spotLight.target);

        const ambientLight = new THREE.AmbientLight(0xffeedd, 0.95);
        scene.add(ambientLight);

        // 5. Master Model Group
        const modelGroup = new THREE.Group();
        scene.add(modelGroup);
        modelGroupRef.current = modelGroup;

        // 6. Materials Setup
        const tone = SKIN_TONES[selectedToneIdx];
        const { diffuseTex, bumpTex } = createPhotorealisticSkinTexture(tone.color, tone.subColor);
        const heatmapTex = create3DThermalHeatmapTexture();
        const crossSectionTex = createThighCrossSectionTexture();

        let skinMat: THREE.Material;
        if (viewMode === 'realistic') {
            skinMat = new THREE.MeshPhysicalMaterial({
                color: tone.color,
                map: diffuseTex,
                bumpMap: bumpTex,
                bumpScale: 0.024,
                roughness: 0.50,
                metalness: 0.02,
                clearcoat: 0.18,
                clearcoatRoughness: 0.38,
                sheen: 0.52,
                sheenColor: new THREE.Color(tone.sheenColor),
                sheenRoughness: 0.45,
                transmission: 0.04,
                thickness: 1.5,
                side: THREE.DoubleSide,
            });
        } else if (viewMode === 'translucent') {
            skinMat = new THREE.MeshPhysicalMaterial({
                color: 0x0f2b48,
                transparent: true,
                opacity: 0.32,
                roughness: 0.16,
                metalness: 0.15,
                clearcoat: 0.9,
                side: THREE.DoubleSide,
            });
        } else {
            skinMat = new THREE.MeshStandardMaterial({
                map: heatmapTex,
                roughness: 0.35,
                metalness: 0.05,
                emissive: 0x991b1b,
                emissiveIntensity: 0.35,
            });
        }

        // 7. Load or attach Leg Mesh
        const attachLegsMesh = (geometry: THREE.BufferGeometry) => {
            const legMesh = new THREE.Mesh(geometry, skinMat);
            legMesh.castShadow = true;
            legMesh.receiveShadow = true;
            modelGroup.add(legMesh);
        };

        if (cachedGeometryRef.current) {
            attachLegsMesh(cachedGeometryRef.current);
            requestAnimationFrame(() => {
                if (isMounted) setIsLoading(false);
            });
        } else {
            const loader = new OBJLoader();
            loader.load('/models/human_legs.obj', (obj) => {
                if (!isMounted) return;
                let foundGeo: THREE.BufferGeometry | null = null;
                obj.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh && !foundGeo) {
                        foundGeo = (child as THREE.Mesh).geometry;
                    }
                });

                if (foundGeo) {
                    const geo = foundGeo as THREE.BufferGeometry;
                    const pos = geo.attributes.position;
                    const uvs = new Float32Array(pos.count * 2);
                    for (let i = 0; i < pos.count; i++) {
                        const x = pos.getX(i);
                        const y = pos.getY(i);
                        const z = pos.getZ(i);
                        const legCenterX = x < 0 ? -0.537 : 0.532;
                        const dx = x - legCenterX;
                        const u = (Math.atan2(dx, z) / Math.PI + 1) * 0.5;
                        const v = (y + 3.0) / 3.90;
                        uvs[i * 2] = u;
                        uvs[i * 2 + 1] = v;
                    }
                    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

                    cachedGeometryRef.current = geo;
                    attachLegsMesh(geo);
                }
                requestAnimationFrame(() => {
                    if (isMounted) setIsLoading(false);
                });
            }, undefined, (err) => {
                console.error('Failed to load human_legs.obj:', err);
                requestAnimationFrame(() => {
                    if (isMounted) setIsLoading(false);
                });
            });
        }

        // ── 8. THIGH TRANSVERSE SECTION CAPS (SEALING THE TOP) ───────────────
        const capTopMat = new THREE.MeshStandardMaterial({
            map: crossSectionTex,
            roughness: 0.38,
            metalness: 0.05,
        });

        const bezelRimMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            metalness: 0.88,
            roughness: 0.22,
        });

        const capMaterials = [bezelRimMat, capTopMat, bezelRimMat];

        const leftCapGeo = new THREE.CylinderGeometry(1, 1, 0.012, 64);
        const leftCap = new THREE.Mesh(leftCapGeo, capMaterials);
        leftCap.scale.set(0.452, 1.0, 0.505);
        leftCap.position.set(-0.537, 0.901, -0.123);
        modelGroup.add(leftCap);

        const rightCapGeo = new THREE.CylinderGeometry(1, 1, 0.012, 64);
        const rightCap = new THREE.Mesh(rightCapGeo, capMaterials);
        rightCap.scale.set(0.456, 1.0, 0.498);
        rightCap.position.set(0.532, 0.901, -0.115);
        modelGroup.add(rightCap);

        const collarMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.92,
            roughness: 0.20,
            emissive: effectiveIsHealthy ? 0x10b981 : 0x06b6d4,
            emissiveIntensity: 0.25,
        });

        const leftCollarGeo = new THREE.TorusGeometry(0.47, 0.012, 16, 64);
        leftCollarGeo.scale(0.96, 1.07, 1.0);
        leftCollarGeo.rotateX(Math.PI / 2);
        const leftCollar = new THREE.Mesh(leftCollarGeo, collarMat);
        leftCollar.position.set(-0.537, 0.901, -0.123);
        modelGroup.add(leftCollar);

        const rightCollarGeo = new THREE.TorusGeometry(0.47, 0.012, 16, 64);
        rightCollarGeo.scale(0.97, 1.05, 1.0);
        rightCollarGeo.rotateX(Math.PI / 2);
        const rightCollar = new THREE.Mesh(rightCollarGeo, collarMat);
        rightCollar.position.set(0.532, 0.901, -0.115);
        modelGroup.add(rightCollar);

        // ── 9. DYNAMIC SUBCUTANEOUS VASCULAR LESION ILLUMINATION & CLINICAL RETICLES ─
        const createSubcutaneousLesionTexture = (colorHex: string, caliberNum: number, tortuosityNum: number) => {
            const size = 512;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d')!;

            const cx = size / 2;
            const cy = size / 2;

            // 1. Soft Perivascular Erythema & Hemosiderin Dermal Stasis Penumbra
            const radGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 230);
            radGrad.addColorStop(0, colorHex + 'cc'); // 80% opacity
            radGrad.addColorStop(0.35, colorHex + '80'); // 50% opacity
            radGrad.addColorStop(0.65, colorHex + '28'); // 15% opacity
            radGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
            ctx.fillStyle = radGrad;
            ctx.fillRect(0, 0, size, size);

            // Subtle hemosiderin brownish stasis halo for chronic larger lesions
            if (caliberNum >= 3.0) {
                const hemoGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 180);
                hemoGrad.addColorStop(0, 'rgba(92, 40, 20, 0.45)');
                hemoGrad.addColorStop(0.5, 'rgba(92, 40, 20, 0.18)');
                hemoGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
                ctx.fillStyle = hemoGrad;
                ctx.fillRect(0, 0, size, size);
            }

            // 2. Realistic Subcutaneous Vein Cord (Serpentine dilated main trunk)
            ctx.beginPath();
            const pts = 18;
            const chordLen = 260;
            const startX = cx - chordLen / 2;
            const trunkPoints: { x: number; y: number }[] = [];

            for (let i = 0; i <= pts; i++) {
                const px = startX + (i / pts) * chordLen;
                const wave = Math.sin((i / pts) * Math.PI * (1.2 + tortuosityNum * 0.4)) * (32 * Math.min(2.2, tortuosityNum));
                const py = cy + wave;
                trunkPoints.push({ x: px, y: py });
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.lineWidth = Math.max(16, Math.min(46, caliberNum * 6.2));
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = colorHex;
            ctx.shadowColor = colorHex;
            ctx.shadowBlur = 24;
            ctx.stroke();

            // Central Specular Venous Lumen Highlight
            ctx.lineWidth = Math.max(4, ctx.lineWidth * 0.28);
            ctx.strokeStyle = '#ffffffcc';
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // 3. Secondary Reticular Feeder Veins (35° to 60° Branches)
            const numReticular = 5;
            for (let r = 0; r < numReticular; r++) {
                const anchorIdx = Math.floor(3 + (r / (numReticular - 1)) * (pts - 6));
                const anchor = trunkPoints[anchorIdx];
                if (!anchor) continue;

                const branchSign = r % 2 === 0 ? 1 : -1;
                const branchLen = 65 + (r * 12) % 45;
                const angle = (branchSign * (0.55 + (r * 0.2) % 0.4));

                ctx.beginPath();
                ctx.moveTo(anchor.x, anchor.y);
                const midX = anchor.x + Math.cos(angle) * (branchLen * 0.55);
                const midY = anchor.y + Math.sin(angle) * (branchLen * 0.55) + (Math.sin(r * 2) * 12);
                const endX = anchor.x + Math.cos(angle) * branchLen;
                const endY = anchor.y + Math.sin(angle) * branchLen;
                ctx.quadraticCurveTo(midX, midY, endX, endY);

                ctx.lineWidth = Math.max(5, caliberNum * 2.1);
                ctx.strokeStyle = colorHex + 'e6';
                ctx.stroke();

                // 4. Fine Spider Telangiectasias (Microvascular dendritic branching radiating from reticular nodes)
                const numSpiders = 4;
                for (let s = 0; s < numSpiders; s++) {
                    const spiderAngle = angle + (s - 1.5) * 0.38 + (Math.sin(s * 1.5) * 0.15);
                    const spiderLen = 32 + (s * 9) % 28;
                    const spStartX = midX + (s / numSpiders) * (endX - midX);
                    const spStartY = midY + (s / numSpiders) * (endY - midY);

                    ctx.beginPath();
                    ctx.moveTo(spStartX, spStartY);
                    const spKnotX = spStartX + Math.cos(spiderAngle) * (spiderLen * 0.6) + (Math.cos(s * 3) * 6);
                    const spKnotY = spStartY + Math.sin(spiderAngle) * (spiderLen * 0.6) + (Math.sin(s * 3) * 6);
                    const spEndX = spStartX + Math.cos(spiderAngle) * spiderLen;
                    const spEndY = spStartY + Math.sin(spiderAngle) * spiderLen;
                    ctx.quadraticCurveTo(spKnotX, spKnotY, spEndX, spEndY);

                    ctx.lineWidth = Math.max(1.5, Math.min(3.2, 0.8 + (caliberNum / 6.0) * 1.6));
                    ctx.strokeStyle = colorHex + 'c0';
                    ctx.stroke();

                    // Micro-bifurcation fork at spider vein tip
                    if (s % 2 === 0) {
                        ctx.beginPath();
                        ctx.moveTo(spEndX, spEndY);
                        ctx.lineTo(spEndX + Math.cos(spiderAngle + 0.35) * 14, spEndY + Math.sin(spiderAngle + 0.35) * 14);
                        ctx.lineWidth = 1.2;
                        ctx.strokeStyle = colorHex + '99';
                        ctx.stroke();
                    }
                }
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            return tex;
        };

        const createNumberedLocatorSprite = (index: number, colorHex: string) => {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 160;
            const ctx = canvas.getContext('2d')!;

            // Outer glowing ring
            ctx.shadowColor = colorHex;
            ctx.shadowBlur = 18;
            ctx.fillStyle = 'rgba(7, 12, 24, 0.95)';
            ctx.strokeStyle = colorHex;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(80, 80, 66, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Inner severity colored circular disc
            ctx.shadowBlur = 0;
            ctx.fillStyle = colorHex;
            ctx.beginPath();
            ctx.arc(80, 80, 50, 0, Math.PI * 2);
            ctx.fill();

            // Center Pin Number #
            ctx.fillStyle = '#050811';
            ctx.font = '900 50px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${index}`, 80, 82);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(0.13, 0.13, 1.0);
            return sprite;
        };

        pinMeshesRef.current = [];
        clinicalLandmarks.forEach((lm, idx) => {
            const pinGroup = new THREE.Group();
            pinGroup.position.copy(lm.pos);
            (pinGroup as any).landmarkData = lm;

            const isPostPin = lm.pos.z < 0;
            const normDir = isPostPin ? -1 : 1;
            const isFootZone = lm.pos.y < -2.20;

            // Calculate precise anatomical slope angle
            let slopeAngle = 0;
            let normalVec: THREE.Vector3;
            if (isFootZone) {
                const t = Math.max(0, Math.min(1, (-2.25 - lm.pos.y) / 0.60));
                slopeAngle = -Math.PI * (0.08 + t * 0.42);
                normalVec = new THREE.Vector3(0, Math.sin(-slopeAngle) * 0.18, Math.cos(-slopeAngle) * 0.18);
            } else if (!isPostPin) {
                slopeAngle = Math.PI / 2.2;
                normalVec = new THREE.Vector3(0, 0, 0.18);
            } else {
                normalVec = new THREE.Vector3(0, 0, normDir * 0.18);
            }

            const calMm = Math.max(1.2, Math.min(7.0, lm.caliberNum || 4.5));
            const tort = Math.max(1.1, Math.min(2.8, lm.tortuosityNum || 1.8));
            const patchRadius = Math.max(0.10, Math.min(0.22, 0.11 + (calMm / 6.5) * 0.08));

            // 1. Subcutaneous Perivascular Erythema & Stasis Penumbra Base (Conformal Flush on Skin)
            const patchGeo = new THREE.CircleGeometry(patchRadius, 36);
            if (slopeAngle !== 0) patchGeo.rotateX(slopeAngle);

            const lesionTex = createSubcutaneousLesionTexture(lm.severityColor, lm.caliberNum, lm.tortuosityNum);
            const patchMat = new THREE.MeshBasicMaterial({
                map: lesionTex,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.88,
                blending: THREE.NormalBlending
            });
            const patchMesh = new THREE.Mesh(patchGeo, patchMat);
            pinGroup.add(patchMesh);

            // 2. PHYSICAL 3D SERPENTINE VARICOSE VEIN TUBE MESH
            const tubeRadius = Math.max(0.015, Math.min(0.038, (calMm / 6.5) * 0.034));
            const veinSpan = Math.max(0.18, Math.min(0.32, 0.20 + (calMm / 6.5) * 0.10));
            const dirSign = isPostPin ? -1 : 1;

            const splinePoints: THREE.Vector3[] = [];
            const numKnots = 9;
            for (let i = 0; i < numKnots; i++) {
                const t = i / (numKnots - 1);
                const yLocal = (t - 0.5) * veinSpan;
                const xExcursion = Math.sin(t * Math.PI * (1.3 + tort * 0.45)) * (0.042 * (tort / 1.5));
                const zProtrusion = (0.012 + (calMm / 6.5) * 0.010) * dirSign;
                const knotWobble = Math.cos(t * Math.PI * 4) * 0.006;
                splinePoints.push(new THREE.Vector3(xExcursion + knotWobble, yLocal, zProtrusion));
            }

            const mainCurve = new THREE.CatmullRomCurve3(splinePoints);
            const mainTubeGeo = new THREE.TubeGeometry(mainCurve, 42, tubeRadius, 14, false);
            if (slopeAngle !== 0) mainTubeGeo.rotateX(slopeAngle);

            const veinMat = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(lm.severityColor).lerp(new THREE.Color(0x3b0712), 0.42),
                emissive: new THREE.Color(lm.severityColor),
                emissiveIntensity: 0.52,
                roughness: 0.24,
                metalness: 0.10,
                clearcoat: 0.90,
                clearcoatRoughness: 0.20,
                transmission: 0.18,
                thickness: 1.3,
                side: THREE.DoubleSide
            });
            const veinMesh = new THREE.Mesh(mainTubeGeo, veinMat);
            pinGroup.add(veinMesh);

            // Secondary Branching Tributary Veins (Spider/Reticular feeders)
            const trib1Pts = [
                mainCurve.getPointAt(0.32),
                mainCurve.getPointAt(0.32).clone().add(new THREE.Vector3(0.045, -0.038, 0)),
                mainCurve.getPointAt(0.32).clone().add(new THREE.Vector3(0.082, -0.060, 0))
            ];
            const trib1Curve = new THREE.CatmullRomCurve3(trib1Pts);
            const trib1Geo = new THREE.TubeGeometry(trib1Curve, 14, tubeRadius * 0.55, 8, false);
            if (slopeAngle !== 0) trib1Geo.rotateX(slopeAngle);
            const trib1Mesh = new THREE.Mesh(trib1Geo, veinMat);
            pinGroup.add(trib1Mesh);

            const trib2Pts = [
                mainCurve.getPointAt(0.68),
                mainCurve.getPointAt(0.68).clone().add(new THREE.Vector3(-0.042, 0.035, 0)),
                mainCurve.getPointAt(0.68).clone().add(new THREE.Vector3(-0.078, 0.058, 0))
            ];
            const trib2Curve = new THREE.CatmullRomCurve3(trib2Pts);
            const trib2Geo = new THREE.TubeGeometry(trib2Curve, 14, tubeRadius * 0.50, 8, false);
            if (slopeAngle !== 0) trib2Geo.rotateX(slopeAngle);
            const trib2Mesh = new THREE.Mesh(trib2Geo, veinMat);
            pinGroup.add(trib2Mesh);

            // Micro-spider capillary branch 3
            const trib3Pts = [
                mainCurve.getPointAt(0.18),
                mainCurve.getPointAt(0.18).clone().add(new THREE.Vector3(-0.032, -0.025, 0)),
                mainCurve.getPointAt(0.18).clone().add(new THREE.Vector3(-0.055, -0.042, 0))
            ];
            const trib3Curve = new THREE.CatmullRomCurve3(trib3Pts);
            const trib3Geo = new THREE.TubeGeometry(trib3Curve, 12, tubeRadius * 0.38, 6, false);
            if (slopeAngle !== 0) trib3Geo.rotateX(slopeAngle);
            const trib3Mesh = new THREE.Mesh(trib3Geo, veinMat);
            pinGroup.add(trib3Mesh);

            // Micro-spider capillary branch 4
            const trib4Pts = [
                mainCurve.getPointAt(0.82),
                mainCurve.getPointAt(0.82).clone().add(new THREE.Vector3(0.036, 0.028, 0)),
                mainCurve.getPointAt(0.82).clone().add(new THREE.Vector3(0.062, 0.048, 0))
            ];
            const trib4Curve = new THREE.CatmullRomCurve3(trib4Pts);
            const trib4Geo = new THREE.TubeGeometry(trib4Curve, 12, tubeRadius * 0.35, 6, false);
            if (slopeAngle !== 0) trib4Geo.rotateX(slopeAngle);
            const trib4Mesh = new THREE.Mesh(trib4Geo, veinMat);
            pinGroup.add(trib4Mesh);

            // Saccular Aneurysmal Dilation Ampulla (Varicose Knot)
            const ampullaPos = mainCurve.getPointAt(0.52);
            const ampullaGeo = new THREE.SphereGeometry(tubeRadius * 1.50, 16, 16);
            ampullaGeo.scale(1.2, 1.4, 1.1);
            if (slopeAngle !== 0) ampullaGeo.rotateX(slopeAngle);
            const ampullaMesh = new THREE.Mesh(ampullaGeo, veinMat);
            ampullaMesh.position.copy(ampullaPos);
            pinGroup.add(ampullaMesh);

            // 3. ANIMATED HEMODYNAMIC ERYTHROCYTE FLOW PARTICLES
            const particleCount = 28;
            const particleProgress = new Float32Array(particleCount);
            const particlePositions = new Float32Array(particleCount * 3);
            for (let i = 0; i < particleCount; i++) {
                particleProgress[i] = i / particleCount;
                const pt = mainCurve.getPointAt(particleProgress[i]);
                particlePositions[i * 3] = pt.x;
                particlePositions[i * 3 + 1] = pt.y;
                particlePositions[i * 3 + 2] = pt.z;
            }

            const particleGeo = new THREE.BufferGeometry();
            particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
            if (slopeAngle !== 0) particleGeo.rotateX(slopeAngle);

            const particleMat = new THREE.PointsMaterial({
                color: new THREE.Color(lm.severityColor).lerp(new THREE.Color('#ffffff'), 0.55),
                size: 0.022,
                transparent: true,
                opacity: 0.92,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const particlePoints = new THREE.Points(particleGeo, particleMat);
            pinGroup.add(particlePoints);

            // 4. INCOMPETENT VENOUS VALVE REGURGITATION MARKER
            const valvePos = mainCurve.getPointAt(0.88);
            const valveGeo = new THREE.TorusGeometry(tubeRadius * 1.65, 0.005, 12, 32);
            if (slopeAngle !== 0) valveGeo.rotateX(slopeAngle);
            const valveMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color('#fbbf24'),
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide
            });
            const valveRing = new THREE.Mesh(valveGeo, valveMat);
            valveRing.position.copy(valvePos);
            pinGroup.add(valveRing);

            // 5. HOLOGRAPHIC CALIPER SCANLINE
            const scanGeo = new THREE.PlaneGeometry(veinSpan * 0.85, 0.006);
            if (slopeAngle !== 0) scanGeo.rotateX(slopeAngle);
            const scanMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color('#38bdf8'),
                transparent: true,
                opacity: 0.75,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            const scanLine = new THREE.Mesh(scanGeo, scanMat);
            pinGroup.add(scanLine);

            // 6. Delicate Laser Guide Stalk pointing normal to surface
            const beamGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                normalVec
            ]);
            const beamMat = new THREE.LineBasicMaterial({
                color: new THREE.Color(lm.severityColor),
                transparent: true,
                opacity: 0.90
            });
            pinGroup.add(new THREE.Line(beamGeo, beamMat));

            // 7. Compact Numbered Locator Node (Always Facing Camera, Zero Text Collision)
            const pinSprite = createNumberedLocatorSprite(idx + 1, lm.severityColor);
            pinSprite.position.copy(normalVec);
            pinGroup.add(pinSprite);

            (pinGroup as any).veinData = {
                mainCurve,
                veinMesh,
                trib1Mesh,
                trib2Mesh,
                ampullaMesh,
                particlePoints,
                particleCount,
                particleProgress,
                valveRing,
                scanLine,
                patchMesh,
                pinSprite
            };

            modelGroup.add(pinGroup);
        });

        // ── 10. CLINICAL PEDESTAL WITH SEVERITY RIM LIGHT ────────────────────
        const floorGeo = new THREE.CylinderGeometry(2.9, 3.0, 0.10, 54);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x070c18,
            roughness: 0.25,
            metalness: 0.8
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.set(0, -3.05, 0.15);
        floor.receiveShadow = true;
        modelGroup.add(floor);

        const isOverallSevere = maxCaliberMm >= 5.0;
        const isOverallModerate = maxCaliberMm >= 3.0 && maxCaliberMm < 5.0;
        const rimColor = effectiveIsHealthy ? 0x10b981 : isOverallSevere ? 0xef4444 : isOverallModerate ? 0xf59e0b : 0x06b6d4;
        const ringGeo = new THREE.RingGeometry(2.65, 2.74, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: rimColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, -3.00, 0.15);
        modelGroup.add(ring);

        // ── 11. 360° ORBIT, HOVER & CLICK RAYCASTING ──────────────────────────
        let isDragging = false;
        let prevMousePos = { x: 0, y: 0 };
        let downPos = { x: 0, y: 0 };
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const onMouseDown = (e: MouseEvent) => {
            isDragging = true;
            prevMousePos = { x: e.clientX, y: e.clientY };
            downPos = { x: e.clientX, y: e.clientY };
        };
        const onMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const deltaX = e.clientX - prevMousePos.x;
                const deltaY = e.clientY - prevMousePos.y;
                modelGroup.rotation.y += deltaX * 0.008;
                modelGroup.rotation.x = Math.max(-0.4, Math.min(0.4, modelGroup.rotation.x + deltaY * 0.006));
                prevMousePos = { x: e.clientX, y: e.clientY };
            } else if (container) {
                const rect = container.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                raycaster.setFromCamera(mouse, camera);
                const hits = raycaster.intersectObjects(pinMeshesRef.current, true);
                container.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
            }
        };
        const onMouseUp = (e: MouseEvent) => {
            isDragging = false;
            if (container) {
                const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
                if (dist < 6) {
                    const rect = container.getBoundingClientRect();
                    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                    raycaster.setFromCamera(mouse, camera);
                    const intersects = raycaster.intersectObjects(pinMeshesRef.current, true);
                    if (intersects.length > 0) {
                        let obj: THREE.Object3D | null = intersects[0].object;
                        while (obj && !(obj as any).landmarkData && obj.parent) {
                            obj = obj.parent;
                        }
                        if (obj && (obj as any).landmarkData) {
                            focusPin((obj as any).landmarkData as LandmarkPin);
                        }
                    }
                }
            }
        };

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                isDragging = true;
                prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!isDragging || e.touches.length !== 1) return;
            const deltaX = e.touches[0].clientX - prevMousePos.x;
            const deltaY = e.touches[0].clientY - prevMousePos.y;
            modelGroup.rotation.y += deltaX * 0.008;
            modelGroup.rotation.x = Math.max(-0.4, Math.min(0.4, modelGroup.rotation.x + deltaY * 0.006));
            prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        };
        const onTouchEnd = () => { isDragging = false; };

        container.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        container.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', onTouchEnd);

        // ── 12. ANIMATION LOOP ───────────────────────────────────────────────
        let animId: number;
        let lastTime = performance.now();

        const animate = () => {
            animId = requestAnimationFrame(animate);
            const now = performance.now();
            const delta = Math.min(0.08, (now - lastTime) / 1000);
            lastTime = now;

            camera.position.lerp(targetCameraPos.current, 0.08);
            currentLookAt.current.lerp(targetLookAt.current, 0.08);
            camera.lookAt(currentLookAt.current);

            if (autoRotate && !isDragging) {
                modelGroup.rotation.y += delta * 0.28;
            }

            // Dynamic Hemodynamic Blood Flow & Clinical Reticle Animation
            pinMeshesRef.current.forEach((pg, idx) => {
                const vd = (pg as any).veinData;
                const phase = (now * 0.0030) + idx * 0.85;

                if (vd) {
                    // 1. Venous Systolic / Reflux Pulse Wave on 3D Vein Lumen
                    const refluxFactor = simulateReflux ? 1.0 : 0.35;
                    const pulse = 1.0 + (0.08 * refluxFactor) * Math.sin(phase);
                    if (vd.veinMesh) {
                        vd.veinMesh.scale.set(pulse, pulse, 1.0);
                    }
                    if (vd.ampullaMesh) {
                        vd.ampullaMesh.scale.set(pulse * 1.2, pulse * 1.4, 1.1);
                    }

                    // 2. Animated Hemodynamic Blood Flow Particles along 3D Spline
                    if (vd.particlePoints && vd.mainCurve && vd.particleProgress) {
                        const geom = vd.particlePoints.geometry as THREE.BufferGeometry;
                        const posAttr = geom.attributes.position;
                        const positions = posAttr.array as Float32Array;
                        // Flow speed: retrograde backward pooling when refluxing, cephalad upward when competent
                        const flowSpeed = simulateReflux ? -0.22 : 0.38;

                        for (let i = 0; i < vd.particleCount; i++) {
                            vd.particleProgress[i] = (vd.particleProgress[i] + delta * flowSpeed + 1.0) % 1.0;
                            const pt = vd.mainCurve.getPointAt(vd.particleProgress[i]);
                            positions[i * 3] = pt.x;
                            positions[i * 3 + 1] = pt.y;
                            positions[i * 3 + 2] = pt.z;
                        }
                        posAttr.needsUpdate = true;
                    }

                    // 3. Subcutaneous Dermal Stasis Aura Breathing
                    if (vd.patchMesh) {
                        const auraScale = 1.0 + 0.06 * Math.sin(phase);
                        vd.patchMesh.scale.set(auraScale, auraScale, auraScale);
                        if (vd.patchMesh.material) {
                            (vd.patchMesh.material as any).opacity = 0.72 + 0.22 * Math.sin(phase);
                        }
                    }

                    // 4. Incompetent Venous Valve Regurgitation Pulse
                    if (vd.valveRing) {
                        vd.valveRing.rotation.z += delta * 1.4;
                        const valvePulse = 1.0 + 0.18 * Math.sin(phase * 1.6);
                        vd.valveRing.scale.set(valvePulse, valvePulse, 1.0);
                    }

                    // 5. Holographic Ultrasound Doppler Scanline Sweep
                    if (vd.scanLine) {
                        vd.scanLine.position.y = Math.sin(now * 0.0022 + idx) * 0.09;
                    }

                    // 6. Subtle Pulse on Numbered Locator Pin
                    if (vd.pinSprite) {
                        const pinPulse = 0.13 + 0.008 * Math.sin(phase * 1.5);
                        vd.pinSprite.scale.set(pinPulse, pinPulse, 1.0);
                    }
                }
            });

            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!container || !camera || !renderer) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            isMounted = false;
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
            container.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            container.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            renderer.dispose();
        };
    }, [autoRotate, viewMode, selectedToneIdx, simulateReflux, severity, maxCaliberMm, clinicalLandmarks, findings, effectiveIsHealthy, viewPerspective, isInitiallyPosterior]);

    const handleZoom = (amount: number) => {
        if (!cameraRef.current) return;
        const curZ = targetCameraPos.current.z;
        if (curZ < 0) {
            targetCameraPos.current.z = Math.min(-1.6, Math.max(-8.0, curZ - amount));
        } else {
            targetCameraPos.current.z = Math.max(1.6, Math.min(10.0, curZ + amount));
        }
    };

    const resetOrientation = () => {
        if (!modelGroupRef.current) return;
        modelGroupRef.current.rotation.set(0, 0, 0);
        setSelectedPin(null);
        if (hasFootAnatomy) {
            targetCameraPos.current.set(isRightLegDominant ? 0.38 : -0.38, -2.20, 2.15);
            targetLookAt.current.set(isRightLegDominant ? 0.48 : -0.48, -2.55, 0.40);
        } else if (viewPerspective === 'posterior') {
            targetCameraPos.current.set(0.0, -1.05, -3.90);
            targetLookAt.current.set(0.0, -1.15, -0.30);
        } else {
            targetCameraPos.current.set(0.0, -0.7, 5.40);
            targetLookAt.current.set(0.0, -1.05, 0.10);
        }
    };

    return (
        <div className="relative w-full h-[620px] rounded-3xl overflow-hidden bg-gradient-to-b from-[#050811] via-[#091122] to-[#050811] border border-slate-700/50 shadow-2xl flex flex-col select-none">
            
            {/* Top Toolbar: Quality Badge, Perspective Switcher & View Controls */}
            <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
                
                {/* Clinical Production Medical Badge */}
                <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 dark:bg-slate-900/90 light-mode:bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/60 dark:border-slate-700/60 light-mode:border-slate-300 shadow-xl">
                    <Sparkles size={15} className={effectiveIsHealthy ? "text-emerald-400" : "text-amber-400"} />
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-extrabold text-white dark:text-white light-mode:text-slate-900 uppercase tracking-wider">
                            3D Vascular Twin
                        </span>
                        {effectiveIsHealthy ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <CheckCircle2 size={10} className="text-emerald-400" />
                                C0 Normal
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {findings.length} Colored Part(s)
                            </span>
                        )}
                    </div>
                </div>

                {/* Perspective Switcher: Front (Anterior) vs Back (Posterior) */}
                <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/95 dark:bg-slate-900/95 light-mode:bg-white/90 backdrop-blur-md p-1 rounded-2xl border border-amber-500/40 shadow-xl ring-1 ring-amber-500/20">
                    <button
                        onClick={() => { setSelectedPin(null); setViewPerspective('anterior'); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            viewPerspective === 'anterior'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold scale-102'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                        title="View Anterior (Front / Foot) Surface"
                    >
                        <RotateCw size={12} className={viewPerspective === 'anterior' ? 'text-slate-950' : 'text-amber-400'} />
                        <span>Front (Anterior)</span>
                    </button>
                    <button
                        onClick={() => { setSelectedPin(null); setViewPerspective('posterior'); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            viewPerspective === 'posterior'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold scale-102'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                        title="View Posterior (Back) Surface: SSV Trunk, Calves, Popliteal"
                    >
                        <RotateCw size={12} className={viewPerspective === 'posterior' ? 'text-slate-950' : 'text-amber-400'} />
                        <span>Back (Posterior)</span>
                    </button>
                </div>

                {/* Anatomical Region Focus */}
                <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 dark:bg-slate-900/90 light-mode:bg-white/90 backdrop-blur-md p-1 rounded-2xl border border-slate-700/60 dark:border-slate-700/60 light-mode:border-slate-300 shadow-xl">
                    <button
                        onClick={() => { setSelectedPin(null); setAnatomicalFocus('foot'); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            anatomicalFocus === 'foot' && !selectedPin
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                        title="Close-Up on Foot, Toes, and Ankle Malleolus"
                    >
                        <span>🦶 Foot</span>
                    </button>
                    <button
                        onClick={() => { setSelectedPin(null); setAnatomicalFocus('calf'); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            anatomicalFocus === 'calf' && !selectedPin
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                        title="Calf Belly & Gastrocnemius"
                    >
                        <span>🦵 Calf</span>
                    </button>
                    <button
                        onClick={() => { setSelectedPin(null); setAnatomicalFocus('popliteal'); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            anatomicalFocus === 'popliteal' && !selectedPin
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                        title="Posterior Knee & Popliteal Fossa"
                    >
                        <span>🦿 Knee</span>
                    </button>
                    <button
                        onClick={() => { setSelectedPin(null); setAnatomicalFocus('both'); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            anatomicalFocus === 'both' && !selectedPin
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                        title="Bilateral Overview of Mid-Thigh Limbs"
                    >
                        <span>🧍 Both</span>
                    </button>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 dark:bg-slate-900/90 light-mode:bg-white/90 backdrop-blur-md p-1 rounded-2xl border border-slate-700/60 dark:border-slate-700/60 light-mode:border-slate-300 shadow-xl">
                    <button
                        onClick={() => setViewMode('realistic')}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'realistic'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                    >
                        Skin
                    </button>
                    <button
                        onClick={() => setViewMode('translucent')}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'translucent'
                                ? 'bg-sky-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                    >
                        Angio
                    </button>
                    <button
                        onClick={() => setViewMode('heatmap')}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'heatmap'
                                ? 'bg-red-500 text-slate-950 shadow-md font-extrabold'
                                : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'
                        }`}
                    >
                        Thermal
                    </button>
                </div>
            </div>

            {/* 3D WebGL Canvas */}
            <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-3">
                    <Loader2 size={36} className="text-amber-400 animate-spin" />
                    <p className="text-sm font-semibold text-white tracking-wide">
                        Rendering Anatomical Vascular Twin...
                    </p>
                    <span className="text-xs text-slate-400">
                        Synthesizing precision colored lesion parts &amp; clinical reticles
                    </span>
                </div>
            )}

            {/* ── 3D INTERACTIVE IN-VIEWPORT CLINICAL DOSSIER CARD ──────────────── */}
            {selectedPin ? (
                <div className="absolute top-20 left-6 z-30 pointer-events-auto bg-slate-950/95 dark:bg-slate-950/95 light-mode:bg-white/95 backdrop-blur-xl border border-amber-500/60 p-4 rounded-3xl text-left shadow-2xl max-w-[310px] animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full animate-ping flex-shrink-0" style={{ backgroundColor: selectedPin.severityColor }} />
                            <div>
                                <span className="text-xs font-extrabold text-white dark:text-white light-mode:text-slate-900 uppercase tracking-wide block">
                                    {selectedPin.title}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold">{selectedPin.zone}</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => setSelectedPin(null)} 
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Calibrated Vessel Caliber Gauge Bar */}
                    <div className="mt-3 p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 font-semibold">Caliber Gauge:</span>
                            <span className="font-mono font-bold" style={{ color: selectedPin.severityColor }}>
                                Ø {selectedPin.caliber}
                            </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                            <div className="h-full bg-cyan-400" style={{ width: '37.5%' }} title="Mild <3.0mm" />
                            <div className="h-full bg-amber-400" style={{ width: '25%' }} title="Moderate 3.0-4.9mm" />
                            <div className="h-full bg-red-500" style={{ width: '37.5%' }} title="Severe >=5.0mm" />
                        </div>
                        <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                            <span>0mm</span>
                            <span>3.0mm</span>
                            <span>5.0mm</span>
                            <span>8.0mm</span>
                        </div>
                    </div>

                    <div className="mt-2.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Tortuosity Index:</span>
                            <span className="font-mono font-bold text-sky-400">{selectedPin.tortuosity}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">CEAP Clinical Stage:</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ backgroundColor: `${selectedPin.severityColor}25`, color: selectedPin.severityColor }}>
                                {selectedPin.ceap}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Retrograde Reflux:</span>
                            <span className="font-mono text-[10px] text-red-400 font-bold">{selectedPin.refluxTime}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Venous Stasis Pressure:</span>
                            <span className="font-mono text-[10px] text-amber-300 font-semibold">{selectedPin.stasisPressure}</span>
                        </div>
                    </div>

                    {/* Surgical Intervention Recommendation */}
                    <div className="mt-2.5 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 space-y-1">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-1">
                            <ShieldAlert size={12} />
                            Clinical Protocol:
                        </span>
                        <p className="text-[10.5px] text-slate-300 leading-relaxed">
                            {selectedPin.clinicalProtocol}
                        </p>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed bg-slate-950/40 p-2 rounded-xl border border-slate-800/40">
                        {selectedPin.description}
                    </p>

                    <button
                        onClick={() => focusPin(selectedPin)}
                        className="mt-3 w-full py-1.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                        <Crosshair size={13} />
                        <span>Center Camera on This Zone</span>
                    </button>
                </div>
            ) : null}

            {/* ── SLEEK FLOATING ANATOMICAL LESION QUICK DOCK (BOTTOM CENTER) ── */}
            {clinicalLandmarks.length > 0 && !effectiveIsHealthy && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 pointer-events-auto bg-slate-950/90 dark:bg-slate-950/90 light-mode:bg-white/95 backdrop-blur-xl px-3 py-1.5 rounded-2xl border border-slate-700/60 dark:border-slate-700/60 light-mode:border-slate-300 shadow-2xl max-w-[95%] overflow-x-auto">
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-400 light-mode:text-slate-600 uppercase tracking-wider flex items-center gap-1 flex-shrink-0 mr-1">
                        <Activity size={12} className="text-amber-400" />
                        <span>Lesions ({clinicalLandmarks.length}):</span>
                    </span>
                    {clinicalLandmarks.map((lm, idx) => {
                        const isSelected = selectedPin?.id === lm.id;
                        return (
                            <button
                                key={lm.id}
                                onClick={() => focusPin(lm)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex-shrink-0 border ${
                                    isSelected
                                        ? 'bg-amber-500/20 text-white border-amber-500 shadow-lg scale-102 ring-1 ring-amber-500/50'
                                        : 'bg-slate-900/60 dark:bg-slate-900/60 light-mode:bg-slate-100 text-slate-300 dark:text-slate-300 light-mode:text-slate-700 hover:text-white border-slate-800 hover:border-slate-600'
                                }`}
                                title={`${lm.title} (${lm.zone}) - Click to inspect 3D lesion`}
                            >
                                <span 
                                    className="w-2 h-2 rounded-full flex-shrink-0" 
                                    style={{ backgroundColor: lm.severityColor }} 
                                />
                                <span>#{idx + 1} {lm.leg.includes('Left') ? 'Left' : 'Right'}</span>
                                <span className="text-[10px] font-mono font-bold" style={{ color: lm.severityColor }}>
                                    {lm.caliber}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── EXPANDABLE MEDICAL SEVERITY & HEMODYNAMICS GUIDE MODAL ────────── */}
            {showSeverityGuide && (
                <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md p-6 flex flex-col justify-center items-center pointer-events-auto animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 max-w-2xl w-full rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90%] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <ShieldAlert size={20} className="text-amber-400" />
                                <h3 className="text-base font-extrabold text-white tracking-wide uppercase">
                                    Medical Production Grade: Severity Color Standards
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowSeverityGuide(false)}
                                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3 text-xs">
                            <div className="p-3.5 rounded-2xl bg-red-950/30 border border-red-500/40 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-red-400 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                        Severe Dilation (&ge;5.0 mm)
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[10px] font-bold">
                                        CEAP C2S - C4a
                                    </span>
                                </div>
                                <p className="text-slate-300 text-[11px] leading-relaxed">
                                    <strong>Etiology:</strong> Complete valvular incompetence with continuous retrograde reflux (&gt;1.0s). Severe ambulatory venous hypertension (&gt;65 mmHg). Smooth muscle elastolysis and aneurysmal tortuosity.
                                </p>
                                <div className="text-[10px] text-red-300 font-semibold bg-red-900/30 p-2 rounded-xl">
                                    Protocol: Endovenous Laser Ablation (EVLA 1470nm) or Radiofrequency Ablation (RFA).
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-amber-400 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                        Moderate Ectasia (3.0 - 4.9 mm)
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                                        CEAP C2
                                    </span>
                                </div>
                                <p className="text-slate-300 text-[11px] leading-relaxed">
                                    <strong>Etiology:</strong> Dilation of secondary subcutaneous tributaries with axial reflux (0.5 - 1.0s). Moderate venous pooling under standing hydrostatic load.
                                </p>
                                <div className="text-[10px] text-amber-300 font-semibold bg-amber-900/30 p-2 rounded-xl">
                                    Protocol: Ultrasound-Guided Foam Sclerotherapy (UGFS) + Class II (20-30 mmHg) compression.
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-cyan-400 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                                        Spider &amp; Reticular (&lt;3.0 mm)
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                                        CEAP C1
                                    </span>
                                </div>
                                <p className="text-slate-300 text-[11px] leading-relaxed">
                                    <strong>Etiology:</strong> Intradermal venular ectasia and subdermal capillary arborization. Minimal axial reflux (&lt;0.5s), localized microvascular hypertension.
                                </p>
                                <div className="text-[10px] text-cyan-300 font-semibold bg-cyan-900/30 p-2 rounded-xl">
                                    Protocol: Transdermal Nd:YAG 1064nm Laser or Liquid Microsclerotherapy.
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-emerald-400 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                        Competent Trunk (&lt;2.5 mm)
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                                        CEAP C0
                                    </span>
                                </div>
                                <p className="text-slate-300 text-[11px] leading-relaxed">
                                    <strong>Etiology:</strong> Preserved physiological centripetal return. Intact bicuspid venous valves with rapid closure time (&lt;0.5s), zero retrograde leakage.
                                </p>
                                <div className="text-[10px] text-emerald-300 font-semibold bg-emerald-900/30 p-2 rounded-xl">
                                    Protocol: Healthy baseline. Annual surveillance recommended.
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowSeverityGuide(false)}
                            className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all hover:bg-amber-400 shadow-md"
                        >
                            Close Severity Guide
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom 3D Toolbar */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
                
                {/* Natural Skin Tone Palette */}
                <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 dark:bg-slate-900/90 light-mode:bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/60 dark:border-slate-700/60 light-mode:border-slate-300 shadow-xl">
                    <Palette size={14} className="text-amber-400" />
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 light-mode:text-slate-600 hidden md:inline">Skin Tone:</span>
                    {SKIN_TONES.map((toneItem, idx) => (
                        <button
                            key={toneItem.name}
                            onClick={() => setSelectedToneIdx(idx)}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                selectedToneIdx === idx 
                                    ? 'scale-115 border-white dark:border-white light-mode:border-slate-900 shadow-md ring-2 ring-amber-400' 
                                    : 'border-slate-600 opacity-60 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: `#${toneItem.color.toString(16)}` }}
                            title={toneItem.name}
                        />
                    ))}
                </div>

                {/* Orbit & Camera Controls */}
                <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 dark:bg-slate-900/90 light-mode:bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700/60 dark:border-slate-700/60 light-mode:border-slate-300 shadow-xl">
                    <button
                        onClick={() => setAutoRotate(!autoRotate)}
                        className={`p-2 rounded-xl transition-all ${autoRotate ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900'}`}
                        title={autoRotate ? "Pause 360° Orbit" : "Start 360° Orbit"}
                    >
                        <RotateCw size={15} className={autoRotate ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => handleZoom(-0.6)}
                        className="p-2 rounded-xl text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900 transition-all"
                        title="Zoom In"
                    >
                        <ZoomIn size={15} />
                    </button>
                    <button
                        onClick={() => handleZoom(0.6)}
                        className="p-2 rounded-xl text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900 transition-all"
                        title="Zoom Out"
                    >
                        <ZoomOut size={15} />
                    </button>
                    <button
                        onClick={resetOrientation}
                        className="p-2 rounded-xl text-slate-400 hover:text-white dark:hover:text-white light-mode:hover:text-slate-900 transition-all"
                        title="Reset Orientation"
                    >
                        <RefreshCw size={15} />
                    </button>
                </div>
            </div>

            {/* Guidance Banner & Clinical Severity Legend Bar */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-wrap items-center justify-center gap-2 max-w-[95%]">
                <div className="bg-slate-950/90 dark:bg-slate-950/90 light-mode:bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[10px] text-slate-300 dark:text-slate-300 light-mode:text-slate-700 border border-slate-700/60 shadow-lg whitespace-nowrap flex items-center gap-2.5">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Severity:</span>
                    <span className="flex items-center gap-1 font-semibold text-red-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /> &ge;5.0mm Severe
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center gap-1 font-semibold text-amber-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 3.0-4.9mm Mod
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center gap-1 font-semibold text-cyan-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> &lt;3.0mm Spider
                    </span>
                    <span className="text-slate-600">•</span>
                    <button
                        onClick={() => setShowSeverityGuide(true)}
                        className="flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200 underline underline-offset-2 ml-1"
                    >
                        <Info size={11} />
                        <span>Clinical Guide</span>
                    </button>
                </div>
                <div className="hidden md:flex bg-slate-950/75 dark:bg-slate-950/75 light-mode:bg-white/90 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-[10px] text-slate-400 border border-slate-800 shadow-md whitespace-nowrap items-center gap-1.5">
                    <span>👆 360° Drag • Click Colored Part to Inspect</span>
                </div>
            </div>
        </div>
    );
}
