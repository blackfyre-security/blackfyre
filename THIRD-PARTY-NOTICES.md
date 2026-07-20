# Third-Party Notices

Blackfyre is licensed under Apache-2.0 (see [LICENSE](LICENSE) and [NOTICE](NOTICE)).
This file lists third-party software that Blackfyre bundles or invokes, together with
the licences those components are distributed under.

Blackfyre does not fork, vendor, or modify any of the tools below. Each is installed
unmodified from its official package registry and invoked as a separate process; no
third-party source is incorporated into Blackfyre's own source tree.

## Scanner container images

These tools are installed into Blackfyre's container Lambda images at build time and
executed as subprocesses. See `platform/infra/containers/*/Dockerfile`.

### `prowler-scanner`

| Component | Version | Licence | Upstream |
|---|---|---|---|
| Prowler | 5.4.0 | Apache-2.0 | https://github.com/prowler-cloud/prowler |
| AWS Lambda Runtime Interface Client | 2.2.1 | Apache-2.0 | https://github.com/aws/aws-lambda-python-runtime-interface-client |
| boto3 | (transitive) | Apache-2.0 | https://github.com/boto/boto3 |

### `iac-scanner`

| Component | Version | Licence | Upstream |
|---|---|---|---|
| Checkov | 3.2.0 | Apache-2.0 | https://github.com/bridgecrewio/checkov |
| **Semgrep** | **1.90.0** | **LGPL-2.1** | https://github.com/semgrep/semgrep |
| Bandit | 1.7.10 | Apache-2.0 | https://github.com/PyCQA/bandit |
| boto3 | 1.35.0 | Apache-2.0 | https://github.com/boto/boto3 |
| AWS Lambda Runtime Interface Client | 2.2.1 | Apache-2.0 | https://github.com/aws/aws-lambda-python-runtime-interface-client |

**Note on Semgrep (LGPL-2.1).** Semgrep is the one copyleft-licensed component
Blackfyre ships. Blackfyre invokes the `semgrep` CLI as a separate process and does
not link against it, statically or dynamically, so no Blackfyre source becomes a
derivative work under LGPL-2.1 §5. Anyone redistributing the `iac-scanner` image
must still convey Semgrep's licence and offer its source, per LGPL-2.1 §§4–6;
unmodified upstream source is available at the URL above.

## Node.js dependencies

Blackfyre's application packages depend on npm software declared in `package.json` and
resolved in `package-lock.json`, which record each dependency's licence. To regenerate
a full dependency-level report:

```bash
npx license-checker-rspack --production --summary
```

## Relationship to upstream projects

Blackfyre's own cloud auditors — the TypeScript SDK-based auditors under
`platform/packages/api/src/agents/` — are original work. Prowler and the IaC tools run
as additional, optional container Lambdas alongside them; they are complementary
scanners, not the source of Blackfyre's own control coverage.

## Trademarks

See [TRADEMARK.md](TRADEMARK.md). Naming a third-party tool here is a statement of
technical fact and does not imply that its owner endorses, sponsors, or is affiliated
with Blackfyre.
