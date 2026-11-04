'use client';

/**
 * اینسپکتور — پنل راست: مشخصات انتخاب، محیط، میان‌برها
 */

import { useEffect, useState } from 'react';
import { Crosshair, Thermometer, Droplets, Box, Radar, Keyboard, Trash2, Zap, RotateCcw, Ghost } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useSimStore } from '@/lib/sim/store';
import { ACOUSTIC_MATERIALS, getMaterial } from '@/sensors/core/materials';
import { sensorRuntime } from '@/lib/sim/runtime';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2.5 text-xs font-bold text-zinc-300">{children}</h3>;
}

function NumField({
  label,
  value,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] font-normal text-zinc-500">{label}</Label>
      <Input
        dir="ltr"
        type="number"
        step={step}
        value={Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="h-7 rounded-md border-zinc-800 bg-zinc-900 px-2 font-mono text-xs text-zinc-200"
      />
    </div>
  );
}

/* ── پنل شیء انتخاب‌شده ── */
function ObjectPanel({ id }: { id: string }) {
  const obj = useSimStore((s) => s.objects[id]);
  if (!obj) return null;
  const mat = getMaterial(obj.materialId);
  const degY = (obj.rotation[1] * 180) / Math.PI;

  return (
    <div>
      <SectionTitle>
        <Box className="mb-0.5 inline h-3.5 w-3.5 text-emerald-400" /> مشخصات شیء
      </SectionTitle>
      <div className="flex flex-col gap-3">
        <div>
          <Label className="mb-1 text-[10px] text-zinc-500">نام</Label>
          <Input
            value={obj.name}
            onChange={(e) => useSimStore.getState().updateObject(id, { name: e.target.value })}
            className="h-7 rounded-md border-zinc-800 bg-zinc-900 text-xs"
          />
        </div>

        <div>
          <Label className="mb-1 text-[10px] text-zinc-500">متریال آکوستیک</Label>
          <Select value={obj.materialId} onValueChange={(v) => useSimStore.getState().updateObject(id, { materialId: v })}>
            <SelectTrigger className="h-8 rounded-md border-zinc-800 bg-zinc-900 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACOUSTIC_MATERIALS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                    {m.labelFa}
                    <span className="font-mono text-[10px] text-zinc-500">α={m.acoustic.toFixed(2)}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1 text-[10px] text-zinc-500">موقعیت (متر)</Label>
          <div className="grid grid-cols-3 gap-1.5">
            <NumField label="X" value={obj.position[0]} onChange={(v) => useSimStore.getState().updateObject(id, { position: [v, obj.position[1], obj.position[2]] })} />
            <NumField label="Y" value={obj.position[1]} onChange={(v) => useSimStore.getState().updateObject(id, { position: [obj.position[0], v, obj.position[2]] })} />
            <NumField label="Z" value={obj.position[2]} onChange={(v) => useSimStore.getState().updateObject(id, { position: [obj.position[0], obj.position[1], v] })} />
          </div>
        </div>

        <div>
          <Label className="mb-1 text-[10px] text-zinc-500">چرخش حول Y (درجه)</Label>
          <Input
            dir="ltr"
            type="number"
            step={5}
            value={Math.round(degY)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) {
                useSimStore.getState().updateObject(id, { rotation: [obj.rotation[0], (v * Math.PI) / 180, obj.rotation[2]] });
              }
            }}
            className="h-7 rounded-md border-zinc-800 bg-zinc-900 px-2 font-mono text-xs"
          />
        </div>

        <div>
          <Label className="mb-1 text-[10px] text-zinc-500">ابعاد (متر)</Label>
          <div className="grid grid-cols-3 gap-1.5">
            <NumField label="طول X" value={obj.scale[0]} onChange={(v) => useSimStore.getState().updateObject(id, { scale: [Math.max(0.02, v), obj.scale[1], obj.scale[2]] })} />
            <NumField label="ارتفاع Y" value={obj.scale[1]} onChange={(v) => useSimStore.getState().updateObject(id, { scale: [obj.scale[0], Math.max(0.02, v), obj.scale[2]] })} />
            <NumField label="عمق Z" value={obj.scale[2]} onChange={(v) => useSimStore.getState().updateObject(id, { scale: [obj.scale[0], obj.scale[1], Math.max(0.02, v)] })} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs text-zinc-300">فیزیک دینامیک (جاذبه)</Label>
          <Switch
            checked={obj.dynamic}
            disabled={obj.id === 'ground'}
            onCheckedChange={(v) => useSimStore.getState().updateObject(id, { dynamic: v })}
          />
        </div>

        {obj.id !== 'ground' && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => useSimStore.getState().removeObject(id)}
          >
            <Trash2 className="h-3.5 w-3.5" /> حذف شیء
          </Button>
        )}
        <p className="text-[10px] leading-4 text-zinc-500">
          بازتاب صوت این متریال: <span className="font-mono text-zinc-400">{mat.acoustic.toFixed(2)}</span> — سنسورهای اولتراسونیک از سطوح سخت و صاف اکوی قوی می‌گیرند.
        </p>
      </div>
    </div>
  );
}

/* ── پنل سنسور انتخاب‌شده ── */
function SensorPanel({ id }: { id: string }) {
  const sensor = useSimStore((s) => s.sensors[id]);
  const [live, setLive] = useState<{ cm: number | null; out: boolean; state: string; material: string | null; trueCm: number | null }>({
    cm: null,
    out: false,
    state: '',
    material: null,
    trueCm: null,
  });

  useEffect(() => {
    const t = window.setInterval(() => {
      const twin = sensorRuntime.getTwin(id);
      const r = twin?.lastReading;
      setLive({
        cm: r?.outOfRange ? null : (r?.distanceCm ?? null),
        out: r?.outOfRange ?? false,
        state: twin?.stateFa ?? '',
        material: r?.detectedMaterialId ?? null,
        trueCm: r?.trueCm ?? null,
      });
    }, 200);
    return () => window.clearInterval(t);
  }, [id]);

  if (!sensor) return null;
  const degY = Math.round((sensor.rotationY * 180) / Math.PI);

  return (
    <div>
      <SectionTitle>
        <Radar className="mb-0.5 inline h-3.5 w-3.5 text-emerald-400" /> سنسور HC-SR04
      </SectionTitle>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-2.5 text-center">
          <div className={`font-mono text-2xl font-bold ${live.out ? 'text-red-400' : 'text-emerald-300'}`} dir="ltr">
            {live.out ? 'OUT' : live.cm != null ? `${live.cm.toFixed(1)}` : '---'}
          </div>
          <div className="text-[10px] text-zinc-500">
            سانتی‌متر · وضعیت: {live.state} {live.material ? `· ${getMaterial(live.material).labelFa}` : ''}
          </div>
          {live.cm != null && live.trueCm != null && (
            <div className="mt-1 font-mono text-[10px] text-zinc-500" dir="ltr">
              true: {live.trueCm.toFixed(1)} cm · err: {(live.cm - live.trueCm >= 0 ? '+' : '') + (live.cm - live.trueCm).toFixed(2)} cm
            </div>
          )}
        </div>

        {/* ── کنترل‌های سنسور ── */}
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            className="h-9 gap-1 bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400"
            onClick={() => sensorRuntime.manualTrigger(id)}
            title="ارسال پالس ۱۰µs روی پین Trig"
          >
            <Zap className="h-3.5 w-3.5" /> پالس Trig
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800"
            onClick={() => useSimStore.getState().requestFocus(id)}
            title="نزدیک شدن دوربین (کلید F)"
          >
            <Crosshair className="h-3.5 w-3.5" /> فوکوس دوربین
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1 border-zinc-700 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={() => sensorRuntime.getTwin(id)?.reset()}
            title="پاک کردن تاریخچه و ماشین‌حالت"
          >
            <RotateCcw className="h-3.5 w-3.5" /> ریست دوقلو
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1 border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => useSimStore.getState().removeSensor(id)}
          >
            <Trash2 className="h-3.5 w-3.5" /> حذف
          </Button>
        </div>

        <div>
          <Label className="mb-1 text-[10px] text-zinc-500">نام</Label>
          <Input
            value={sensor.name}
            onChange={(e) => useSimStore.getState().updateSensor(id, { name: e.target.value })}
            className="h-7 rounded-md border-zinc-800 bg-zinc-900 text-xs"
          />
        </div>

        <div>
          <Label className="mb-1 text-[10px] text-zinc-500">موقعیت (متر)</Label>
          <div className="grid grid-cols-3 gap-1.5">
            <NumField label="X" value={sensor.position[0]} onChange={(v) => useSimStore.getState().updateSensor(id, { position: [v, sensor.position[1], sensor.position[2]] })} />
            <NumField label="Y (ارتفاع)" value={sensor.position[1]} onChange={(v) => useSimStore.getState().updateSensor(id, { position: [sensor.position[0], Math.max(0.02, v), sensor.position[2]] })} />
            <NumField label="Z" value={sensor.position[2]} onChange={(v) => useSimStore.getState().updateSensor(id, { position: [sensor.position[0], sensor.position[1], v] })} />
          </div>
        </div>

        <div>
          <Label className="mb-1 text-[10px] text-zinc-500">جهت‌گیری (درجه)</Label>
          <Input
            dir="ltr"
            type="number"
            step={5}
            value={degY}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) useSimStore.getState().updateSensor(id, { rotationY: (v * Math.PI) / 180 });
            }}
            className="h-7 rounded-md border-zinc-800 bg-zinc-900 px-2 font-mono text-xs"
          />
          <p className="mt-1 text-[10px] text-zinc-500">۰° رو به +Z · ۱۸۰° رو به −Z — کون دید ±۱۵°</p>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs text-zinc-300">اندازه‌گیری خودکار</Label>
          <Switch checked={sensor.autoRun} onCheckedChange={(v) => useSimStore.getState().updateSensor(id, { autoRun: v })} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-[10px] text-zinc-500">سایکل اندازه‌گیری</Label>
            <span className="font-mono text-[10px] text-emerald-300">{sensor.cycleMs}ms</span>
          </div>
          <Slider
            value={[sensor.cycleMs]}
            min={60}
            max={600}
            step={10}
            onValueChange={([v]) => useSimStore.getState().updateSensor(id, { cycleMs: v })}
          />
          <p className="mt-1 text-[10px] text-zinc-500">دیتاشیت: حداقل ۶۰ms بین دو Trig</p>
        </div>
      </div>
    </div>
  );
}

/* ── پنل محیط (وقتی انتخابی نیست) ── */
function EnvironmentPanel() {
  const env = useSimStore((s) => s.env);
  const setEnv = useSimStore((s) => s.setEnv);
  const phantomEchoes = useSimStore((s) => s.phantomEchoes);
  const setPhantomEchoes = useSimStore((s) => s.setPhantomEchoes);
  const objects = useSimStore((s) => s.objectOrder);
  const sensors = useSimStore((s) => s.sensorOrder);
  const measurements = useSimStore((s) => s.measurements);
  const fps = useSimStore((s) => s.fps);

  const v = 331.3 + 0.606 * env.temperatureC + 0.0124 * env.humidityPct;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionTitle>
          <Thermometer className="mb-0.5 inline h-3.5 w-3.5 text-amber-400" /> محیط فیزیکی
        </SectionTitle>
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-[10px] text-zinc-500">دما (سانتی‌گراد)</Label>
              <span className="font-mono text-[10px] text-amber-300">{env.temperatureC.toFixed(1)}°C</span>
            </div>
            <Slider value={[env.temperatureC]} min={-10} max={50} step={0.5} onValueChange={([x]) => setEnv({ temperatureC: x })} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-[10px] text-zinc-500">
                <Droplets className="mb-0.5 inline h-3 w-3" /> رطوبت نسبی
              </Label>
              <span className="font-mono text-[10px] text-amber-300">{Math.round(env.humidityPct)}%</span>
            </div>
            <Slider value={[env.humidityPct]} min={0} max={100} step={1} onValueChange={([x]) => setEnv({ humidityPct: x })} />
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-center" dir="ltr">
            <div className="font-mono text-lg font-bold text-emerald-300">{v.toFixed(1)} m/s</div>
            <div className="text-[10px] text-zinc-500">سرعت صوت در این محیط</div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <Ghost className="h-3.5 w-3.5 text-zinc-400" />
              <div>
                <div className="text-xs text-zinc-200">اکوهای کاذب</div>
                <div className="text-[10px] text-zinc-500">نویز واقعی مدار بدون هدف</div>
              </div>
            </div>
            <Switch checked={phantomEchoes} onCheckedChange={setPhantomEchoes} />
          </div>
          <p className="text-[10px] leading-4 text-zinc-500">
            فرمول: v = 331.3 + 0.606·T + 0.0124·RH — دقت خوانش سنسور مستقیماً به این مقدار وابسته است.
          </p>
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      <div>
        <SectionTitle>آمار صحنه</SectionTitle>
        <div className="grid grid-cols-2 gap-1.5 text-center">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
            <div className="font-mono text-lg text-zinc-100">{objects.length}</div>
            <div className="text-[10px] text-zinc-500">شیء</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
            <div className="font-mono text-lg text-emerald-300">{sensors.length}</div>
            <div className="text-[10px] text-zinc-500">سنسور</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
            <div className="font-mono text-lg text-amber-300">{measurements.length}</div>
            <div className="text-[10px] text-zinc-500">اندازه‌گیری</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
            <div className="font-mono text-lg text-zinc-100">{fps}</div>
            <div className="text-[10px] text-zinc-500">FPS</div>
          </div>
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      <div>
        <SectionTitle>
          <Keyboard className="mb-0.5 inline h-3.5 w-3.5 text-zinc-400" /> میان‌برها
        </SectionTitle>
        <ul className="flex flex-col gap-1 text-[11px] text-zinc-400" dir="ltr">
          {[
            ['V', 'انتخاب'],
            ['G', 'جابجایی'],
            ['R', 'چرخش'],
            ['T', 'مقیاس'],
            ['M', 'متر لیزری'],
            ['F', 'فوکوس دوربین'],
            ['Esc', 'لغو / رد کردن'],
            ['Del', 'حذف انتخاب‌شده'],
          ].map(([k, fa]) => (
            <li key={k} className="flex items-center justify-between rounded bg-zinc-900/60 px-2 py-1">
              <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200">{k}</kbd>
              <span className="text-[10px] text-zinc-500" dir="rtl">
                {fa}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Inspector() {
  const selectedId = useSimStore((s) => s.selectedId);
  const isSensor = useSimStore((s) => (selectedId ? !!s.sensors[selectedId] : false));
  const clearMeasurements = useSimStore((s) => s.clearMeasurements);
  const measurements = useSimStore((s) => s.measurements);

  return (
    <ScrollArea className="h-full">
      <aside className="w-full flex-col gap-4 p-3.5" dir="rtl">
        {selectedId ? (
          isSensor ? (
            <SensorPanel id={selectedId} />
          ) : (
            <ObjectPanel id={selectedId} />
          )
        ) : (
          <EnvironmentPanel />
        )}

        {measurements.length > 0 && (
          <>
            <Separator className="mt-4 bg-zinc-800" />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <SectionTitle>اندازه‌گیری‌ها</SectionTitle>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-zinc-500" onClick={clearMeasurements}>
                  پاک کردن همه
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                {measurements.map((m, i) => {
                  const dx = m.b[0] - m.a[0];
                  const dy = m.b[1] - m.a[1];
                  const dz = m.b[2] - m.a[2];
                  return (
                    <div key={m.id} className="rounded-md bg-zinc-900/70 px-2.5 py-1.5 font-mono text-[11px]" dir="ltr">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">#{i + 1}</span>
                        <span className="text-amber-300">{m.distanceM.toFixed(3)} m</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[9px] text-zinc-600">
                        <span>
                          ΔX {dx.toFixed(2)} · ΔY {dy.toFixed(2)} · ΔZ {dz.toFixed(2)}
                        </span>
                        <span>{(m.distanceM * 100).toFixed(1)} cm</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </aside>
    </ScrollArea>
  );
}
