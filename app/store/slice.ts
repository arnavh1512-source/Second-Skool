import type { StateCreator } from 'zustand'
import type { Store } from './types'

// Every slice creator gets the whole store's `set`/`get` (so one domain can
// call another's action, which they already do) but declares exactly which
// keys it contributes. Composing them in store.ts then fails to compile if a
// key is missed or claimed twice under a wrong signature.
export type Slice<K extends keyof Store> = StateCreator<Store, [], [], Pick<Store, K>>
