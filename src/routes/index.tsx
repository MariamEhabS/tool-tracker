import { createFileRoute } from "@tanstack/react-router";
import { parseSubscriptionIntent } from "@/lib/subscriptionIntent";

type IndexSearch = {
  error?: string;
  task?: "subscribe";
  plan?: "standard" | "professional" | "business";
};

// Route definition for "/" with optional search param support
// The component is lazy-loaded from index.lazy.tsx
// Using explicit return type to make search params optional
export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): IndexSearch => {
    const subscriptionIntent = parseSubscriptionIntent({
      task: search.task,
      plan: search.plan,
    });

    return {
      error: typeof search.error === "string" ? search.error : undefined,
      task: subscriptionIntent?.task,
      plan: subscriptionIntent?.plan,
    };
  },
});
