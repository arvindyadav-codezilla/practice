-- Database changes required for Gym Owner Admin Panel, Attendance, and Interactive AI WhatsApp Agent

-- 1. Add role & gym_owner_id & twilio credentials & biometrics & active status to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'member';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gym_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twilio_account_sid VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twilio_auth_token VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twilio_sender_number VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS callmebot_key VARCHAR(255);

-- Biometrics
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bmi NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medical_conditions TEXT;

-- 2. Create assigned_plans table
CREATE TABLE IF NOT EXISTS assigned_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workout_plan JSONB,
    diet_plan JSONB,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'present', -- 'present', 'absent'
    marked_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (member_id, date)
);

-- 4. Create whatsapp_chat_history table
CREATE TABLE IF NOT EXISTS whatsapp_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    messages JSONB DEFAULT '[]'::jsonb, -- Store list of dicts: {"role": "user"|"assistant", "content": "text"}
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create leads table for sales follow-ups
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'converted', 'not_interested'
    last_followup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
