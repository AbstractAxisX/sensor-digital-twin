/**
 * ─────────────────────────────────────────────────────────────
 *  مشخصات کامل دیتاشیت HC-SR04 (نسل ۱ و ۲)
 *  منبع: docs/HC-SR04-RESEARCH.md
 * ─────────────────────────────────────────────────────────────
 */

export const HCSR04_SPECS = {
  /** نام سنسور */
  name: 'HC-SR04',
  /** ولتاژ کاری نسل ۱ (V) */
  voltageMinV: 4.8,
  voltageMaxV: 5.0,
  /** ولتاژ نسل ۲ / P (V) */
  voltageV2MinV: 3.3,
  /** جریان کاری (mA) */
  workingCurrentMa: 15,
  /** جریان سکون نسل ۲ (mA) */
  quiescentCurrentMa: 2,
  /** فرکانس آکوستیک (Hz) */
  frequencyHz: 40000,
  /** پریود یک سیکل (µs) */
  periodUs: 25,
  /** طول موج در هوای 20°C (mm) */
  wavelengthMm: 8.5,
  /** تعداد پالس‌های برست */
  burstCycles: 8,
  /** مدت برست (µs) */
  burstDurationUs: 200,
  /** حداقل رنج / بایندزون (m) */
  minRangeM: 0.02,
  /** حداکثر رنج (m) */
  maxRangeM: 4.0,
  /** دقت نامی (m) */
  accuracyM: 0.003,
  /** رزولوشن (m) */
  resolutionM: 0.003,
  /** زاویه‌ی مؤثر (درجه — نیم‌زاویه‌ی کون) */
  halfAngleDeg: 15,
  /** حداقل عرض پالس Trig (µs) */
  triggerPulseUs: 10,
  /** تاخیر شناسایی Trig توسط MCU داخلی (µs) */
  detectDelayUs: 10,
  /** زمان راه‌افتادن چارج‌پامپ MAX232 (µs) */
  pumpRampUs: 248,
  /** Timeout اکو — عرض پالس بدون مانع (µs) */
  echoTimeoutUs: 38000,
  /** حداقل سیکل پیشنهادی بین اندازه‌گیری‌ها (ms) */
  minCycleMs: 60,
  /** ضریب دیتاشیت: µs/58 = cm */
  usPerCm: 58,
  /** ابعاد (m) */
  dimension: { lengthM: 0.045, widthM: 0.02, heightM: 0.015 },
  /** قطر ترنسدیوسر (m) */
  transducerDiameterM: 0.016,
  /** وزن (g) */
  weightG: 9,
  /** دمای کاری */
  operatingTempC: { min: -15, max: 70 },
} as const;

/** محدوده‌ی بهین‌ه‌ی دامنه (بالای این، کلمپ می‌شود) */
export const MAX_AMPLITUDE_CLAMP = 40;
