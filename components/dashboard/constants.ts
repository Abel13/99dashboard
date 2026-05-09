import { BarChart3, LayoutDashboard, Search, Settings, User } from 'lucide-react'
import type { DashboardPage, StatusOption } from './types'

export const statuses: StatusOption[] = [
  ['new', 'Não revisado'],
  ['questions_sent', 'Perguntas enviadas'],
  ['prepare_proposal', 'Preparar proposta'],
  ['proposal_sent', 'Proposta enviada'],
  ['won', 'Ganho'],
  ['lost', 'Perdeu'],
  ['discarded', 'Descartado'],
  ['liked', 'Gostei'],
]

export const nav: [DashboardPage, any, string][] = [
  ['dashboard', LayoutDashboard, 'Dashboard'],
  ['explorer', Search, 'Project Explorer'],
  ['analytics', BarChart3, 'Match Analytics'],
  ['profile', User, 'Profile'],
  ['settings', Settings, 'Configurações'],
]
