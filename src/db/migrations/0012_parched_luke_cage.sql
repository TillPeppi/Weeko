PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_food_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`meal` text DEFAULT 'snack' NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`amount_g` real NOT NULL,
	`nutrients` text NOT NULL,
	`created_at` text NOT NULL,
	`user_id` text,
	`updated_at` text
);
--> statement-breakpoint
INSERT INTO `__new_food_entry`("id", "date", "meal", "barcode", "name", "amount_g", "nutrients", "created_at", "user_id", "updated_at") SELECT "id", "date", "meal", "barcode", "name", "amount_g", "nutrients", "created_at", "user_id", "updated_at" FROM `food_entry`;--> statement-breakpoint
DROP TABLE `food_entry`;--> statement-breakpoint
ALTER TABLE `__new_food_entry` RENAME TO `food_entry`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_food_product` (
	`id` text PRIMARY KEY NOT NULL,
	`barcode` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`quantity` text,
	`package_g` real,
	`serving_g` real,
	`nutrients` text NOT NULL,
	`nutri_score` text,
	`source` text DEFAULT 'off' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_food_product`("id", "barcode", "name", "brand", "quantity", "package_g", "serving_g", "nutrients", "nutri_score", "source", "favorite", "fetched_at") SELECT "id", "barcode", "name", "brand", "quantity", "package_g", "serving_g", "nutrients", "nutri_score", "source", "favorite", "fetched_at" FROM `food_product`;--> statement-breakpoint
DROP TABLE `food_product`;--> statement-breakpoint
ALTER TABLE `__new_food_product` RENAME TO `food_product`;--> statement-breakpoint
CREATE TABLE `__new_notification_pref` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`quiet_start` text,
	`quiet_end` text,
	`escalation_minutes` integer DEFAULT 30 NOT NULL,
	`digest_time` text,
	`snooze_minutes` integer,
	`user_id` text,
	`updated_at` text
);
--> statement-breakpoint
INSERT INTO `__new_notification_pref`("id", "category", "enabled", "quiet_start", "quiet_end", "escalation_minutes", "digest_time", "snooze_minutes", "user_id", "updated_at") SELECT "id", "category", "enabled", "quiet_start", "quiet_end", "escalation_minutes", "digest_time", "snooze_minutes", "user_id", "updated_at" FROM `notification_pref`;--> statement-breakpoint
DROP TABLE `notification_pref`;--> statement-breakpoint
ALTER TABLE `__new_notification_pref` RENAME TO `notification_pref`;--> statement-breakpoint
CREATE TABLE `__new_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`height_cm` real,
	`age` integer,
	`sex` text,
	`weight_kg` real,
	`goal` text,
	`goal_rate_kg_per_week` real,
	`nutrition_goals` text,
	`language` text DEFAULT 'de' NOT NULL,
	`theme` text DEFAULT 'light' NOT NULL,
	`onboarding_done` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_profile`("id", "user_id", "height_cm", "age", "sex", "weight_kg", "goal", "goal_rate_kg_per_week", "nutrition_goals", "language", "theme", "onboarding_done", "updated_at") SELECT "id", "user_id", "height_cm", "age", "sex", "weight_kg", "goal", "goal_rate_kg_per_week", "nutrition_goals", "language", "theme", "onboarding_done", "updated_at" FROM `profile`;--> statement-breakpoint
DROP TABLE `profile`;--> statement-breakpoint
ALTER TABLE `__new_profile` RENAME TO `profile`;--> statement-breakpoint
CREATE TABLE `__new_weekly_structure` (
	`id` text PRIMARY KEY NOT NULL,
	`weekday` integer NOT NULL,
	`work_start` text,
	`work_end` text,
	`work_location` text,
	`done_by` text,
	`fixed_blocks` text DEFAULT '[]' NOT NULL,
	`user_id` text,
	`updated_at` text
);
--> statement-breakpoint
INSERT INTO `__new_weekly_structure`("id", "weekday", "work_start", "work_end", "work_location", "done_by", "fixed_blocks", "user_id", "updated_at") SELECT "id", "weekday", "work_start", "work_end", "work_location", "done_by", "fixed_blocks", "user_id", "updated_at" FROM `weekly_structure`;--> statement-breakpoint
DROP TABLE `weekly_structure`;--> statement-breakpoint
ALTER TABLE `__new_weekly_structure` RENAME TO `weekly_structure`;--> statement-breakpoint
ALTER TABLE `body_measurement` ADD `muscle_mass_kg` real;--> statement-breakpoint
ALTER TABLE `body_measurement` ADD `bone_mass_kg` real;--> statement-breakpoint
ALTER TABLE `body_measurement` ADD `bmr_kcal` real;