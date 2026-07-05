CREATE TABLE `food_entry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
CREATE TABLE `food_product` (
	`barcode` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`quantity` text,
	`package_g` real,
	`serving_g` real,
	`nutrients` text NOT NULL,
	`nutri_score` text,
	`source` text DEFAULT 'off' NOT NULL,
	`fetched_at` text NOT NULL
);
