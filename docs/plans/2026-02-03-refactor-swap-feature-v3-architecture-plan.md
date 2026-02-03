---
title: Migrate Swap Feature to v3 Architecture
type: refactor
date: 2026-02-03
---

# Migrate Swap Feature to v3 Architecture

## Overview

Migrate the `src/features/swap/` feature to the v3 feature architecture pattern with lazy loading, feature contracts, and proper public API exports.

## Current State

The swap feature currently:

- Has `index.tsx` as a React component (SwapWidget) instead of a public API file
- Exports `SwapWidget` as default and `getSwapTitle` function directly
- Has no `contract.ts` or `feature.ts`
- Is consumed by ~15+ files importing internal paths like `@/features/swap/components/SwapButton`

## Proposed Solution

Restructure to follow the v3 pattern:

1. Create `contract.ts` defining the public API surface
2. Create `feature.ts` with flat structure for lazy-loaded exports
3. Convert `index.ts` to proper public API (handle + direct hook exports)
4. Move `SwapWidget` component to `components/SwapWidget/`

## Acceptance Criteria

- [x] Create `contract.ts` with typed exports for all public components
- [x] Create `feature.ts` with flat structure (NO hooks, NO lazy() calls)
- [x] Create `index.ts` exporting feature handle and hooks directly
- [x] Move `SwapWidget` from `index.tsx` to `components/SwapWidget/index.tsx`
- [x] Update all consumers to use `useLoadFeature(SwapFeature)` for components
- [x] Hooks exported directly from index.ts: `useIsSwapFeatureEnabled`, `useIsExpiredSwap`, `useIsTWAPFallbackHandler`, `useSwapConsent`
- [x] ESLint passes (no restricted import warnings for swap feature)
- [x] Type-check passes
- [x] Tests pass

## MVP

### contract.ts

```typescript
/**
 * Swap Feature Contract - v3 Architecture
 */
import type SwapWidget from './components/SwapWidget'
import type SwapButton from './components/SwapButton'
import type SwapOrder from './components/SwapOrder'
import type SwapOrderConfirmation from './components/SwapOrderConfirmationView'
import type StatusLabel from './components/StatusLabel'
import type { SwapTx } from './components/SwapTxInfo/SwapTx'
import type SwapTokens from './components/SwapTokens'
import type { getSwapTitle } from './helpers/utils'

export interface SwapContract {
  // Components (PascalCase → stub renders null)
  SwapWidget: typeof SwapWidget
  SwapButton: typeof SwapButton
  SwapOrder: typeof SwapOrder
  SwapOrderConfirmation: typeof SwapOrderConfirmation
  StatusLabel: typeof StatusLabel
  SwapTx: typeof SwapTx
  SwapTokens: typeof SwapTokens

  // Services (camelCase → undefined when not ready)
  getSwapTitle: typeof getSwapTitle
}
```

### feature.ts

```typescript
/**
 * Swap Feature Implementation - v3 Lazy-Loaded
 */
import type { SwapContract } from './contract'

import SwapWidget from './components/SwapWidget'
import SwapButton from './components/SwapButton'
import SwapOrder from './components/SwapOrder'
import SwapOrderConfirmation from './components/SwapOrderConfirmationView'
import StatusLabel from './components/StatusLabel'
import { SwapTx } from './components/SwapTxInfo/SwapTx'
import SwapTokens from './components/SwapTokens'
import { getSwapTitle } from './helpers/utils'

const feature: SwapContract = {
  SwapWidget,
  SwapButton,
  SwapOrder,
  SwapOrderConfirmation,
  StatusLabel,
  SwapTx,
  SwapTokens,
  getSwapTitle,
}

export default feature satisfies SwapContract
```

### index.ts

```typescript
/**
 * Swap Feature - Public API (v3 Architecture)
 */
import { createFeatureHandle } from '@/features/__core__'
import type { SwapContract } from './contract'

// Feature handle (already mapped in createFeatureHandle: swap → FEATURES.NATIVE_SWAPS)
export const SwapFeature = createFeatureHandle<SwapContract>('swap')

// Contract type
export type { SwapContract } from './contract'

// Public hooks (always loaded, not lazy)
export { default as useIsSwapFeatureEnabled } from './hooks/useIsSwapFeatureEnabled'
export { default as useIsExpiredSwap } from './hooks/useIsExpiredSwap'
export { useIsTWAPFallbackHandler, useTWAPFallbackHandlerAddress } from './hooks/useIsTWAPFallbackHandler'
export { default as useSwapConsent } from './useSwapConsent'

// Store (direct imports)
export * from './store/swapParamsSlice'

// Constants
export * from './constants'

// Helper utilities needed by consumers
export { getOrderClass, TWAP_FALLBACK_HANDLER } from './helpers/utils'
```

### Consumer Update Pattern

```typescript
// Before
import SwapButton from '@/features/swap/components/SwapButton'
import useIsSwapFeatureEnabled from '@/features/swap/hooks/useIsSwapFeatureEnabled'

// After
import { SwapFeature, useIsSwapFeatureEnabled } from '@/features/swap'
import { useLoadFeature } from '@/features/__core__'

function MyComponent() {
  const swap = useLoadFeature(SwapFeature)
  const isEnabled = useIsSwapFeatureEnabled()

  return <swap.SwapButton />
}
```

## References

- Architecture pattern: [feature-architecture.md](apps/web/docs/feature-architecture.md)
- Reference implementation: [hypernative feature](apps/web/src/features/hypernative/)
- Feature flag mapping: [createFeatureHandle.ts:11](apps/web/src/features/__core__/createFeatureHandle.ts#L11) (swap → FEATURES.NATIVE_SWAPS)

## Critical Notes

### SSR Handling

The `swap.tsx` page currently uses `dynamic(() => import('@/features/swap'), { ssr: false })` because CowSwapWidget requires browser APIs (`window.location.origin`, iframe refs). After migration, consumers should continue using `dynamic()` with `ssr: false` when rendering `SwapWidget`.

### Missing from MVP (to add)

1. **FallbackSwapWidget** - Used when COW flag is disabled
2. **`getSwapTitle`** - Currently in `index.tsx`, must be moved to `helpers/utils.ts` first

## Key Consumers to Update (~20 files)

| File                                                   | Current Import                      | Migration                                 |
| ------------------------------------------------------ | ----------------------------------- | ----------------------------------------- |
| `pages/swap.tsx`                                       | `SwapWidget`, `FallbackSwapWidget`  | Dynamic import with `useLoadFeature`      |
| `components/balances/AssetsTable/ActionButtons.tsx`    | `SwapButton`                        | Use `useLoadFeature(SwapFeature)`         |
| `components/balances/AssetsTable/index.tsx`            | `useIsSwapFeatureEnabled`           | Direct import (hook)                      |
| `components/transactions/TxSummary/index.tsx`          | `StatusLabel`, `useIsExpiredSwap`   | Component: `useLoadFeature`, Hook: direct |
| `components/transactions/TxInfo/index.tsx`             | `SwapTx`                            | Use `useLoadFeature(SwapFeature)`         |
| `components/transactions/TxDetails/TxData/index.tsx`   | `SwapOrder`                         | Use `useLoadFeature(SwapFeature)`         |
| `components/tx/confirmation-views/SwapOrder/index.tsx` | `SwapOrderConfirmation`             | Use `useLoadFeature(SwapFeature)`         |
| `components/dashboard/Overview/Overview.tsx`           | `useIsSwapFeatureEnabled`           | Direct import (hook)                      |
| `components/settings/FallbackHandler/index.tsx`        | `useIsTWAPFallbackHandler`          | Direct import (hook)                      |
| `hooks/useTransactionType.tsx`                         | `getOrderClass`, `TWAP_ORDER_TITLE` | Direct import (utility)                   |
| `services/analytics/tx-tracking.ts`                    | `SWAP_WIDGET_URL`                   | Direct import (constant)                  |

## Risks

| Risk                       | Likelihood | Mitigation                                 |
| -------------------------- | ---------- | ------------------------------------------ |
| SSR errors after migration | Medium     | Document SSR requirements; test page loads |
| Missing consumer updates   | Low        | Use ESLint warnings + grep for old imports |
| Bundle size regression     | Low        | Verify chunk splitting after build         |
