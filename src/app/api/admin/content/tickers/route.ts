import { NextResponse } from 'next/server';
import { getContent, saveContent } from '@/lib/content';
import { superAdminError } from '@/lib/auth';

export async function PUT(request: Request) {
  const denied = superAdminError(request);
  if (denied) return denied;
  
  const body = await request.json();
  const content = await getContent();
  
  if (body.top_ticker !== undefined && body.top_ticker !== null) {
    content.top_ticker = body.top_ticker;
  }
  if (body.bottom_ticker !== undefined && body.bottom_ticker !== null) {
    content.bottom_ticker = body.bottom_ticker;
  }
  
  await saveContent(content);
  return NextResponse.json(content);
}
