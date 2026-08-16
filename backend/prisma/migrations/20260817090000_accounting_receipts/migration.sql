CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'CANCELLED');

CREATE TYPE "ReceiptSource" AS ENUM ('WEBSITE', 'MANUAL');

CREATE TYPE "ReceiptPaymentMethod" AS ENUM ('WEBSITE', 'CARD', 'BANK_TRANSFER', 'BIT', 'CASH', 'OTHER');

CREATE TABLE "ReceiptSequence" (
    "key" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptSequence_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "documentNumber" INTEGER NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "payerAddress" TEXT,
    "businessName" TEXT NOT NULL,
    "businessTaxId" TEXT NOT NULL,
    "businessAddress" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "paymentMethod" "ReceiptPaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "source" "ReceiptSource" NOT NULL,
    "electronicDocumentLabel" TEXT,
    "electronicDocsConsentAt" TIMESTAMP(3),
    "electronicDocsConsentSource" TEXT,
    "orderId" UUID,
    "paymentId" UUID,
    "documentHash" TEXT NOT NULL,
    "pdfHash" TEXT,
    "signedPdfHash" TEXT,
    "signedPdfStorageKey" TEXT,
    "signedPdfByteSize" INTEGER,
    "signatureMetadata" JSONB,
    "createdById" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Receipt_amount_check" CHECK ("amountMinor" > 0),
    CONSTRAINT "Receipt_cancelled_check" CHECK (
      ("status" = 'ISSUED' AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL)
      OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL)
    ),
    CONSTRAINT "Receipt_website_link_check" CHECK (
      ("source" = 'MANUAL' AND "paymentId" IS NULL)
      OR ("source" = 'WEBSITE' AND "orderId" IS NOT NULL AND "paymentId" IS NOT NULL)
    )
);

CREATE TABLE "ReceiptEvent" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "actorId" UUID,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Receipt_documentNumber_key" ON "Receipt"("documentNumber");
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");
CREATE INDEX "Receipt_issuedAt_idx" ON "Receipt"("issuedAt");
CREATE INDEX "Receipt_customerEmail_idx" ON "Receipt"("customerEmail");
CREATE INDEX "Receipt_orderId_idx" ON "Receipt"("orderId");
CREATE INDEX "Receipt_source_issuedAt_idx" ON "Receipt"("source", "issuedAt");
CREATE INDEX "Receipt_status_issuedAt_idx" ON "Receipt"("status", "issuedAt");
CREATE INDEX "ReceiptEvent_receiptId_createdAt_idx" ON "ReceiptEvent"("receiptId", "createdAt");
CREATE INDEX "ReceiptEvent_actorId_createdAt_idx" ON "ReceiptEvent"("actorId", "createdAt");

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceiptEvent" ADD CONSTRAINT "ReceiptEvent_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ReceiptSequence" ("key", "nextNumber", "updatedAt") VALUES ('receipt', 1, CURRENT_TIMESTAMP);

CREATE OR REPLACE FUNCTION prevent_receipt_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Issued receipts cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Receipt_no_delete"
BEFORE DELETE ON "Receipt"
FOR EACH ROW EXECUTE FUNCTION prevent_receipt_delete();

CREATE OR REPLACE FUNCTION prevent_receipt_immutable_update()
RETURNS trigger AS $$
BEGIN
  IF OLD."documentNumber" IS DISTINCT FROM NEW."documentNumber"
    OR OLD."issuedAt" IS DISTINCT FROM NEW."issuedAt"
    OR OLD."customerName" IS DISTINCT FROM NEW."customerName"
    OR OLD."customerEmail" IS DISTINCT FROM NEW."customerEmail"
    OR OLD."payerAddress" IS DISTINCT FROM NEW."payerAddress"
    OR OLD."businessName" IS DISTINCT FROM NEW."businessName"
    OR OLD."businessTaxId" IS DISTINCT FROM NEW."businessTaxId"
    OR OLD."businessAddress" IS DISTINCT FROM NEW."businessAddress"
    OR OLD."amountMinor" IS DISTINCT FROM NEW."amountMinor"
    OR OLD."currency" IS DISTINCT FROM NEW."currency"
    OR OLD."description" IS DISTINCT FROM NEW."description"
    OR OLD."paymentMethod" IS DISTINCT FROM NEW."paymentMethod"
    OR OLD."paymentReference" IS DISTINCT FROM NEW."paymentReference"
    OR OLD."source" IS DISTINCT FROM NEW."source"
    OR OLD."electronicDocumentLabel" IS DISTINCT FROM NEW."electronicDocumentLabel"
    OR OLD."electronicDocsConsentAt" IS DISTINCT FROM NEW."electronicDocsConsentAt"
    OR OLD."electronicDocsConsentSource" IS DISTINCT FROM NEW."electronicDocsConsentSource"
    OR OLD."orderId" IS DISTINCT FROM NEW."orderId"
    OR OLD."paymentId" IS DISTINCT FROM NEW."paymentId"
    OR OLD."documentHash" IS DISTINCT FROM NEW."documentHash"
    OR OLD."createdById" IS DISTINCT FROM NEW."createdById"
  THEN
    RAISE EXCEPTION 'Issued receipt immutable fields cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Receipt_immutable_update"
BEFORE UPDATE ON "Receipt"
FOR EACH ROW EXECUTE FUNCTION prevent_receipt_immutable_update();
