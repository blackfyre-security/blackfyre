// AWS Budgets — monthly cost cap + SNS-backed email alert.
// Ports `infrastructure/modules/budgets/main.tf` from launch-blockers/w1-w4
// into SST. Prod cap: $2,000/mo; staging: $400/mo. Alerts oncall@.
//
// Stage `demo` is excluded — it runs a single Lambda and a cap would be noise.

const ALERT_EMAIL = "oncall@blackfyre.tech";

const limits: Record<string, number> = {
  prod: 2000,
  staging: 400,
};

const stage = $app.stage;
const limit = limits[stage];

if (limit !== undefined) {
  const alertTopic = new aws.sns.Topic(`BudgetAlerts-${stage}`, {
    name: `blackfyre-${stage}-budget-alerts`,
  });

  new aws.sns.TopicSubscription(`BudgetAlertsEmail-${stage}`, {
    topic: alertTopic.arn,
    protocol: "email",
    endpoint: ALERT_EMAIL,
  });

  new aws.budgets.Budget(`MonthlyBudget-${stage}`, {
    name: `blackfyre-${stage}-monthly`,
    budgetType: "COST",
    limitAmount: String(limit),
    limitUnit: "USD",
    timeUnit: "MONTHLY",
    notifications: [
      {
        comparisonOperator: "GREATER_THAN",
        threshold: 80,
        thresholdType: "PERCENTAGE",
        notificationType: "ACTUAL",
        subscriberSnsTopicArns: [alertTopic.arn],
      },
      {
        comparisonOperator: "GREATER_THAN",
        threshold: 100,
        thresholdType: "PERCENTAGE",
        notificationType: "ACTUAL",
        subscriberSnsTopicArns: [alertTopic.arn],
      },
      {
        comparisonOperator: "GREATER_THAN",
        threshold: 100,
        thresholdType: "PERCENTAGE",
        notificationType: "FORECASTED",
        subscriberSnsTopicArns: [alertTopic.arn],
      },
    ],
  });
}
