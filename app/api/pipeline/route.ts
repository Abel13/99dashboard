import { NextRequest, NextResponse } from 'next/server'
import { runPipeline } from '@/lib/softwarehouse'
import { getAppSettings } from '@/lib/settings'

function authorized(req: NextRequest, token?: string){ return !token || token==='change-me' || req.headers.get('authorization')===`Bearer ${token}` || req.nextUrl.searchParams.get('token')===token }
export async function POST(req: NextRequest){ const settings = await getAppSettings(); if(!authorized(req, settings.dashboard_api_token)) return NextResponse.json({error:'unauthorized'},{status:401}); const result=await runPipeline(); return NextResponse.json(result,{status:result.ok?200:500}) }
export async function GET(req: NextRequest){ return POST(req) }
