CREATE TABLE `body_measurement` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real NOT NULL,
	`fat_percent` real,
	`created_at` text NOT NULL
);
