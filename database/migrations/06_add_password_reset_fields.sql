-- Migration: Add password reset fields to users table
-- Description: Adds fields for password reset token and expiration
-- Date: 2026-01-05

-- Add reset token fields to users table
ALTER TABLE users
ADD COLUMN reset_token VARCHAR(255),
ADD COLUMN reset_token_expires TIMESTAMP;

-- Add index for faster token lookup
CREATE INDEX idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;

-- Comment the columns
COMMENT ON COLUMN users.reset_token IS 'Token for password reset (hashed)';
COMMENT ON COLUMN users.reset_token_expires IS 'Expiration timestamp for reset token (typically 1 hour)';
