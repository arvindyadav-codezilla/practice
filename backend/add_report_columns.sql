-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Adds biometrics columns for the AI Fitness Coach Report

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_level VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS waist NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS neck NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hip NUMERIC;

-- Verify columns:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('gender', 'activity_level', 'waist', 'neck', 'hip');
