/**
 * ─────────────────────────────────────────────────────────────
 *  WaveLab — Sensor Simulation Framework (Core Types)
 *  چارچوب شبیه‌سازی سنسورها — نوع‌های مشترک
 * ─────────────────────────────────────────────────────────────
 */

/** شرایط محیطی که همه‌ی سنسورها در آن کار می‌کنند */
export interface SensorEnvironment {
  /** دما به سانتی‌گراد */
  temperatureC: number;
  /** رطوبت نسبی درصد */
  humidityPct: number;
}

/** یک بازتابنده‌ی بالقوه در صحنه (خروجی فیزیک آکوستیک) */
export interface EchoCandidate {
  /** شناسه‌ی شیء برخوردی */
  objectId: string;
  /** متریال سطح برخورد */
  materialId: string;
  /** فاصله‌ی هندسی تا سطح (متر) */
  distanceM: number;
  /** زاویه‌ی خروج پرتو از محور سنسور (درجه) */
  angleDeg: number;
  /** دامنه‌ی اکوی برگشتی نسبت به آستانه‌ی تشخیص (۱ = روی آستانه) */
  amplitude: number;
}

/** انواع لبه‌های دیجیتال پین‌ها */
export type EdgeKind = 'TRIG_RISE' | 'TRIG_FALL' | 'ECHO_RISE' | 'ECHO_FALL';

/** یک لبه‌ی ثبت‌شده روی پین (زمان میکروثانیه‌ی مطلق) */
export interface EdgeEvent {
  tUs: number;
  kind: EdgeKind;
}

/** وضعیت ماشین‌حالت دوقلوی HC-SR04 */
export type HCSR04State =
  | 'IDLE'
  | 'ARMED' // پالس Trig شنیده شده، هنوز ≥10µs تایید نشده
  | 'PUMP' // راه‌افتادن چارج‌پامپ ±10V (~248µs)
  | 'BURST' // تابش ۸ پالس 40kHz (200µs)
  | 'LISTEN' // گوش دادن به اکو (Echo پین HIGH است)
  | 'COOLDOWN'; // سارگ کوچک بعد از پایان اندازه‌گیری

/** یک اندازه‌گیری کامل‌شده‌ی دوقلو */
export interface TwinReading {
  /** شماره‌ی اندازه‌گیری از ابتدای روشن شدن */
  index: number;
  /** لحظه‌ی شروع برست (بالارفتن Echo) میکروثانیه */
  startTUs: number;
  /** عرض پالس Echo میکروثانیه (در timeout = 38000) */
  widthUs: number;
  /** خارج از رنج؟ (پالس ۳۸ms) */
  outOfRange: boolean;
  /** فاصله‌ی محاسبه‌شده با سرعت صوت واقعی محیط (سانتی‌متر) */
  distanceCm: number | null;
  /** فاصله با فرمول دیتاشیت µs/58 (سانتی‌متر) */
  datasheetCm: number | null;
  /** فاصله‌ی هندسی «واقعی» هدف برای مقایسه‌ی خطا (سانتی‌متر) */
  trueCm: number | null;
  /** سرعت صوت لحظه‌ی اندازه‌گیری (m/s) */
  speedMs: number;
  temperatureC: number;
  humidityPct: number;
  /** متریال هدف تشخیص داده شده */
  detectedMaterialId: string | null;
}

/** رابط مشترک همه‌ی دوقلوهای دیجیتال سنسورها (برای موتور) */
export interface SensorTwin {
  readonly kind: string;
  /** پیشبرد زمانی ماشین‌حالت (tUs میکروثانیه‌ی مطلق) */
  update(tUs: number): void;
  reset(): void;
}
