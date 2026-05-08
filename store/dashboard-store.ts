'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Store={ query:string; minScore:number; statuses:string[]; setQuery:(v:string)=>void; setMinScore:(v:number)=>void; toggleStatus:(s:string)=>void; clearStatuses:()=>void }
export const useDashboardStore=create<Store>()(persist((set,get)=>({
  query:'', minScore:0, statuses:[],
  setQuery:v=>set({query:v}), setMinScore:v=>set({minScore:v}),
  toggleStatus:s=>set({statuses:get().statuses.includes(s)?get().statuses.filter(x=>x!==s):[...get().statuses,s]}),
  clearStatuses:()=>set({statuses:[]})
}),{name:'99dashboard-ui'}))
