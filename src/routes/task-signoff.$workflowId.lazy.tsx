import { createLazyFileRoute } from "@tanstack/react-router";
import { BallInCourtPage } from "./ball-in-court.$workflowId.lazy";

export const Route = createLazyFileRoute("/task-signoff/$workflowId")({
  component: BallInCourtPage,
});
