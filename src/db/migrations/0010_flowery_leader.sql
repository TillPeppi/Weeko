PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_block` (
	`id` text PRIMARY KEY NOT NULL,
	`week_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`title` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'planned' NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `week`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_block`("id", "week_id", "date", "type", "start", "end", "title", "details", "status") SELECT "id", "week_id", "date", "type", "start", "end", "title", "details", "status" FROM `block`;--> statement-breakpoint
DROP TABLE `block`;--> statement-breakpoint
ALTER TABLE `__new_block` RENAME TO `block`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_body_measurement` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real NOT NULL,
	`fat_percent` real,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_body_measurement`("id", "date", "weight_kg", "fat_percent", "created_at") SELECT "id", "date", "weight_kg", "fat_percent", "created_at" FROM `body_measurement`;--> statement-breakpoint
DROP TABLE `body_measurement`;--> statement-breakpoint
ALTER TABLE `__new_body_measurement` RENAME TO `body_measurement`;--> statement-breakpoint
CREATE TABLE `__new_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`available` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_equipment`("id", "name", "available") SELECT "id", "name", "available" FROM `equipment`;--> statement-breakpoint
DROP TABLE `equipment`;--> statement-breakpoint
ALTER TABLE `__new_equipment` RENAME TO `equipment`;--> statement-breakpoint
CREATE TABLE `__new_exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`equipment_id` text,
	`is_weighted` integer DEFAULT false NOT NULL,
	`notes` text,
	`slug` text,
	`muscle_group` text,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_exercise`("id", "name", "equipment_id", "is_weighted", "notes", "slug", "muscle_group") SELECT "id", "name", "equipment_id", "is_weighted", "notes", "slug", "muscle_group" FROM `exercise`;--> statement-breakpoint
DROP TABLE `exercise`;--> statement-breakpoint
ALTER TABLE `__new_exercise` RENAME TO `exercise`;--> statement-breakpoint
CREATE TABLE `__new_food_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`meal` text DEFAULT 'snack' NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`amount_g` real NOT NULL,
	`nutrients` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`barcode`) REFERENCES `food_product`(`barcode`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_food_entry`("id", "date", "meal", "barcode", "name", "amount_g", "nutrients", "created_at") SELECT "id", "date", "meal", "barcode", "name", "amount_g", "nutrients", "created_at" FROM `food_entry`;--> statement-breakpoint
DROP TABLE `food_entry`;--> statement-breakpoint
ALTER TABLE `__new_food_entry` RENAME TO `food_entry`;--> statement-breakpoint
CREATE TABLE `__new_session_template` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name_key` text NOT NULL,
	`items` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_session_template`("id", "key", "name_key", "items") SELECT "id", "key", "name_key", "items" FROM `session_template`;--> statement-breakpoint
DROP TABLE `session_template`;--> statement-breakpoint
ALTER TABLE `__new_session_template` RENAME TO `session_template`;--> statement-breakpoint
CREATE UNIQUE INDEX `session_template_key_unique` ON `session_template` (`key`);--> statement-breakpoint
CREATE TABLE `__new_set_log` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_index` integer NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`done` integer DEFAULT false NOT NULL,
	`superset_group` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `workout_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_set_log`("id", "session_id", "exercise_id", "set_index", "reps", "weight_kg", "done", "superset_group", "created_at") SELECT "id", "session_id", "exercise_id", "set_index", "reps", "weight_kg", "done", "superset_group", "created_at" FROM `set_log`;--> statement-breakpoint
DROP TABLE `set_log`;--> statement-breakpoint
ALTER TABLE `__new_set_log` RENAME TO `set_log`;--> statement-breakpoint
CREATE TABLE `__new_task` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`estimated_minutes` integer,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`window_day` text,
	`window_start` text,
	`window_end` text,
	`context` text,
	`block_id` text,
	`week_id` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`block_id`) REFERENCES `block`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`week_id`) REFERENCES `week`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_task`("id", "title", "category", "estimated_minutes", "recurrence", "status", "window_day", "window_start", "window_end", "context", "block_id", "week_id", "created_at", "completed_at") SELECT "id", "title", "category", "estimated_minutes", "recurrence", "status", "window_day", "window_start", "window_end", "context", "block_id", "week_id", "created_at", "completed_at" FROM `task`;--> statement-breakpoint
DROP TABLE `task`;--> statement-breakpoint
ALTER TABLE `__new_task` RENAME TO `task`;--> statement-breakpoint
CREATE TABLE `__new_week` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`iso_week` integer NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_week`("id", "year", "iso_week", "status", "source", "created_at") SELECT "id", "year", "iso_week", "status", "source", "created_at" FROM `week`;--> statement-breakpoint
DROP TABLE `week`;--> statement-breakpoint
ALTER TABLE `__new_week` RENAME TO `week`;--> statement-breakpoint
CREATE UNIQUE INDEX `week_year_iso_unique` ON `week` (`year`,`iso_week`);--> statement-breakpoint
CREATE TABLE `__new_week_template` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_week_template`("id", "name", "data", "created_at") SELECT "id", "name", "data", "created_at" FROM `week_template`;--> statement-breakpoint
DROP TABLE `week_template`;--> statement-breakpoint
ALTER TABLE `__new_week_template` RENAME TO `week_template`;--> statement-breakpoint
CREATE TABLE `__new_workout_session` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text,
	`template_id` text,
	`title` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `block`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`template_id`) REFERENCES `session_template`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_workout_session`("id", "block_id", "template_id", "title", "started_at", "ended_at", "status") SELECT "id", "block_id", "template_id", "title", "started_at", "ended_at", "status" FROM `workout_session`;--> statement-breakpoint
DROP TABLE `workout_session`;--> statement-breakpoint
ALTER TABLE `__new_workout_session` RENAME TO `workout_session`;