import { getAppSettings } from '../settings'

export async function openAIJson<T>(prompt: string, options?: { model?: string; temperature?: number; apiKey?: string }) {
  const settings = await getAppSettings()
  const key = options?.apiKey || settings.openai_api_key
  if (!key) throw new Error('OPENAI_API_KEY/configuração OpenAI ausente')
  const model = options?.model || settings.ai_pricing_model || 'gpt-4o-mini'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: options?.temperature ?? 0.25,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return JSON.parse(json.choices?.[0]?.message?.content || '{}') as T
}
