'use client';

/**
 * نوار بالا — برند، سوییچ فضای کاری، عملیات صحنه
 */

import { Radar, Save, FolderOpen, FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimStore } from '@/lib/sim/store';

export type WorkspaceTab = 'viewport' | 'lab';

interface Props {
  tab: WorkspaceTab;
  onTabChange: (t: WorkspaceTab) => void;
  onSave: () => void;
  onScenes: () => void;
}

export function TopBar({ tab, onTabChange, onSave, onScenes }: Props) {
  const resetScene = useSimStore((s) => s.resetScene);

  const tabBtn = (active: boolean) =>
    `rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
      active ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
    }`;

  return (
    <header className="z-30 flex h-13 min-h-13 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/95 px-3 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <Radar className="h-4.5 w-4.5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-black tracking-tight text-zinc-100">
            WaveLab <span className="text-emerald-400">Studio</span>
          </div>
          <div className="hidden text-[10px] text-zinc-500 sm:block">موتور شبیه‌سازی فیزیکی سنسورها</div>
        </div>
      </div>

      <nav className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1" aria-label="فضای کاری">
        <button className={tabBtn(tab === 'viewport')} onClick={() => onTabChange('viewport')}>
          محیط سه‌بعدی
        </button>
        <button className={tabBtn(tab === 'lab')} onClick={() => onTabChange('lab')}>
          آزمایشگاه سنسور
        </button>
      </nav>

      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-zinc-400 hover:text-zinc-100" onClick={() => resetScene()} title="صحنه‌ی نمونه">
          <FilePlus2 className="h-3.5 w-3.5" />
          <span className="hidden md:inline">صحنه‌ی نمونه</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-zinc-400 hover:text-zinc-100" onClick={onScenes}>
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="hidden md:inline">صحنه‌ها</span>
        </Button>
        <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500" onClick={onSave}>
          <Save className="h-3.5 w-3.5" />
          <span className="hidden md:inline">ذخیره صحنه</span>
        </Button>
      </div>
    </header>
  );
}
