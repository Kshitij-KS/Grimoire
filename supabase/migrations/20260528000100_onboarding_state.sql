-- Migration: Add onboarding_state JSONB column to profiles table
-- Stores user onboarding progress across sessions

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_state jsonb
  DEFAULT '{"currentStep": 0, "completedSteps": [false, false, false, false], "dismissed": false, "finished": false}';
