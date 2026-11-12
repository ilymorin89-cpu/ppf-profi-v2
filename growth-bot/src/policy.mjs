export const POLICY = Object.freeze({
  currency: "RUB",
  monthlyBudgetRub: 30000,
  dailyBudgetRub: 1500,
  timezone: "Europe/Moscow",
  permissions: {
    site: "autonomous_publish_after_checks",
    ads: "autonomous_campaign_management",
    outreach: "autonomous_allowed_channels_only"
  },
  safeguards: {
    requireBudgetReservation: true,
    requireAuditLog: true,
    requireHealthChecks: true,
    rollbackOnFailedDeploy: true,
    forbidSecretAndDatabaseAccess: true,
    forbidUnsolicitedBulkMessaging: true,
    requireLawfulBasisForOutreach: true,
    requireOptOutAndSuppressionList: true,
    maxRecipientsPerCampaign: 25
  }
});
