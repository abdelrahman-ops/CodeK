import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CreditCard,
  Layers,
  Receipt,
  Plus,
  RotateCcw,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Users,
  AlertTriangle,
  XCircle,
  Calendar,
  Sparkles,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Video,
  Zap,
  Award,
  Shield,
  Star,
  Code,
  Building,
  Laptop,
  Headphones,
  BookOpen,
  Settings,
  Check,
  CheckCheck,
  X,
  Smartphone,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { api } from '../../lib/api/client.js';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Dialog } from '../../components/ui/dialog.js';
import { useToast } from '../../components/ui/toast.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { SubscriptionPlan, PlanBenefit } from '../../types/api.js';
import { useBulkSelection } from '../../hooks/use-bulk-selection.js';
import { BulkSelectionBar } from '../../components/shared/bulk-selection-bar.js';

const AVAILABLE_ICONS = [
  { id: 'check', labelAr: 'علامة صح', labelEn: 'Check mark' },
  { id: 'video', labelAr: 'فيديو ودروس', labelEn: 'Video / Lessons' },
  { id: 'zap', labelAr: 'برق وسرعة', labelEn: 'Lightning' },
  { id: 'award', labelAr: 'شهادة وإنجاز', labelEn: 'Award / Certificate' },
  { id: 'shield', labelAr: 'حماية وضمان', labelEn: 'Shield' },
  { id: 'star', labelAr: 'نجمة وتميز', labelEn: 'Star' },
  { id: 'code', labelAr: 'برمجة وتطوير', labelEn: 'Code' },
  { id: 'users', labelAr: 'مجتمع وتواصل', labelEn: 'Community' },
  { id: 'building', labelAr: 'مقر الأكاديمية', labelEn: 'Academy Campus' },
  { id: 'laptop', labelAr: 'مختبر ومعامل', labelEn: 'Laptop / Lab' },
  { id: 'headphones', labelAr: 'دعم وإرشاد', labelEn: 'Mentorship / Support' },
  { id: 'book-open', labelAr: 'مناهج ومصادر', labelEn: 'Curriculum' }
];

export function AdminBillingPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'subscriptions' | 'transactions' | 'plans' | 'settings'>('subscriptions');

  // Manual payment single & bulk review states
  const [rejectTxnId, setRejectTxnId] = useState<string | null>(null);
  const [rejectTxnReason, setRejectTxnReason] = useState('');
  const [isBulkRejectTxnOpen, setIsBulkRejectTxnOpen] = useState(false);
  const [bulkRejectTxnReason, setBulkRejectTxnReason] = useState('');

  // Payment settings state
  const [settingsForm, setSettingsForm] = useState({
    vodafoneCashNumber: '01012345678',
    vodafoneCashInstructions: '',
    vodafoneCashEnabled: true,
    instaPayAddress: 'codek@instapay',
    instaPayInstructions: '',
    instaPayEnabled: true,
    paymobEnabled: true
  });

  // Subscriptions filter
  const [subStatusFilter, setSubStatusFilter] = useState<string>('');
  const [subPage, setSubPage] = useState(1);

  // Transactions filters & pagination
  const [txnSearch, setTxnSearch] = useState('');
  const [txnStatusFilter, setTxnStatusFilter] = useState<string>('');
  const [txnProviderFilter, setTxnProviderFilter] = useState<string>('');
  const [txnLearningModeFilter, setTxnLearningModeFilter] = useState<string>('');
  const [txnPage, setTxnPage] = useState(1);
  const [txnPageSize, setTxnPageSize] = useState(25);

  // Refund modal state
  const [refundTxnId, setRefundTxnId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');

  // Top header manual payment modal state
  const [showManualRecordModal, setShowManualRecordModal] = useState(false);
  const [manualStudentSearch, setManualStudentSearch] = useState('');
  const [selectedHybridStudentId, setSelectedHybridStudentId] = useState('');
  const [manualPaymentNotes, setManualPaymentNotes] = useState('');

  // Create / Edit plan modal state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    code: '',
    description: '',
    price: 250,
    currency: 'EGP',
    billingInterval: 'MONTHLY',
    isActive: true,
    benefits: [
      { id: 'b-1', textAr: 'الوصول لجميع الدروس والمشاريع أونلاين', textEn: 'Full access to online lessons & projects', icon: 'check', sortOrder: 0 },
      { id: 'b-2', textAr: 'حضور الجلسات العملية في مقر الأكاديمية (للمسار المدمج)', textEn: 'In-person lab sessions at academy campus', icon: 'building', sortOrder: 1 },
      { id: 'b-3', textAr: 'المشاركة في المسابقات ولوحة المتصدرين الأسبوعية', textEn: 'Weekly competitions & leaderboard', icon: 'award', sortOrder: 2 }
    ]
  });

  // Deactivate plan modal state
  const [deactivatingPlan, setDeactivatingPlan] = useState<SubscriptionPlan | null>(null);

  // 1. Subscriptions Query
  const { data: subsData, isLoading: isLoadingSubs } = useQuery({
    queryKey: ['adminSubscriptions', subStatusFilter, subPage],
    enabled: activeTab === 'subscriptions',
    queryFn: async () => {
      const res = await api.billing.adminListSubscriptions({
        status: subStatusFilter || undefined,
        page: subPage,
        limit: 20
      });
      return res.data;
    }
  });

  // 2. Transactions Query (Server-side search, filters, pagination)
  const { data: txnsData, isLoading: isLoadingTxns } = useQuery({
    queryKey: [
      'adminTransactions',
      txnSearch,
      txnStatusFilter,
      txnProviderFilter,
      txnLearningModeFilter,
      txnPage,
      txnPageSize
    ],
    enabled: activeTab === 'transactions',
    queryFn: async () => {
      const res = await api.billing.adminListTransactions({
        search: txnSearch || undefined,
        status: txnStatusFilter || undefined,
        provider: txnProviderFilter || undefined,
        learningMode: txnLearningModeFilter || undefined,
        page: txnPage,
        pageSize: txnPageSize
      });
      return res.data;
    }
  });

  // 3. Plans Query
  const { data: plansData, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['adminBillingPlans'],
    enabled: activeTab === 'plans',
    queryFn: async () => (await api.subscriptions.listPlans()).data.data
  });

  // 4. Hybrid Students Query for the Manual Payment Modal
  const { data: hybridStudents } = useQuery({
    queryKey: ['adminHybridStudents', manualStudentSearch],
    enabled: showManualRecordModal,
    queryFn: async () => {
      const res = await api.students.list({ search: manualStudentSearch || undefined });
      // Only keep HYBRID students (attendanceRequired = true && learningModeSelected = true)
      return (res.data.data || []).filter(
        (s: any) => s.learningModeSelected && s.attendanceRequired
      );
    }
  });

  // 5. Refund Mutation
  const refundMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api.billing.adminRefund(id, reason);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success(
        isRtl
          ? 'تم استرجاع المعاملة المالية وإلغاء الاشتراك المرتبط'
          : 'Refund processed successfully'
      );
      setRefundTxnId(null);
      setRefundReason('');
      queryClient.invalidateQueries({ queryKey: ['adminTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['adminSubscriptions'] });
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.error?.message ||
          (isRtl ? 'فشل عملية الاسترجاع' : 'Refund failed')
      );
    }
  });

  // 6. Manual Payment Mutation (Header modal)
  const manualPaymentMutation = useMutation({
    mutationFn: async ({ studentId, notes }: { studentId: string; notes?: string }) => {
      const res = await api.billing.adminRecordManualPayment({ studentId, notes });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success(
        isRtl
          ? 'تم تسجيل الدفع وتفعيل الاشتراك لمدة 30 يوماً بنجاح'
          : 'Manual payment recorded and subscription activated'
      );
      setShowManualRecordModal(false);
      setSelectedHybridStudentId('');
      setManualPaymentNotes('');
      setManualStudentSearch('');
      queryClient.invalidateQueries({ queryKey: ['adminTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['adminSubscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.error?.message ||
          (isRtl ? 'فشل تسجيل الدفع' : 'Failed to record payment')
      );
    }
  });

  // 7. Save Plan Mutation (Create or Update)
  const savePlanMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: planForm.name.trim(),
        description: planForm.description.trim() || undefined,
        price: Number(planForm.price),
        currency: planForm.currency,
        billingInterval: planForm.billingInterval,
        isActive: planForm.isActive,
        benefits: planForm.benefits.map((b, idx) => ({
          id: b.id || `b-${idx + 1}`,
          textAr: cleanBenefitText(b.textAr),
          textEn: b.textEn ? cleanBenefitText(b.textEn) : undefined,
          icon: b.icon || 'check',
          sortOrder: idx
        }))
      };

      if (editingPlanId) {
        return (await api.subscriptions.updatePlan(editingPlanId, payload)).data.data;
      } else {
        payload.code = planForm.code.trim().toUpperCase();
        return (await api.subscriptions.createPlan(payload)).data.data;
      }
    },
    onSuccess: () => {
      toast.success(
        isRtl
          ? editingPlanId
            ? 'تم تحديث الخطة بنجاح'
            : 'تم إنشاء خطة الاشتراك بنجاح'
          : 'Plan saved successfully'
      );
      setShowPlanModal(false);
      setEditingPlanId(null);
      queryClient.invalidateQueries({ queryKey: ['adminBillingPlans'] });
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.error?.message ||
          (isRtl ? 'فشل حفظ الخطة' : 'Failed to save plan')
      );
    }
  });

  // 8. Delete / Deactivate Plan Mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await api.subscriptions.deletePlan(id)).data;
    },
    onSuccess: (data: any) => {
      const msg =
        data?.message ||
        (isRtl
          ? 'تم تعطيل / حذف الخطة بنجاح'
          : 'Plan deactivated or removed successfully');
      toast.success(msg);
      setDeactivatingPlan(null);
      queryClient.invalidateQueries({ queryKey: ['adminBillingPlans'] });
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.error?.message ||
          (isRtl ? 'فشل تعطيل الخطة' : 'Failed to deactivate plan')
      );
    }
  });

  // 9. Payment Settings Query
  const { data: paymentSettingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['adminPaymentSettings'],
    queryFn: async () => {
      const res = await api.billing.adminGetSettings();
      if (res.data?.data) {
        setSettingsForm({
          vodafoneCashNumber: res.data.data.vodafoneCashNumber || '',
          vodafoneCashInstructions: res.data.data.vodafoneCashInstructions || '',
          vodafoneCashEnabled: res.data.data.vodafoneCashEnabled ?? true,
          instaPayAddress: res.data.data.instaPayAddress || '',
          instaPayInstructions: res.data.data.instaPayInstructions || '',
          instaPayEnabled: res.data.data.instaPayEnabled ?? true,
          paymobEnabled: res.data.data.paymobEnabled ?? true
        });
      }
      return res.data?.data;
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: typeof settingsForm) => {
      return (await api.billing.adminUpdateSettings(data)).data;
    },
    onSuccess: () => {
      toast.success(isRtl ? 'تم حفظ إعدادات الدفع بنجاح' : 'Payment settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['adminPaymentSettings'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  // Manual Payment Mutations
  const confirmTxnMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      return (await api.billing.adminConfirmManualPayment(transactionId)).data;
    },
    onSuccess: () => {
      toast.success(isRtl ? 'تم تأكيد استلام المبلغ وتفعيل اشتراك الطالب' : 'Payment confirmed & subscription activated');
      queryClient.invalidateQueries({ queryKey: ['adminTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['adminSubscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const rejectTxnMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return (await api.billing.adminRejectManualPayment(id, reason)).data;
    },
    onSuccess: () => {
      toast.success(isRtl ? 'تم رفض المعاملة' : 'Transaction rejected');
      setRejectTxnId(null);
      setRejectTxnReason('');
      queryClient.invalidateQueries({ queryKey: ['adminTransactions'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const bulkConfirmTxnMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return (await api.billing.adminBulkConfirmManualPayments(ids)).data;
    },
    onSuccess: (data: any) => {
      toast.success(isRtl ? `تم تأكيد ${data.count || ''} معاملة بنجاح وتفعيل الاشتراكات` : 'Bulk manual payments confirmed');
      manualTxnSelection.deselectAll();
      queryClient.invalidateQueries({ queryKey: ['adminTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['adminSubscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const bulkRejectTxnMutation = useMutation({
    mutationFn: async ({ ids, reason }: { ids: string[]; reason: string }) => {
      return (await api.billing.adminBulkRejectManualPayments(ids, reason)).data;
    },
    onSuccess: () => {
      toast.success(isRtl ? 'تم رفض المعاملات المحددة' : 'Transactions rejected');
      setIsBulkRejectTxnOpen(false);
      setBulkRejectTxnReason('');
      manualTxnSelection.deselectAll();
      queryClient.invalidateQueries({ queryKey: ['adminTransactions'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  // Plans Bulk Status Mutation
  const bulkPlanStatusMutation = useMutation({
    mutationFn: async ({ ids, isActive }: { ids: string[]; isActive: boolean }) => {
      return (await api.billing.adminBulkUpdatePlanStatus(ids, isActive)).data;
    },
    onSuccess: () => {
      toast.success(isRtl ? 'تم تحديث حالة الخطط المحددة' : 'Plans status updated successfully');
      planSelection.deselectAll();
      queryClient.invalidateQueries({ queryKey: ['adminBillingPlans'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  // Selections
  const planSelection = useBulkSelection(plansData || []);
  const pendingManualTxns = (txnsData?.data || []).filter(
    (t: any) => (t.provider === 'VODAFONE_CASH' || t.provider === 'INSTAPAY') && t.status === 'PENDING'
  );
  const manualTxnSelection = useBulkSelection(pendingManualTxns);

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

  const cleanBenefitText = (text: string): string => {
    if (!text) return '';
    return text.replace(/^svg[:\s\-_]*/i, '').trim();
  };

  const renderBenefitIcon = (iconName?: string) => {
    const cls = 'w-4 h-4 shrink-0';
    switch (iconName?.toLowerCase()) {
      case 'video':
        return <Video className={`${cls} text-brand-500`} />;
      case 'zap':
        return <Zap className={`${cls} text-amber-500`} />;
      case 'award':
        return <Award className={`${cls} text-indigo-500`} />;
      case 'shield':
        return <Shield className={`${cls} text-sky-500`} />;
      case 'star':
        return <Star className={`${cls} text-amber-500`} />;
      case 'code':
        return <Code className={`${cls} text-emerald-500`} />;
      case 'users':
        return <Users className={`${cls} text-indigo-500`} />;
      case 'building':
        return <Building className={`${cls} text-purple-500`} />;
      case 'laptop':
        return <Laptop className={`${cls} text-blue-500`} />;
      case 'headphones':
        return <Headphones className={`${cls} text-pink-500`} />;
      case 'book-open':
      case 'book':
        return <BookOpen className={`${cls} text-teal-500`} />;
      default:
        return <CheckCircle2 className={`${cls} text-emerald-500`} />;
    }
  };

  const getSubBadge = (status: string) => {
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
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getTxnBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">{isRtl ? 'ناجح' : 'Paid'}</Badge>;
      case 'PENDING':
        return <Badge variant="warning">{isRtl ? 'قيد المعالجة' : 'Pending'}</Badge>;
      case 'FAILED':
        return <Badge variant="danger">{isRtl ? 'فشل' : 'Failed'}</Badge>;
      case 'REFUNDED':
        return <Badge variant="outline">{isRtl ? 'مسترجع' : 'Refunded'}</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const openEditPlanModal = (plan: SubscriptionPlan) => {
    setEditingPlanId(plan.id);

    // Normalize benefits
    let benefitsList: any[] = [];
    if (Array.isArray(plan.features)) {
      benefitsList = plan.features.map((f: any, idx: number) => {
        if (typeof f === 'string') {
          return {
            id: `b-${idx + 1}`,
            textAr: cleanBenefitText(f),
            textEn: '',
            icon: 'check',
            sortOrder: idx
          };
        }
        return {
          id: f.id || `b-${idx + 1}`,
          textAr: cleanBenefitText(f.textAr || f.text || ''),
          textEn: f.textEn ? cleanBenefitText(f.textEn) : '',
          icon: f.icon || 'check',
          sortOrder: f.sortOrder ?? idx
        };
      });
    }

    if (benefitsList.length === 0) {
      benefitsList = [
        { id: 'b-1', textAr: 'الوصول لجميع الدروس والمشاريع أونلاين', textEn: '', icon: 'check', sortOrder: 0 }
      ];
    }

    setPlanForm({
      name: plan.name,
      code: plan.code,
      description: plan.description || '',
      price: plan.price,
      currency: plan.currency || 'EGP',
      billingInterval: plan.billingInterval || 'MONTHLY',
      isActive: plan.isActive,
      benefits: benefitsList
    });

    setShowPlanModal(true);
  };

  const openCreatePlanModal = () => {
    setEditingPlanId(null);
    setPlanForm({
      name: '',
      code: '',
      description: '',
      price: 250,
      currency: 'EGP',
      billingInterval: 'MONTHLY',
      isActive: true,
      benefits: [
        { id: 'b-1', textAr: 'الوصول لجميع الدروس والمشاريع أونلاين', textEn: 'Full access to online lessons & projects', icon: 'check', sortOrder: 0 },
        { id: 'b-2', textAr: 'حضور الجلسات العملية في مقر الأكاديمية (للمسار المدمج)', textEn: 'In-person lab sessions at academy campus', icon: 'building', sortOrder: 1 },
        { id: 'b-3', textAr: 'المشاركة في المسابقات ولوحة المتصدرين الأسبوعية', textEn: 'Weekly competitions & leaderboard', icon: 'award', sortOrder: 2 }
      ]
    });
    setShowPlanModal(true);
  };

  // Structured benefits list manipulations
  const addBenefitRow = () => {
    setPlanForm((prev) => ({
      ...prev,
      benefits: [
        ...prev.benefits,
        {
          id: `b-${Date.now()}`,
          textAr: '',
          textEn: '',
          icon: 'check',
          sortOrder: prev.benefits.length
        }
      ]
    }));
  };

  const removeBenefitRow = (index: number) => {
    setPlanForm((prev) => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== index)
    }));
  };

  const moveBenefit = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= planForm.benefits.length) return;

    const updated = [...planForm.benefits];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setPlanForm((prev) => ({ ...prev, benefits: updated }));
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-brand-500" />
            {isRtl ? 'إدارة الفواتير والاشتراكات' : 'Billing & Subscriptions'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isRtl
              ? 'متابعة اشتراكات الطلاب، تدقيق المعاملات المالية، تسجيل الدفعات الحضورية، وإدارة خطط الاشتراك'
              : 'Monitor student subscriptions, audit financial transactions, record offline payments, and manage plans'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Action: Record In-Person Payment */}
          <Button
            onClick={() => setShowManualRecordModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm"
          >
            <Wallet className="w-4 h-4 mr-1.5" />
            <span>{isRtl ? 'تسجيل دفع حضوري (250 ج.م)' : 'Record In-Person Payment'}</span>
          </Button>

          {activeTab === 'plans' && (
            <Button onClick={openCreatePlanModal} className="bg-brand-600 hover:bg-brand-700 text-white shrink-0">
              <Plus className="w-4 h-4 mr-1.5" />
              <span>{isRtl ? 'إضافة خطة جديدة' : 'New Plan'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'subscriptions'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          {isRtl ? 'الاشتراكات' : 'Subscriptions'}
          {subsData?.meta?.total !== undefined && (
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
              {subsData.meta.total}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'transactions'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Receipt className="w-4 h-4" />
          {isRtl ? 'المعاملات المالية' : 'Transactions'}
          {txnsData?.pagination?.total !== undefined ? (
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
              {txnsData.pagination.total}
            </span>
          ) : txnsData?.meta?.total !== undefined ? (
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
              {txnsData.meta.total}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'plans'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          {isRtl ? 'خطط الاشتراك' : 'Subscription Plans'}
          {plansData?.length !== undefined && (
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
              {plansData.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'settings'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          {isRtl ? 'إعدادات قنوات الدفع' : 'Payment Settings'}
        </button>
      </div>

      {/* Tab 1: Subscriptions */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={subStatusFilter}
                onChange={(e) => {
                  setSubStatusFilter(e.target.value);
                  setSubPage(1);
                }}
                className="text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="">{isRtl ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="ACTIVE">{isRtl ? 'نشط (ACTIVE)' : 'Active'}</option>
                <option value="PAST_DUE">{isRtl ? 'متأخر (PAST_DUE)' : 'Past Due'}</option>
                <option value="CANCELED">{isRtl ? 'ملغى (CANCELED)' : 'Canceled'}</option>
                <option value="EXPIRED">{isRtl ? 'منتهي (EXPIRED)' : 'Expired'}</option>
              </select>
            </div>
          </div>

          <Card className="overflow-hidden border-slate-200 dark:border-slate-800 rounded-2xl">
            {isLoadingSubs ? (
              <div className="p-6 space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : subsData?.data && subsData.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium">
                    <tr>
                      <th className="py-3 px-4">{isRtl ? 'الطالب' : 'Student'}</th>
                      <th className="py-3 px-4">{isRtl ? 'المسار التعليمي' : 'Learning Mode'}</th>
                      <th className="py-3 px-4">{isRtl ? 'الخطة' : 'Plan'}</th>
                      <th className="py-3 px-4">{isRtl ? 'الحالة' : 'Status'}</th>
                      <th className="py-3 px-4">{isRtl ? 'بداية الفترة' : 'Period Start'}</th>
                      <th className="py-3 px-4">{isRtl ? 'نهاية الفترة' : 'Period End'}</th>
                      <th className="py-3 px-4">{isRtl ? 'تجديد تلقائي' : 'Auto-Renew'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {subsData.data.map((sub: any) => {
                      const student = sub.student;
                      const isHybrid = student?.learningModeSelected && student?.attendanceRequired;
                      const isOnline = student?.learningModeSelected && !student?.attendanceRequired;

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {student?.user?.firstName} {student?.user?.lastName}
                            </div>
                            <div className="text-xs font-mono text-slate-400">
                              {student?.studentCode} • {student?.user?.email || student?.user?.phone}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isHybrid ? (
                              <Badge variant="primary" size="sm" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                                {isRtl ? 'مدمج (حضوري + أونلاين)' : 'Hybrid'}
                              </Badge>
                            ) : isOnline ? (
                              <Badge variant="outline" size="sm" className="text-sky-700 border-sky-300 dark:text-sky-300 dark:border-sky-700">
                                {isRtl ? 'أونلاين' : 'Online'}
                              </Badge>
                            ) : (
                              <Badge variant="warning" size="sm">
                                {isRtl ? 'لم يحدد المسار' : 'Not Selected'}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-200">
                            {sub.plan?.name}
                          </td>
                          <td className="py-3 px-4">{getSubBadge(sub.status)}</td>
                          <td className="py-3 px-4 text-slate-500">{formatDate(sub.currentPeriodStart)}</td>
                          <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                            {formatDate(sub.currentPeriodEnd)}
                          </td>
                          <td className="py-3 px-4">
                            {sub.cancelAtPeriodEnd ? (
                              <Badge variant="warning">{isRtl ? 'ملغى' : 'Disabled'}</Badge>
                            ) : (
                              <Badge variant="success">{isRtl ? 'مُفعّل' : 'Active'}</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-sm">
                {isRtl ? 'لا توجد اشتراكات تطابق هذا الفلتر' : 'No subscriptions found matching filter'}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Transactions (Server-side search, filters, pagination) */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Search and Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search */}
            <div className="md:col-span-2">
              <Input
                placeholder={isRtl ? 'بحث باسم الطالب، الكود، الإيميل، رقم المعاملة...' : 'Search student, code, email, txn...'}
                value={txnSearch}
                onChange={(e) => {
                  setTxnSearch(e.target.value);
                  setTxnPage(1);
                }}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            {/* Status Filter */}
            <div>
              <Select
                value={txnStatusFilter}
                onChange={(e: any) => {
                  setTxnStatusFilter(e.target.value);
                  setTxnPage(1);
                }}
                options={[
                  { value: '', label: isRtl ? 'جميع الحالات' : 'All Statuses' },
                  { value: 'PAID', label: isRtl ? 'ناجح (PAID)' : 'Paid' },
                  { value: 'PENDING', label: isRtl ? 'قيد الانتظار (PENDING)' : 'Pending' },
                  { value: 'FAILED', label: isRtl ? 'فشل (FAILED)' : 'Failed' },
                  { value: 'REFUNDED', label: isRtl ? 'مسترجع (REFUNDED)' : 'Refunded' }
                ]}
              />
            </div>

            {/* Provider Filter */}
            <div>
              <Select
                value={txnProviderFilter}
                onChange={(e: any) => {
                  setTxnProviderFilter(e.target.value);
                  setTxnPage(1);
                }}
                options={[
                  { value: '', label: isRtl ? 'جميع بوابات الدفع' : 'All Providers' },
                  { value: 'PAYMOB', label: 'Paymob' },
                  { value: 'VODAFONE_CASH', label: isRtl ? 'فودافون كاش (Vodafone Cash)' : 'Vodafone Cash' },
                  { value: 'INSTAPAY', label: isRtl ? 'إنستاباي (InstaPay)' : 'InstaPay' },
                  { value: 'MANUAL', label: isRtl ? 'نقدي / مكتب الأكاديمية' : 'In-Person / Reception' }
                ]}
              />
            </div>

            {/* Learning Mode Filter */}
            <div>
              <Select
                value={txnLearningModeFilter}
                onChange={(e: any) => {
                  setTxnLearningModeFilter(e.target.value);
                  setTxnPage(1);
                }}
                options={[
                  { value: '', label: isRtl ? 'جميع المسارات' : 'All Learning Modes' },
                  { value: 'ONLINE', label: isRtl ? 'أونلاين (ONLINE)' : 'Online' },
                  { value: 'HYBRID', label: isRtl ? 'مدمج (HYBRID)' : 'Hybrid' }
                ]}
              />
            </div>
          </div>

          {/* Pending Manual Payments Selection Toolbar */}
          {pendingManualTxns.length > 0 && (
            <BulkSelectionBar
              totalItems={pendingManualTxns.length}
              selectedCount={manualTxnSelection.selectedCount}
              isAllSelected={manualTxnSelection.isAllSelected}
              isIndeterminate={manualTxnSelection.isIndeterminate}
              onToggleSelectAll={manualTxnSelection.toggleSelectAll}
              onDeselectAll={manualTxnSelection.deselectAll}
              isLoading={bulkConfirmTxnMutation.isPending || bulkRejectTxnMutation.isPending}
              actions={[
                {
                  id: 'bulk-confirm',
                  label: isRtl ? 'تأكيد واستلام المحدد' : 'Confirm Selected',
                  icon: <CheckCheck className="w-3.5 h-3.5" />,
                  variant: 'primary',
                  onClick: () => bulkConfirmTxnMutation.mutate(Array.from(manualTxnSelection.selectedIds))
                },
                {
                  id: 'bulk-reject',
                  label: isRtl ? 'رفض المحدد' : 'Reject Selected',
                  icon: <X className="w-3.5 h-3.5" />,
                  variant: 'danger',
                  onClick: () => setIsBulkRejectTxnOpen(true)
                }
              ]}
            />
          )}

          <Card className="overflow-hidden border-slate-200 dark:border-slate-800 rounded-2xl">
            {isLoadingTxns ? (
              <div className="p-6 space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : (() => {
              const items = txnsData?.data || [];
              const pagination = txnsData?.pagination || txnsData?.meta || {};
              const total = pagination.total ?? items.length;
              const totalPages = pagination.totalPages ?? (Math.ceil(total / txnPageSize) || 1);

              return items.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left rtl:text-right text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium">
                        <tr>
                          <th className="w-10 py-3 px-3 text-center">
                            {pendingManualTxns.length > 0 && (
                              <input
                                type="checkbox"
                                checked={manualTxnSelection.isAllSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = manualTxnSelection.isIndeterminate;
                                }}
                                onChange={manualTxnSelection.toggleSelectAll}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-brand-600"
                              />
                            )}
                          </th>
                          <th className="py-3 px-4">{isRtl ? 'التاريخ' : 'Date'}</th>
                          <th className="py-3 px-4">{isRtl ? 'الطالب' : 'Student'}</th>
                          <th className="py-3 px-4">{isRtl ? 'المسار التعليمي' : 'Learning Mode'}</th>
                          <th className="py-3 px-4">{isRtl ? 'المبلغ' : 'Amount'}</th>
                          <th className="py-3 px-4">{isRtl ? 'مصدر الدفع' : 'Payment Source'}</th>
                          <th className="py-3 px-4">{isRtl ? 'رقم المعاملة / التفاصيل' : 'Txn / Transfer Info'}</th>
                          <th className="py-3 px-4">{isRtl ? 'الحالة' : 'Status'}</th>
                          <th className="py-3 px-4 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {items.map((txn: any) => {
                          const student = txn.student;
                          const isHybrid = student?.learningModeSelected && student?.attendanceRequired;
                          const isOnline = student?.learningModeSelected && !student?.attendanceRequired;
                          const isManual = txn.provider === 'MANUAL';
                          const isManualPending = (txn.provider === 'VODAFONE_CASH' || txn.provider === 'INSTAPAY') && txn.status === 'PENDING';
                          const isSelected = manualTxnSelection.isSelected(txn.id);

                          return (
                            <tr
                              key={txn.id}
                              className={`transition-colors ${
                                isSelected
                                  ? 'bg-brand-50/40 dark:bg-brand-950/20'
                                  : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                              }`}
                            >
                              <td className="w-10 py-3 px-3 text-center">
                                {isManualPending ? (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => manualTxnSelection.toggle(txn.id)}
                                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-brand-600"
                                  />
                                ) : null}
                              </td>
                              <td className="py-3 px-4 text-slate-500">{formatDate(txn.paidAt || txn.createdAt)}</td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {student?.user?.firstName} {student?.user?.lastName}
                                </div>
                                <div className="text-xs font-mono text-slate-400">
                                  {student?.studentCode} • {student?.user?.email || student?.user?.phone}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {isHybrid ? (
                                  <Badge variant="primary" size="sm" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                                    {isRtl ? 'مدمج' : 'Hybrid'}
                                  </Badge>
                                ) : isOnline ? (
                                  <Badge variant="outline" size="sm" className="text-sky-700 border-sky-300 dark:text-sky-300 dark:border-sky-700">
                                    {isRtl ? 'أونلاين' : 'Online'}
                                  </Badge>
                                ) : (
                                  <Badge variant="warning" size="sm">
                                    {isRtl ? 'لم يحدد' : 'Not Selected'}
                                  </Badge>
                                )}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                {formatPrice(txn.amount, txn.currency)}
                              </td>
                              {/* Payment source column */}
                              <td className="py-3 px-4">
                                {txn.provider === 'VODAFONE_CASH' ? (
                                  <Badge variant="danger" size="sm" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 flex items-center gap-1 w-fit">
                                    <Smartphone className="w-3 h-3 text-red-600" />
                                    <span>فودافون كاش</span>
                                  </Badge>
                                ) : txn.provider === 'INSTAPAY' ? (
                                  <Badge variant="primary" size="sm" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 flex items-center gap-1 w-fit">
                                    <Smartphone className="w-3 h-3 text-purple-600" />
                                    <span>إنستاباي (InstaPay)</span>
                                  </Badge>
                                ) : isManual ? (
                                  <Badge variant="primary" size="sm" className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1 w-fit">
                                    <Wallet className="w-3 h-3" />
                                    <span>{isRtl ? 'نقدي / مكتب الأكاديمية' : 'In-Person / Academy Desk'}</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" size="sm" className="text-brand-700 border-brand-300 dark:text-brand-300 dark:border-brand-700 flex items-center gap-1 w-fit">
                                    <CreditCard className="w-3 h-3" />
                                    <span>Paymob</span>
                                  </Badge>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-mono text-xs text-slate-700 dark:text-slate-300">
                                  {txn.providerTransactionId || txn.id.slice(0, 8)}
                                </div>
                                {(txn.metadata?.senderPhone || txn.metadata?.referenceNumber) && (
                                  <div className="text-[11px] text-slate-500 mt-0.5 space-y-0.5">
                                    {txn.metadata?.senderPhone && (
                                      <div>
                                        {isRtl ? 'المحول منه:' : 'From:'}{' '}
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                                          {txn.metadata.senderPhone}
                                        </span>
                                      </div>
                                    )}
                                    {txn.metadata?.referenceNumber && (
                                      <div>
                                        {isRtl ? 'الرقم المرجعي:' : 'Ref:'}{' '}
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                                          {txn.metadata.referenceNumber}
                                        </span>
                                      </div>
                                    )}
                                    {txn.metadata?.notes && (
                                      <div className="text-slate-400 italic">"{txn.metadata.notes}"</div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4">{getTxnBadge(txn.status)}</td>
                              <td className="py-3 px-4 text-center">
                                {isManualPending ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 flex items-center gap-1"
                                      onClick={() => confirmTxnMutation.mutate(txn.id)}
                                      isLoading={confirmTxnMutation.isPending}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{isRtl ? 'تأكيد' : 'Confirm'}</span>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs h-7 px-2 flex items-center gap-1"
                                      onClick={() => {
                                        setRejectTxnId(txn.id);
                                        setRejectTxnReason('');
                                      }}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>{isRtl ? 'رفض' : 'Reject'}</span>
                                    </Button>
                                  </div>
                                ) : txn.status === 'PAID' && !isManual ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
                                    onClick={() => setRefundTxnId(txn.id)}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                    <span>{isRtl ? 'استرجاع' : 'Refund'}</span>
                                  </Button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Bar */}
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span>{isRtl ? 'عدد العناصر لكل صفحة:' : 'Rows per page:'}</span>
                      <select
                        value={txnPageSize}
                        onChange={(e) => {
                          setTxnPageSize(Number(e.target.value));
                          setTxnPage(1);
                        }}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-slate-900 dark:text-white"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span>
                        {isRtl
                          ? `إجمالي المعاملات: ${total}`
                          : `Total transactions: ${total}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={txnPage <= 1}
                        onClick={() => setTxnPage((p) => Math.max(p - 1, 1))}
                      >
                        <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                        <span>{isRtl ? 'السابق' : 'Prev'}</span>
                      </Button>

                      <span className="px-3 py-1 font-semibold text-slate-700 dark:text-slate-300">
                        {isRtl
                          ? `صفحة ${txnPage} من ${totalPages}`
                          : `Page ${txnPage} of ${totalPages}`}
                      </span>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={txnPage >= totalPages}
                        onClick={() => setTxnPage((p) => Math.min(p + 1, totalPages))}
                      >
                        <span>{isRtl ? 'التالي' : 'Next'}</span>
                        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  {isRtl ? 'لا توجد معاملات مطابقة لمعايير البحث' : 'No transactions matching search criteria'}
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {/* Tab 3: Subscription Plans CRUD */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              {isRtl
                ? 'إدارة خطط الاشتراكات، الأسعار، والمميزات المنظمة المعروضة للطلاب في صفحة الدفع.'
                : 'Manage subscription plans, pricing, and structured benefits shown to students.'}
            </p>
          </div>

          {/* Plans Bulk Selection Bar */}
          <BulkSelectionBar
            totalItems={(plansData || []).length}
            selectedCount={planSelection.selectedCount}
            isAllSelected={planSelection.isAllSelected}
            isIndeterminate={planSelection.isIndeterminate}
            onToggleSelectAll={planSelection.toggleSelectAll}
            onDeselectAll={planSelection.deselectAll}
            isLoading={bulkPlanStatusMutation.isPending}
            actions={[
              {
                id: 'bulk-activate-plans',
                label: isRtl ? 'تفعيل الخطط المحددة' : 'Activate Selected Plans',
                icon: <Check className="w-3.5 h-3.5" />,
                variant: 'primary',
                onClick: () =>
                  bulkPlanStatusMutation.mutate({
                    ids: Array.from(planSelection.selectedIds),
                    isActive: true
                  })
              },
              {
                id: 'bulk-deactivate-plans',
                label: isRtl ? 'تعطيل الخطط المحددة' : 'Deactivate Selected Plans',
                icon: <X className="w-3.5 h-3.5" />,
                variant: 'secondary',
                onClick: () =>
                  bulkPlanStatusMutation.mutate({
                    ids: Array.from(planSelection.selectedIds),
                    isActive: false
                  })
              }
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(plansData || []).map((plan: SubscriptionPlan) => {
              const isCanonical = plan.code === 'CODEK_MONTHLY';
              const isSelected = planSelection.isSelected(plan.id);

              // Normalize features
              const features: any[] = Array.isArray(plan.features) ? plan.features : [];

              return (
                <Card
                  key={plan.id}
                  className={`p-6 space-y-4 rounded-2xl border transition relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-950/20 shadow-md ring-2 ring-brand-500/20'
                      : isCanonical
                      ? 'border-brand-300 dark:border-brand-700 shadow-md bg-gradient-to-b from-brand-50/20 to-transparent dark:from-brand-950/10'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => planSelection.toggle(plan.id)}
                            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-brand-600"
                          />
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {plan.name}
                          </h3>
                          {isCanonical && (
                            <Badge variant="primary" size="sm" className="bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
                              {isRtl ? 'الخطة الأساسية' : 'Canonical'}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs font-mono text-slate-400 font-semibold">{plan.code}</span>
                      </div>

                      <Badge variant={plan.isActive ? 'success' : 'secondary'}>
                        {plan.isActive ? (isRtl ? 'مُفعّلة' : 'Active') : (isRtl ? 'مُعطّلة' : 'Inactive')}
                      </Badge>
                    </div>

                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatPrice(plan.price, plan.currency)}{' '}
                      <span className="text-xs text-slate-400 font-normal">
                        / {isRtl ? 'شهرياً' : plan.billingInterval.toLowerCase()}
                      </span>
                    </div>

                    {plan.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {plan.description}
                      </p>
                    )}

                    {/* Structured Benefits Render */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isRtl ? 'مميزات الخطة:' : 'Plan Benefits:'}
                      </div>
                      <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                        {features.map((f: any, i: number) => {
                          const icon = typeof f === 'object' ? f.icon : 'check';
                          const text = typeof f === 'object' ? (isRtl ? (f.textAr || f.text) : (f.textEn || f.textAr || f.text)) : f;
                          return (
                            <li key={i} className="flex items-center gap-2">
                              {renderBenefitIcon(icon)}
                              <span>{cleanBenefitText(text)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditPlanModal(plan)}
                      className="text-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      <span>{isRtl ? 'تعديل' : 'Edit'}</span>
                    </Button>

                    {!isCanonical ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/40"
                        onClick={() => setDeactivatingPlan(plan)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        <span>{isRtl ? 'تعطيل / حذف' : 'Deactivate'}</span>
                      </Button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium px-2 py-1">
                        {isRtl ? 'خطة أساسية محمية' : 'Protected Plan'}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Payment Settings (Vodafone Cash & InstaPay) */}
      {activeTab === 'settings' && (
        <div className="max-w-4xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand-500" />
                <span>{isRtl ? 'إعدادات قنوات الدفع (فودافون كاش وإنستاباي)' : 'Payment Channel Settings'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRtl
                  ? 'تخصيص أرقام الحسابات المستلمة وتعليمات التحويل التي تظهر للطلاب في صفحة الاشتراك.'
                  : 'Configure receiving phone numbers, accounts, and transfer instructions shown to students.'}
              </p>
            </div>

            <Button
              onClick={() => updateSettingsMutation.mutate(settingsForm)}
              isLoading={updateSettingsMutation.isPending}
              className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
            >
              <Check className="w-4 h-4 mr-1.5" />
              <span>{isRtl ? 'حفظ التغييرات' : 'Save Changes'}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vodafone Cash */}
            <Card className="p-6 space-y-4 border-red-200/80 dark:border-red-900/40 bg-gradient-to-br from-red-50/20 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-lg">
                    📱
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      فودافون كاش (Vodafone Cash)
                    </h3>
                    <span className="text-xs text-slate-500">تحويل محفظة إلكترونية</span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <span>{settingsForm.vodafoneCashEnabled ? (isRtl ? 'مُفعّل' : 'Enabled') : (isRtl ? 'معطّل' : 'Disabled')}</span>
                  <input
                    type="checkbox"
                    checked={settingsForm.vodafoneCashEnabled}
                    onChange={(e) => setSettingsForm({ ...settingsForm, vodafoneCashEnabled: e.target.checked })}
                    className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isRtl ? 'رقم محفظة فودافون كاش المستلمة' : 'Receiving Wallet Phone Number'}
                  </label>
                  <Input
                    value={settingsForm.vodafoneCashNumber}
                    onChange={(e) => setSettingsForm({ ...settingsForm, vodafoneCashNumber: e.target.value })}
                    placeholder="010XXXXXXXX"
                    className="font-mono text-base"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isRtl ? 'تعليمات التحويل للطلاب' : 'Transfer Instructions'}
                  </label>
                  <textarea
                    rows={3}
                    value={settingsForm.vodafoneCashInstructions}
                    onChange={(e) => setSettingsForm({ ...settingsForm, vodafoneCashInstructions: e.target.value })}
                    placeholder={isRtl ? 'حول المبلغ المطلوب إلى رقم فودافون كاش أعلاه ثم أدخل رقمك والرقم المرجعي...' : 'Instructions...'}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            </Card>

            {/* InstaPay */}
            <Card className="p-6 space-y-4 border-purple-200/80 dark:border-purple-900/40 bg-gradient-to-br from-purple-50/20 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-lg">
                    ⚡
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      إنستاباي (InstaPay)
                    </h3>
                    <span className="text-xs text-slate-500">تحويل بنكي لحظي IPA</span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <span>{settingsForm.instaPayEnabled ? (isRtl ? 'مُفعّل' : 'Enabled') : (isRtl ? 'معطّل' : 'Disabled')}</span>
                  <input
                    type="checkbox"
                    checked={settingsForm.instaPayEnabled}
                    onChange={(e) => setSettingsForm({ ...settingsForm, instaPayEnabled: e.target.checked })}
                    className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isRtl ? 'عنوان إنستاباي المستلم (IPA Username / Address)' : 'InstaPay Address (IPA)'}
                  </label>
                  <Input
                    value={settingsForm.instaPayAddress}
                    onChange={(e) => setSettingsForm({ ...settingsForm, instaPayAddress: e.target.value })}
                    placeholder="name@instapay"
                    className="font-mono text-base"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isRtl ? 'تعليمات التحويل للطلاب' : 'Transfer Instructions'}
                  </label>
                  <textarea
                    rows={3}
                    value={settingsForm.instaPayInstructions}
                    onChange={(e) => setSettingsForm({ ...settingsForm, instaPayInstructions: e.target.value })}
                    placeholder={isRtl ? 'حول المبلغ عبر تطبيق إنستاباي إلى العنوان أعلاه ثم أدخل الرقم المرجعي للعملية...' : 'Instructions...'}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Paymob Gateway Toggle */}
          <Card className="p-4 flex items-center justify-between border-slate-200 dark:border-slate-800">
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-500" />
                <span>بوابة الدفع التلقائية (Paymob)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                تفعيل الدفع بالبطاقات البنكية والمحافظ الإلكترونية الفورية عبر Paymob
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
              <span>{settingsForm.paymobEnabled ? (isRtl ? 'مُفعّل' : 'Enabled') : (isRtl ? 'معطّل' : 'Disabled')}</span>
              <input
                type="checkbox"
                checked={settingsForm.paymobEnabled}
                onChange={(e) => setSettingsForm({ ...settingsForm, paymobEnabled: e.target.checked })}
                className="w-5 h-5 accent-brand-600 rounded cursor-pointer"
              />
            </label>
          </Card>
        </div>
      )}

      {/* Header Modal: In-Person / Reception Manual Payment Recording */}
      {showManualRecordModal && (
        <Dialog
          isOpen={showManualRecordModal}
          onClose={() => {
            setShowManualRecordModal(false);
            setSelectedHybridStudentId('');
            setManualPaymentNotes('');
            setManualStudentSearch('');
          }}
          title={isRtl ? 'تسجيل دفع اشتراك حضوري (المسار المدمج)' : 'Record In-Person Hybrid Payment'}
          maxWidth="md"
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 leading-relaxed">
              {isRtl
                ? 'يستخدم هذا النموذج لتسجيل استلام رسوم الاشتراك الشهري (250 ج.م) نقداً أو بمكتب الأكاديمية لطلاب المسار المدمج (حضوري + أونلاين). يتم تفعيل وتمديد الاشتراك فورياً لمدة 30 يوماً.'
                : 'Record manual monthly subscription payments (250 EGP) at academy desk for Hybrid students. This immediately activates/extends full online access.'}
            </p>

            {/* Student Search & Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRtl ? 'اختر الطالب من المسار المدمج:' : 'Select Hybrid Student:'}
              </label>
              <Input
                placeholder={isRtl ? 'ابحث باسم الطالب أو كود الطالب...' : 'Search student name or code...'}
                value={manualStudentSearch}
                onChange={(e) => setManualStudentSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />

              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {hybridStudents && hybridStudents.length > 0 ? (
                  hybridStudents.map((s: any) => {
                    const isSelected = selectedHybridStudentId === s.id;
                    const sub = s.subscriptions?.[0];
                    const isSubActive = sub?.status === 'ACTIVE' && new Date(sub.currentPeriodEnd) > new Date();

                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedHybridStudentId(s.id)}
                        className={`p-2.5 cursor-pointer flex items-center justify-between text-xs transition ${
                          isSelected
                            ? 'bg-brand-50 dark:bg-brand-950/40 border-l-4 border-brand-600'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {s.user.firstName} {s.user.lastName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {s.studentCode} • {s.user.email || s.user.phone}
                          </div>
                        </div>

                        <div className="text-right">
                          <Badge variant={isSubActive ? 'success' : 'danger'} size="sm">
                            {isSubActive ? (isRtl ? 'اشتراك نشط' : 'Active') : (isRtl ? 'غير مسدد' : 'Unpaid')}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400">
                    {isRtl ? 'لم يتم العثور على طلاب في المسار المدمج بهذا الاسم' : 'No Hybrid students found'}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Summary Box */}
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium">{isRtl ? 'قيمة الرسوم المقررة:' : 'Standard Fee:'}</span>
                <span className="font-black text-sm text-emerald-700 dark:text-emerald-400">250 {isRtl ? 'ج.م' : 'EGP'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium">{isRtl ? 'فترة التمديد:' : 'Access Period:'}</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{isRtl ? '30 يوماً من تاريخ انتهاء الفترة الحالية' : '30 days from period end'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium">{isRtl ? 'مصدر الدفع المسجل:' : 'Payment Source:'}</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{isRtl ? 'نقدي / مكتب الأكاديمية (MANUAL)' : 'MANUAL'}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                {isRtl ? 'ملاحظات المعاملة (اختياري):' : 'Transaction Notes (Optional):'}
              </label>
              <textarea
                value={manualPaymentNotes}
                onChange={(e) => setManualPaymentNotes(e.target.value)}
                placeholder={isRtl ? 'مثال: سداد نقدي في استقبال الأكاديمية - إيصال 204' : 'e.g. Cash payment at reception desk - receipt #204'}
                rows={2}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowManualRecordModal(false);
                  setSelectedHybridStudentId('');
                  setManualPaymentNotes('');
                }}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!selectedHybridStudentId || manualPaymentMutation.isPending}
                isLoading={manualPaymentMutation.isPending}
                onClick={() =>
                  manualPaymentMutation.mutate({
                    studentId: selectedHybridStudentId,
                    notes: manualPaymentNotes || undefined
                  })
                }
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                <span>{isRtl ? 'تأكيد استلام الدفع وتفعيل الاشتراك' : 'Confirm & Activate'}</span>
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Create / Edit Plan Modal with Structured Benefits Builder */}
      {showPlanModal && (
        <Dialog
          isOpen={showPlanModal}
          onClose={() => {
            setShowPlanModal(false);
            setEditingPlanId(null);
          }}
          title={
            isRtl
              ? editingPlanId
                ? 'تعديل خطة الاشتراك'
                : 'إنشاء خطة اشتراك جديدة'
              : editingPlanId
              ? 'Edit Subscription Plan'
              : 'Create Subscription Plan'
          }
          maxWidth="lg"
        >
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isRtl ? 'اسم الخطة' : 'Plan Name'} *
                </label>
                <Input
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder={isRtl ? 'مثال: اشتراك كودك الشهري' : 'e.g. CodeK Monthly Plan'}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isRtl ? 'كود الخطة (فريد)' : 'Plan Code (Unique)'} *
                </label>
                <Input
                  value={planForm.code}
                  onChange={(e) => setPlanForm({ ...planForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. CODEK_MONTHLY"
                  disabled={Boolean(editingPlanId)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isRtl ? 'السعر (ج.م)' : 'Price (EGP)'} *
                </label>
                <Input
                  type="number"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isRtl ? 'دورة الفاتورة' : 'Billing Interval'}
                </label>
                <Select
                  value={planForm.billingInterval}
                  onChange={(e: any) => setPlanForm({ ...planForm, billingInterval: e.target.value })}
                  options={[
                    { value: 'MONTHLY', label: isRtl ? 'شهرياً' : 'Monthly' },
                    { value: 'QUARTERLY', label: isRtl ? 'ربع سنوي' : 'Quarterly' },
                    { value: 'YEARLY', label: isRtl ? 'سنوياً' : 'Yearly' }
                  ]}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isRtl ? 'حالة التفعيل' : 'Active Status'}
                </label>
                <Select
                  value={planForm.isActive ? 'true' : 'false'}
                  onChange={(e: any) => setPlanForm({ ...planForm, isActive: e.target.value === 'true' })}
                  options={[
                    { value: 'true', label: isRtl ? 'مُفعّلة (Active)' : 'Active' },
                    { value: 'false', label: isRtl ? 'مُعطّلة (Inactive)' : 'Inactive' }
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                {isRtl ? 'وصف الخطة' : 'Description'}
              </label>
              <textarea
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder={isRtl ? 'وصف مختصر للخطة ومزاياها...' : 'Brief description of plan...'}
                rows={2}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Structured Benefits Builder */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {isRtl ? 'المميزات المنظمة للخطة (Plan Benefits):' : 'Structured Plan Benefits:'}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {isRtl
                      ? 'حدد نص الميزة والأيقونة وترتيبها للعرض للطلاب بشكل جذاب ومنظم.'
                      : 'Define benefit text, icon, and display order.'}
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addBenefitRow}
                  className="text-xs text-brand-600 border-brand-200 hover:bg-brand-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>{isRtl ? 'إضافة ميزة' : 'Add Benefit'}</span>
                </Button>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {planForm.benefits.map((b, idx) => (
                  <div
                    key={b.id || idx}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center gap-2"
                  >
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveBenefit(idx, 'up')}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30"
                        title={isRtl ? 'تحريك لأعلى' : 'Move up'}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === planForm.benefits.length - 1}
                        onClick={() => moveBenefit(idx, 'down')}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30"
                        title={isRtl ? 'تحريك لأسفل' : 'Move down'}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Icon Selector */}
                    <div className="w-full sm:w-36 shrink-0">
                      <select
                        value={b.icon || 'check'}
                        onChange={(e) => {
                          const updated = [...planForm.benefits];
                          updated[idx].icon = e.target.value;
                          setPlanForm({ ...planForm, benefits: updated });
                        }}
                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-slate-900 dark:text-white"
                      >
                        {AVAILABLE_ICONS.map((icon) => (
                          <option key={icon.id} value={icon.id}>
                            {isRtl ? icon.labelAr : icon.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Arabic Text */}
                    <div className="flex-1 w-full">
                      <Input
                        value={b.textAr}
                        onChange={(e) => {
                          const updated = [...planForm.benefits];
                          updated[idx].textAr = e.target.value;
                          setPlanForm({ ...planForm, benefits: updated });
                        }}
                        placeholder={isRtl ? 'نص الميزة بالعربية...' : 'Benefit text in Arabic...'}
                        className="text-xs h-8"
                      />
                    </div>

                    {/* English Text (optional) */}
                    <div className="flex-1 w-full hidden sm:block">
                      <Input
                        value={b.textEn || ''}
                        onChange={(e) => {
                          const updated = [...planForm.benefits];
                          updated[idx].textEn = e.target.value;
                          setPlanForm({ ...planForm, benefits: updated });
                        }}
                        placeholder="English (optional)"
                        className="text-xs h-8"
                      />
                    </div>

                    {/* Remove Benefit */}
                    <button
                      type="button"
                      disabled={planForm.benefits.length <= 1}
                      onClick={() => removeBenefitRow(idx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg shrink-0 disabled:opacity-30"
                      title={isRtl ? 'حذف الميزة' : 'Delete benefit'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowPlanModal(false);
                  setEditingPlanId(null);
                }}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                className="bg-brand-600 text-white hover:bg-brand-700"
                disabled={!planForm.name.trim() || (!editingPlanId && !planForm.code.trim()) || savePlanMutation.isPending}
                isLoading={savePlanMutation.isPending}
                onClick={() => savePlanMutation.mutate()}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                <span>{isRtl ? 'حفظ الخطة' : 'Save Plan'}</span>
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Deactivate / Delete Plan Confirmation Modal */}
      {deactivatingPlan && (
        <Dialog
          isOpen={Boolean(deactivatingPlan)}
          onClose={() => setDeactivatingPlan(null)}
          title={isRtl ? 'تأكيد تعطيل / حذف الخطة' : 'Confirm Plan Deactivation'}
          maxWidth="sm"
        >
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                {deactivatingPlan.name} ({deactivatingPlan.code})
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isRtl
                ? 'إذا كانت هناك اشتراكات أو معاملات مالية مسجلة بهذه الخطة، فسيتم تعطيلها تلقائياً (isActive = false) لمنع الاشتراكات الجديدة مع الحفاظ على سلامة السجلات المالية.'
                : 'If this plan has historical subscriptions or transactions, it will be safely deactivated (isActive = false) to protect financial audit integrity.'}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDeactivatingPlan(null)}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="danger"
                isLoading={deletePlanMutation.isPending}
                onClick={() => deletePlanMutation.mutate(deactivatingPlan.id)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                <span>{isRtl ? 'تأكيد الإجراء' : 'Confirm'}</span>
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Refund Modal */}
      {refundTxnId && (
        <Dialog
          isOpen={Boolean(refundTxnId)}
          onClose={() => setRefundTxnId(null)}
          title={isRtl ? 'تأكيد استرجاع المعاملة المالية' : 'Confirm Transaction Refund'}
          maxWidth="md"
        >
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {isRtl
                  ? 'سيتم إرسال طلب استرجاع المبلغ عبر بوابة الدفع (Paymob) وإلغاء الاشتراك المرتبط بهذه المعاملة فورياً.'
                  : 'A refund request will be dispatched to the gateway (Paymob) and the linked student subscription will be cancelled immediately.'}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {isRtl ? 'سبب الاسترجاع (إلزامي)' : 'Refund Reason (Required)'}
              </label>
              <Input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={isRtl ? 'مثال: خطأ في السداد، طلب ولي الأمر...' : 'e.g., Parent request, accidental charge...'}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRefundTxnId(null)}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="danger"
                disabled={!refundReason.trim() || refundMutation.isPending}
                isLoading={refundMutation.isPending}
                onClick={() => refundMutation.mutate({ id: refundTxnId, reason: refundReason })}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                <span>{isRtl ? 'تنفيذ الاسترجاع' : 'Refund'}</span>
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Manual Payment Single Reject Modal */}
      {rejectTxnId && (
        <Dialog
          isOpen={Boolean(rejectTxnId)}
          onClose={() => setRejectTxnId(null)}
          title={isRtl ? 'رفض معاملة الدفع اليدوي' : 'Reject Manual Payment'}
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-500">
              {isRtl
                ? 'يرجى كتابة سبب رفض المعاملة (مثلاً: لم يتم استلام التحويل / الرقم المرجعي غير صحيح):'
                : 'Please specify the rejection reason (e.g. transfer not received / invalid reference):'}
            </p>

            <Input
              value={rejectTxnReason}
              onChange={(e) => setRejectTxnReason(e.target.value)}
              placeholder={isRtl ? 'سبب الرفض...' : 'Rejection reason...'}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setRejectTxnId(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={!rejectTxnReason.trim() || rejectTxnMutation.isPending}
                isLoading={rejectTxnMutation.isPending}
                onClick={() =>
                  rejectTxnMutation.mutate({
                    id: rejectTxnId,
                    reason: rejectTxnReason.trim()
                  })
                }
              >
                {isRtl ? 'تأكيد الرفض' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Manual Payment Bulk Reject Modal */}
      {isBulkRejectTxnOpen && (
        <Dialog
          isOpen={isBulkRejectTxnOpen}
          onClose={() => setIsBulkRejectTxnOpen(false)}
          title={
            isRtl
              ? `رفض ${manualTxnSelection.selectedCount} معاملات محددة`
              : `Reject ${manualTxnSelection.selectedCount} Transactions`
          }
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-500">
              {isRtl
                ? 'يرجى كتابة سبب رفض المعاملات المحددة لتسجيله في السجل:'
                : 'Please provide a reason to log for rejecting the selected transactions:'}
            </p>

            <Input
              value={bulkRejectTxnReason}
              onChange={(e) => setBulkRejectTxnReason(e.target.value)}
              placeholder={isRtl ? 'سبب الرفض الجماعي...' : 'Bulk rejection reason...'}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsBulkRejectTxnOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={!bulkRejectTxnReason.trim() || bulkRejectTxnMutation.isPending}
                isLoading={bulkRejectTxnMutation.isPending}
                onClick={() =>
                  bulkRejectTxnMutation.mutate({
                    ids: Array.from(manualTxnSelection.selectedIds),
                    reason: bulkRejectTxnReason.trim()
                  })
                }
              >
                {isRtl ? 'تأكيد الرفض الجماعي' : 'Confirm Bulk Rejection'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
