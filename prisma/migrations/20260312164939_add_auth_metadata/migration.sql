-- AlterTable
ALTER TABLE `AuthOtp` ADD COLUMN `roleHint` ENUM('CUSTOMER', 'SERVICE_OWNER') NULL;

-- AlterTable
ALTER TABLE `Session` ADD COLUMN `appVersion` VARCHAR(64) NULL,
    ADD COLUMN `devicePlatform` VARCHAR(32) NULL;
