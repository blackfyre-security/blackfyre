export const secrets = {
  // RDS master password — DATABASE_URL is built from this in infra/database.ts
  dbMasterPassword: new sst.Secret("DbMasterPassword"),

  jwtSecret: new sst.Secret("JwtSecret"),
  smtpPass: new sst.Secret("SmtpPass"),
  webhookSigningSecret: new sst.Secret("WebhookSigningSecret"),
  googleClientSecret: new sst.Secret("GoogleClientSecret"),
  anthropicApiKey: new sst.Secret("AnthropicApiKey"),
  razorpayKeyId: new sst.Secret("RazorpayKeyId"),
  razorpayKeySecret: new sst.Secret("RazorpayKeySecret"),
  razorpayWebhookSecret: new sst.Secret("RazorpayWebhookSecret"),
  encryptionMasterKey: new sst.Secret("EncryptionMasterKey"),
  googleClientId: new sst.Secret("GoogleClientId"),
};
