import { BarChart3, LayoutDashboard, Search, Settings, User } from 'lucide-react'
import type { DashboardPage, StatusOption } from './types'

export const statuses: StatusOption[] = [
  ['new', 'Novo'],
  ['review', 'Revisar'],
  ['liked', 'Gostei'],
  ['discarded', 'Descartado'],
  ['prepare_proposal', 'Preparar proposta'],
  ['proposal_sent', 'Proposta enviada'],
  ['won', 'Ganhou'],
  ['lost', 'Perdeu'],
  ['preparar_proposta', 'Preparar proposta (sug.)'],
  ['caso_a_caso', 'Caso a caso'],
  ['descartar', 'Descartar (sug.)'],
]

export const nav: [DashboardPage, any, string][] = [
  ['dashboard', LayoutDashboard, 'Dashboard'],
  ['explorer', Search, 'Project Explorer'],
  ['analytics', BarChart3, 'Match Analytics'],
  ['profile', User, 'Profile'],
  ['settings', Settings, 'Configurações'],
]
