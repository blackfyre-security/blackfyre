# @blackfyre/shared

Shared TypeScript types, Zod validation schemas, and Tailwind preset used across all BLACKFYRE packages.

## Contents

- `src/types/` — TypeScript interfaces for all domain models
- `src/schemas/` — Zod validation schemas
- `tailwind-preset.cjs` — Shared Tailwind CSS configuration

## Usage

```typescript
import { UserSchema, ScanStatus } from "@blackfyre/shared";
```

All platform packages depend on this package. Build it first:

```bash
npm run build --workspace=packages/shared
```
