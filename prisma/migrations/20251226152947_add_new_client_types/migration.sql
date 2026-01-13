-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_user` ENUM('developer', 'superadmin', 'admin', 'owner') NOT NULL DEFAULT 'admin',
    `username` VARCHAR(225) NOT NULL,
    `password` VARCHAR(225) NOT NULL,
    `nom` VARCHAR(225) NOT NULL,
    `email` VARCHAR(225) NULL,
    `is_dev` INTEGER NOT NULL DEFAULT 0,
    `is_admin` INTEGER NOT NULL DEFAULT 0,
    `is_superadmin` INTEGER NOT NULL DEFAULT 0,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `companieid` INTEGER NULL,
    `clientid` INTEGER NULL,
    `created_by` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login` DATETIME(3) NULL,
    `date_creation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `date_modification` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_companieid_idx`(`companieid`),
    INDEX `users_clientid_idx`(`clientid`),
    INDEX `users_type_user_idx`(`type_user`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uid_companie` VARCHAR(255) NOT NULL,
    `token_fne` TEXT NOT NULL,
    `api_key` VARCHAR(255) NULL,
    `nom` VARCHAR(225) NOT NULL,
    `ncc` VARCHAR(225) NOT NULL,
    `commercialMessage` TEXT NOT NULL,
    `footer` TEXT NOT NULL,
    `localisation` TEXT NOT NULL,
    `logo_url` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `date_creation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `date_modification` DATETIME(3) NOT NULL,

    UNIQUE INDEX `companies_uid_companie_key`(`uid_companie`),
    UNIQUE INDEX `companies_api_key_key`(`api_key`),
    UNIQUE INDEX `companies_ncc_key`(`ncc`),
    INDEX `companies_api_key_idx`(`api_key`),
    INDEX `companies_ncc_idx`(`ncc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pointdeventes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uid_companie` VARCHAR(255) NOT NULL,
    `nom` VARCHAR(225) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `date_creation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `date_modification` DATETIME(3) NOT NULL,

    INDEX `pointdeventes_uid_companie_idx`(`uid_companie`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uid_companie` VARCHAR(255) NOT NULL,
    `ncc` VARCHAR(225) NULL,
    `clientCompanyName` VARCHAR(225) NULL,
    `clientPhone` VARCHAR(225) NULL,
    `clientEmail` VARCHAR(225) NULL,
    `pointdeventeid` INTEGER NOT NULL,
    `type_client` ENUM('B2B', 'B2F', 'B2G', 'B2C') NOT NULL DEFAULT 'B2C',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `date_creation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `date_modification` DATETIME(3) NOT NULL,

    INDEX `clients_uid_companie_idx`(`uid_companie`),
    INDEX `clients_pointdeventeid_idx`(`pointdeventeid`),
    INDEX `clients_ncc_idx`(`ncc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uid_companie` VARCHAR(255) NOT NULL,
    `pointdeventeid` INTEGER NOT NULL,
    `clientid` INTEGER NOT NULL,
    `uid_invoice` VARCHAR(255) NOT NULL,
    `remise_montant` INTEGER NOT NULL DEFAULT 0,
    `remise_taux` INTEGER NOT NULL DEFAULT 0,
    `type_invoice` ENUM('sale', 'purchase') NOT NULL DEFAULT 'sale',
    `paymentMethod` VARCHAR(222) NOT NULL,
    `clientSellerName` VARCHAR(222) NOT NULL,
    `fne_reference` TEXT NULL,
    `fne_invoice_id` VARCHAR(255) NULL,
    `fne_token` TEXT NULL,
    `fne_token_value` TEXT NULL,
    `is_refund` BOOLEAN NOT NULL DEFAULT false,
    `original_invoice_id` INTEGER NULL,
    `status` ENUM('pending', 'certified', 'rejected', 'refunded') NOT NULL DEFAULT 'pending',
    `date_creation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `date_modification` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_uid_invoice_key`(`uid_invoice`),
    INDEX `invoices_uid_companie_idx`(`uid_companie`),
    INDEX `invoices_uid_invoice_idx`(`uid_invoice`),
    INDEX `invoices_clientid_idx`(`clientid`),
    INDEX `invoices_pointdeventeid_idx`(`pointdeventeid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items_invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uid_invoice` VARCHAR(255) NOT NULL,
    `uid_companie` VARCHAR(255) NOT NULL,
    `reference` VARCHAR(225) NOT NULL,
    `description` VARCHAR(225) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `discount` INTEGER NOT NULL DEFAULT 0,
    `measurementUnit` VARCHAR(225) NOT NULL,
    `taxes` VARCHAR(225) NOT NULL,
    `customTaxesname` VARCHAR(225) NULL,
    `customTaxesamount` INTEGER NOT NULL DEFAULT 0,
    `fne_item_id` VARCHAR(255) NULL,
    `date_creation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `items_invoices_uid_invoice_idx`(`uid_invoice`),
    INDEX `items_invoices_uid_companie_idx`(`uid_companie`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items_invoices_receved` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `fne_item_id` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `reference` VARCHAR(225) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `discount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `measurementUnit` VARCHAR(225) NOT NULL,
    `taxes` JSON NULL,
    `customTaxes` JSON NULL,
    `date_creation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `items_invoices_receved_invoice_id_idx`(`invoice_id`),
    INDEX `items_invoices_receved_fne_item_id_idx`(`fne_item_id`),
    UNIQUE INDEX `items_invoices_receved_invoice_id_fne_item_id_key`(`invoice_id`, `fne_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uid_companie` INTEGER NOT NULL,
    `pointdeventeid` INTEGER NOT NULL,
    `uid_invoice` INTEGER NOT NULL,
    `data_send` JSON NOT NULL,
    `data_receved` JSON NOT NULL,
    `code_response` VARCHAR(222) NOT NULL,
    `msg_response` TEXT NOT NULL,
    `userid` INTEGER NOT NULL,
    `token_receced` TEXT NULL,
    `date_creation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `invoice_logs_uid_companie_idx`(`uid_companie`),
    INDEX `invoice_logs_uid_invoice_idx`(`uid_invoice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_companieid_fkey` FOREIGN KEY (`companieid`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_clientid_fkey` FOREIGN KEY (`clientid`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pointdeventes` ADD CONSTRAINT `pointdeventes_uid_companie_fkey` FOREIGN KEY (`uid_companie`) REFERENCES `companies`(`uid_companie`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_uid_companie_fkey` FOREIGN KEY (`uid_companie`) REFERENCES `companies`(`uid_companie`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_pointdeventeid_fkey` FOREIGN KEY (`pointdeventeid`) REFERENCES `pointdeventes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_uid_companie_fkey` FOREIGN KEY (`uid_companie`) REFERENCES `companies`(`uid_companie`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_pointdeventeid_fkey` FOREIGN KEY (`pointdeventeid`) REFERENCES `pointdeventes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_clientid_fkey` FOREIGN KEY (`clientid`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_original_invoice_id_fkey` FOREIGN KEY (`original_invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items_invoices` ADD CONSTRAINT `items_invoices_uid_invoice_fkey` FOREIGN KEY (`uid_invoice`) REFERENCES `invoices`(`uid_invoice`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items_invoices` ADD CONSTRAINT `items_invoices_uid_companie_fkey` FOREIGN KEY (`uid_companie`) REFERENCES `companies`(`uid_companie`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items_invoices_receved` ADD CONSTRAINT `items_invoices_receved_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_logs` ADD CONSTRAINT `invoice_logs_uid_companie_fkey` FOREIGN KEY (`uid_companie`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_logs` ADD CONSTRAINT `invoice_logs_pointdeventeid_fkey` FOREIGN KEY (`pointdeventeid`) REFERENCES `pointdeventes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_logs` ADD CONSTRAINT `invoice_logs_uid_invoice_fkey` FOREIGN KEY (`uid_invoice`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_logs` ADD CONSTRAINT `invoice_logs_userid_fkey` FOREIGN KEY (`userid`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
