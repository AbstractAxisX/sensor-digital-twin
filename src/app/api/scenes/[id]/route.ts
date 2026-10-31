import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scenes/[id] — دریافت یک صحنه */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const scene = await db.scene.findUnique({ where: { id } });
    if (!scene) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ scene });
  } catch (err) {
    console.error('GET /api/scenes/[id] failed', err);
    return NextResponse.json({ error: 'failed_to_get_scene' }, { status: 500 });
  }
}

/** PUT /api/scenes/[id] — بروزرسانی { name?, data? } */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as { name?: string; data?: string };
    const scene = await db.scene.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.slice(0, 80) } : {}),
        ...(body.data ? { data: body.data } : {}),
      },
    });
    return NextResponse.json({ scene: { id: scene.id, name: scene.name, updatedAt: scene.updatedAt } });
  } catch (err) {
    console.error('PUT /api/scenes/[id] failed', err);
    return NextResponse.json({ error: 'failed_to_update_scene' }, { status: 500 });
  }
}

/** DELETE /api/scenes/[id] */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await db.scene.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/scenes/[id] failed', err);
    return NextResponse.json({ error: 'failed_to_delete_scene' }, { status: 500 });
  }
}
