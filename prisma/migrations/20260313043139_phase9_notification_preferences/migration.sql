-- CreateTable
CREATE TABLE "user_notification_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "upcoming_appointment_reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
    "upcoming_appointment_reminder_lead_minutes" INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_settings_user_id_key" ON "user_notification_settings"("user_id");

-- AddForeignKey
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
