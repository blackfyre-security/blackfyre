import type { FastifyRequest } from "fastify";
import { forbidden } from "../utils/errors.js";

/**
 * Check if an auditor has access to the specified framework.
 * Non-auditor roles pass through without restriction.
 * Auditors must have the framework in their JWT frameworkScope.
 *
 * Known limitation: frameworkScope is set at JWT sign time.
 * If admin revokes access, auditor retains access until token expires (~15 min).
 */
export function requireAuditorScope(
  request: Pick<FastifyRequest, "userRole" | "frameworkScope">,
  framework: string,
): void {
  if (request.userRole !== "auditor") return; // non-auditors pass through

  const scopes = request.frameworkScope ?? [];
  if (!scopes.includes(framework)) {
    throw forbidden("Auditors can only access evidence for their assigned frameworks");
  }
}

/**
 * Fastify preHandler factory for evidence routes.
 * Extracts framework from query param, route param, or request body and checks auditor scope.
 */
export function auditorScopePreHandler(frameworkSource: "query" | "params" | "body" = "query") {
  return async (request: FastifyRequest) => {
    let framework: string | undefined;
    if (frameworkSource === "query") framework = (request.query as any).framework;
    else if (frameworkSource === "params") framework = (request.params as any).framework;
    else if (frameworkSource === "body") framework = (request.body as any).framework;

    if (framework) {
      requireAuditorScope(request, framework);
    } else if (request.userRole === "auditor") {
      // Auditor must always specify a framework filter
      throw forbidden("Auditors must specify a framework filter");
    }
  };
}
