window.NOTIFICATION_FORMS_DATA = {
  "fields": [
    {
      "key": "in_app_enabled",
      "binding": "preferences.in_app_enabled",
      "type": "checkbox",
      "disabled": false,
      "required": false
    },
    {
      "key": "email_enabled",
      "binding": "preferences.email_enabled",
      "type": "checkbox",
      "disabled": true,
      "required": false
    },
    {
      "key": "task_enabled",
      "binding": "preferences.task_enabled",
      "type": "checkbox",
      "disabled": false,
      "required": false
    },
    {
      "key": "approval_enabled",
      "binding": "preferences.approval_enabled",
      "type": "checkbox",
      "disabled": false,
      "required": false
    },
    {
      "key": "competitor_enabled",
      "binding": "preferences.competitor_enabled",
      "type": "checkbox",
      "disabled": false,
      "required": false
    }
  ],
  "diagnostics": [
    {
      "status": 500,
      "scene": "error",
      "requestId": "P26-REVIEW-500",
      "notice": "请求未完成，请稍后重试。",
      "inertAttempts": 1
    },
    {
      "status": 403,
      "scene": "forbidden",
      "requestId": "P26-REVIEW-403",
      "notice": "请求未完成，请稍后重试。",
      "inertAttempts": 1
    },
    {
      "status": 401,
      "scene": "expired",
      "requestId": "P26-REVIEW-401",
      "notice": "请求未完成，请稍后重试。",
      "inertAttempts": 1
    },
    {
      "status": 429,
      "scene": "rate_limited",
      "requestId": "P26-REVIEW-429",
      "notice": "请求未完成，请稍后重试。",
      "inertAttempts": 3
    },
    {
      "status": 409,
      "scene": "version_conflict",
      "requestId": "P26-REVIEW-409",
      "notice": "请求未完成，请稍后重试。",
      "inertAttempts": 1
    }
  ],
  "boundary": "合成错误响应经真实api-client及NotificationCenter.api隔离执行；不请求网络、不证明服务或在途结果归属。编号是审核样本，不是真实请求。"
};
