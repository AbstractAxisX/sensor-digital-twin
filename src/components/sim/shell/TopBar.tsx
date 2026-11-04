'use client';

/**
 * نوار بالا — برند، سوییچ فضای کاری، عملیات صحنه + راهنما
 */

import { useState } from 'react';
import { Radar, Save, FolderOpen, FilePlus2, CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSimStore } from '@/lib/sim/store';

export type WorkspaceTab = 'viewport' | 'lab';

interface Props {
  tab: WorkspaceTab;
  onTabChange: (t: WorkspaceTab) => void;
  onSave: () => void;
  onScenes: () => void;
}

const GUIDE_SECTIONS: Array<{ title: string; items: string[] }> = [
  {
    title: '🎬 محیط سه‌بعدی',
    items: [
      'چرخش دوربین: درگ ماوس — زوم: اسکرول — جابجایی: درگ راست',
      'افزودن سنسور/شیء: از نوار ابزار انتخاب کنید و یک «کلیک تمیز» روی زمین بزنید (درگِ چرخش دوربین شیء نمی‌گذارد)',
      'انتخاب: کلیک روی شیء یا سنسور — دابل‌کلیک روی سنسور = زوم',
      'جابجایی/چرخش/مقیاس: ابزار را انتخاب کنید و از دستگیره‌ها بکشید',
      'کلید F = فوکوس دوربین روی انتخاب فعلی',
    ],
  },
  {
    title: '📡 کنترل سنسور در صحنه',
    items: [
      'بعد از انتخاب سنسور، نوار کنترل پایین ظاهر می‌شود: Trig دستی، فوکوس، اجرای خودکار',
      'پنل مشخصات (راست): موقعیت، جهت‌گیری، سایکل، ریست دوقلو و حذف',
      'کون سبز = مسیر امواج اولتراسونیک و فاصله‌ی لحظه‌ای هدف',
      'قرمز شدن کون/OUT = هیچ اکویی برنگشته (خارج از رنج ۴ متر)',
    ],
  },
  {
    title: '📏 متر لیزری',
    items: [
      'ابزار «متر لیزری» را بردارید و روی دو نقطه کلیک کنید',
      'کلیک روی اجسام = نقطه‌ی دقیق سه‌بعدی روی سطح',
      'نتیجه: فاصله‌ی مستقیم + تفکیک ΔX/ΔY/ΔZ در پنل کنار',
    ],
  },
  {
    title: '🔬 آزمایشگاه سنسور',
    items: [
      'هدف مجازی: فاصله، متریال و زاویه را عوض کنید و پاسخ مدار را ببینید',
      'اسیلوسکوپ: زرد = Trig، سبز = Echo، قرمز = timeout ۳۸ms',
      '«فریم اسکوپ» نمایش را منجمد می‌کند — دوباره بزنید تا ادامه یابد',
      'بایندزون ۲cm، حداکثر ~۴m، زاویه بالای ۳۰° اکو نمی‌دهد — همه واقعی‌اند',
    ],
  },
];

export function TopBar({ tab, onTabChange, onSave, onScenes }: Props) {
  const resetScene = useSimStore((s) => s.resetScene);
  const [helpOpen, setHelpOpen] = useState(false);

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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-400 hover:text-emerald-300"
          onClick={() => setHelpOpen(true)}
          aria-label="راهنما"
          title="راهنمای استفاده"
        >
          <CircleHelp className="h-4 w-4" />
        </Button>
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

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base">راهنمای سریع WaveLab</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              همه‌چیز درباره‌ی کنترل صحنه، سنسور و آزمایشگاه
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pb-2">
            {GUIDE_SECTIONS.map((sec) => (
              <section key={sec.title}>
                <h4 className="mb-1.5 text-xs font-bold text-emerald-300">{sec.title}</h4>
                <ul className="flex flex-col gap-1">
                  {sec.items.map((it) => (
                    <li key={it} className="flex gap-1.5 text-[11px] leading-5 text-zinc-400">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
