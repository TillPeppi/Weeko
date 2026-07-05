PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_profile` (
	`id` integer PRIMARY KEY NOT NULL,
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
INSERT INTO `__new_profile`("id", "height_cm", "age", "sex", "weight_kg", "goal", "goal_rate_kg_per_week", "nutrition_goals", "language", "theme", "onboarding_done", "updated_at") SELECT "id", "height_cm", "age", "sex", "weight_kg", "goal", "goal_rate_kg_per_week", "nutrition_goals", "language", "theme", "onboarding_done", "updated_at" FROM `profile`;--> statement-breakpoint
DROP TABLE `profile`;--> statement-breakpoint
ALTER TABLE `__new_profile` RENAME TO `profile`;--> statement-breakpoint
PRAGMA foreign_keys=ON;