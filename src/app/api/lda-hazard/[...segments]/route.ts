import { handleHazardApi } from '@/lib/lda-hazard/server/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = {params: Promise<{segments: string[]}>};
export async function GET(request: Request, context: Context) {
  return handleHazardApi(request, (await context.params).segments);
}
export async function POST(request: Request, context: Context) {
  return handleHazardApi(request, (await context.params).segments);
}
export async function HEAD(request: Request, context: Context) {
  return handleHazardApi(request, (await context.params).segments);
}
