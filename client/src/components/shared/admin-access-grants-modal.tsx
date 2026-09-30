import { useState, useEffect } from 'react';
import { Shield, Check, X, Calendar, Plus, Ban, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api/client.js';
import { EducationalAccessGrant } from '../../types/api.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { Input } from '../ui/input.js';

interface AdminAccessGrantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStudentId?: string;
  defaultCurriculumId?: string;
  defaultLessonId?: string;
}

export function AdminAccessGrantsModal({
  isOpen,
  onClose,
  defaultStudentId,
  defaultCurriculumId,
  defaultLessonId
}: AdminAccessGrantsModalProps) {
  const [grants, setGrants] = useState<EducationalAccessGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [studentId, setStudentId] = useState(defaultStudentId || '');
  const [scope, setScope] = useState<'ALL_ACCESS' | 'COURSE' | 'LESSON'>('ALL_ACCESS');
  const [curriculumId, setCurriculumId] = useState(defaultCurriculumId || '');
  const [lessonId, setLessonId] = useState(defaultLessonId || '');
  const [reason, setReason] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Revoke states
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadGrants();
      if (defaultStudentId) setStudentId(defaultStudentId);
      if (defaultCurriculumId) setCurriculumId(defaultCurriculumId);
      if (defaultLessonId) setLessonId(defaultLessonId);
    }
  }, [isOpen, defaultStudentId, defaultCurriculumId, defaultLessonId]);

  const loadGrants = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.access.listGrants(defaultStudentId ? { studentId: defaultStudentId } : undefined);
      setGrants(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load access grants');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !reason.trim()) {
      setError('Student ID and Reason are required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.access.createGrant({
        studentId: studentId.trim(),
        scope,
        curriculumId: scope === 'COURSE' ? curriculumId.trim() : undefined,
        lessonId: scope === 'LESSON' ? lessonId.trim() : undefined,
        reason: reason.trim(),
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined
      });
      setIsCreating(false);
      setReason('');
      setValidUntil('');
      await loadGrants();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to grant educational access');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    try {
      await api.access.revokeGrant(grantId, revokeReason || 'Administrative revocation');
      setRevokingId(null);
      setRevokeReason('');
      await loadGrants();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to revoke access grant');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                منح الصلاحيات التعليمية الاستثنائية
              </h2>
              <p className="text-xs text-muted-foreground">
                إدارة الوصول الاستثنائي (منح دراسية، استثناءات اختبار، حالات خاصة) بعيداً عن نظام المدفوعات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action / Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              الصلاحيات الممنوحة حالياً ({grants.length})
            </h3>
            <Button
              size="sm"
              variant={isCreating ? 'outline' : 'primary'}
              onClick={() => setIsCreating(!isCreating)}
              className="text-xs font-semibold gap-1.5"
            >
              {isCreating ? (
                <>إلغاء النموذج</>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>منح صلاحية جديدة</span>
                </>
              )}
            </Button>
          </div>

          {/* Creation Form */}
          {isCreating && (
            <form onSubmit={handleCreateGrant} className="p-5 rounded-2xl bg-muted/40 border border-border space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    معرف الطالب (Student UUID) *
                  </label>
                  <Input
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. 11111111-1111-1111-1111-111111111111"
                    required
                    className="text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    نطاق الصلاحية (Access Scope) *
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ALL_ACCESS">وصول كامل لجميع المسارات والدروس (ALL_ACCESS)</option>
                    <option value="COURSE">مسار / كورس كامل فقط (COURSE)</option>
                    <option value="LESSON">درس محدد فقط (LESSON)</option>
                  </select>
                </div>

                {scope === 'COURSE' && (
                  <div className="col-span-full">
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      معرف المسار (Curriculum UUID) *
                    </label>
                    <Input
                      value={curriculumId}
                      onChange={(e) => setCurriculumId(e.target.value)}
                      placeholder="e.g. course-uuid"
                      required
                      className="text-xs font-mono"
                    />
                  </div>
                )}

                {scope === 'LESSON' && (
                  <div className="col-span-full">
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      معرف الدرس (Lesson UUID) *
                    </label>
                    <Input
                      value={lessonId}
                      onChange={(e) => setLessonId(e.target.value)}
                      placeholder="e.g. lesson-uuid"
                      required
                      className="text-xs font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    سبب المنح الاستثنائي *
                  </label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="مثال: منحة تفوق، تجربة بيتا، إعفاء خاص"
                    required
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    تاريخ انتهاء الصلاحية (اختياري)
                  </label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreating(false)}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                  className="text-xs font-semibold"
                >
                  {submitting ? 'جارٍ الحفظ...' : 'تأكيد ومنح الصلاحية'}
                </Button>
              </div>
            </form>
          )}

          {/* Grants List */}
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              جارٍ تحميل الصلاحيات...
            </div>
          ) : grants.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-border rounded-2xl p-6">
              <Shield className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">لا توجد صلاحيات استثنائية مسجلة حالياً</p>
            </div>
          ) : (
            <div className="space-y-3">
              {grants.map((grant) => {
                const isExpired = grant.validUntil && new Date(grant.validUntil) < new Date();
                const status = !grant.isActive ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE';

                return (
                  <div
                    key={grant.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      status === 'ACTIVE'
                        ? 'bg-card border-border/80 shadow-sm'
                        : 'bg-muted/20 border-border/40 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-foreground">
                            {grant.student?.user
                              ? `${grant.student.user.firstName} ${grant.student.user.lastName} (${grant.student.studentCode})`
                              : grant.studentId}
                          </span>
                          <Badge
                            variant={status === 'ACTIVE' ? 'success' : 'outline'}
                            size="sm"
                            className="text-[11px]"
                          >
                            {status === 'ACTIVE' ? 'نشطة' : status === 'EXPIRED' ? 'منتهية' : 'ملغاة'}
                          </Badge>
                          <Badge variant="purple" size="sm" className="text-[11px]">
                            {grant.scope === 'ALL_ACCESS'
                              ? 'وصول كامل'
                              : grant.scope === 'COURSE'
                              ? `مسار: ${grant.curriculum?.title || grant.curriculumId}`
                              : `درس: ${grant.lesson?.title || grant.lessonId}`}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          السبب: <span className="text-foreground">{grant.reason}</span>
                        </p>

                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            صالحة حتى:{' '}
                            {grant.validUntil
                              ? new Date(grant.validUntil).toLocaleDateString('ar-EG')
                              : 'غير محدد (دائمة)'}
                          </span>
                          {grant.grantedByUser && (
                            <span>بواسطة: {grant.grantedByUser.firstName} {grant.grantedByUser.lastName}</span>
                          )}
                        </div>
                      </div>

                      {status === 'ACTIVE' && (
                        <div>
                          {revokingId === grant.id ? (
                            <div className="flex items-center gap-1.5 animate-in fade-in">
                              <Input
                                value={revokeReason}
                                onChange={(e) => setRevokeReason(e.target.value)}
                                placeholder="سبب الإلغاء..."
                                className="text-[11px] h-7 w-36"
                              />
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleRevokeGrant(grant.id)}
                                className="h-7 text-[11px] px-2"
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRevokingId(null)}
                                className="h-7 text-[11px] px-2"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRevokingId(grant.id);
                                setRevokeReason('');
                              }}
                              className="text-xs text-destructive hover:bg-destructive/10 border-destructive/20 gap-1"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>إلغاء الصلاحية</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}
