ALTER TABLE "User"
ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP(3),
ADD COLUMN "adminMfaSecret" TEXT,
ADD COLUMN "adminMfaEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "AuthTokenType" ADD VALUE IF NOT EXISTS 'ADMIN_MFA';

ALTER TABLE "User"
ADD CONSTRAINT "User_failedLoginAttempts_check"
CHECK ("failedLoginAttempts" >= 0);

CREATE INDEX "User_lockedUntil_idx" ON "User"("lockedUntil");

-- Privileged audit history is append-only even if application code is compromised.
CREATE OR REPLACE FUNCTION prevent_admin_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AdminAuditLog_append_only_update"
BEFORE UPDATE ON "AdminAuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_mutation();

CREATE TRIGGER "AdminAuditLog_append_only_delete"
BEFORE DELETE ON "AdminAuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_mutation();
