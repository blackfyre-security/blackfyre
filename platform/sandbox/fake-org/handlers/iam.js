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

function handleListUsers(orgData) {
  const users = orgData.iam.users;
  const membersXml = users
    .map((u) => {
      const pwdLine = u.passwordLastUsed
        ? `<PasswordLastUsed>${xmlEscape(u.passwordLastUsed)}</PasswordLastUsed>`
        : "";
      return `    <member>
      <UserId>AIDA${u.name.toUpperCase().padEnd(16, "0").slice(0, 16)}</UserId>
      <UserName>${xmlEscape(u.name)}</UserName>
      <Arn>${xmlEscape(u.arn)}</Arn>
      <Path>/</Path>
      <CreateDate>2023-01-01T00:00:00Z</CreateDate>
      ${pwdLine}
    </member>`;
    })
    .join("\n");

  return xmlResponse(`<ListUsersResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
  <ListUsersResult>
    <Users>
${membersXml}
    </Users>
    <IsTruncated>false</IsTruncated>
  </ListUsersResult>
  <ResponseMetadata>
    <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
  </ResponseMetadata>
</ListUsersResponse>`);
}

function handleListMFADevices(params, orgData) {
  const userName = params.UserName;
  const user = orgData.iam.users.find((u) => u.name === userName);
  if (!user) {
    return {
      status: 404,
      headers: { "Content-Type": "text/xml" },
      body: `<?xml version="1.0"?><ErrorResponse><Error><Code>NoSuchEntity</Code><Message>User ${xmlEscape(userName)} not found</Message></Error></ErrorResponse>`,
    };
  }

  const devicesXml = user.mfaDevices
    .map(
      (d) => `    <member>
      <UserName>${xmlEscape(userName)}</UserName>
      <SerialNumber>${xmlEscape(d.serialNumber)}</SerialNumber>
      <EnableDate>2023-06-01T00:00:00Z</EnableDate>
    </member>`
    )
    .join("\n");

  return xmlResponse(`<ListMFADevicesResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
  <ListMFADevicesResult>
    <MFADevices>
${devicesXml}
    </MFADevices>
    <IsTruncated>false</IsTruncated>
  </ListMFADevicesResult>
  <ResponseMetadata>
    <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
  </ResponseMetadata>
</ListMFADevicesResponse>`);
}

function handleListAccessKeys(params, orgData) {
  const userName = params.UserName;
  const user = orgData.iam.users.find((u) => u.name === userName);
  if (!user) {
    return {
      status: 404,
      headers: { "Content-Type": "text/xml" },
      body: `<?xml version="1.0"?><ErrorResponse><Error><Code>NoSuchEntity</Code><Message>User ${xmlEscape(userName)} not found</Message></Error></ErrorResponse>`,
    };
  }

  const keysXml = user.accessKeys
    .map(
      (k) => `    <member>
      <UserName>${xmlEscape(userName)}</UserName>
      <AccessKeyId>${xmlEscape(k.id)}</AccessKeyId>
      <Status>${xmlEscape(k.status)}</Status>
      <CreateDate>2023-01-01T00:00:00Z</CreateDate>
    </member>`
    )
    .join("\n");

  return xmlResponse(`<ListAccessKeysResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
  <ListAccessKeysResult>
    <AccessKeyMetadata>
${keysXml}
    </AccessKeyMetadata>
    <IsTruncated>false</IsTruncated>
  </ListAccessKeysResult>
  <ResponseMetadata>
    <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
  </ResponseMetadata>
</ListAccessKeysResponse>`);
}

function handleGetAccountSummary(orgData) {
  const rootKeys = orgData.iam.rootHasAccessKeys ? 1 : 0;
  const rootMfa = orgData.iam.rootMfaEnabled ? 1 : 0;

  return xmlResponse(`<GetAccountSummaryResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
  <GetAccountSummaryResult>
    <SummaryMap>
      <entry>
        <key>AccountAccessKeysPresent</key>
        <value>${rootKeys}</value>
      </entry>
      <entry>
        <key>AccountMFAEnabled</key>
        <value>${rootMfa}</value>
      </entry>
      <entry>
        <key>Users</key>
        <value>${orgData.iam.users.length}</value>
      </entry>
      <entry>
        <key>Groups</key>
        <value>2</value>
      </entry>
      <entry>
        <key>Roles</key>
        <value>4</value>
      </entry>
      <entry>
        <key>Policies</key>
        <value>${orgData.iam.policies.length}</value>
      </entry>
    </SummaryMap>
  </GetAccountSummaryResult>
  <ResponseMetadata>
    <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
  </ResponseMetadata>
</GetAccountSummaryResponse>`);
}

function handleGetAccountAuthorizationDetails(orgData) {
  const policies = orgData.iam.policies;

  const policiesXml = policies
    .map((p) => {
      // URL-encode the policy document as real AWS does
      const docStr = encodeURIComponent(JSON.stringify(p.document));
      return `    <member>
      <PolicyName>${xmlEscape(p.name)}</PolicyName>
      <Arn>${xmlEscape(p.arn)}</Arn>
      <Path>/</Path>
      <DefaultVersionId>v1</DefaultVersionId>
      <AttachmentCount>1</AttachmentCount>
      <IsAttachable>true</IsAttachable>
      <CreateDate>2023-01-01T00:00:00Z</CreateDate>
      <UpdateDate>2023-01-01T00:00:00Z</UpdateDate>
      <PolicyVersionList>
        <member>
          <Document>${docStr}</Document>
          <VersionId>v1</VersionId>
          <IsDefaultVersion>true</IsDefaultVersion>
          <CreateDate>2023-01-01T00:00:00Z</CreateDate>
        </member>
      </PolicyVersionList>
    </member>`;
    })
    .join("\n");

  return xmlResponse(`<GetAccountAuthorizationDetailsResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
  <GetAccountAuthorizationDetailsResult>
    <Policies>
${policiesXml}
    </Policies>
    <RoleDetailList/>
    <GroupDetailList/>
    <UserDetailList/>
    <IsTruncated>false</IsTruncated>
  </GetAccountAuthorizationDetailsResult>
  <ResponseMetadata>
    <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
  </ResponseMetadata>
</GetAccountAuthorizationDetailsResponse>`);
}

function handleGetAccountPasswordPolicy(orgData) {
  const pp = orgData.iam.passwordPolicy;

  return xmlResponse(`<GetAccountPasswordPolicyResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
  <GetAccountPasswordPolicyResult>
    <PasswordPolicy>
      <MinimumPasswordLength>${pp.minimumPasswordLength}</MinimumPasswordLength>
      <RequireSymbols>${pp.requireSymbols}</RequireSymbols>
      <RequireNumbers>${pp.requireNumbers}</RequireNumbers>
      <RequireUppercaseCharacters>${pp.requireUppercase}</RequireUppercaseCharacters>
      <RequireLowercaseCharacters>${pp.requireLowercase}</RequireLowercaseCharacters>
      <AllowUsersToChangePassword>true</AllowUsersToChangePassword>
      <ExpirePasswords>${pp.maxPasswordAge > 0}</ExpirePasswords>
      ${pp.maxPasswordAge > 0 ? `<MaxPasswordAge>${pp.maxPasswordAge}</MaxPasswordAge>` : ""}
      <PasswordReusePrevention>0</PasswordReusePrevention>
      <HardExpiry>false</HardExpiry>
    </PasswordPolicy>
  </GetAccountPasswordPolicyResult>
  <ResponseMetadata>
    <RequestId>7a62c49f-347e-4fc4-9331-6e8eEXAMPLE</RequestId>
  </ResponseMetadata>
</GetAccountPasswordPolicyResponse>`);
}

function handle(req, body, orgData, params) {
  const action = params.Action;

  if (action === "ListUsers") return handleListUsers(orgData);
  if (action === "ListMFADevices") return handleListMFADevices(params, orgData);
  if (action === "ListAccessKeys") return handleListAccessKeys(params, orgData);
  if (action === "GetAccountSummary") return handleGetAccountSummary(orgData);
  if (action === "GetAccountAuthorizationDetails") return handleGetAccountAuthorizationDetails(orgData);
  if (action === "GetAccountPasswordPolicy") return handleGetAccountPasswordPolicy(orgData);

  return {
    status: 400,
    headers: { "Content-Type": "text/xml" },
    body: `<?xml version="1.0"?><ErrorResponse><Error><Code>InvalidAction</Code><Message>Unknown IAM action: ${xmlEscape(action)}</Message></Error></ErrorResponse>`,
  };
}

module.exports = { handle };
