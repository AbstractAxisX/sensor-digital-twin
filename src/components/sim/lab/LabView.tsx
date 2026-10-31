/**
 * ─────────────────────────────────────────────────────────────
 *  آزمایشگاه سنسور (Sensor Test Lab) — HC-SR04 دیجیتال‌توین
 *  چیدمان سه‌ستونی: کنترل | اسیلوسکوپ + مانیتور سریال | تحلیل زنده
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { ACOUSTIC_MATERIALS, getMaterial } from '@/sensors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useLabSensor } from '@/hooks/use-lab-sensor';
import { cn } from '@/lib/utils';
import Oscilloscope from './Oscilloscope';

const PANEL = 'rounded-xl border border-zinc-800 bg-zinc-900/70 p-4';

/** رنگ بج وضعیت دوقلو بر اساس ماشین‌حالت */
const STATE_STYLES: Record<string, string> = {
  IDLE: 'border-zinc-700 bg-zinc-950 text-zinc-400',
  ARMED: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  PUMP: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  BURST: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  LISTEN: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  COOLDOWN: 'border-zinc-700 bg-zinc-950 text-zinc-400',
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

/** یک ردیف اسلایدر: برچسب + مقدار فعلی مونو */
function SliderRow({ label, value, min, max, step, onChange }: SliderRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="font-mono tabular-nums text-xs text-emerald-300">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vs) => onChange(vs[0] ?? value)}
      />
    </div>
  );
}

interface AnalyzeRowProps {
  label: string;
  value: string;
  valueClass?: string;
}

/** یک ردیف تحلیل: برچسب کوچک + مقدار مونو */
function AnalyzeRow({ label, value, valueClass }: AnalyzeRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className={cn('font-mono tabular-nums text-zinc-200', valueClass)}>{value}</span>
    </div>
  );
}

/** رنگ خطا بر اساس بزرگی قدرمطلق */
function errorClass(absErr: number): string {
  if (absErr < 0.5) return 'text-emerald-300';
  if (absErr < 2) return 'text-amber-300';
  return 'text-red-400';
}

export default function LabView() {
  const {
    twin,
    state,
    setTarget,
    setEnv,
    setAutoRun,
    setCycleMs,
    triggerPulse,
    clearLog,
    pauseEdges,
    edges,
    readings,
    lastReading,
    speed,
    beamGain,
    absorption,
  } = useLabSensor();

  const currentMaterial = getMaterial(state.target.materialId);
  const measured = lastReading?.distanceCm ?? null;
  const errorCm = measured !== null ? measured - state.target.distanceCm : null;

  const lastWidthUs = lastReading ? Math.round(lastReading.widthUs) : 0;
  const lastDatasheetCm = lastReading?.datasheetCm != null ? lastReading.datasheetCm.toFixed(1) : '0.0';

  return (
    <div dir="rtl" className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr_300px]">
      {/* ─────────── ستون ۱: کنترل ─────────── */}
      <div className={cn(PANEL, 'space-y-4')}>
        <div className="text-sm font-bold text-zinc-200">کنترل</div>

        <Button
          onClick={triggerPulse}
          className="h-11 w-full bg-amber-500 text-sm font-bold text-zinc-950 hover:bg-amber-400"
        >
          ⚡ پالس Trig (۱۰µs)
        </Button>

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">اجرای خودکار</span>
          <Switch checked={state.autoRun} onCheckedChange={setAutoRun} />
        </div>

        <SliderRow
          label="سایکل خودکار (ms)"
          value={state.cycleMs}
          min={60}
          max={1000}
          step={10}
          onChange={setCycleMs}
        />

        <Separator className="bg-zinc-800" />

        <div className="space-y-3">
          <div className="text-sm font-bold text-zinc-200">هدف</div>
          <SliderRow
            label="فاصله‌ی هدف (cm)"
            value={state.target.distanceCm}
            min={2}
            max={500}
            step={1}
            onChange={(v) => setTarget({ distanceCm: v })}
          />
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">متریال هدف</Label>
            <Select
              value={state.target.materialId}
              onValueChange={(v) => setTarget({ materialId: v })}
            >
              <SelectTrigger className="w-full border-zinc-800 bg-zinc-950">
                <SelectValue>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: currentMaterial.color }}
                    />
                    {currentMaterial.labelFa}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-950">
                {ACOUSTIC_MATERIALS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                      {m.labelFa}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SliderRow
            label="زاویه‌ی هدف (°) — بزرگ: بازتاب آینه‌ای"
            value={state.target.angleDeg}
            min={0}
            max={60}
            step={1}
            onChange={(v) => setTarget({ angleDeg: v })}
          />
        </div>

        <Separator className="bg-zinc-800" />

        <div className="space-y-3">
          <div className="text-sm font-bold text-zinc-200">محیط</div>
          <SliderRow
            label="دما (°C)"
            value={state.env.temperatureC}
            min={-10}
            max={50}
            step={0.5}
            onChange={(v) => setEnv({ temperatureC: v })}
          />
          <SliderRow
            label="رطوبت (%)"
            value={state.env.humidityPct}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setEnv({ humidityPct: v })}
          />
        </div>

        <Separator className="bg-zinc-800" />

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={pauseEdges}
            className="border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            فریم اسکوپ
          </Button>
          <Button
            variant="outline"
            onClick={clearLog}
            className="border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            پاک کردن
          </Button>
        </div>
      </div>

      {/* ─────────── ستون ۲: اسیلوسکوپ + مانیتور سریال ─────────── */}
      <div className="space-y-4">
        <div className={PANEL}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold text-zinc-200">اسیلوسکوپ دیجیتال — Trig / Echo</div>
            <Badge
              variant="outline"
              className={cn('font-mono text-[10px]', STATE_STYLES[twin.state] ?? STATE_STYLES.IDLE)}
            >
              {twin.stateFa}
            </Badge>
          </div>
          <Oscilloscope edges={edges} stateFa={twin.stateFa} />
        </div>

        <div className={PANEL}>
          <div className="mb-2 text-sm font-bold text-zinc-200">مانیتور سریال</div>
          <div
            dir="ltr"
            className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-zinc-950 p-3 text-left font-mono text-xs"
          >
            {readings.length === 0 ? (
              <div className="text-zinc-600">{'// منتظر اولین اندازه‌گیری…'}</div>
            ) : (
              readings.map((r) => (
                <div
                  key={r.index}
                  className={cn(
                    'border-l-2 py-0.5 pl-2',
                    r.outOfRange ? 'border-l-red-400 text-red-400' : 'border-l-emerald-400 text-emerald-300',
                  )}
                >
                  {r.outOfRange
                    ? `#${r.index}  ✖ خارج از رنج (پالس ${Math.round(r.widthUs)}µs)`
                    : `#${r.index}  ➜  ${r.distanceCm?.toFixed(2) ?? '—'} cm   (width ${Math.round(r.widthUs)} µs)`}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─────────── ستون ۳: تحلیل زنده ─────────── */}
      <div className="space-y-4">
        <div className={PANEL}>
          <div className="text-sm font-bold text-zinc-200">فاصله‌ی اندازه‌گیری‌شده</div>
          <div dir="ltr" className="mt-2 flex items-baseline gap-2 text-left">
            <span className="font-mono text-4xl tabular-nums text-emerald-300">
              {measured !== null ? measured.toFixed(2) : '—'}
            </span>
            <span className="text-sm text-zinc-400">cm</span>
          </div>
          <div className="mt-1 font-mono text-xs tabular-nums text-zinc-500">
            دیتاشیت (÷58): {lastReading?.datasheetCm != null ? lastReading.datasheetCm.toFixed(1) : '—'} cm
          </div>
          {lastReading?.outOfRange && (
            <Badge variant="outline" className="mt-2 border-red-500/40 bg-red-500/10 text-red-400">
              خارج از رنج — پالس ۳۸ms
            </Badge>
          )}
        </div>

        <div className={cn(PANEL, 'space-y-2')}>
          <div className="text-sm font-bold text-zinc-200">تفکیک خطا</div>
          <AnalyzeRow label="فاصله‌ی واقعی هدف" value={`${state.target.distanceCm} cm`} />
          <AnalyzeRow
            label="اندازه‌گیری‌شده"
            value={measured !== null ? `${measured.toFixed(2)} cm` : '—'}
          />
          <AnalyzeRow
            label="خطا (اندازه‌گیری − هدف)"
            value={
              errorCm !== null
                ? `${errorCm >= 0 ? '+' : ''}${errorCm.toFixed(2)} cm`
                : '—'
            }
            valueClass={errorCm !== null ? errorClass(Math.abs(errorCm)) : 'text-zinc-500'}
          />
          <Separator className="bg-zinc-800" />
          <AnalyzeRow label="سرعت صوت" value={`${speed.toFixed(1)} m/s`} />
          <AnalyzeRow label="جذب هوا" value={`${absorption.toFixed(2)} dB/m`} />
          <AnalyzeRow label="بهره‌ی پرتو" value={beamGain.toFixed(2)} />
          <AnalyzeRow
            label="متریال تشخیص‌داده‌شده"
            value={lastReading?.detectedMaterialId ? getMaterial(lastReading.detectedMaterialId).labelFa : '—'}
          />
        </div>

        <div className={PANEL}>
          <div className="text-sm font-bold text-zinc-200">فرمول مجازی آردوینو</div>
          <pre
            dir="ltr"
            className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-5 text-zinc-300"
          >
            {`digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);
long d = pulseIn(ECHO, HIGH, 40000);
float cm = d / 58.0;
// last: d = ${lastWidthUs} µs  →  cm = ${lastDatasheetCm}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
