/**
 * ─────────────────────────────────────────────────────────────
 *  موتور فیزیک آکوستیک — 40kHz در هوا
 *  بر پایه‌ی تحقیق HC-SR04 (docs/HC-SR04-RESEARCH.md)
 * ─────────────────────────────────────────────────────────────
 *  مدل:
 *   - سرعت صوت وابسته به دما و رطوبت:  v = 331.3 + 0.606·T + 0.0124·RH
 *   - جذب هوا ~1.2 dB/m در 40kHz (وابسته به T/RH)
 *   - اتلاف هندسی معکوس مجذور (−6dB در هر دوبرابر شدن فاصله، مرجع 30cm)
 *   - الگوی پرتو ترنسدیوسر 16mm: لوب اصلی گاوسی با پهنای مؤثر ±15°
 *   - بازتاب آینه‌ای: سطوح زاویه‌دار انرژی را می‌دزدند (cos مؤثر)
 */

import type { EchoCandidate, SensorEnvironment } from './types';

/** آستانه‌ی تشخیص مقایسه‌گر داخلی (دامنه نسبت به این مقدار سنجیده می‌شود) */
export const DETECTION_THRESHOLD = 1.0;

/** ثابت کالیبراسیون SPL داخلی: هدف صلب و صاف روی محور در ~4.1m دقیقاً روی آستانه */
export const SPL_CAL = 309;

/** مرجع اتلاف هندسی (متر) */
export const SPREADING_REF_M = 0.3;

/** سرعت صوت در هوا (m/s) — دما °C و رطوبت نسبی % */
export function speedOfSound(env: SensorEnvironment): number {
  const t = env.temperatureC;
  const rh = env.humidityPct;
  return 331.3 + 0.606 * t + 0.0124 * rh;
}

/** جذب هوا (dB/m) در فرکانس دلخواه — تقریب تجربی برای رنج سمعی-بصری */
export function absorptionDbPerM(env: SensorEnvironment, frequencyHz = 40000): number {
  const base = 1.2 * Math.pow(frequencyHz / 40000, 1.6);
  const tempFactor = 1 + 0.006 * (env.temperatureC - 20);
  const rhFactor = 1 + 0.004 * (env.humidityPct - 50);
  return Math.min(2.4, Math.max(0.35, base * tempFactor * rhFactor));
}

/** الگوی پرتو (Beam Pattern) — لوب اصلی گاوسی؛ ۱ در محور، افت مؤثر تا ±15° */
export function beamPattern(angleDeg: number, theta0Deg = 12): number {
  const a = Math.abs(angleDeg);
  if (a > 30) return 0;
  const ratio = a / theta0Deg;
  return Math.exp(-ratio * ratio);
}

/**
 * دامنه‌ی اکوی برگشتی (نسبت به آستانه‌ی ۱٫۰)
 * @param distanceM        فاصله‌ی رفت‌وبرگشت تا هدف (یک‌طرفه، متر)
 * @param angleDeg         زاویه از محور سنسور
 * @param materialAcoustic ضریب بازتاب متریال (0..1)
 * @param incidenceCos     |cos| زاویه‌ی تابش با نرمال سطح (۰..۱)
 */
export function echoAmplitude(params: {
  distanceM: number;
  angleDeg: number;
  materialAcoustic: number;
  incidenceCos: number;
  env: SensorEnvironment;
}): number {
  const { distanceM, angleDeg, materialAcoustic, incidenceCos, env } = params;
  if (distanceM <= 0) return 0;
  const beam = beamPattern(angleDeg);
  if (beam <= 0.001) return 0;

  // بازتاب آینه‌ای: سطح مایل، انرژی را از سنسور دور می‌کند
  const specular = 0.25 + 0.75 * Math.pow(Math.max(0, Math.min(1, incidenceCos)), 1.5);

  // اتلاف هندسی معکوس مجذور نسبت به مرجع 30cm
  const spreading = Math.pow(SPREADING_REF_M / distanceM, 2);

  // جذب هوا در مسیر رفت‌وبرگشت
  const alpha = absorptionDbPerM(env);
  const absorption = Math.pow(10, (-alpha * 2 * distanceM) / 20);

  return SPL_CAL * beam * specular * spreading * absorption * materialAcoustic;
}

/** زمان پرواز رفت‌وبرگشت (میکروثانیه) */
export function tofUs(distanceM: number, speedMs: number): number {
  return ((2 * distanceM) / speedMs) * 1e6;
}

/** تبدیل عرض پالس Echo به فاصله (سانتی‌متر) با سرعت واقعی */
export function widthUsToCm(widthUs: number, speedMs: number): number {
  return (widthUs * speedMs) / 2 / 10000;
}

/** نمونه‌گیری یکنواخت جهت‌ها داخل کون (اسپیرال آفتابگردان) */
export function coneDirections(count: number, halfAngleDeg: number): Array<{ thetaDeg: number; phiDeg: number }> {
  const dirs: Array<{ thetaDeg: number; phiDeg: number }> = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const frac = (i + 0.5) / count;
    const theta = halfAngleDeg * Math.sqrt(frac);
    const phi = (i * golden * 180) / Math.PI;
    dirs.push({ thetaDeg: theta, phiDeg: phi % 360 });
  }
  return dirs;
}

/** گروه‌بندی پرتوها به کاندیداهای اکو (قوی‌ترین پرتو هر شیء) */
export function groupEchos(rays: EchoCandidate[]): EchoCandidate[] {
  const byObject = new Map<string, EchoCandidate>();
  for (const r of rays) {
    const prev = byObject.get(r.objectId);
    if (!prev || r.amplitude > prev.amplitude) byObject.set(r.objectId, r);
  }
  return Array.from(byObject.values()).sort((a, b) => a.distanceM - b.distanceM);
}
