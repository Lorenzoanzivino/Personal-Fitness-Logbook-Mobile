-- Migration 0003: Add rest_pause_seconds to routine_exercise_sets

ALTER TABLE "routine_exercise_sets" ADD COLUMN IF NOT EXISTS "rest_pause_seconds" integer;
