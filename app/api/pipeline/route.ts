import { NextRequest, NextResponse } from 'next/server'
import { runPipeline } from '@/lib/softwarehouse'
function authorized(req: NextRequest){ const token=process.env.DASHBOARD_API_TOKEN; return !token || token==='change-me' || req.headers.get('authorization')===`Bearer ${token}` || req.nextUrl.searchParams.get('token')===token }
export async function POST(req: NextRequest){ if(!authorized(req)) return NextResponse.json({error:'unauthorized'},{status:401}); const result=await runPipeline(); return NextResponse.json(result,{status:result.ok?200:500}) }
export async function GET(req: NextRequest){ return POST(req) }
