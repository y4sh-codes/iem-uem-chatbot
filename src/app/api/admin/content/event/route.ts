import { NextResponse } from 'next/server';
import { getContent, saveContent } from '@/lib/content';
import { superAdminError } from '@/lib/auth';

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
  return NextResponse.json(content);
}
