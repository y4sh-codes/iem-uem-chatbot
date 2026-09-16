import { NextResponse } from 'next/server';
import { getContent, saveContent } from '@/lib/content';
import { verifyAuth } from '@/lib/auth';

export async function PUT(request: Request) {
  if (!verifyAuth(request)) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  
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
