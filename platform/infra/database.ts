import { vpc } from "./network.js";
import { secrets } from "./secrets.js";

/**
 * Database — RDS Postgres 16 in the VPC's private subnets.
 *
 * Connection string is built from the instance address + master credentials
 * and exposed as `database.url`. App Lambdas (api, sse, workers) consume it
 * via DATABASE_URL.
 *
 * Sizing:
 *  - staging: db.t4g.micro, single-AZ, 7-day backups, no deletion protection
 *  - prod:    db.t4g.medium, multi-AZ, 14-day backups, deletion protected
 */

const isProd = $app.stage === "prod";

const subnetGroup = new aws.rds.SubnetGroup("BlackfyreDbSubnetsV2", {
  // RDS subnet group names must be lowercase; without explicit name Pulumi uses
  // the logical name (mixed case) and AWS rejects it.
  //
  // "-v2" name (+ new logical name) is REQUIRED for the BlackfyreVpcV2 migration:
  // a DB subnet group cannot change VPCs in place — AWS rejects ModifyDBSubnetGroup
  // with "The new Subnets are not in the same Vpc as the existing subnet group".
  // A new name forces a fresh subnet group in the new VPC instead of a modify.
  name: `blackfyre-${$app.stage}-db-subnets-v2`,
  subnetIds: vpc.privateSubnets,
  tags: { Name: `blackfyre-${$app.stage}-db-subnets-v2` },
});

const dbSecurityGroup = new aws.ec2.SecurityGroup("BlackfyreDbSg", {
  vpcId: vpc.id,
  description: "RDS Postgres SG - accepts 5432 only from the app/Lambda security group",
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): RDS SG ingress trusted a broad
  // hardcoded 10.0.0.0/16 CIDR — every ENI in the VPC (NAT subnet hosts, future
  // workloads, any compromised in-VPC resource) could reach Postgres. Scope
  // ingress to the app/Lambda security group (vpc.securityGroup, the SG SST
  // attaches to all in-VPC Lambdas: api, sse, workers, scanners) so only those
  // functions can open 5432. Tighter, identity-based, and survives CIDR changes.
  ingress: [{
    fromPort: 5432,
    toPort: 5432,
    protocol: "tcp",
    securityGroups: [vpc.securityGroup],
    description: "Postgres from in-VPC Lambdas (app/Lambda SG only)",
  }],
  egress: [{
    fromPort: 0,
    toPort: 0,
    protocol: "-1",
    cidrBlocks: ["0.0.0.0/0"],
  }],
  tags: { Name: `blackfyre-${$app.stage}-db-sg` },
});

const instance = new aws.rds.Instance("BlackfyreDb", {
  // Suffix '-sst' to avoid conflict with the legacy terraform-managed
  // 'blackfyre-staging' RDS instance still running. Once that's torn down,
  // can rename to plain `blackfyre-${stage}` on a future deploy.
  identifier: `blackfyre-${$app.stage}-sst`,
  // One-time staging VPC-migration restore (network.ts -> BlackfyreVpcV2). The
  // replacement restores from the pre-migration snapshot so staging data is
  // preserved instead of getting an empty DB (skipFinalSnapshot is true on
  // staging). engine/dbName/username/password are inherited from the snapshot.
  //
  // GUARDED TO NON-PROD: prod must never be seeded from the staging snapshot —
  // a prod deploy starts as a fresh empty instance. The staging code path is
  // unchanged (same literal), so this guard is a no-op for staging. Once the
  // staging migration is fully retired this whole option can be removed behind
  // an `sst diff` showing no replacement.
  snapshotIdentifier: isProd ? undefined : "blackfyre-staging-pre-natmig-2026-06-02",
  engine: "postgres",
  engineVersion: "16.13",
  // Lean prod: t4g.small (2 GB, modest headroom over staging's micro) rather
  // than t4g.medium. Bump later if prod load needs it — applyImmediately makes
  // an instance-class change online-ish.
  instanceClass: isProd ? "db.t4g.small" : "db.t4g.micro",
  allocatedStorage: 20,
  maxAllocatedStorage: 100,
  storageType: "gp3",
  storageEncrypted: true,

  dbName: "blackfyre",
  username: "blackfyre",
  password: secrets.dbMasterPassword.value,

  dbSubnetGroupName: subnetGroup.name,
  vpcSecurityGroupIds: [dbSecurityGroup.id],
  publiclyAccessible: false,

  // Lean: single-AZ on every stage (multi-AZ ~doubles DB cost). AZ failure
  // means brief downtime while RDS auto-recovers — acceptable trade for now;
  // flip to multiAz: isProd if prod needs failover. Data safety comes from the
  // backups + final snapshot + deletion protection below, not from multi-AZ.
  multiAz: false,
  backupRetentionPeriod: isProd ? 14 : 7,
  preferredBackupWindow: "03:00-04:00",
  preferredMaintenanceWindow: "sun:04:30-sun:05:30",

  deletionProtection: isProd,
  skipFinalSnapshot: !isProd,
  finalSnapshotIdentifier: isProd
    ? `blackfyre-${$app.stage}-final-${Date.now()}`
    : undefined,

  applyImmediately: !isProd,

  tags: { Name: `blackfyre-${$app.stage}-db` },
}, {
  // The one-time staging VPC-migration restore (network.ts -> BlackfyreVpcV2) is
  // COMPLETE — the restored instance is live (see platform/.sst/outputs.json). So
  // the destructive `deleteBeforeReplace: !isProd` is now pure downside: any future
  // change that forces a replacement would DELETE the live staging DB *before*
  // restoring it. It is removed.
  //
  // `snapshotIdentifier` is a create-only property; once the instance exists, any
  // edit/removal of that literal would force a replacement. Pin it under
  // ignoreChanges so it can never again trigger one. (prod was never affected —
  // isProd leaves snapshotIdentifier undefined and deleteBeforeReplace off, and
  // deletionProtection stays on via the resource args.)
  ignoreChanges: ["snapshotIdentifier"],
});

export const database = {
  instance,
  securityGroup: dbSecurityGroup,
  url: $interpolate`postgres://blackfyre:${secrets.dbMasterPassword.value}@${instance.address}:${instance.port}/blackfyre?sslmode=require`,
};
