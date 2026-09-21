CREATE TABLE IF NOT EXISTS "body_measurements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"weight_kg" numeric(5, 2) NOT NULL,
	"weight_delta_kg" numeric(5, 2),
	"bmi" numeric(4, 1),
	"body_fat_pct" numeric(4, 1),
	"muscle_mass_kg" numeric(5, 2),
	"lean_mass_kg" numeric(5, 2),
	"water_pct" numeric(4, 1),
	"bone_mass_kg" numeric(4, 2),
	"visceral_fat" numeric(4, 1),
	"bmr_kcal" integer,
	"amr_kcal" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "diet_pdfs" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"start_date" varchar(20) NOT NULL,
	"end_date" varchar(20),
	"is_active" smallint DEFAULT 1 NOT NULL,
	"notes" text,
	"source_file_name" varchar(255),
	"file_path" varchar(500) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100) DEFAULT 'application/pdf',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"muscle_group" varchar(50) NOT NULL,
	"exercise_type" varchar(20) NOT NULL,
	"description" text,
	"video_url" text,
	"is_archived" smallint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otps" (
	"code" varchar(16) PRIMARY KEY NOT NULL,
	"trainer_id" varchar(64) NOT NULL,
	"trainer_name" varchar(150) NOT NULL,
	"client_id" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routine_exercise_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"routine_exercise_id" integer NOT NULL,
	"set_number" integer NOT NULL,
	"set_type" varchar(30) DEFAULT 'normal' NOT NULL,
	"target_weight_kg" numeric(6, 2) DEFAULT '0' NOT NULL,
	"target_reps" integer DEFAULT 0 NOT NULL,
	"target_time_seconds" integer,
	"band_assistance" varchar(30) DEFAULT 'none',
	"dropset_weight_kg" numeric(6, 2),
	"drops" jsonb DEFAULT '[]'::jsonb,
	"rest_seconds" integer DEFAULT 90 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routine_exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"routine_id" integer NOT NULL,
	"exercise_id" integer,
	"exercise_order" integer DEFAULT 1 NOT NULL,
	"superset_group" varchar(20),
	"custom_description" text,
	"custom_video_url" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routine_folders" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255),
	"role" varchar(20) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"birth_date" varchar(20),
	"height_cm" numeric(5, 2),
	"avatar_url" text,
	"email" varchar(255),
	"is_profile_completed" boolean DEFAULT false,
	"raw_otp" varchar(20),
	"notes" text,
	"trainer_id" varchar(64),
	"trainer_name" varchar(150),
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workout_routines" (
	"id" serial PRIMARY KEY NOT NULL,
	"folder_id" varchar(64),
	"folder_name" varchar(100),
	"border_color" varchar(30) DEFAULT '#3B82F6',
	"name" varchar(150) NOT NULL,
	"description" text,
	"workout_type" varchar(50),
	"duration_weeks" integer DEFAULT 4 NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workout_session_exercises" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workout_session_id" bigserial NOT NULL,
	"exercise_id" integer,
	"exercise_name_snapshot" varchar(150) NOT NULL,
	"muscle_group_snapshot" varchar(50) NOT NULL,
	"exercise_order" integer DEFAULT 1 NOT NULL,
	"superset_group" varchar(20),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workout_session_sets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_exercise_id" bigserial NOT NULL,
	"set_number" integer NOT NULL,
	"set_type" varchar(30) DEFAULT 'normal' NOT NULL,
	"weight_kg" numeric(6, 2) DEFAULT '0' NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"time_seconds" integer,
	"band_assistance" varchar(30) DEFAULT 'none',
	"dropset_weight_kg" numeric(6, 2),
	"drops" jsonb DEFAULT '[]'::jsonb,
	"rest_seconds" integer,
	"rpe" numeric(3, 1),
	"completed" boolean DEFAULT true NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workout_sessions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"routine_id" integer,
	"routine_name_snapshot" varchar(150) NOT NULL,
	"date" varchar(20) NOT NULL,
	"duration_minutes" integer,
	"workout_type" varchar(50),
	"week_number" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diet_pdfs" ADD CONSTRAINT "diet_pdfs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "otps" ADD CONSTRAINT "otps_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "otps" ADD CONSTRAINT "otps_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_exercise_sets" ADD CONSTRAINT "routine_exercise_sets_routine_exercise_id_routine_exercises_id_fk" FOREIGN KEY ("routine_exercise_id") REFERENCES "public"."routine_exercises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_routine_id_workout_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."workout_routines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_folders" ADD CONSTRAINT "routine_folders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_routines" ADD CONSTRAINT "workout_routines_folder_id_routine_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."routine_folders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_routines" ADD CONSTRAINT "workout_routines_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_workout_session_id_workout_sessions_id_fk" FOREIGN KEY ("workout_session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_session_sets" ADD CONSTRAINT "workout_session_sets_session_exercise_id_workout_session_exercises_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."workout_session_exercises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_routine_id_workout_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."workout_routines"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
