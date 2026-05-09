'use client'

import type { ReactNode } from 'react'
import { scoreBand } from './helpers'

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric glass mini">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

export function MiniStat({ label, value, tone }: { label: string; value: ReactNode; tone: string }) {
  return (
    <div className={`miniStat ${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel glass">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="barLine">
      <span>{label}</span>
      <div>
        <i style={{ width: `${Math.max(8, (value / max) * 100)}%` }} />
      </div>
      <b>{value}</b>
    </div>
  )
}

export function ScoreBar({ value }: { value: number }) {
  const [, kind] = scoreBand(value)
  return (
    <div className={`scoreBar ${kind}`}>
      <i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function SignalDot({ kind, label }: { kind: string; label: string }) {
  return (
    <span className={`signalDot ${kind}`}>
      <i />
      {label}
    </span>
  )
}

export function Signal({ label, value, suffix, kind }: { label: string; value: number; suffix: string; kind: string }) {
  return (
    <div className={`signalGauge ${kind}`}>
      <div style={{ '--value': Math.min(100, Math.max(0, value)) } as any}>
        <b>{value || '—'}</b>
        <span>{suffix}</span>
      </div>
      <small>{label}</small>
    </div>
  )
}

export function Complexity({ value, label }: { value: number; label?: string }) {
  return (
    <div className="complexity">
      <div>
        <i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span>{label || `${Math.round(value)} / 100`}</span>
      <small>Correção simples → Complexidade empresarial</small>
    </div>
  )
}

export function StatusLine({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="statusLine">
      <span className={`dot ${ok ? 'ok' : 'bad'}`} />
      <b>{label}</b>
      <small>{detail}</small>
    </div>
  )
}
