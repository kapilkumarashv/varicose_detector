/**
 * Anatomical mapping utility for varicose vein locations.
 * Translates bounding box coordinates into clinical terminology with bilateral multi-leg awareness.
 */

export interface BBox {
    x: number;      // Center X (normalized 0-1)
    y: number;      // Center Y (normalized 0-1)
    width: number;  // Width (normalized 0-1)
    height: number; // Height (normalized 0-1)
}

export function getFootAnatomicalLocation(bbox: BBox): string {
    const { x, y } = bbox;
    const leg = x > 0.35 ? 'Right Leg' : 'Left Leg';
    let zone = '';
    if (y < 0.35) {
        zone = 'Supramalleolar Ankle Flexure';
    } else if (y < 0.65) {
        zone = 'Medial Malleolar Ankle Joint';
    } else {
        zone = 'Dorsal Foot / Instep & Arch';
    }
    return `${leg} - ${zone}`;
}

export function getAnatomicalLocation(bbox: BBox, isFootScan?: boolean): string {
    if (isFootScan) {
        return getFootAnatomicalLocation(bbox);
    }
    const { x, y } = bbox;

    let leg = '';
    let lateralAspect = '';
    let verticalZone = '';

    // Determine Leg & Medial/Lateral anatomical orientation (assuming standard bilateral posterior/anterior view)
    if (x < 0.50) {
        leg = 'Left Leg';
        if (x < 0.26) lateralAspect = 'Lateral';
        else if (x > 0.38) lateralAspect = 'Medial';
        else lateralAspect = 'Central Posterior';
    } else {
        leg = 'Right Leg';
        if (x > 0.74) lateralAspect = 'Lateral';
        else if (x < 0.62) lateralAspect = 'Medial';
        else lateralAspect = 'Central Posterior';
    }

    // Vertical zones for clinical lower extremity vascular examination
    if (y < 0.20) {
        verticalZone = 'Popliteal Fossa / Proximal Calf';
    } else if (y < 0.50) {
        verticalZone = 'Mid Calf (Gastrocnemius Trunk)';
    } else if (y < 0.78) {
        verticalZone = 'Distal Calf (Soleus Junction)';
    } else {
        verticalZone = 'Perimalleolar Ankle / Supramalleolar';
    }

    return `${leg} - ${lateralAspect} ${verticalZone}`.trim();
}

export function getClinicalDescription(label: string, location: string, caliberMm?: number): string {
    const caliberStr = caliberMm ? ` (${caliberMm}mm caliber)` : '';

    const descMap: Record<string, string> = {
        'varicose-vein': `Dilated, tortuous subcutaneous saphenous tributary segment${caliberStr} with valvular reflux in the ${location}.`,
        'spider-vein': `Telangiectatic web-like intradermal clusters (C1)${caliberStr} presenting in the ${location}.`,
        'reticular-vein': `Bluish subdermal feeding reticular venous network (1-3mm)${caliberStr} mapped in the ${location}.`,
    };

    return descMap[label] || `Subcutaneous vascular lesion detected in the ${location}.`;
}

export function getCEAPCategory(label: string, caliberMm?: number): string {
    if (label.includes('varicose')) {
        return (caliberMm && caliberMm >= 4.0) ? 'C2S' : 'C2';
    }
    if (label.includes('spider')) return 'C1';
    if (label.includes('reticular')) return 'C1R';
    return 'C1';
}
