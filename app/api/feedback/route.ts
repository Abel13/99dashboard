import { NextRequest, NextResponse } from 'next/server'
import { runPipeline, updateFeedback } from '@/lib/softwarehouse'
const valid = new Set(['new','review','liked','discarded','prepare_proposal','proposal_sent','won','lost'])
export async function POST(req: NextRequest){
  const body = await req.json()
  const projectId = String(body.projectId || '')
  const status = body.status ? String(body.status) : undefined
  if(!projectId) return NextResponse.json({error:'projectId obrigatório'},{status:400})
  if(status && !valid.has(status)) return NextResponse.json({error:'status inválido'},{status:400})
  const feedback = await updateFeedback(projectId, {
    status: status as any,
    reason: body.reason,
    notes: body.notes,
    outcome: body.outcome,
    price_override: body.price_override,
    proposal_sent_price: body.proposal_sent_price,
    proposal_sent_at: status === 'proposal_sent' ? new Date().toISOString() : body.proposal_sent_at,
  })
  const pipeline = body.runPipeline === false ? undefined : await runPipeline()
  return NextResponse.json({ feedback, pipeline })
}
