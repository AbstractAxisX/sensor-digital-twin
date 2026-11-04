/**
 * ─────────────────────────────────────────────────────────────
 *  دوقلوی دیجیتال HC-SR04 — ماشین‌حالت میکروثانیه‌ای
 * ─────────────────────────────────────────────────────────────
 *  بازتولید رفتار واقعی ماژول (بر پایه‌ی ریورس‌انجینیرینگ):
 *
 *   Trig HIGH ≥10µs → شناسایی (~10µs) → راه‌افتادن چارج‌پامپ (~248µs)
 *   → برست ۸ پالس 40kHz (200µs) → Echo HIGH → اولین اکوی بالای آستانه
 *   → Echo LOW → عرض پالس = زمان پرواز رفت‌وبرگشت
 *
 *   رفتارهای واقعی شبیه‌سازی‌شده:
 *   • Timeout پالس ۳۸ms وقتی هیچ اکویی نرسد (خارج از رنج)
 *   • بایندزون ۲cm (رینگ‌داون فرستنده — اکوی زودتر شنیده نمی‌شود)
 *   • MCU داخلی با polling کار می‌کند → گاهی اولین پالس جا می‌افتد (+25µs)
 *   • تشخیص دامنه‌ای → اکوی ضعیف دیرتر آستانه می‌شود (جیتر واقعی)
 *   • اکوهای کاذب تصادفی وقتی هیچ هدفی نیست (نویز واقعی مدار)
 *   • Trig وسط اندازه‌گیری → نادیده گرفته می‌شود (سایکل ≥60ms الزامی)
 */

import type {
  EdgeEvent,
  EchoCandidate,
  HCSR04State,
  SensorEnvironment,
  SensorTwin,
  TwinReading,
} from '../core/types';
import {
  DETECTION_THRESHOLD,
  speedOfSound,
  tofUs,
  widthUsToCm,
} from '../core/acoustic';
import { MAX_AMPLITUDE_CLAMP } from './specs';
import { getMaterial } from '../core/materials';

export interface HCSR04TwinOptions {
  /** تابع تهیه‌ی کاندیداهای اکو (در لحظه‌ی شروع برست صدا زده می‌شود) */
  provideEchos: () => EchoCandidate[];
  /** خواندن محیط فعلی */
  getEnvironment: () => SensorEnvironment;
  /** توزیع گاوسی فعال؟ (پیش‌فرض بله) */
  noise?: boolean;
}

function gauss(): number {
  // Box-Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const EDGES_CAP = 800;
const READINGS_CAP = 256;
const COOLDOWN_US = 300;

export class HCSR04Twin implements SensorTwin {
  readonly kind = 'HC-SR04';

  /** وضعیت پین‌ها */
  trigLevel = false;
  echoLevel = false;

  /** ماشین حالت */
  state: HCSR04State = 'IDLE';

  /** لبه‌های ثبت‌شده برای اسیلوسکوپ */
  edges: EdgeEvent[] = [];

  /** تاریخچه اندازه‌گیری‌ها */
  readings: TwinReading[] = [];

  /** آخرین اندازه‌گیری */
  lastReading: TwinReading | null = null;

  /** شمارنده */
  readingIndex = 0;

  /** کاندیداهای اکوی اندازه‌گیری جاری */
  private candidates: EchoCandidate[] = [];

  private tTrig = 0; // لحظه‌ی بالارفتن Trig
  private tPump = 0;
  private tBurst = 0;
  private tFall = Infinity; // زمان پیش‌بینی‌شده‌ی پایین آمدن Echo

  private pendingPulse: { riseUs: number; fallUs: number } | null = null;

  private readingListeners = new Set<(r: TwinReading) => void>();

  constructor(private opts: HCSR04TwinOptions) {}

  /** گوش دادن به اندازه‌گیری‌های جدید (برای UI) */
  onReading(fn: (r: TwinReading) => void): () => void {
    this.readingListeners.add(fn);
    return () => this.readingListeners.delete(fn);
  }

  private pushEdge(tUs: number, kind: EdgeEvent['kind']) {
    this.edges.push({ tUs, kind });
    if (this.edges.length > EDGES_CAP) this.edges.splice(0, this.edges.length - EDGES_CAP);
  }

  /** درخواست یک پالس Trig ده میکروثانیه‌ای */
  triggerPulse(tUs: number): void {
    if (this.pendingPulse) return;
    this.pendingPulse = { riseUs: tUs, fallUs: tUs + 10 };
  }

  /** کنترل مستقیم پین Trig (مثل MCU واقعی) */
  setTrig(high: boolean, tUs: number): void {
    if (high === this.trigLevel) return;
    this.trigLevel = high;
    this.pushEdge(tUs, high ? 'TRIG_RISE' : 'TRIG_FALL');
    if (high) {
      if (this.state === 'IDLE') {
        this.state = 'ARMED';
        this.tTrig = tUs;
      }
      // وسط اندازه‌گیری: نادیده گرفته می‌شود (مثل واقعی — سایکل ≥60ms لازم است)
    }
  }

  update(tUs: number): void {
    // پردازش پالس Trig روی تایم‌لاین میکروثانیه‌ای (مقاوم به فریم‌ریت پایین)
    const pulse = this.pendingPulse;
    if (pulse) {
      if (!this.trigLevel && tUs >= pulse.riseUs) this.setTrig(true, pulse.riseUs);
      if (this.trigLevel && tUs >= pulse.fallUs) {
        const wasArmed = this.state === 'ARMED';
        this.setTrig(false, pulse.fallUs);
        if (wasArmed) {
          // پالس ثبت شد — اگر ≥10µs بود، توالی داخلی اجرا می‌شود
          if (pulse.fallUs - pulse.riseUs >= 10) {
            this.state = 'PUMP';
            this.tPump = Math.max(pulse.riseUs + 10, pulse.fallUs);
          } else {
            this.state = 'IDLE'; // پالس خیلی کوتاه — نادیده گرفته شد (رفتار واقعی)
          }
        }
        this.pendingPulse = null;
      }
    }

    switch (this.state) {
      case 'IDLE':
        break;

      case 'ARMED':
        // مسیر کنترل مستقیم پین (بدون triggerPulse) — مثل MCU واقعی که polling می‌کند
        if (!this.trigLevel) {
          this.state = 'IDLE';
        } else if (tUs - this.tTrig >= 10) {
          this.state = 'PUMP';
          this.tPump = tUs;
        }
        break;

      case 'PUMP':
        if (tUs - this.tPump >= 248) {
          // شروع برست — Echo بالا می‌رود
          this.tBurst = tUs;
          this.echoLevel = true;
          this.pushEdge(tUs, 'ECHO_RISE');
          this.candidates = this.opts.provideEchos();
          this.tFall = this.planEchoFall(tUs);
          this.state = 'BURST';
        }
        break;

      case 'BURST':
      case 'LISTEN':
        if (tUs >= this.tFall) {
          // پالس Echo دقیقاً روی زمان برنامه‌ریزی‌شده بسته می‌شود (مستقل از فریم‌ریت)
          this.finishReading(this.tFall);
        } else if (this.state === 'BURST' && tUs - this.tBurst >= 200) {
          this.state = 'LISTEN';
        }
        break;

      case 'COOLDOWN':
        if (tUs - this.tFall >= COOLDOWN_US) this.state = 'IDLE';
        break;
    }
  }

  /** محاسبه‌ی زمان فرود اکو بر اساس کاندیداها (فیزیک تشخیص) */
  private planEchoFall(burstTUs: number): number {
    const env = this.opts.getEnvironment();
    const v = speedOfSound(env);
    const noisy = this.opts.noise !== false;

    // انتخاب نزدیک‌ترین هدف با دامنه بالای آستانه
    let chosen: EchoCandidate | null = null;
    for (const c of this.candidates) {
      if (c.amplitude >= DETECTION_THRESHOLD && c.distanceM >= 0.02 && c.distanceM <= 4.2) {
        chosen = c;
        break;
      }
    }

    if (!chosen) {
      // اکوی کاذب؟ (نویز واقعی مدار وقتی هدفی نیست)
      if (noisy && Math.random() < 0.03) {
        const d = 0.2 + Math.random() * Math.random() * 3.3;
        chosen = {
          objectId: 'phantom',
          materialId: 'concrete',
          distanceM: d,
          angleDeg: 0,
          amplitude: 1.2 + Math.random() * 0.4,
        };
      } else {
        return burstTUs + 38000; // timeout واقعی
      }
    }

    const tof = tofUs(chosen.distanceM, v);

    // تشخیص زودتر از پایان برست ممکن نیست (رینگ‌داون فرستنده)
    let fall = burstTUs + Math.max(tof, 200);

    // تاخیر آستانه‌ای: اکوی ضعیف دیرتر آستانه را رد می‌کند + جیتر polling
    const amp = Math.min(chosen.amplitude, MAX_AMPLITUDE_CLAMP);
    let latency = noisy ? 8 + Math.abs(gauss()) * 4 : 8;
    if (amp < 1.6 && Math.random() < 0.35) latency += 25; // جاافتادن پالس اول (+25µs واقعی)
    if (amp < 1.15 && Math.random() < 0.3) latency += 25; // حتی پالس دوم هم سخت
    fall += Math.min(120, Math.max(4, latency));

    return fall;
  }

  private finishReading(tUs: number): void {
    const widthUs = tUs - this.tBurst;
    const outOfRange = widthUs >= 37990;
    const env = this.opts.getEnvironment();
    const v = speedOfSound(env);

    const chosen = this.candidates.find(
      (c) => c.amplitude >= DETECTION_THRESHOLD && c.distanceM >= 0.02,
    );

    const reading: TwinReading = {
      index: ++this.readingIndex,
      startTUs: this.tBurst,
      widthUs,
      outOfRange,
      distanceCm: outOfRange ? null : widthUsToCm(widthUs, v),
      datasheetCm: outOfRange ? null : widthUs / 58,
      trueCm: outOfRange ? null : chosen ? chosen.distanceM * 100 : null,
      speedMs: v,
      temperatureC: env.temperatureC,
      humidityPct: env.humidityPct,
      detectedMaterialId: outOfRange ? null : chosen?.materialId ?? null,
    };

    this.readings.push(reading);
    if (this.readings.length > READINGS_CAP) this.readings.splice(0, this.readings.length - READINGS_CAP);
    this.lastReading = reading;
    this.echoLevel = false;
    this.pushEdge(tUs, 'ECHO_FALL');
    this.tFall = tUs;
    this.candidates = [];
    this.state = 'COOLDOWN';
    for (const fn of this.readingListeners) fn(reading);
  }

  /** وضعیت فعلی به فارسی */
  get stateFa(): string {
    switch (this.state) {
      case 'IDLE':
        return 'آماده';
      case 'ARMED':
        return 'دریافت Trig';
      case 'PUMP':
        return 'شارژ پامپ';
      case 'BURST':
        return 'تابش 40kHz';
      case 'LISTEN':
        return 'گوش دادن';
      case 'COOLDOWN':
        return 'پایان';
    }
  }

  /** متریال آخرین هدف */
  get lastTargetFa(): string | null {
    const id = this.lastReading?.detectedMaterialId;
    return id ? getMaterial(id).labelFa : null;
  }

  reset(): void {
    this.state = 'IDLE';
    this.trigLevel = false;
    this.echoLevel = false;
    this.edges = [];
    this.readings = [];
    this.lastReading = null;
    this.pendingPulse = null;
    this.candidates = [];
    this.tFall = Infinity;
  }
}
