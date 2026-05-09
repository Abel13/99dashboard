export async function openAIJson<T>(prompt: string, options?: { model?: string; temperature?: number }): Promise<T | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: options?.model || process.env.AI_PRICING_MODEL || 'gpt-4o-mini',
      temperature: options?.temperature ?? 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responda somente JSON válido, sem markdown.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  return JSON.parse(json.choices?.[0]?.message?.content || 'null') as T
}
