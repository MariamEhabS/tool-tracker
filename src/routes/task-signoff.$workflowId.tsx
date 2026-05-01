import { createFileRoute } from "@tanstack/react-router";
import { BallInCourtPage } from "./ball-in-court.$workflowId.lazy";

export const Route = createFileRoute("/task-signoff/$workflowId")({
  component: BallInCourtPage,
});
