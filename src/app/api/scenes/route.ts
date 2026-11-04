import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** GET /api/scenes — فهرست صحنه‌های ذخیره‌شده */
export async function GET() {
  try {
    const scenes = await db.scene.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 60,
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ scenes });
  } catch (err) {
    console.error('GET /api/scenes failed', err);
    return NextResponse.json({ error: 'failed_to_list_scenes' }, { status: 500 });
  }
}

/** POST /api/scenes — ذخیره‌ی صحنه‌ی جدید { name, data } */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; data?: string };
    if (!body?.data || typeof body.data !== 'string') {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    const name = (body.name?.trim() || 'صحنه‌ی بی‌نام').slice(0, 80);
    // محدودیت حجم داده (2MB)
    if (body.data.length > 2_000_000) {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    }
    const scene = await db.scene.create({ data: { name, data: body.data } });
    return NextResponse.json({ scene: { id: scene.id, name: scene.name, updatedAt: scene.updatedAt } });
  } catch (err) {
    console.error('POST /api/scenes failed', err);
    return NextResponse.json({ error: 'failed_to_save_scene' }, { status: 500 });
  }
}
