import { createLazyFileRoute } from "@tanstack/react-router";
import ToolsListPage from "@/components/tools/ToolsListPage";

export const Route = createLazyFileRoute("/tools")({
  component: ToolsListPage,
});
