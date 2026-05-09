export type Opportunity = any
export type DashboardPage = 'dashboard' | 'explorer' | 'analytics' | 'profile' | 'settings'

export type OpportunityAction = (
  item: Opportunity,
  status: string,
  reason: string,
  outcome?: string
) => void

export type OpportunityReaction = (item: Opportunity, reaction: string) => void

export type OpenOpportunity = (id: string) => void

export type StatusOption = [string, string]
