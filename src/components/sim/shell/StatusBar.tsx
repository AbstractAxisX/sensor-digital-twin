'use client';

/**
 * نوار وضعیت پایین — چسبیده به کف (Sticky Footer)
 */

import { useEffect, useState } from 'react';
import { Activity, Box, Radar, Ruler, MousePointer2 } from 'lucide-react';
import { useSimStore, type ToolId } from '@/lib/sim/store';
import { sensorRuntime } from '@/lib/sim/runtime';

const TOOL_FA: Partial<Record<ToolId, string>> = {
  select: 'انتخاب',
  move: 'جابجایی',
  rotate: 'چرخش',
  scale: 'مقیاس',
  measure: 'متر لیزری — دو نقطه کلیک کنید',
  plan: 'کلیک روی زمین = قرار دادن پلن',
  wall: 'کلیک روی زمین = قرار دادن دیوار',
  box: 'کلیک روی زمین = قرار دادن جعبه',
  sphere: 'کلیک روی زمین = قرار دادن گوی',
  cylinder: 'کلیک روی زمین = قرار دادن استوانه',
  addSensor: 'کلیک روی زمین = قرار دادن HC-SR04',
};

export function StatusBar() {
  const fps = useSimStore((s) => s.fps);
  const tool = useSimStore((s) => s.tool);
  const objectCount = useSimStore((s) => s.objectOrder.length);
  const sensorCount = useSimStore((s) => s.sensorOrder.length);
  const measurementCount = useSimStore((s) => s.measurements.length);
  const selectedId = useSimStore((s) => s.selectedId);
  const [coords, setCoords] = useState<string>('');

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!selectedId) {
        setCoords('');
        return;
      }
      const st = useSimStore.getState();
      const o = st.objects[selectedId];
      const s = st.sensors[selectedId];
      const p = o?.position ?? s?.position;
      if (p) setCoords(`X ${p[0].toFixed(2)} · Y ${p[1].toFixed(2)} · Z ${p[2].toFixed(2)} m`);
    }, 250);
    return () => window.clearInterval(id);
  }, [selectedId]);

  return (
    <footer className="z-30 mt-auto flex h-8 shrink-0 items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950/95 px-3 text-[10.5px] text-zinc-500 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex items-center gap-1 text-emerald-400">
          <Activity className="h-3 w-3" />
          <span className="font-mono">{fps} FPS</span>
        </span>
        <span className="hidden items-center gap-1 sm:flex">
          <Box className="h-3 w-3" /> {objectCount} شیء
        </span>
        <span className="flex items-center gap-1">
          <Radar className="h-3 w-3" /> {sensorCount} سنسور
        </span>
        <span className="hidden items-center gap-1 md:flex">
          <Ruler className="h-3 w-3" /> {measurementCount} اندازه‌گیری
        </span>
        {coords && <span className="hidden font-mono text-zinc-400 lg:inline">{coords}</span>}
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <MousePointer2 className="h-3 w-3 shrink-0 text-zinc-600" />
        <span className="truncate">{TOOL_FA[tool] ?? ''}</span>
        <span className="mx-1 hidden text-zinc-700 md:inline">|</span>
        <span className="hidden text-zinc-600 md:inline">WaveLab Engine v1.0 · Three.js + Rapier + HC-SR04 Twin</span>
      </div>
    </footer>
  );
}
