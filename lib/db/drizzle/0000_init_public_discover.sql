CREATE TABLE IF NOT EXISTS "trips" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "trips" SET "is_public" = false WHERE "is_public" IS NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_public_feed_idx" ON "trips" USING btree ("is_public","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_handle_lower_unique" ON "user_profiles" USING btree (lower("handle"));
