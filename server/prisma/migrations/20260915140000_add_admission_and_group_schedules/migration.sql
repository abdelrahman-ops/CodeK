-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WAITLISTED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'INVALIDATED');

-- AlterTable AuthToken
ALTER TABLE "AuthToken" ADD COLUMN "status" "OtpStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "AuthToken" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex AuthToken
CREATE INDEX "AuthToken_userId_type_status_idx" ON "AuthToken"("userId", "type", "status");

-- CreateTable GroupSchedule
CREATE TABLE "GroupSchedule" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable StudentRegistration
CREATE TABLE "StudentRegistration" (
    "id" TEXT NOT NULL,
    "registrationCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappPhone" TEXT,
    "email" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "schoolName" TEXT,
    "grade" TEXT,
    "programmingLevel" "Difficulty" NOT NULL DEFAULT 'BEGINNER',
    "previousExperience" TEXT,
    "motivation" TEXT,
    "preferredDays" TEXT,
    "preferredTimes" TEXT,
    "preferredGroupId" TEXT,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "parentRelationship" "RelationshipType",
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdStudentId" TEXT,
    "clientIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable RegistrationSetting
CREATE TABLE "RegistrationSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "maxRegistrations" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable PaymentSetting
CREATE TABLE "PaymentSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "vodafoneCashNumber" TEXT NOT NULL DEFAULT '01012345678',
    "vodafoneCashInstructions" TEXT DEFAULT 'حول المبلغ المطلوب إلى رقم فودافون كاش ثم أدخل رقم الهاتف المحول منه ورقم العملية لتأكيد الدفع.',
    "instaPayAddress" TEXT NOT NULL DEFAULT 'codek@instapay',
    "instaPayInstructions" TEXT DEFAULT 'حول المبلغ المطلوب عبر تطبيق إنستاباي إلى العنوان أعلاه ثم أدخل الرقم المرجعي للتحويل.',
    "vodafoneCashEnabled" BOOLEAN NOT NULL DEFAULT true,
    "instaPayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paymobEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex GroupSchedule
CREATE UNIQUE INDEX "GroupSchedule_groupId_dayOfWeek_key" ON "GroupSchedule"("groupId", "dayOfWeek");
CREATE INDEX "GroupSchedule_groupId_isActive_idx" ON "GroupSchedule"("groupId", "isActive");
CREATE INDEX "GroupSchedule_dayOfWeek_isActive_idx" ON "GroupSchedule"("dayOfWeek", "isActive");

-- CreateIndex StudentRegistration
CREATE UNIQUE INDEX "StudentRegistration_registrationCode_key" ON "StudentRegistration"("registrationCode");
CREATE UNIQUE INDEX "StudentRegistration_createdStudentId_key" ON "StudentRegistration"("createdStudentId");
CREATE INDEX "StudentRegistration_status_createdAt_idx" ON "StudentRegistration"("status", "createdAt");
CREATE INDEX "StudentRegistration_phone_idx" ON "StudentRegistration"("phone");

-- AddForeignKey GroupSchedule -> Group
ALTER TABLE "GroupSchedule" ADD CONSTRAINT "GroupSchedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey StudentRegistration -> Group
ALTER TABLE "StudentRegistration" ADD CONSTRAINT "StudentRegistration_preferredGroupId_fkey" FOREIGN KEY ("preferredGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey StudentRegistration -> User
ALTER TABLE "StudentRegistration" ADD CONSTRAINT "StudentRegistration_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey StudentRegistration -> Student
ALTER TABLE "StudentRegistration" ADD CONSTRAINT "StudentRegistration_createdStudentId_fkey" FOREIGN KEY ("createdStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
