'use client';

/**
 * تولبار ابزارها — ستون عمودی (دسکتاپ) / نوار افقی (موبایل)
 */

import {
  MousePointer2,
  Move,
  RotateCw,
  Scale,
  Ruler,
  Square,
  BrickWall,
  Box,
  Circle,
  Cylinder,
  Radar,
  Trash2,
  Grid3x3,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSimStore, type ToolId } from '@/lib/sim/store';
import { Button } from '@/components/ui/button';

const TOOLS: Array<{ id: ToolId; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'select', label: 'انتخاب', hint: 'V', icon: MousePointer2 },
  { id: 'move', label: 'جابجایی', hint: 'G', icon: Move },
  { id: 'rotate', label: 'چرخش', hint: 'R', icon: RotateCw },
  { id: 'scale', label: 'مقیاس', hint: 'T', icon: Scale },
  { id: 'measure', label: 'متر لیزری', hint: 'M', icon: Ruler },
  { id: 'plan', label: 'افزودن پلن', hint: 'با کلیک روی زمین', icon: Square },
  { id: 'wall', label: 'افزودن دیوار', hint: 'با کلیک روی زمین', icon: BrickWall },
  { id: 'box', label: 'افزودن جعبه', hint: 'با کلیک روی زمین', icon: Box },
  { id: 'sphere', label: 'افزودن گوی', hint: 'با کلیک روی زمین', icon: Circle },
  { id: 'cylinder', label: 'افزودن استوانه', hint: 'با کلیک روی زمین', icon: Cylinder },
  { id: 'addSensor', label: 'افزودن HC-SR04', hint: 'با کلیک روی زمین', icon: Radar },
];

export function Toolbar() {
  const tool = useSimStore((s) => s.tool);
  const setTool = useSimStore((s) => s.setTool);
  const gridVisible = useSimStore((s) => s.gridVisible);
  const toggleGrid = useSimStore((s) => s.toggleGrid);
  const selectedId = useSimStore((s) => s.selectedId);

  const removeSelected = () => {
    const st = useSimStore.getState();
    if (st.selectedId && st.selectedId !== 'ground') st.removeObject(st.selectedId);
  };

  return (
    <TooltipProvider delayDuration={250}>
      <div className="z-20 flex shrink-0 flex-row items-center gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950/95 px-2 py-1.5 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-l lg:px-1.5 lg:py-2">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = tool === t.id;
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setTool(t.id)}
                  aria-label={t.label}
                  aria-pressed={active}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    active
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-transparent text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="lg:side-left">
                <span className="text-xs">
                  {t.label} <span className="font-mono text-[10px] text-zinc-400">{t.hint}</span>
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}

        <div className="mx-1 h-6 w-px shrink-0 bg-zinc-800 lg:my-1 lg:h-px lg:w-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleGrid}
              aria-label="گرید متریک"
              aria-pressed={gridVisible}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                gridVisible
                  ? 'border-zinc-700 bg-zinc-800/80 text-zinc-200'
                  : 'border-transparent text-zinc-500 hover:bg-zinc-800/70'
              }`}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="lg:side-left">
            <span className="text-xs">گرید متریک (سلول = ۱ متر)</span>
          </TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="icon"
          onClick={removeSelected}
          disabled={!selectedId || selectedId === 'ground'}
          aria-label="حذف انتخاب‌شده"
          className="h-9 w-9 shrink-0 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </TooltipProvider>
  );
}
