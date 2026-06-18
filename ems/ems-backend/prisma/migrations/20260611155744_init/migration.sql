-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "DataType" AS ENUM ('FLOAT', 'INTEGER', 'BOOLEAN', 'STRING');

-- CreateEnum
CREATE TYPE "SwitchState" AS ENUM ('ON', 'OFF');

-- CreateEnum
CREATE TYPE "LogSource" AS ENUM ('INGEST', 'MANUAL', 'SCHEDULE', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "Operator" AS ENUM ('GT', 'LT', 'EQ', 'GTE', 'LTE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AlarmStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AlarmState" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ProcessState" AS ENUM ('UNPROCESSED', 'PROCESSED');

-- CreateEnum
CREATE TYPE "TaskAction" AS ENUM ('ON', 'OFF');

-- CreateEnum
CREATE TYPE "RepeatType" AS ENUM ('DAILY', 'WEEKLY', 'ONCE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ExecutionResult" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "Horizon" AS ENUM ('TEN_MIN', 'FIVE_HR', 'SEVEN_DAY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "IconStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ThemeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('BAR', 'LINE', 'AREA', 'GAUGE', 'VALUE_CARD', 'PIE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "themeId" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "organizationId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateways" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "model" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "organizationId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "acquisitionMethod" TEXT,
    "totalSlaves" INTEGER NOT NULL DEFAULT 0,
    "totalVariables" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_template_slaves" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_template_slaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_template_variables" (
    "id" TEXT NOT NULL,
    "templateSlaveId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "unit" TEXT,
    "registerAddress" TEXT,
    "iconId" TEXT,
    "dataType" "DataType" NOT NULL DEFAULT 'FLOAT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_template_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gatewayId" TEXT,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "switchState" "SwitchState" NOT NULL DEFAULT 'OFF',
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "mqttConfigId" TEXT,
    "lastDataReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_config_slaves" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "templateSlaveId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_config_slaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_config_variables" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceConfigSlaveId" TEXT NOT NULL,
    "templateVariableId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "unit" TEXT,
    "currentValue" TEXT,
    "lastUpdatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_config_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_config_variable_logs" (
    "id" TEXT NOT NULL,
    "deviceConfigVariableId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "source" "LogSource" NOT NULL DEFAULT 'INGEST',
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_config_variable_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_users" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "device_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceConfigSlaveId" TEXT,
    "organizationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readings" JSONB NOT NULL,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_timestamps" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_timestamps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_triggers" (
    "id" TEXT NOT NULL,
    "deviceTemplateId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateVariableId" TEXT NOT NULL,
    "operator" "Operator" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "anomalyType" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "linkageVariableId" TEXT,
    "linkageAction" TEXT,
    "linkageValue" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarm_settings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateTriggerId" TEXT,
    "pushType" TEXT,
    "pushBody" TEXT,
    "pushMethod" TEXT,
    "pushingMechanism" TEXT,
    "status" "AlarmStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alarm_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarm_configuration_devices" (
    "id" TEXT NOT NULL,
    "alarmSettingId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "alarm_configuration_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarm_configuration_contacts" (
    "id" TEXT NOT NULL,
    "alarmSettingId" TEXT NOT NULL,
    "alarmContactId" TEXT NOT NULL,

    CONSTRAINT "alarm_configuration_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarm_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "remark" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alarm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarm_history_notifications" (
    "id" TEXT NOT NULL,
    "alarmSettingId" TEXT,
    "organizationId" TEXT NOT NULL,
    "deviceId" TEXT,
    "message" TEXT,
    "pushType" TEXT,
    "sentTo" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',

    CONSTRAINT "alarm_history_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_variable_alarm_histories" (
    "id" TEXT NOT NULL,
    "alarmSettingId" TEXT,
    "templateTriggerId" TEXT,
    "deviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "variableName" TEXT NOT NULL,
    "triggerName" TEXT,
    "triggerType" TEXT,
    "slaveName" TEXT,
    "currentValue" DOUBLE PRECISION,
    "triggeringCondition" TEXT,
    "alarmTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alarmState" "AlarmState" NOT NULL DEFAULT 'ACTIVE',
    "processState" "ProcessState" NOT NULL DEFAULT 'UNPROCESSED',

    CONSTRAINT "device_variable_alarm_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_variable_linkage_histories" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateTriggerId" TEXT,
    "triggerName" TEXT,
    "watchedVariableName" TEXT,
    "watchedVariableValue" DOUBLE PRECISION,
    "linkedVariableName" TEXT,
    "actionTaken" TEXT,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_variable_linkage_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdBy" TEXT,
    "deviceId" TEXT NOT NULL,
    "deviceConfigSlaveId" TEXT,
    "deviceConfigVariableId" TEXT,
    "variableName" TEXT NOT NULL,
    "action" "TaskAction" NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "repeatType" "RepeatType" NOT NULL DEFAULT 'DAILY',
    "daysOfWeek" INTEGER[],
    "status" "TaskStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_execution_logs" (
    "id" TEXT NOT NULL,
    "scheduleTaskId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT,
    "variableName" TEXT,
    "result" "ExecutionResult" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,

    CONSTRAINT "schedule_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slab_rates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceConfigSlaveId" TEXT NOT NULL,
    "unitFrom" DOUBLE PRECISION NOT NULL,
    "unitTo" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "onPeakRate" DOUBLE PRECISION,
    "offPeakRate" DOUBLE PRECISION,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slab_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interval_histories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceConfigSlaveId" TEXT NOT NULL,
    "templateVariableId" TEXT,
    "templateSlaveId" TEXT,
    "variableName" TEXT NOT NULL,
    "slaveName" TEXT,
    "totalUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tariff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interval_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_forecast_readings" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateVariableId" TEXT,
    "templateSlaveId" TEXT,
    "variableName" TEXT NOT NULL,
    "horizon" "Horizon" NOT NULL,
    "predictions" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_forecast_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "triggerName" TEXT,
    "deviceName" TEXT,
    "description" TEXT,
    "anomalyId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "status" "IconStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "icons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "description" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headerFontColor" TEXT,
    "headerBgColor" TEXT,
    "bodyFontColor" TEXT,
    "bodyBgColor" TEXT,
    "fontSize" TEXT,
    "status" "ThemeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "iconId" TEXT,
    "themeId" TEXT,
    "widgetType" "WidgetType" NOT NULL DEFAULT 'VALUE_CARD',
    "variableName" TEXT,
    "displayName" TEXT,
    "unit" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_type_items" (
    "id" TEXT NOT NULL,
    "listTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_type_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mqtt_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceId" TEXT,
    "brokerUrl" TEXT,
    "port" INTEGER NOT NULL DEFAULT 1883,
    "username" TEXT,
    "passwordEncrypted" TEXT,
    "topic" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mqtt_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateVariableId" TEXT,
    "templateSlaveId" TEXT,
    "variableName" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "predictions" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "description" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'NEW',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "gateways_serialNumber_key" ON "gateways"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "device_template_variables_templateSlaveId_name_key" ON "device_template_variables"("templateSlaveId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "devices_mqttConfigId_key" ON "devices"("mqttConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "device_config_variables_deviceId_deviceConfigSlaveId_name_key" ON "device_config_variables"("deviceId", "deviceConfigSlaveId", "name");

-- CreateIndex
CREATE INDEX "device_config_variable_logs_deviceConfigVariableId_changedA_idx" ON "device_config_variable_logs"("deviceConfigVariableId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "device_users_deviceId_userId_key" ON "device_users"("deviceId", "userId");

-- CreateIndex
CREATE INDEX "sensor_readings_deviceId_deviceConfigSlaveId_timestamp_idx" ON "sensor_readings"("deviceId", "deviceConfigSlaveId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "device_timestamps_deviceId_key" ON "device_timestamps"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "alarm_configuration_devices_alarmSettingId_deviceId_key" ON "alarm_configuration_devices"("alarmSettingId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "alarm_configuration_contacts_alarmSettingId_alarmContactId_key" ON "alarm_configuration_contacts"("alarmSettingId", "alarmContactId");

-- CreateIndex
CREATE INDEX "device_variable_alarm_histories_deviceId_alarmTime_idx" ON "device_variable_alarm_histories"("deviceId", "alarmTime");

-- CreateIndex
CREATE INDEX "device_variable_linkage_histories_deviceId_firedAt_idx" ON "device_variable_linkage_histories"("deviceId", "firedAt");

-- CreateIndex
CREATE INDEX "schedule_execution_logs_scheduleTaskId_executedAt_idx" ON "schedule_execution_logs"("scheduleTaskId", "executedAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "list_types_name_key" ON "list_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "mqtt_configs_deviceId_key" ON "mqtt_configs"("deviceId");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateways" ADD CONSTRAINT "gateways_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_templates" ADD CONSTRAINT "device_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_template_slaves" ADD CONSTRAINT "device_template_slaves_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "device_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_template_variables" ADD CONSTRAINT "device_template_variables_templateSlaveId_fkey" FOREIGN KEY ("templateSlaveId") REFERENCES "device_template_slaves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_template_variables" ADD CONSTRAINT "device_template_variables_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "icons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "device_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_mqttConfigId_fkey" FOREIGN KEY ("mqttConfigId") REFERENCES "mqtt_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_config_slaves" ADD CONSTRAINT "device_config_slaves_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_config_slaves" ADD CONSTRAINT "device_config_slaves_templateSlaveId_fkey" FOREIGN KEY ("templateSlaveId") REFERENCES "device_template_slaves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_config_variables" ADD CONSTRAINT "device_config_variables_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_config_variables" ADD CONSTRAINT "device_config_variables_deviceConfigSlaveId_fkey" FOREIGN KEY ("deviceConfigSlaveId") REFERENCES "device_config_slaves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_config_variables" ADD CONSTRAINT "device_config_variables_templateVariableId_fkey" FOREIGN KEY ("templateVariableId") REFERENCES "device_template_variables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_config_variable_logs" ADD CONSTRAINT "device_config_variable_logs_deviceConfigVariableId_fkey" FOREIGN KEY ("deviceConfigVariableId") REFERENCES "device_config_variables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_users" ADD CONSTRAINT "device_users_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_users" ADD CONSTRAINT "device_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_timestamps" ADD CONSTRAINT "device_timestamps_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_triggers" ADD CONSTRAINT "template_triggers_deviceTemplateId_fkey" FOREIGN KEY ("deviceTemplateId") REFERENCES "device_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_triggers" ADD CONSTRAINT "template_triggers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_triggers" ADD CONSTRAINT "template_triggers_templateVariableId_fkey" FOREIGN KEY ("templateVariableId") REFERENCES "device_template_variables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_triggers" ADD CONSTRAINT "template_triggers_linkageVariableId_fkey" FOREIGN KEY ("linkageVariableId") REFERENCES "device_template_variables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_triggers" ADD CONSTRAINT "template_triggers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_settings" ADD CONSTRAINT "alarm_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_settings" ADD CONSTRAINT "alarm_settings_templateTriggerId_fkey" FOREIGN KEY ("templateTriggerId") REFERENCES "template_triggers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_settings" ADD CONSTRAINT "alarm_settings_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_configuration_devices" ADD CONSTRAINT "alarm_configuration_devices_alarmSettingId_fkey" FOREIGN KEY ("alarmSettingId") REFERENCES "alarm_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_configuration_devices" ADD CONSTRAINT "alarm_configuration_devices_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_configuration_contacts" ADD CONSTRAINT "alarm_configuration_contacts_alarmSettingId_fkey" FOREIGN KEY ("alarmSettingId") REFERENCES "alarm_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_configuration_contacts" ADD CONSTRAINT "alarm_configuration_contacts_alarmContactId_fkey" FOREIGN KEY ("alarmContactId") REFERENCES "alarm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_contacts" ADD CONSTRAINT "alarm_contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_contacts" ADD CONSTRAINT "alarm_contacts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_history_notifications" ADD CONSTRAINT "alarm_history_notifications_alarmSettingId_fkey" FOREIGN KEY ("alarmSettingId") REFERENCES "alarm_settings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_variable_alarm_histories" ADD CONSTRAINT "device_variable_alarm_histories_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_variable_alarm_histories" ADD CONSTRAINT "device_variable_alarm_histories_templateTriggerId_fkey" FOREIGN KEY ("templateTriggerId") REFERENCES "template_triggers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_variable_linkage_histories" ADD CONSTRAINT "device_variable_linkage_histories_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_variable_linkage_histories" ADD CONSTRAINT "device_variable_linkage_histories_templateTriggerId_fkey" FOREIGN KEY ("templateTriggerId") REFERENCES "template_triggers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_deviceConfigVariableId_fkey" FOREIGN KEY ("deviceConfigVariableId") REFERENCES "device_config_variables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_execution_logs" ADD CONSTRAINT "schedule_execution_logs_scheduleTaskId_fkey" FOREIGN KEY ("scheduleTaskId") REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slab_rates" ADD CONSTRAINT "slab_rates_deviceConfigSlaveId_fkey" FOREIGN KEY ("deviceConfigSlaveId") REFERENCES "device_config_slaves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interval_histories" ADD CONSTRAINT "interval_histories_deviceConfigSlaveId_fkey" FOREIGN KEY ("deviceConfigSlaveId") REFERENCES "device_config_slaves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interval_histories" ADD CONSTRAINT "interval_histories_templateVariableId_fkey" FOREIGN KEY ("templateVariableId") REFERENCES "device_template_variables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interval_histories" ADD CONSTRAINT "interval_histories_templateSlaveId_fkey" FOREIGN KEY ("templateSlaveId") REFERENCES "device_template_slaves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_forecast_readings" ADD CONSTRAINT "ai_forecast_readings_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_forecast_readings" ADD CONSTRAINT "ai_forecast_readings_templateVariableId_fkey" FOREIGN KEY ("templateVariableId") REFERENCES "device_template_variables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_templates" ADD CONSTRAINT "widget_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_templates" ADD CONSTRAINT "widget_templates_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "icons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_templates" ADD CONSTRAINT "widget_templates_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_templates" ADD CONSTRAINT "widget_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_type_items" ADD CONSTRAINT "list_type_items_listTypeId_fkey" FOREIGN KEY ("listTypeId") REFERENCES "list_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mqtt_configs" ADD CONSTRAINT "mqtt_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_templateVariableId_fkey" FOREIGN KEY ("templateVariableId") REFERENCES "device_template_variables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_templateSlaveId_fkey" FOREIGN KEY ("templateSlaveId") REFERENCES "device_template_slaves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
