-- Migration 0001: Circuit intervals & Body Measurements update

-- 1. Routine Blocks: Add circuit type and interval settings
ALTER TABLE "routine_blocks" ADD COLUMN IF NOT EXISTS "circuit_type" varchar(20) DEFAULT 'STANDARD';
ALTER TABLE "routine_blocks" ADD COLUMN IF NOT EXISTS "interval_work_seconds" integer;
ALTER TABLE "routine_blocks" ADD COLUMN IF NOT EXISTS "interval_rest_seconds" integer;

-- 2. Body Measurements: Add date, weight, and new biometrics
ALTER TABLE "body_measurements" ADD COLUMN IF NOT EXISTS "date" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "body_measurements" ADD COLUMN IF NOT EXISTS "weight" numeric(5, 2);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='body_measurements' AND column_name='weight_kg') THEN
    UPDATE "body_measurements" SET "weight" = "weight_kg" WHERE "weight" IS NULL AND "weight_kg" IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='body_measurements' AND column_name='recorded_at') THEN
    UPDATE "body_measurements" SET "date" = "recorded_at" WHERE "date" IS NULL AND "recorded_at" IS NOT NULL;
  END IF;
END $$;

UPDATE "body_measurements" SET "weight" = 70.0 WHERE "weight" IS NULL;
ALTER TABLE "body_measurements" ALTER COLUMN "weight" SET NOT NULL;

ALTER TABLE "body_measurements" ADD COLUMN IF NOT EXISTS "body_fat_percentage" numeric(4, 1);
ALTER TABLE "body_measurements" ADD COLUMN IF NOT EXISTS "bmr" numeric(6, 1);
ALTER TABLE "body_measurements" ADD COLUMN IF NOT EXISTS "water_percentage" numeric(4, 1);
ALTER TABLE "body_measurements" ADD COLUMN IF NOT EXISTS "fat_mass_kg" numeric(5, 2);
ALTER TABLE "body_measurements" ADD COLUMN IF NOT EXISTS "protein_percentage" numeric(4, 1);
ALTER TABLE "body_measurements" ADD COLUMN IF NOT EXISTS "skeletal_muscle_mass_kg" numeric(5, 2);
ALTER TABLE "body_measurements" ADD COLUMN IF NOT EXISTS "subcutaneous_fat_percentage" numeric(4, 1);
