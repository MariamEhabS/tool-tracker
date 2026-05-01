import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ball-in-court/$workflowId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/task-signoff/$workflowId",
      params: { workflowId: params.workflowId },
      replace: true,
    });
  },
  component: () => null,
});
