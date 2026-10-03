-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "loanAmount" DECIMAL(12,2) NOT NULL,
    "interestRate" DECIMAL(7,4) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "monthlyPayment" DECIMAL(10,2) NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_vehicleId_idx" ON "Loan"("vehicleId");

-- CreateIndex
CREATE INDEX "LoanInstallment_loanId_idx" ON "LoanInstallment"("loanId");

-- CreateIndex
CREATE INDEX "LoanInstallment_dueDate_idx" ON "LoanInstallment"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "LoanInstallment_loanId_periodNumber_key" ON "LoanInstallment"("loanId", "periodNumber");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Add loanId to Attachment if not exists)
-- This migration assumes Attachment.loanId already exists from previous schema
-- If you need to add it: ALTER TABLE "Attachment" ADD COLUMN "loanId" TEXT;
-- If you need the foreign key: ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- If you need the index: CREATE INDEX "Attachment_loanId_idx" ON "Attachment"("loanId");
