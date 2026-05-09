export type Feedback = {
  status?: string
  reactions?: string[]
  reason?: string
  notes?: string
  outcome?: string
  price_override?: number
  proposal_sent_price?: number
  proposal_sent_at?: string
  proposal_draft?: string
  updated_at?: string
}

export type Opportunity = {
  source: string
  source_project_id: string
  title: string
  project_url: string
  category?: string
  level?: string
  budget?: string
  description_preview?: string
  full_description?: string
  received_at_raw?: string
  email_subject?: string
  email_from?: string
  email_to?: string
  analysis?: any
  page_details?: any
  client_details?: any
  decision_support?: any
  match_insight?: any
  match_insight_generated_at?: string
  effective_status?: string
  effective_status_label?: string
  abel_feedback?: Feedback
}
