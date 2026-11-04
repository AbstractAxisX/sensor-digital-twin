'use client';

/**
 * دیالوگ‌های ذخیره / بارگذاری صحنه (API + Prisma)
 */

import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Save, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSimStore } from '@/lib/sim/store';
import { useToast } from '@/hooks/use-toast';
import type { SceneSnapshot } from '@/lib/sim/store';

interface SceneMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function SceneDialogs({
  open,
  mode,
  onClose,
}: {
  open: boolean;
  mode: 'save' | 'load';
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('صحنه‌ی من');
  const [busy, setBusy] = useState(false);
  const [scenes, setScenes] = useState<SceneMeta[]>([]);
  const [loading, setLoading] = useState(false);

  const listScenes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scenes');
      const json = await res.json();
      setScenes(json.scenes ?? []);
    } catch {
      toast({ title: 'خطا در دریافت صحنه‌ها', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open && mode === 'load') void listScenes();
  }, [open, mode, listScenes]);

  const save = async () => {
    setBusy(true);
    try {
      const snapshot: SceneSnapshot = useSimStore.getState().getSnapshot();
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: JSON.stringify(snapshot) }),
      });
      if (!res.ok) throw new Error('save failed');
      toast({ title: 'صحنه ذخیره شد ✅', description: `«${name}» در سرور ذخیره شد.` });
      onClose();
    } catch {
      toast({ title: 'ذخیره ناموفق بود', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const load = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/scenes/${id}`);
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      const snapshot = JSON.parse(json.scene.data as string) as SceneSnapshot;
      useSimStore.getState().loadSnapshot(snapshot);
      toast({ title: 'صحنه بارگذاری شد ✅' });
      onClose();
    } catch {
      toast({ title: 'بارگذاری ناموفق بود', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/scenes/${id}`, { method: 'DELETE' });
      setScenes((s) => s.filter((x) => x.id !== id));
      toast({ title: 'صحنه حذف شد' });
    } catch {
      toast({ title: 'حذف ناموفق بود', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md" dir="rtl">
        {mode === 'save' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Save className="h-4 w-4 text-emerald-400" /> ذخیره‌ی صحنه
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                همه‌ی اشیاء، سنسورها، محیط و اندازه‌گیری‌ها ذخیره می‌شود.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              <Label htmlFor="scene-name" className="text-xs text-zinc-400">
                نام صحنه
              </Label>
              <Input
                id="scene-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 border-zinc-800 bg-zinc-900"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400">
                انصراف
              </Button>
              <Button onClick={save} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-4 w-4 text-emerald-400" /> صحنه‌های ذخیره‌شده
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                یک صحنه را برای بارگذاری انتخاب کنید.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-72 min-h-24 overflow-y-auto rounded-lg border border-zinc-800">
              {loading ? (
                <div className="flex items-center justify-center p-6 text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : scenes.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">هنوز صحنه‌ای ذخیره نشده است.</div>
              ) : (
                <ul className="divide-y divide-zinc-800/70">
                  {scenes.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-zinc-900/60">
                      <button className="min-w-0 flex-1 text-right" onClick={() => load(s.id)} disabled={busy}>
                        <div className="truncate text-xs font-bold text-zinc-200">{s.name}</div>
                        <div className="text-[10px] text-zinc-500" dir="ltr">
                          {new Date(s.updatedAt).toLocaleString('fa-IR')}
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => remove(s.id)}
                        aria-label={`حذف ${s.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400">
                بستن
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
