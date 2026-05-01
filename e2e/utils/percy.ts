import basePercySnapshot from "@percy/playwright";
import { test } from "@playwright/test";

type PercyPage = Parameters<typeof basePercySnapshot>[0];
type PercyOptions = Parameters<typeof basePercySnapshot>[2];

function getSnapshotName(name: string) {
  try {
    return `${name} [${test.info().project.name}]`;
  } catch {
    return name;
  }
}

export default async function percySnapshot(
  page: PercyPage,
  name: string,
  options?: PercyOptions,
) {
  await basePercySnapshot(page, getSnapshotName(name), options);
}
