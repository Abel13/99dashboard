import { NextResponse } from 'next/server'
import { getOpportunities } from '@/lib/softwarehouse'
export async function GET(){ return NextResponse.json(await getOpportunities()) }
