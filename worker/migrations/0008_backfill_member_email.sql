-- Members who joined from the QR were linked to their Google account but their Gmail was never saved on the member record.
UPDATE OR IGNORE members
SET invite_email = (SELECT lower(u.email) FROM users u WHERE u.id = members.user_id)
WHERE invite_email IS NULL AND user_id IS NOT NULL AND anonymised_at IS NULL;
