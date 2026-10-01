-- Migration 0002: routine_blocks block_type update and routine_exercise_sets stripping/drop fields

ALTER TABLE "routine_blocks" ALTER COLUMN "block_type" TYPE varchar(50);
ALTER TABLE "routine_blocks" ALTER COLUMN "block_type" SET DEFAULT 'SINGLE';

ALTER TABLE "routine_exercise_sets" ALTER COLUMN "set_type" SET DEFAULT 'NORMAL';
ALTER TABLE "routine_exercise_sets" ADD COLUMN IF NOT EXISTS "drop_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "routine_exercise_sets" ADD COLUMN IF NOT EXISTS "drop_percentage" real;
