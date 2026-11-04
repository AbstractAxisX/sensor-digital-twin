/**
 * ─────────────────────────────────────────────────────────────
 *  کتابخانه‌ی متریال‌های آکوستیک + ظاهر سه‌بعدی
 *  ضرایب بازتاب صوت بر اساس رفتار واقعی سطوح در 40kHz
 * ─────────────────────────────────────────────────────────────
 */

export interface AcousticMaterial {
  id: string;
  /** نام فارسی */
  labelFa: string;
  /** رنگ نمایشی (hex) */
  color: string;
  /** زبری (Three.js standard material) */
  roughness: number;
  /** فلزی بودن (Three.js) */
  metalness: number;
  /** ضریب بازتاب آکوستیک (۱ = بازتاب کامل مثل فلز، ۰.۰۸ = اسفنج جاذب) */
  acoustic: number;
}

export const ACOUSTIC_MATERIALS: AcousticMaterial[] = [
  {
    id: 'concrete',
    labelFa: 'بتن / دیوار',
    color: '#9aa0a8',
    roughness: 0.95,
    metalness: 0.0,
    acoustic: 0.92,
  },
  {
    id: 'wood',
    labelFa: 'چوب',
    color: '#b0854f',
    roughness: 0.8,
    metalness: 0.0,
    acoustic: 0.72,
  },
  {
    id: 'metal',
    labelFa: 'فلز',
    color: '#c9ccd1',
    roughness: 0.25,
    metalness: 1.0,
    acoustic: 1.0,
  },
  {
    id: 'glass',
    labelFa: 'شیشه',
    color: '#a8d4cf',
    roughness: 0.05,
    metalness: 0.1,
    acoustic: 0.96,
  },
  {
    id: 'plastic',
    labelFa: 'پلاستیک',
    color: '#d95f43',
    roughness: 0.55,
    metalness: 0.05,
    acoustic: 0.8,
  },
  {
    id: 'fabric',
    labelFa: 'پارچه (جاذب)',
    color: '#7d6b9e',
    roughness: 1.0,
    metalness: 0.0,
    acoustic: 0.22,
  },
  {
    id: 'foam',
    labelFa: 'اسفنج (فوق جاذب)',
    color: '#4a4f57',
    roughness: 1.0,
    metalness: 0.0,
    acoustic: 0.08,
  },
  {
    id: 'water',
    labelFa: 'آب / مایع',
    color: '#3f8f8a',
    roughness: 0.1,
    metalness: 0.3,
    acoustic: 0.95,
  },
  {
    id: 'carpet',
    labelFa: 'موکت / فرش',
    color: '#8a5a44',
    roughness: 1.0,
    metalness: 0.0,
    acoustic: 0.35,
  },
];

const MATERIAL_MAP = new Map(ACOUSTIC_MATERIALS.map((m) => [m.id, m]));

export function getMaterial(id: string): AcousticMaterial {
  return MATERIAL_MAP.get(id) ?? ACOUSTIC_MATERIALS[0];
}
