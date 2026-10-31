'use client';

/**
 * WaveLab Studio — استودیوی شبیه‌سازی فیزیکی سنسورها
 * موتور: Three.js + React Three Fiber + Rapier Physics + دوقلوی دیجیتال HC-SR04
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { SlidersHorizontal, X } from 'lucide-react';
import { TopBar, type WorkspaceTab } from '@/components/sim/shell/TopBar';
import { Toolbar } from '@/components/sim/shell/Toolbar';
import { Inspector } from '@/components/sim/shell/Inspector';
import { StatusBar } from '@/components/sim/shell/StatusBar';
import { SceneDialogs } from '@/components/sim/shell/SceneDialogs';
import { Button } from '@/components/ui/button';

const ViewportCanvas = dynamic(
  () => import('@/components/sim/viewport/ViewportCanvas').then((m) => m.ViewportCanvas),
  { ssr: false, loading: () => <ViewportSkeleton /> },
);
const LabView = dynamic(() => import('@/components/sim/lab/LabView'), {
  ssr: false,
  loading: () => <ViewportSkeleton />,
});

function ViewportSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
        <span className="text-xs">در حال راه‌اندازی موتور فیزیک…</span>
      </div>
    </div>
  );
}

export default function Page() {
  const [tab, setTab] = useState<WorkspaceTab>('viewport');
  const [dialog, setDialog] = useState<'save' | 'load' | null>(null);
  const [mobileInspector, setMobileInspector] = useState(false);

  return (
    <div dir="rtl" className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <TopBar tab={tab} onTabChange={setTab} onSave={() => setDialog('save')} onScenes={() => setDialog('load')} />

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <Toolbar />

        <main className="relative min-h-0 min-w-0 flex-1">
          {/* هر دو فضا مونتاز می‌مانند تا Canvas هنگام سوییچ unmount همگام نشود؛
              تب غیرفعال با frameloop=never متوقف است */}
          <div className={tab === 'viewport' ? 'absolute inset-0' : 'hidden'}>
            <ViewportCanvas active={tab === 'viewport'} />
          </div>
          <div className={tab === 'lab' ? 'absolute inset-0 overflow-y-auto bg-zinc-950 p-3 md:p-4' : 'hidden'}>
            <LabView />
          </div>
        </main>

        {/* اینسپکتور دسکتاپ */}
        <div className="hidden w-[300px] shrink-0 border-r border-zinc-800 bg-zinc-950/95 lg:block">
          <Inspector />
        </div>

        {/* دکمه‌ی اینسپکتور موبایل */}
        <Button
          size="icon"
          onClick={() => setMobileInspector((v) => !v)}
          aria-label="پنل مشخصات"
          className="absolute bottom-12 left-3 z-40 h-10 w-10 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-500 lg:hidden"
        >
          {mobileInspector ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
        </Button>

        {/* اینسپکتور موبایل */}
        {mobileInspector && (
          <div className="absolute inset-y-0 right-0 z-30 w-[300px] max-w-[85vw] overflow-hidden border-l border-zinc-800 bg-zinc-950/98 shadow-2xl backdrop-blur lg:hidden">
            <div className="flex h-10 items-center justify-between border-b border-zinc-800 px-3 text-xs font-bold text-zinc-300">
              پنل مشخصات
              <button onClick={() => setMobileInspector(false)} aria-label="بستن" className="text-zinc-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(100%-2.5rem)]">
              <Inspector />
            </div>
          </div>
        )}
      </div>

      <StatusBar />

      <SceneDialogs open={dialog !== null} mode={dialog ?? 'save'} onClose={() => setDialog(null)} />
    </div>
  );
}
