# Tiering System Tests

This directory contains comprehensive tests for the Taliho V3 tiering system.

## Test Structure

```
src/__tests__/tiers/
├── fixtures.ts              # Mock Company data for all tier types
├── determineTier.test.ts    # Unit tests for tier determination logic
├── hooks.test.tsx           # Tests for React hooks (useTier, useStorageLimits, useFeatureGate)
└── components.test.tsx      # Tests for React components (StorageWarningBanner, StorageLimitModal, etc.)
```

## Setup

### 1. Install Testing Dependencies

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### 2. Update package.json

Add the following scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run"
  }
}
```

## Running Tests

### Run all tests in watch mode

```bash
npm test
```

### Run all tests once

```bash
npm run test:run
```

### Run tests with UI

```bash
npm run test:ui
```

### Run specific test file

```bash
npm test -- determineTier.test.ts
```

### Run with coverage report

```bash
npm run test:coverage
```

## Test Coverage

The test suite covers:

### Tier Determination (`determineTier.test.ts`)

- ✅ Correct tier identification for all 5 tiers
- ✅ Fallback logic for missing/invalid Stripe Product IDs
- ✅ Edge cases (null company, empty object, expired trial)
- ✅ Trial and paid account logic
- ✅ Type safety

### React Hooks (`hooks.test.tsx`)

- ✅ `useTier()` - Tier identification and boolean helpers
- ✅ `useStorageLimits()` - Storage calculations and warning states
- ✅ `useFeatureGate()` - Feature access by tier

### React Components (`components.test.tsx`)

- ✅ `StorageWarningBanner` - Rendering at correct thresholds, user interactions, visual styling
- ✅ `StorageLimitModal` - Rendering, user interactions, usage display
- ✅ `TrialBanner` - Tier-based rendering, dismissal behavior, localStorage persistence
- ✅ `LockedFeatureCard` - Rendering, user interactions, different tier requirements

## Fixtures

The `fixtures.ts` file provides pre-configured Company objects for testing:

**Tier Fixtures:**

- `freeTrialCompany` - Free Trial (50 MB, 20 QR limit)
- `standardCompany` - Standard ($29/mo, 50 GB, 20 QR limit)
- `professionalCompany` - Professional ($69/mo, 200 GB, unlimited QR)
- `businessCompany` - Business ($189/mo, 500 GB, unlimited QR, Procore)
- `earlyAdopterCompany` - Early Adopter (legacy, 50 GB, unlimited QR, Procore)

**Storage State Fixtures:**

- `emptyStorageCompany` - 0% used
- `halfStorageCompany` - 50% used
- `warningStorageCompany` - 85% used (warning threshold)
- `criticalStorageCompany` - 95% used (critical threshold)
- `blockedStorageCompany` - 100% used (blocked)

**Special Cases:**

- `companyWithAddons` - Standard + 2 storage add-ons
- `canceledCompany` - Canceled subscription
- `missingProductIDCompany` - Missing Stripe Product ID
- `invalidProductIDCompany` - Invalid Stripe Product ID

## Writing New Tests

### Example: Testing a new hook

```typescript
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { useYourNewHook } from "@/lib/tiers/hooks";
import { standardCompany } from "./fixtures";

function createWrapper(company: any) {
  const store = configureStore({
    reducer: {
      company: (state = company) => state,
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

describe("useYourNewHook", () => {
  it("should return expected value", () => {
    const { result } = renderHook(() => useYourNewHook(), {
      wrapper: createWrapper(standardCompany),
    });

    expect(result.current).toBe(expectedValue);
  });
});
```

### Example: Testing a new component

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { createMockStore } from "./fixtures";
import YourComponent from "@/components/YourComponent";

describe("YourComponent", () => {
  it("should render correctly", () => {
    render(
      <Provider store={createMockStore(standardCompany)}>
        <YourComponent />
      </Provider>
    );

    expect(screen.getByText("Expected Text")).toBeInTheDocument();
  });
});
```

## Continuous Integration

To run tests in CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm run test:run

- name: Generate coverage
  run: npm run test:coverage
```

## Troubleshooting

### Tests fail with "document is not defined"

Make sure `vitest.config.ts` has `environment: "jsdom"` configured.

### Module resolution errors

Check that the `@` path alias is correctly configured in both `vitest.config.ts` and `tsconfig.json`.

### Redux store errors

Ensure all components are wrapped with the Redux `Provider` using the `createWrapper` helper.

### localStorage errors

The test setup automatically clears localStorage after each test. Make sure your component handles missing localStorage gracefully.

## Best Practices

1. **Use fixtures** - Don't create inline Company objects; use fixtures for consistency
2. **Test user interactions** - Use `fireEvent` to simulate clicks, not direct function calls
3. **Test visual states** - Verify classes and styling, not just text content
4. **Mock sparingly** - Only mock external dependencies, not internal functions
5. **Clear mocks** - Always call `vi.clearAllMocks()` in `beforeEach`
6. **Descriptive tests** - Use clear test names that describe what is being tested

## Coverage Goals

Target coverage for the tiering system:

- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 90%+
- **Lines**: 90%+

Run `npm run test:coverage` to check current coverage.
