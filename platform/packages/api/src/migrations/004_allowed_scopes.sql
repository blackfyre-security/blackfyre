-- FOUND-06: Data minimization — allowedScopes on integrations table
-- Agents must only collect findings for scopes listed here.
-- Empty array = all standard scopes for the integration type (default behaviour).

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS allowed_scopes text[] NOT NULL DEFAULT '{}';

UPDATE integrations SET allowed_scopes = ARRAY['iam','s3','ec2','cloudtrail','kms','vpc']
  WHERE type = 'aws' AND allowed_scopes = '{}';

UPDATE integrations SET allowed_scopes = ARRAY['iam','storage','compute','networking','logging','keyvault']
  WHERE type = 'azure' AND allowed_scopes = '{}';

UPDATE integrations SET allowed_scopes = ARRAY['iam','storage','compute','networking','logging','kms']
  WHERE type = 'gcp' AND allowed_scopes = '{}';
