import { NextResponse } from 'next/server';
import { getContent, saveContent } from '@/lib/content';
import { authUsername, superAdminError, verifyAuth } from '@/lib/auth';
import { ensureAdminSchema, pool } from '@/lib/db';
import { logEvent } from '@/lib/eventLog';

export async function PUT(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;

  const body = await request.json();
  const content = await getContent();

  if (body.events && Array.isArray(body.events)) {
    content.events = body.events;
  }
  if (body.right_slides && Array.isArray(body.right_slides)) {
    content.right_slides = body.right_slides;
  }

  await saveContent(content);

  const user = verifyAuth(request);
  if (user) {
    try {
      await ensureAdminSchema();
      await logEvent(pool, {
        action: 'content_updated',
        actor: authUsername(user),
        actorRole: String(user.role || 'admin'),
        details: `Saved ${content.events?.length ?? 0} image slide(s) and ${
          content.right_slides?.length ?? 0
        } right-panel slide(s).`,
      });
    } catch (error) {
      console.error('Error writing event content log:', error);
    }
  }

  return NextResponse.json(content);
}
