-- Staff can add a member with their Gmail. The first Google sign-in with that address links the member,
-- the same way staff invites work. One email per gym; the same email can be a member at other gyms.
ALTER TABLE members ADD COLUMN invite_email TEXT;
CREATE UNIQUE INDEX idx_members_gym_invite_email ON members (gym_id, invite_email) WHERE invite_email IS NOT NULL;
CREATE INDEX idx_members_invite_email ON members (invite_email) WHERE invite_email IS NOT NULL;
