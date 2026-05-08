import { NextResponse } from 'next/server'
import { getOpportunities } from '@/lib/softwarehouse'
export async function GET(){ const data=await getOpportunities(); return new NextResponse(JSON.stringify(data,null,2), { headers:{'content-type':'application/json; charset=utf-8','content-disposition':'attachment; filename="99dashboard-data.json"'} }) }
