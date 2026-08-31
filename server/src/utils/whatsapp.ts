import { normalizeEgyptianPhone } from './phone.js';

export interface WhatsAppOnboardingParams {
  studentName: string;
  loginId: string;
  tempPassword: string;
  phone: string;
  groupName?: string;
  scheduleInfo?: string;
  whatsappGroupUrl?: string;
  appBaseUrl?: string;
  lang?: 'ar' | 'en';
}

export function generateWhatsAppOnboardingMessage(params: WhatsAppOnboardingParams): {
  messageText: string;
  whatsappUrl: string;
  normalizedPhone: string;
} {
  const isAr = params.lang !== 'en'; // Default to Arabic
  const baseUrl = params.appBaseUrl || process.env.APP_BASE_URL || 'http://localhost:3000';
  const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`;
  const normalizedPhone = normalizeEgyptianPhone(params.phone);
  // Phone number for wa.me link should not have '+'
  const waPhoneNum = normalizedPhone.replace(/^\+/, '');

  let messageText = '';

  if (isAr) {
    messageText = `أهلاً بك في أكاديمية CodeK! 🚀

عزيزي/عزيزتي: ${params.studentName}
يسعدنا إبلاغك بأنه تم قبول طلب تسجيلك وإنشاء حسابك الطلابي بالأكاديمية.

موقع الأكاديمية:
${loginUrl}

اسم المستخدم (Login ID):
${params.loginId}

كلمة المرور المؤقتة:
${params.tempPassword}
`;

    if (params.groupName) {
      messageText += `\nالمجموعة الدراسية: ${params.groupName}`;
    }
    if (params.scheduleInfo) {
      messageText += `\nمواعيد الحصص: ${params.scheduleInfo}`;
    }
    if (params.whatsappGroupUrl) {
      messageText += `\nرابط مجموعة الواتساب الخاصة بالفصل:\n${params.whatsappGroupUrl}`;
    }

    messageText += `\n\nيرجى تسجيل الدخول وتغيير كلمة المرور المؤقتة فوراً. نتمنى لك رحلة ممتعة معنا! 🎉`;
  } else {
    messageText = `Welcome to CodeK Academy! 🚀

Dear ${params.studentName},
We are pleased to inform you that your registration application has been approved and your student account is ready.

Academy Portal:
${loginUrl}

Login ID:
${params.loginId}

Temporary Password:
${params.tempPassword}
`;

    if (params.groupName) {
      messageText += `\nGroup: ${params.groupName}`;
    }
    if (params.scheduleInfo) {
      messageText += `\nSchedule: ${params.scheduleInfo}`;
    }
    if (params.whatsappGroupUrl) {
      messageText += `\nClassroom WhatsApp Group Link:\n${params.whatsappGroupUrl}`;
    }

    messageText += `\n\nPlease log in and change your temporary password immediately. We wish you great success! 🎉`;
  }

  const encodedText = encodeURIComponent(messageText);
  const whatsappUrl = `https://wa.me/${waPhoneNum}?text=${encodedText}`;

  return {
    messageText,
    whatsappUrl,
    normalizedPhone
  };
}
