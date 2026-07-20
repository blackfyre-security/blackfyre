/**
 * Optional scanner dependencies.
 *
 * A few on-premises auditors need native/heavyweight npm packages that the vast
 * majority of installs (cloud-only) never use. Those packages are deliberately
 * NOT in package.json — carrying `ldapjs` and `net-snmp` in every install to
 * serve a minority of deployments is the wrong trade.
 *
 * The trap is what "not installed" used to look like: the dynamic import failed,
 * the helper returned `[]` or `null`, and the auditor reported a clean result.
 * On a compliance product that is the worst possible failure mode — silence that
 * reads as a pass. Seven auditors (4 Active Directory, 3 SNMP) behaved this way.
 *
 * Throwing instead makes the gap explicit: the orchestrator records the auditor
 * as errored with an actionable message, and nobody mistakes "we never looked"
 * for "we looked and it was fine".
 */
export class OptionalDependencyMissingError extends Error {
  readonly dependency: string;
  readonly capability: string;

  constructor(dependency: string, capability: string) {
    super(
      `${capability} requires the optional dependency "${dependency}", which is not installed. ` +
        `Install it to enable this auditor: npm install ${dependency} --workspace=packages/api`,
    );
    this.name = "OptionalDependencyMissingError";
    this.dependency = dependency;
    this.capability = capability;
  }
}

/** True when the error is a missing optional scanner dependency. */
export function isOptionalDependencyMissing(err: unknown): err is OptionalDependencyMissingError {
  return err instanceof OptionalDependencyMissingError;
}
