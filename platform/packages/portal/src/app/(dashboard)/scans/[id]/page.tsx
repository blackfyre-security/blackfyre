/**
 * Server-component shell for the scans/[id] dynamic route.
 * See findings/[id]/page.tsx for the full pattern explanation.
 */
import ScanDetailView from "./view";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <ScanDetailView />;
}
