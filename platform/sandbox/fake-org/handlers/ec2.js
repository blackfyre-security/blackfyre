"use strict";

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlResponse(body) {
  return {
    status: 200,
    headers: { "Content-Type": "text/xml" },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n${body}`,
  };
}

function buildIpPermissionXml(rule) {
  const protocol = rule.protocol || "tcp";
  let fromPort = rule.from;
  let toPort = rule.to;

  let rangeXml = "";
  if (rule.cidr && rule.cidr !== "") {
    const isIpv6 = rule.cidr.includes(":");
    if (isIpv6) {
      rangeXml = `<ipv6Ranges><item><cidrIpv6>${xmlEscape(rule.cidr)}</cidrIpv6></item></ipv6Ranges>`;
    } else {
      rangeXml = `<ipRanges><item><cidrIp>${xmlEscape(rule.cidr)}</cidrIp></item></ipRanges>`;
    }
  }

  return `<item>
          <ipProtocol>${xmlEscape(protocol)}</ipProtocol>
          <fromPort>${fromPort}</fromPort>
          <toPort>${toPort}</toPort>
          ${rangeXml}
          <groups/>
        </item>`;
}

function handleDescribeSecurityGroups(orgData) {
  const sgs = orgData.ec2.securityGroups;

  const sgsXml = sgs
    .map((sg) => {
      const ingressXml = (sg.ingress || [])
        .map(buildIpPermissionXml)
        .join("\n        ");
      const egressXml = (sg.egress || [])
        .map(buildIpPermissionXml)
        .join("\n        ");

      return `  <item>
    <groupId>${xmlEscape(sg.id)}</groupId>
    <groupName>${xmlEscape(sg.name)}</groupName>
    <description>Managed by fake-org</description>
    <vpcId>${xmlEscape(sg.vpcId || "vpc-00000000")}</vpcId>
    <ownerId>123456789012</ownerId>
    <ipPermissions>
        ${ingressXml}
    </ipPermissions>
    <ipPermissionsEgress>
        ${egressXml}
    </ipPermissionsEgress>
    <tagSet/>
  </item>`;
    })
    .join("\n");

  return xmlResponse(`<DescribeSecurityGroupsResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <securityGroupInfo>
${sgsXml}
  </securityGroupInfo>
</DescribeSecurityGroupsResponse>`);
}

function handleDescribeVolumes(orgData) {
  const volumes = orgData.ec2.volumes || [];

  const volsXml = volumes
    .map((v) => `  <item>
    <volumeId>${xmlEscape(v.id)}</volumeId>
    <size>${v.size}</size>
    <volumeType>${xmlEscape(v.type)}</volumeType>
    <availabilityZone>${xmlEscape(v.az)}</availabilityZone>
    <encrypted>${v.encrypted}</encrypted>
    <state>in-use</state>
    <createTime>2023-01-01T00:00:00.000Z</createTime>
    <attachmentSet/>
    <tagSet/>
  </item>`)
    .join("\n");

  return xmlResponse(`<DescribeVolumesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <volumeSet>
${volsXml}
  </volumeSet>
</DescribeVolumesResponse>`);
}

function handle(req, body, orgData, params) {
  const action = params.Action;

  if (action === "DescribeSecurityGroups") return handleDescribeSecurityGroups(orgData);
  if (action === "DescribeVolumes") return handleDescribeVolumes(orgData);

  return {
    status: 400,
    headers: { "Content-Type": "text/xml" },
    body: `<?xml version="1.0"?><Response><Errors><Error><Code>InvalidAction</Code><Message>Unknown EC2 action: ${xmlEscape(action)}</Message></Error></Errors></Response>`,
  };
}

module.exports = { handle };
