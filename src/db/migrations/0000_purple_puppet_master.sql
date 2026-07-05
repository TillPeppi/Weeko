CREATE TABLE `block` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
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
CREATE TABLE `equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`available` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exercise` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`equipment_id` integer,
	`is_weighted` integer DEFAULT false NOT NULL,
	`notes` text,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `notification_pref` (
	`category` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`quiet_start` text,
	`quiet_end` text,
	`escalation_minutes` integer DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`height_cm` real,
	`age` integer,
	`sex` text,
	`weight_kg` real,
	`goal` text,
	`goal_rate_kg_per_week` real,
	`language` text DEFAULT 'de' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`onboarding_done` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_template` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`name_key` text NOT NULL,
	`items` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_template_key_unique` ON `session_template` (`key`);--> statement-breakpoint
CREATE TABLE `set_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`set_index` integer NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`done` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `workout_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`estimated_minutes` integer,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`window_day` text,
	`window_start` text,
	`window_end` text,
	`context` text,
	`block_id` integer,
	`week_id` integer,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`block_id`) REFERENCES `block`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`week_id`) REFERENCES `week`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `week` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`iso_week` integer NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `week_year_iso_unique` ON `week` (`year`,`iso_week`);--> statement-breakpoint
CREATE TABLE `week_template` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_structure` (
	`weekday` integer PRIMARY KEY NOT NULL,
	`work_start` text,
	`work_end` text,
	`work_location` text,
	`done_by` text,
	`fixed_blocks` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`block_id` integer,
	`template_id` integer,
	`title` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `block`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`template_id`) REFERENCES `session_template`(`id`) ON UPDATE no action ON DELETE set null
);
