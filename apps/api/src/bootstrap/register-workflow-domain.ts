import { ApprovalService } from "../approval-service.js";
import { registerApprovalRoutes } from "../approval-routes.js";
import { AutomationService } from "../automation-service.js";
import { registerAutomationRoutes } from "../automation-routes.js";
import { BusinessTaskService } from "../business-task-service.js";
import { registerBusinessTaskRoutes } from "../business-task-routes.js";
import { MySqlApprovalRepository } from "../mysql-approval-repository.js";
import { MySqlAutomationRepository } from "../mysql-automation-repository.js";
import { MySqlBusinessTaskRepository } from "../mysql-business-task-repository.js";
import { MySqlNotificationRepository } from "../mysql-notification-repository.js";
import { MySqlOrganizationAdminRepository } from "../mysql-organization-admin-repository.js";
import { MySqlPersonalCenterRepository } from "../mysql-personal-center-repository.js";
import { MySqlRealtimeRepository } from "../mysql-realtime-repository.js";
import { MySqlReportRepository } from "../mysql-report-repository.js";
import { NotificationService } from "../notification-service.js";
import { registerNotificationRoutes } from "../notification-routes.js";
import { OrganizationAdminService } from "../organization-admin-service.js";
import { registerOrganizationAdminRoutes } from "../organization-admin-routes.js";
import { PersonalCenterService } from "../personal-center-service.js";
import { registerPersonalCenterRoutes } from "../personal-center-routes.js";
import { RealtimeService } from "../realtime-service.js";
import { registerRealtimeRoutes } from "../realtime-routes.js";
import { ReportService } from "../report-service.js";
import { registerReportRoutes } from "../report-routes.js";
import { commonDomainOptions, type ApiDomainContext } from "./domain-context.js";

export function registerWorkflowDomainRoutes(context: ApiDomainContext) {
  const common = commonDomainOptions(context);
  registerBusinessTaskRoutes(context.app, {
    service: new BusinessTaskService(new MySqlBusinessTaskRepository(context.pool)),
    ...common,
  });
  registerApprovalRoutes(context.app, {
    service: new ApprovalService(new MySqlApprovalRepository(context.pool)),
    ...common,
  });
  registerNotificationRoutes(context.app, {
    service: new NotificationService(new MySqlNotificationRepository(context.pool)),
    ...common,
  });
  registerPersonalCenterRoutes(context.app, {
    service: new PersonalCenterService(new MySqlPersonalCenterRepository(context.pool)),
    ...common,
  });
  registerRealtimeRoutes(context.app, {
    service: new RealtimeService(
      new MySqlRealtimeRepository(context.pool),
      context.config.realtime.replayLimit,
    ),
    ...common,
    pollMs: context.config.realtime.pollMs,
    heartbeatMs: context.config.realtime.heartbeatMs,
    maxConnectionSeconds: context.config.realtime.maxConnectionSeconds,
    maxConnections: context.config.realtime.maxConnections,
  });
  registerAutomationRoutes(context.app, {
    service: new AutomationService(
      new MySqlAutomationRepository(context.pool),
      context.config.automations.defaultRateLimit,
    ),
    ...common,
  });
  registerReportRoutes(context.app, {
    service: new ReportService(
      new MySqlReportRepository(context.pool),
      context.config.reports.exportRoot,
      context.config.reports.exportTtlHours,
    ),
    ...common,
  });
  registerOrganizationAdminRoutes(context.app, {
    service: new OrganizationAdminService(
      new MySqlOrganizationAdminRepository(context.pool),
      context.config.organizationAdmin.invitationTtlHours,
      context.config.organizationAdmin.tokenDefaultTtlDays,
      context.config.organizationAdmin.tokenMaxActive,
    ),
    ...common,
  });
}
