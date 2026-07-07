/**
 * Server-component shell for the findings/[id] dynamic route.
 *
 * With output: "export" we can't render unknown IDs at request time, so we
 * pre-build a single placeholder HTML at /findings/_/index.html. CF Pages
 * _redirects rewrites /findings/* to that file (HTTP 200), and the client
 * inside reads the actual id from the URL via useParams().
 *
 * Do NOT add "use client" here — generateStaticParams must be in a server
 * component.
 */
import FindingDetailView from "./view";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <FindingDetailView />;
}
