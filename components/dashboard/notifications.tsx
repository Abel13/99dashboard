'use client'

import { Bell, Inbox, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type ImportNotification = {
  id: string
  createdAt: string
  inserted: number
  updated: number
  saved: number
  found: number
  trigger?: string
}

export function NotificationsPage({
  notifications,
  onClear,
  onOpenExplorer,
}: {
  notifications: ImportNotification[]
  onClear: () => void
  onOpenExplorer: () => void
}) {
  const totalNew = notifications.reduce((sum, item) => sum + item.inserted, 0)

  return (
    <>
      <section className="notificationsHero glass">
        <div>
          <span className="kicker"><Bell size={14} /> Importações Gmail</span>
          <h2>{notifications.length ? `${totalNew} oportunidades novas no histórico` : 'Nenhuma notificação ainda'}</h2>
          <p>O histórico registra importações que trouxeram novos projetos para o dashboard.</p>
        </div>
        <div className="notificationsActions">
          <Button onClick={onOpenExplorer}>Ver oportunidades</Button>
          <Button onClick={onClear} disabled={!notifications.length}>
            <Trash2 size={15} />
            Limpar histórico
          </Button>
        </div>
      </section>

      {notifications.length ? (
        <section className="notificationsTimeline">
          {notifications.map((notification) => (
            <article className="notificationItem glass" key={notification.id}>
              <span className="notificationIcon"><Bell size={18} /></span>
              <div>
                <b>{notification.inserted} novas oportunidades importadas</b>
                <small>{new Date(notification.createdAt).toLocaleString('pt-BR')} · {notification.trigger || 'manual'}</small>
                <p>{notification.saved} salvas · {notification.updated} atualizadas · {notification.found} e-mails encontrados</p>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty glass">
          <Inbox size={20} /> Nenhuma importação com novos itens foi registrada neste navegador.
        </section>
      )}
    </>
  )
}
