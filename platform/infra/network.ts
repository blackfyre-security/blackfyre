/**
 * Network — VPC for the staging/prod stacks.
 *
 * SST creates a VPC with 2 AZs, public + private subnets, and a NAT Gateway.
 * Public subnets host the NAT GW. Private subnets host RDS and all in-VPC Lambdas.
 *
 * Cost note: `nat: "managed"` provisions one NAT Gateway (~$33/mo/region).
 * Required for in-VPC Lambdas to call external services (Anthropic API,
 * customer AWS accounts via STS:AssumeRole, SMTP, etc).
 */

// Migrated off Vpc.v1 (legacy) to the new sst.aws.Vpc so we can use EC2 NAT
// instances (fck-nat, 2x t4g.nano ~$6/mo) instead of 2 managed NAT Gateways
// (~$70/mo) — the staging lean-cost win.
//
// MUST use a NEW component name (not "BlackfyreVpc"): SST's version guard
// refuses an in-place Vpc.v1 -> Vpc swap ("recreate this component to update").
// A new name destroys the old Vpc.v1 (+ its 2 managed NAT GWs) and creates the
// new VPC with 2 t4g.nano NAT instances. This replaces the private subnets, so
// the raw RDS instance in database.ts replaces too — it restores from a
// snapshot (snapshotIdentifier) to preserve data.
export const vpc = new sst.aws.Vpc("BlackfyreVpcV2", {
  az: 2,
  nat: "ec2",
});
