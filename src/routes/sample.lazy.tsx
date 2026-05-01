import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/sample")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/sample"!</div>;
}
