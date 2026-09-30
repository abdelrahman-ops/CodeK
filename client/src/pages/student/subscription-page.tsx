import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Calendar,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  History,
  XCircle,
  AlertTriangle,
  Building2,
  Smartphone,
  Send,
  Copy,
  Check,
  Info,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Award
} from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { api } from '../../lib/api/client.js';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { useToast } from '../../components/ui/toast.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { VodafoneCashLogo, InstaPayLogo } from '../../components/shared/payment-logos.js';

export function SubscriptionPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const txnParam = searchParams.get('txn') || searchParams.get('merchant_order_id');
  const isPaymentReturn = searchParams.get('payment') === 'complete' || searchParams.get('success') === 'true' || !!txnParam;
  const [isVerifyingReturn, setIsVerifyingReturn] = useState(false);
  const [verificationDone, setVerificationDone] = useState(false);
  const { user } = useAuth();
  const isHybrid = user?.student?.attendanceRequired === true;

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Payment method selection & manual payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalStep, setPaymentModalStep] = useState<'SELECT_METHOD' | 'MANUAL_DETAILS'>('SELECT_METHOD');
  const [selectedMethod, setSelectedMethod] = useState<'PAYMOB' | 'VODAFONE_CASH' | 'INSTAPAY'>('PAYMOB');
  const [targetPlanIdForModal, setTargetPlanIdForModal] = useState<string | undefined>(undefined);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Manual payment submission state
  const [pendingManualTxn, setPendingManualTxn] = useState<{
    id: string;
    method: string;
    amount: number;
    currency: string;
    receivingAccount?: string;
    instructions?: string;
  } | null>(null);
  const [senderPhone, setSenderPhone] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);

  const handleReceiptFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(isRtl ? 'يرجى اختيار ملف صورة صالح (PNG, JPG, WebP)' : 'Please select a valid image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error(isRtl ? 'حجم الصورة كبير جداً، الحد الأقصى 8 ميجابايت' : 'Image is too large (max 8MB)');
      return;
    }
    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptImage(reader.result as string);
    };
    reader.onerror = () => {
      toast.error(isRtl ? 'حدث خطأ أثناء قراءة ملف الصورة' : 'Error reading image file');
    };
    reader.readAsDataURL(file);
  };

  // Automatically verify payment redirect from gateway (e.g. Paymob)
  useEffect(() => {
    if (isPaymentReturn && txnParam && !isVerifyingReturn && !verificationDone) {
      setIsVerifyingReturn(true);
      const paramsObj = Object.fromEntries(searchParams.entries());

      api.billing.verifyRedirect(paramsObj)
        .then((res: any) => {
          setVerificationDone(true);
          toast.success(
            isRtl
              ? 'تم التحقق من عملية الدفع وتفعيل اشتراكك بنجاح! مرحباً بك'
              : 'Payment verified and subscription activated successfully! Welcome'
          );
          queryClient.invalidateQueries({ queryKey: ['mySubscription'] });
          queryClient.invalidateQueries({ queryKey: ['myPaymentHistory'] });
          queryClient.invalidateQueries({ queryKey: ['studentDashboard'] });
          // Clean the query parameters from the URL
          navigate('/student/subscription', { replace: true });
        })
        .catch((err: any) => {
          console.error('Redirect payment verification error:', err);
          setVerificationDone(true);
          toast.error(
            err.response?.data?.error?.message ||
              (isRtl ? 'جاري مراجعة المعاملة من قبل الإدارة' : 'Payment verification issue')
          );
          queryClient.invalidateQueries({ queryKey: ['mySubscription'] });
          queryClient.invalidateQueries({ queryKey: ['myPaymentHistory'] });
        })
        .finally(() => {
          setIsVerifyingReturn(false);
        });
    }
  }, [searchParams, isPaymentReturn, txnParam, isVerifyingReturn, verificationDone, isRtl, navigate, queryClient, toast]);

  // Prevent background scrolling and double scrollbars when modals are open
  useEffect(() => {
    if (showPaymentModal || showCancelModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showPaymentModal, showCancelModal]);

  // 1. Fetch current subscription
  const { data: subData, isLoading: isLoadingSub } = useQuery({
    queryKey: ['mySubscription'],
    queryFn: async () => (await api.billing.getMySubscription()).data.data
  });

  // 2. Fetch available subscription plans
  const { data: plansData, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['subscriptionPlans'],
    queryFn: async () => (await api.subscriptions.listPlans()).data.data
  });

  // 3. Fetch payment history
  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['myPaymentHistory'],
    queryFn: async () => (await api.billing.getMyPayments()).data.data
  });

  // 4. Fetch enabled payment methods
  const { data: paymentMethodsData } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: async () => (await api.billing.getPaymentMethods()).data.data
  });

  // 5. Checkout mutation (supports Paymob, Vodafone Cash, InstaPay)
  const checkoutMutation = useMutation({
    mutationFn: async ({ planId, method }: { planId?: string; method: string }) => {
      const res = await api.billing.checkout({ planId, paymentMethod: method });
      return res.data.data;
    },
    onSuccess: (checkout) => {
      if (checkout.redirectUrl) {
        toast.success(isRtl ? 'تم تجهيز بوابة الدفع بنجاح' : 'Checkout ready');
        window.location.href = checkout.redirectUrl;
      } else if (
        checkout.manualPayment ||
        checkout.receivingAccount ||
        checkout.paymentMethod === 'VODAFONE_CASH' ||
        checkout.paymentMethod === 'INSTAPAY'
      ) {
        const manual = checkout.manualPayment || {};
        const receiving = manual.receivingAccount || checkout.receivingAccount;
        const instructions = isRtl
          ? (manual.instructionsAr || manual.instructions || checkout.instructions)
          : (manual.instructionsEn || manual.instructions || checkout.instructions);
        setPendingManualTxn({
          id: checkout.transactionId,
          method: checkout.paymentMethod,
          amount: checkout.amount,
          currency: checkout.currency || 'EGP',
          receivingAccount: receiving,
          instructions: instructions
        });
        setPaymentModalStep('MANUAL_DETAILS');
        queryClient.invalidateQueries({ queryKey: ['myPaymentHistory'] });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.response?.data?.error || (isRtl ? 'حدث خطأ في بدء الدفع' : 'Checkout failed'));
    }
  });

  // 6. Submit manual payment details mutation
  const submitManualMutation = useMutation({
    mutationFn: async () => {
      if (!pendingManualTxn) return;
      return (await api.billing.submitManualPayment(pendingManualTxn.id, {
        senderPhone: senderPhone.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        receiptUrl: receiptImage || undefined,
        notes: manualNotes.trim() || undefined
      })).data.data;
    },
    onSuccess: () => {
      toast.success(
        isRtl
          ? 'تم إرسال بيانات التحويل وإيصال الدفع بنجاح! سيتم مراجعة الدفع وتفعيل الاشتراك بواسطة الإدارة.'
          : 'Transfer details & receipt submitted successfully! Admin will verify and activate your subscription.'
      );
      setShowPaymentModal(false);
      setPendingManualTxn(null);
      setSenderPhone('');
      setReferenceNumber('');
      setManualNotes('');
      setReceiptImage(null);
      setReceiptFileName(null);
      queryClient.invalidateQueries({ queryKey: ['myPaymentHistory'] });
      queryClient.invalidateQueries({ queryKey: ['mySubscription'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || (isRtl ? 'فشل إرسال بيانات التحويل' : 'Failed to submit details'));
    }
  });

  const handleStartCheckout = (planId?: string) => {
    setTargetPlanIdForModal(planId);
    setPaymentModalStep('SELECT_METHOD');
    setSelectedMethod('PAYMOB');
    setCopiedAccount(false);
    setReceiptImage(null);
    setReceiptFileName(null);
    setShowPaymentModal(true);
  };

  const renderBenefitItem = (feat: any, idx: number) => {
    let text = '';
    let iconName = 'check';

    if (typeof feat === 'string') {
      text = feat.replace(/^svg[:\s\-_]*/i, '').trim();
    } else if (feat && typeof feat === 'object') {
      text = isRtl ? (feat.textAr || feat.textEn) : (feat.textEn || feat.textAr);
      iconName = feat.icon || 'check';
      text = (text || '').replace(/^svg[:\s\-_]*/i, '').trim();
    }

    const renderIcon = (name: string) => {
      switch (name) {
        case 'star':
          return <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />;
        case 'code':
          return <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />;
        case 'video':
          return <CreditCard className="w-4 h-4 text-sky-500 shrink-0" />;
        case 'trophy':
          return <Sparkles className="w-4 h-4 text-yellow-500 shrink-0" />;
        case 'sparkles':
          return <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />;
        case 'award':
          return <Award className="w-4 h-4 text-indigo-500 shrink-0" />;
        default:
          return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      }
    };

    return (
      <li key={idx} className="flex items-center gap-2">
        {renderIcon(iconName)}
        <span>{text}</span>
      </li>
    );
  };

  // 5. Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await api.billing.cancelSubscription(reason);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success(isRtl ? 'تم إلغاء التجديد التلقائي للاشتراك بنجاح' : 'Auto-renewal canceled');
      setShowCancelModal(false);
      queryClient.invalidateQueries({ queryKey: ['mySubscription'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || (isRtl ? 'فشل إلغاء الاشتراك' : 'Cancellation failed'));
    }
  });

  const subscription = subData?.subscription;
  const currentPlan = subData?.plan;
  const isActive = subData?.isActive;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isRtl
      ? d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
      : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatPrice = (amount: number, currency: string = 'EGP') => {
    return isRtl ? `${amount} ج.م` : `${amount} ${currency}`;
  };

  const effectivePlan = currentPlan || (plansData || []).find((p: any) => p.id === selectedPlanId) || (plansData || []).find((p: any) => p.isActive) || (plansData || [])[0];
  const activePlanPrice = effectivePlan?.price;
  const activePlanCurrency = effectivePlan?.currency ?? 'EGP';
  const planRateText = activePlanPrice != null ? formatPrice(activePlanPrice, activePlanCurrency) : '';
  const planDisplayRate = planRateText ? `${planRateText} / ${isRtl ? '30 يوماً' : '30 days'}` : (isRtl ? 'الاشتراك الشهري' : 'Monthly Subscription');

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">{isRtl ? 'نشط' : 'Active'}</Badge>;
      case 'PAST_DUE':
        return <Badge variant="warning">{isRtl ? 'متأخر' : 'Past Due'}</Badge>;
      case 'CANCELED':
        return <Badge variant="secondary">{isRtl ? 'ملغى' : 'Canceled'}</Badge>;
      case 'EXPIRED':
        return <Badge variant="danger">{isRtl ? 'منتهي' : 'Expired'}</Badge>;
      default:
        return <Badge variant="default">{isRtl ? 'غير مشترك' : 'Not Subscribed'}</Badge>;
    }
  };

  const getTxnStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">{isRtl ? 'ناجح' : 'Paid'}</Badge>;
      case 'PENDING':
        return <Badge variant="warning">{isRtl ? 'قيد المراجعة' : 'Pending'}</Badge>;
      case 'FAILED':
        return <Badge variant="danger">{isRtl ? 'فشل' : 'Failed'}</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">{isRtl ? 'مرفوض' : 'Rejected'}</Badge>;
      case 'REFUNDED':
        return <Badge variant="outline">{isRtl ? 'مسترجع' : 'Refunded'}</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const pendingManualPayment = (paymentsData || []).find(
    (p) => (p.provider === 'VODAFONE_CASH' || p.provider === 'INSTAPAY') && p.status === 'PENDING'
  );

  if (isLoadingSub || isLoadingPlans) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-brand-500" />
          {isRtl ? 'اشتراكي والمدفوعات' : 'My Subscription & Billing'}
        </h1>
        <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
          {isRtl
            ? 'إدارة خطة اشتراكك، تفاصيل التجديد وسجل المعاملات المالية الآمنة'
            : 'Manage your active plan, renewal schedule, and secure transaction history'}
        </p>
      </div>

      {/* Gateway Redirect Verification Banner */}
      {isVerifyingReturn && (
        <div className="p-5 rounded-2xl border-2 border-brand-400 bg-brand-50/90 dark:bg-brand-950/40 shadow-sm flex items-center gap-4">
          <Sparkles className="w-6 h-6 text-brand-600 animate-spin shrink-0" />
          <div>
            <div className="font-bold text-slate-900 dark:text-white">
              {isRtl ? 'جاري تأكيد عملية الدفع من بوابة Paymob وتفعيل اشتراكك...' : 'Verifying Paymob payment and activating subscription...'}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {isRtl ? 'يرجى الانتظار ثوانٍ معدودة ريثما يتم تحديث حسابك بالكامل...' : 'Please wait a moment while your account is being updated...'}
            </div>
          </div>
        </div>
      )}

      {/* Pending Manual Payment Alert */}
      {pendingManualPayment && (
        <div className="p-5 rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/40 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300 font-semibold text-base">
              <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
              <span>{isRtl ? 'طلب تحويل يدوي قيد المراجعة والتحقق' : 'Manual Payment Pending Verification'}</span>
            </div>
            <Badge variant="warning">{isRtl ? 'بانتظار موافقة الإدارة' : 'Pending Verification'}</Badge>
          </div>
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {isRtl
              ? `تم تسجيل طلب تحويل بقيمة ${pendingManualPayment.amount} ج.م عبر (${pendingManualPayment.provider === 'VODAFONE_CASH' ? 'فودافون كاش' : 'إنستاباي'}). يقوم فريق الإدارة حالياً بمراجعة بيانات التحويل وتأكيد الاشتراك. سيتم تفعيل حسابك والوصول الكامل لجميع الدروس فور التحقق.`
              : `A transfer request of ${pendingManualPayment.amount} EGP via (${pendingManualPayment.provider}) has been submitted. Academy admin will verify your transfer and activate your subscription shortly.`}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-amber-800 dark:text-amber-300 pt-1 border-t border-amber-200 dark:border-amber-800">
            {pendingManualPayment.metadata?.senderPhone && (
              <div>{isRtl ? 'رقم المحول:' : 'Sender:'} <span className="font-bold">{pendingManualPayment.metadata.senderPhone}</span></div>
            )}
            {pendingManualPayment.metadata?.referenceNumber && (
              <div>{isRtl ? 'الرقم المرجعي:' : 'Reference:'} <span className="font-bold">{pendingManualPayment.metadata.referenceNumber}</span></div>
            )}
            <div>{isRtl ? 'تاريخ الطلب:' : 'Submitted:'} <span className="font-bold">{formatDate(pendingManualPayment.createdAt)}</span></div>
          </div>
        </div>
      )}

      {/* Track Indicator Banner */}
      {isHybrid ? (
        <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/70 dark:bg-purple-950/30 flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="text-xs sm:text-sm text-purple-900 dark:text-purple-200">
            <strong className="block sm:inline font-bold">
              {isRtl ? 'المسار المدمج (حضوري + أونلاين):' : 'Hybrid Learning Track (In-Person + Online):'}
            </strong>{' '}
            {isRtl
              ? `يتم دفع الاشتراك الشهري (${planDisplayRate}) نقداً أو إلكترونياً لدى مكتب الاستقبال خلال جلسات السبت بالأكاديمية. عند التسجيل يفعّل اشتراكك الرقمي فوراً مع وصول كامل لكافة المواد.`
              : `Monthly subscription (${planDisplayRate}) is typically paid in person at the academy desk during Saturday sessions. Once recorded by staff, your digital access is activated/extended immediately.`}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/30 flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-xs sm:text-sm text-blue-900 dark:text-blue-200">
            <strong className="block sm:inline font-bold">
              {isRtl ? 'المسار الأونلاين بالكامل:' : 'Full Online Track:'}
            </strong>{' '}
            {isRtl
              ? `تعلّم بنسبة 100% عن بعد. يتم تجديد الاشتراك (${planDisplayRate}) مباشرة عبر الدفع الإلكتروني الآمن بالبطاقة البنكية أو المحفظة الذكية.`
              : `Learn 100% remotely. Subscription renewals (${planDisplayRate}) are processed online via secure card or mobile wallet.`}
          </div>
        </div>
      )}

      {/* 1. Current Subscription Status Card */}
      <Card className="p-6 sm:p-7 border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/60 shadow-sm rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {isRtl ? 'حالة الحساب' : 'Account Status'}
              </span>
              {getStatusBadge(subscription?.status)}
              {isActive && planRateText && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {planDisplayRate}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">
              {isActive
                ? (isRtl ? 'اشتراكك الإلكتروني مفعل بالكامل' : 'Your Learning Subscription is Active')
                : subscription?.status === 'EXPIRED'
                ? (isRtl ? 'انتهت صلاحية اشتراكك' : 'Your Subscription has Expired')
                : (isRtl ? 'لا يوجد اشتراك نشط حالياً' : 'No Active Subscription')}
            </h2>

            {/* Reassurance & Context */}
            {subscription?.status === 'EXPIRED' ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>{isRtl ? 'تقدمك ونقاطك محفوظة بالكامل!' : 'Your Progress and XP are Fully Preserved!'}</span>
                </p>
                <p className="leading-relaxed">
                  {isRtl
                    ? `جميع دروسك المكتملة، ونقاط XP، والمشاريع البرمجية تظل محفوظة في حسابك دائماً. جدد اشتراكك الآن (${planDisplayRate}) لمتابعة التعلّم فوراً.`
                    : `All your completed lessons, XP, and coding progress remain permanently saved. Renew now for ${planDisplayRate} to continue learning.`}
                </p>
              </div>
            ) : !isActive ? (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                {isRtl
                  ? `اشترك في أكاديمية CodeK ${planRateText ? `مقابل ${planDisplayRate}` : ''} للاستمتاع بوصول كامل لكافة المسارات البرمجية، الفيديوهات التطبيقية، والتحديات العملية.`
                  : `Subscribe to CodeK Academy ${planRateText ? `for ${planDisplayRate}` : ''} for unlimited access to all courses, video walkthroughs, and practical coding tasks.`}
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                {isRtl
                  ? 'لديك وصول كامل ومباشر لكافة المسارات والدروس والمشاريع البرمجية على المنصة.'
                  : 'You have full access to all programming tracks, lessons, and hands-on projects.'}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Calendar className="w-4 h-4 text-brand-500 shrink-0" />
                <span>
                  {isRtl ? 'تاريخ الانتهاء:' : 'Expiry Date:'}{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {formatDate(subscription?.currentPeriodEnd)}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  {isRtl ? 'الوصول للدروس:' : 'Lesson Access:'}{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {isActive ? (isRtl ? 'متاح بالكامل' : 'Full Access') : (isRtl ? 'معاينة فقط' : 'Preview Only')}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <CreditCard className="w-4 h-4 text-purple-500 shrink-0" />
                <span>
                  {isRtl ? 'سعر الخطة:' : 'Plan Rate:'}{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {planRateText} / {isRtl ? '30 يوماً' : '30 days'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action CTA */}
          <div className="flex flex-col gap-2.5 shrink-0">
            {isHybrid ? (
              isActive ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>{isRtl ? 'الاشتراك نشط' : 'Subscription Active'}</span>
                  </div>
                  <div>{isRtl ? 'ينتهي في:' : 'Ends on:'} <strong>{formatDate(subscription?.currentPeriodEnd)}</strong></div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                    {isRtl ? 'تم تسجيل الدفع بواسطة الأكاديمية.' : 'Payment recorded by Academy administration.'}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 max-w-sm space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                    <Building2 className="w-4 h-4" />
                    <span>{isRtl ? 'المسار المدمج (حضوري + أونلاين)' : 'Hybrid Learning Track'}</span>
                  </div>
                  <p className="leading-relaxed">
                    {isRtl
                      ? `يتم دفع الاشتراك الشهري بقيمة ${planRateText} في الأكاديمية.`
                      : `Monthly subscription of ${planRateText} is paid in person at the academy.`}
                  </p>
                  <p className="text-[11px] text-purple-700/90 dark:text-purple-400 leading-normal">
                    {isRtl
                      ? 'بعد تسجيل الإدارة للدفع، سيتم تفعيل اشتراكك والوصول الكامل لجميع الدروس والمحتوى أونلاين.'
                      : 'After admin records your payment, full online course access will be activated.'}
                  </p>
                </div>
              )
            ) : isActive ? (
              <Button
                onClick={() => handleStartCheckout(selectedPlanId || subscription?.planId || undefined)}
                disabled={checkoutMutation.isPending}
                className="gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>{checkoutMutation.isPending ? (isRtl ? 'جاري التحضير...' : 'Processing...') : (isRtl ? 'تجديد مبكر (+30 يوماً)' : 'Renew Early (+30 Days)')}</span>
              </Button>
            ) : (
              <Button
                onClick={() => handleStartCheckout(selectedPlanId || undefined)}
                disabled={checkoutMutation.isPending}
                className="gap-2 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20 px-6"
              >
                <CreditCard className="w-4 h-4" />
                <span>{checkoutMutation.isPending ? (isRtl ? 'جاري التحضير...' : 'Processing...') : (isRtl ? `اشتراك / تجديد (${planRateText})` : `Subscribe / Renew (${planRateText})`)}</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 2. Available Subscription Plans */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            {isRtl ? 'خطط الاشتراك المتاحة' : 'Available Subscription Plans'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isRtl
              ? 'اختر الخطة المناسبة للانطلاق في رحلة تعلّم البرمجة وافتح جميع المسارات والمشاريع'
              : 'Choose the ideal plan to unlock all learning paths, projects, and exercises'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(plansData || []).map((plan) => {
            const isSelected = subscription?.planId === plan.id && isActive;
            const features = Array.isArray(plan.features) ? plan.features : [];

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between p-6 sm:p-7 rounded-3xl transition-all border-2 overflow-visible ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-950/20 shadow-md ring-1 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                {isSelected && (
                  <div className="absolute -top-3.5 start-6 bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-bold py-1 px-3.5 rounded-full shadow-md z-10 flex items-center gap-1.5 border border-white/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'خطتك الحالية' : 'Current Plan'}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h4>
                    {plan.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{plan.description}</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <span className="text-3xl font-semibold text-slate-900 dark:text-white">
                      {formatPrice(plan.price, plan.currency)}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">
                      / {isRtl ? (plan.billingInterval === 'MONTHLY' ? 'شهرياً' : plan.billingInterval) : plan.billingInterval.toLowerCase()}
                    </span>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-2 pt-2 text-sm text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{isRtl ? 'وصول غير محدود لجميع الدروس' : 'Unlimited lesson access'}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{isRtl ? 'أداء التحديات والمشاريع العملية' : 'Hands-on projects & tasks'}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{isRtl ? 'نقاط XP واعتلاء قائمة المتصدرين' : 'XP, badges & leaderboard'}</span>
                    </li>
                    {features.map((feat: any, idx: number) => renderBenefitItem(feat, idx))}
                  </ul>
                </div>

                <div className="pt-6">
                  {isHybrid ? (
                    <div className="p-3 text-center rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-800 dark:text-purple-300 font-semibold">
                      {isSelected ? (
                        <span className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          {isRtl ? 'الاشتراك مفعل في الأكاديمية' : 'Active Academy Subscription'}
                        </span>
                      ) : (
                        <span>{isRtl ? `يتم الدفع في مقر الأكاديمية (${formatPrice(plan.price, plan.currency)})` : `Paid at academy desk (${formatPrice(plan.price, plan.currency)})`}</span>
                      )}
                    </div>
                  ) : isSelected ? (
                    <Button
                      variant="outline"
                      className="w-full border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold"
                      disabled={checkoutMutation.isPending}
                      onClick={() => handleStartCheckout(plan.id)}
                    >
                      <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                      {checkoutMutation.isPending
                        ? (isRtl ? 'جاري التحضير...' : 'Processing...')
                        : (isRtl ? 'تجديد مبكر (+30 يوماً)' : 'Renew Early (+30 Days)')}
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-brand-600 hover:bg-brand-700 text-white shadow-md hover:shadow-lg transition-all font-bold"
                      disabled={checkoutMutation.isPending}
                      onClick={() => handleStartCheckout(plan.id)}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      {checkoutMutation.isPending
                        ? (isRtl ? 'جاري التحضير...' : 'Processing...')
                        : subscription?.status === 'EXPIRED'
                        ? (isRtl ? `تجديد الاشتراك (${formatPrice(plan.price, plan.currency)})` : `Renew Subscription (${formatPrice(plan.price, plan.currency)})`)
                        : (isRtl ? `الاشتراك الآن (${formatPrice(plan.price, plan.currency)})` : `Subscribe Now (${formatPrice(plan.price, plan.currency)})`)}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. Payment History Table */}
      <div className="space-y-4">
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <History className="w-5 h-5 text-brand-500" />
          {isRtl ? 'سجل المدفوعات والمعاملات' : 'Payment History'}
        </h3>

        <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
          {paymentsData && paymentsData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-medium">
                  <tr>
                    <th className="py-3 px-4">{isRtl ? 'التاريخ' : 'Date'}</th>
                    <th className="py-3 px-4">{isRtl ? 'الخطة' : 'Plan'}</th>
                    <th className="py-3 px-4">{isRtl ? 'المبلغ' : 'Amount'}</th>
                    <th className="py-3 px-4">{isRtl ? 'بوابة الدفع' : 'Provider'}</th>
                    <th className="py-3 px-4">{isRtl ? 'رقم المعاملة' : 'Reference'}</th>
                    <th className="py-3 px-4">{isRtl ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paymentsData.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {formatDate(txn.paidAt || txn.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {txn.plan?.name || txn.description || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {formatPrice(txn.amount, txn.currency)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs uppercase">
                        {txn.provider || 'PAYMOB'}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-500">
                        {txn.providerTransactionId || txn.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4">
                        {getTxnStatusBadge(txn.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              {isRtl ? 'لا توجد معاملات سابقة مسجلة' : 'No previous transactions found'}
            </div>
          )}
        </Card>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setShowCancelModal(false)} />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isRtl ? 'تأكيد إلغاء التجديد التلقائي' : 'Confirm Auto-Renewal Cancellation'}
              </h3>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              {isRtl
                ? `سيظل اشتراكك فعالاً ولديك كامل صلاحيات الوصول حتى ${formatDate(subscription?.currentPeriodEnd)}. لن يتم تجديد الاشتراك تلقائياً بعد هذا التاريخ.`
                : `Your subscription will remain active with full access until ${formatDate(subscription?.currentPeriodEnd)}. It will not automatically renew.`}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isRtl ? 'سبب الإلغاء (اختياري)' : 'Reason (optional)'}
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={isRtl ? 'أخبرنا كيف يمكننا التحسين...' : 'Let us know how we can improve...'}
                className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3.5 py-2.5 text-slate-900 dark:text-white outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" onClick={() => setShowCancelModal(false)} className="font-bold text-sm">
                {isRtl ? 'تراجع' : 'Keep Subscription'}
              </Button>
              <Button
                variant="danger"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(cancelReason)}
                className="font-bold text-sm"
              >
                {cancelMutation.isPending ? (isRtl ? 'جاري المعالجة...' : 'Canceling...') : (isRtl ? 'تأكيد الإلغاء' : 'Confirm Cancel')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Payment Method & Manual Payment Modal */}
      {showPaymentModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          {/* Backdrop click dismiss */}
          <div className="fixed inset-0" onClick={() => setShowPaymentModal(false)} />

          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-6 my-auto animate-in zoom-in-95 duration-200">
            {paymentModalStep === 'SELECT_METHOD' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {isRtl ? 'اختر وسيلة الدفع' : 'Select Payment Method'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {isRtl ? 'اختر القناة الأنسب لك لتفعيل اشتراكك' : 'Choose how you would like to pay'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Paymob */}
                  <div
                    onClick={() => setSelectedMethod('PAYMOB')}
                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-center gap-4 ${
                      selectedMethod === 'PAYMOB'
                        ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/30 ring-2 ring-brand-500/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-brand-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selectedMethod === 'PAYMOB'
                        ? 'border-brand-600 bg-brand-600'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {selectedMethod === 'PAYMOB' && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {isRtl ? 'بطاقة بنكية / محفظة إلكترونية (فوري)' : 'Credit Card / E-Wallet (Instant)'}
                        </span>
                        <Badge variant="success" size="sm" className="font-bold">{isRtl ? 'تفعيل لحظي' : 'Instant'}</Badge>
                      </div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                        {isRtl
                          ? 'الدفع المباشر عبر فيزا / ماستركارد أو المحافظ الإلكترونية وتفعيل الاشتراك لحظياً'
                          : 'Instant payment via Visa / Mastercard or mobile wallets with instant activation'}
                      </p>
                    </div>
                  </div>

                  {/* Vodafone Cash */}
                  {paymentMethodsData?.find((m: any) => m.id === 'VODAFONE_CASH') && (
                    <div
                      onClick={() => setSelectedMethod('VODAFONE_CASH')}
                      className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-4 ${
                        selectedMethod === 'VODAFONE_CASH'
                          ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/30 ring-2 ring-brand-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-brand-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-2.5 transition-colors ${
                        selectedMethod === 'VODAFONE_CASH'
                          ? 'border-brand-600 bg-brand-600'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {selectedMethod === 'VODAFONE_CASH' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <VodafoneCashLogo className="w-9 h-9" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {isRtl ? 'فودافون كاش (تحويل يدوي)' : 'Vodafone Cash (Manual Transfer)'}
                          </span>
                          <Badge variant="warning" size="sm" className="font-bold">{isRtl ? 'مراجعة يدوية' : 'Manual Review'}</Badge>
                        </div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                          {isRtl
                            ? 'التحويل المباشر لرقم فودافون كاش المعتمد وتقديم رقم العملية للمراجعة والتفعيل'
                            : 'Transfer directly to the official Vodafone Cash number and submit the reference code'}
                        </p>
                        {paymentMethodsData?.find((m: any) => m.id === 'VODAFONE_CASH')?.receivingAccount && (
                          <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                              {isRtl ? 'رقم المحفظة المعتمد:' : 'Receiving Wallet:'}{' '}
                              <strong className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
                                {paymentMethodsData.find((m: any) => m.id === 'VODAFONE_CASH')?.receivingAccount}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* InstaPay */}
                  {paymentMethodsData?.find((m: any) => m.id === 'INSTAPAY') && (
                    <div
                      onClick={() => setSelectedMethod('INSTAPAY')}
                      className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-4 ${
                        selectedMethod === 'INSTAPAY'
                          ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/30 ring-2 ring-brand-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-brand-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-2.5 transition-colors ${
                        selectedMethod === 'INSTAPAY'
                          ? 'border-brand-600 bg-brand-600'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {selectedMethod === 'INSTAPAY' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <InstaPayLogo className="w-9 h-9" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {isRtl ? 'إنستاباي InstaPay (تحويل يدوي)' : 'InstaPay (Manual Transfer)'}
                          </span>
                          <Badge variant="warning" size="sm" className="font-bold">{isRtl ? 'مراجعة يدوية' : 'Manual Review'}</Badge>
                        </div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                          {isRtl
                            ? 'التحويل اللحظي عبر تطبيق إنستاباي لحساب الأكاديمية وإرفاق الكود المرجعي للتحقق'
                            : 'Transfer instantly using InstaPay to the academy IPA and submit the reference code'}
                        </p>
                        {paymentMethodsData?.find((m: any) => m.id === 'INSTAPAY')?.receivingAccount && (
                          <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                              {isRtl ? 'حساب إنستاباي المعتمد (IPA):' : 'Receiving IPA:'}{' '}
                              <strong className="font-mono text-sm font-bold text-purple-600 dark:text-purple-400">
                                {paymentMethodsData.find((m: any) => m.id === 'INSTAPAY')?.receivingAccount}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="ghost"
                    onClick={() => setShowPaymentModal(false)}
                    className="font-bold text-sm h-11 px-5 text-slate-600 dark:text-slate-300"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={() =>
                      checkoutMutation.mutate({
                        planId: targetPlanIdForModal,
                        method: selectedMethod
                      })
                    }
                    isLoading={checkoutMutation.isPending}
                    className="font-bold text-sm h-11 px-6 bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20"
                  >
                    <span>{isRtl ? 'متابعة الدفع' : 'Continue to Payment'}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180 ms-1.5" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Step 2: MANUAL_DETAILS */
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      pendingManualTxn?.method === 'VODAFONE_CASH'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        : 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                    }`}>
                      {pendingManualTxn?.method === 'VODAFONE_CASH' ? (
                        <Smartphone className="w-5 h-5" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {pendingManualTxn?.method === 'VODAFONE_CASH'
                          ? (isRtl ? 'بيانات تحويل فودافون كاش' : 'Vodafone Cash Transfer')
                          : (isRtl ? 'بيانات تحويل إنستاباي' : 'InstaPay Transfer')}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {isRtl ? 'يرجى تحويل المبلغ ثم إدخال بيانات التأكيد بالأسفل' : 'Complete the transfer and provide the details below'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {/* Amount & Receiving Account Banner */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{isRtl ? 'المبلغ المطلوب تحويله:' : 'Amount to Transfer:'}</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                      {formatPrice(pendingManualTxn?.amount || activePlanPrice, pendingManualTxn?.currency || activePlanCurrency)}
                    </span>
                  </div>

                  {pendingManualTxn?.receivingAccount && (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {pendingManualTxn.method === 'VODAFONE_CASH'
                            ? (isRtl ? 'رقم محفظة فودافون كاش المستلمة' : 'Receiving Vodafone Cash Number')
                            : (isRtl ? 'عنوان حساب إنستاباي المستلم (IPA)' : 'Receiving InstaPay IPA')}
                        </div>
                        <div className="font-mono font-bold text-base text-brand-600 dark:text-brand-400 mt-0.5">
                          {pendingManualTxn.receivingAccount}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs font-bold"
                        onClick={() => {
                          if (pendingManualTxn.receivingAccount) {
                            navigator.clipboard.writeText(pendingManualTxn.receivingAccount);
                            setCopiedAccount(true);
                            setTimeout(() => setCopiedAccount(false), 2500);
                          }
                        }}
                      >
                        {copiedAccount ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAccount ? (isRtl ? 'تم النسخ' : 'Copied') : (isRtl ? 'نسخ' : 'Copy')}</span>
                      </Button>
                    </div>
                  )}

                  {pendingManualTxn?.instructions && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 leading-relaxed">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{pendingManualTxn.instructions}</span>
                    </div>
                  )}
                </div>

                {/* Form: Sender Phone, Reference, Notes */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitManualMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isRtl ? 'رقم الهاتف المحول منه (المحفظة)' : 'Sender Phone / Wallet Number'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isRtl ? 'مثال: 01012345678' : 'e.g. 01012345678'}
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-brand-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isRtl ? 'رقم العملية المرجعي / كود التحويل' : 'Transfer Reference / Transaction ID'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isRtl ? 'الرقم المرجعي المستلم في رسالة التأكيد' : 'Reference number from SMS or receipt'}
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-brand-500 font-mono font-bold"
                    />
                  </div>

                  {/* Transfer Screenshot Upload Field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-brand-600" />
                        <span>{isRtl ? 'صورة إشعار / إيصال التحويل (موصى بها بشدة)' : 'Transfer Screenshot / Receipt Proof'}</span>
                      </span>
                      <span className="text-[11px] font-normal text-slate-400">
                        {isRtl ? 'PNG, JPG, WebP حتى 8 ميجابايت' : 'PNG, JPG up to 8MB'}
                      </span>
                    </label>

                    {receiptImage ? (
                      <div className="relative p-3 rounded-2xl border-2 border-brand-500/40 bg-brand-50/30 dark:bg-brand-950/20 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img
                            src={receiptImage}
                            alt="Receipt preview"
                            className="w-14 h-14 object-cover rounded-xl border border-brand-200 dark:border-brand-800 shadow-xs shrink-0"
                          />
                          <div className="overflow-hidden">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {receiptFileName || (isRtl ? 'صورة الإيصال المرفقة' : 'Attached Receipt')}
                            </div>
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5 font-semibold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isRtl ? 'تم تجهيز الصورة للإرسال' : 'Image ready for submission'}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setReceiptImage(null);
                            setReceiptFileName(null);
                          }}
                          className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shrink-0"
                          title={isRtl ? 'إزالة الصورة' : 'Remove image'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="group relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 bg-slate-50/50 hover:bg-brand-50/30 dark:bg-slate-900/40 dark:hover:bg-brand-950/20 cursor-pointer transition text-center">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/jpg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleReceiptFileChange(file);
                          }}
                          className="sr-only"
                        />
                        <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {isRtl ? 'اضغط لرفع لقطة الشاشة أو اسحب الصورة هنا' : 'Click to upload screenshot or drag and drop'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {isRtl
                            ? 'إرفاق صورة التحويل يساعد فريق الإدارة على تفعيل اشتراكك بأسرع وقت'
                            : 'Attaching proof speeds up verification and immediate activation'}
                        </div>
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isRtl ? 'ملاحظات إضافية (اختياري)' : 'Additional Notes (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'اسم صاحب المحفظة أو أي توضيحات...' : 'Account holder name or remarks...'}
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPaymentModalStep('SELECT_METHOD')}
                      className="font-bold text-sm h-11 px-5"
                    >
                      {isRtl ? 'رجوع' : 'Back'}
                    </Button>
                    <Button
                      type="submit"
                      isLoading={submitManualMutation.isPending}
                      disabled={!senderPhone.trim() || !referenceNumber.trim()}
                      className="font-bold text-sm h-11 px-6 bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4 me-1.5" />
                      <span>{isRtl ? 'تأكيد وإرسال بيانات التحويل' : 'Submit Verification Details'}</span>
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
