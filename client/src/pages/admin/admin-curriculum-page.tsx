import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Plus,
  Clock,
  Edit,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Trash2,
  FolderPlus,
  ArrowUp,
  ArrowDown,
  Video,
  Sparkles,
  Eye,
  EyeOff,
  Layers,
  FolderTree,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Dialog } from '../../components/ui/dialog.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { RichTextEditor } from '../../components/shared/rich-text-editor.js';
import { MarkdownViewer } from '../../components/shared/markdown-viewer.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatDuration } from '../../lib/i18n-helpers.js';
import { Section, LessonAccessType, VideoAsset, StudentGrade } from '../../types/api.js';
import { AdminVideoManager } from '../../components/shared/admin-video-manager.js';
import { useBulkSelection } from '../../hooks/use-bulk-selection.js';
import { BulkSelectionBar } from '../../components/shared/bulk-selection-bar.js';

export function AdminCurriculumPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);

  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);

  // Curriculum Form
  const [curriculumTitle, setCurriculumTitle] = useState('');
  const [curriculumDescription, setCurriculumDescription] = useState('');
  const [curriculumType, setCurriculumType] = useState('OFFICIAL_EB');
  const [curriculumGrade, setCurriculumGrade] = useState<StudentGrade>('GRADE_1');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');

  // Section Form
  const [selectedCurriculumForSection, setSelectedCurriculumForSection] = useState('');
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [editingSection, setEditingSection] = useState<Section | null>(null);

  // Lesson Form
  const [selectedCurriculumId, setSelectedCurriculumId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonDifficulty, setLessonDifficulty] = useState('BEGINNER');
  const [estimatedDuration, setEstimatedDuration] = useState(45);
  const [isFreeLesson, setIsFreeLesson] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState<number | ''>('');
  const [externalResourceUrl, setExternalResourceUrl] = useState('');
  const [externalResourceTitle, setExternalResourceTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('<h2>' + t('lessons.openLesson') + '</h2><p>' + t('curriculum.subtitle') + '</p>');

  // Deletion targets
  const [curriculumToDelete, setCurriculumToDelete] = useState<{ id: string; title: string } | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<{ id: string; title: string } | null>(null);
  const [lessonToDelete, setLessonToDelete] = useState<{ id: string; title: string } | null>(null);

  // Quick Video Management Modal Target
  const [activeVideoLesson, setActiveVideoLesson] = useState<{
    id: string;
    title: string;
    video?: VideoAsset | null;
    videoUrl?: string | null;
    videoDurationSeconds?: number | null;
  } | null>(null);

  const { data: curricula, isLoading } = useQuery({
    queryKey: ['adminCurricula'],
    queryFn: async () => {
      const res = (await api.curriculum.list()).data.data;
      // Fetch full curriculum details with sections for each curriculum
      const detailed = await Promise.all(
        res.map(async (c) => {
          try {
            return (await api.curriculum.getById(c.id)).data.data;
          } catch {
            return c;
          }
        })
      );
      return detailed;
    }
  });

  // 3-Tier Hierarchy Expand/Collapse State
  const [expandedCurricula, setExpandedCurricula] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());

  // Auto-expand all curricula and sections on first load
  useEffect(() => {
    if (curricula && curricula.length > 0 && expandedCurricula.size === 0) {
      setExpandedCurricula(new Set(curricula.map((c) => c.id)));
      const secIds: string[] = [];
      curricula.forEach((c) => {
        (c.sections || []).forEach((s) => secIds.push(s.id));
      });
      setExpandedSections(new Set(secIds));
    }
  }, [curricula]);

  const toggleCurriculum = (id: string) => {
    setExpandedCurricula((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLesson = (id: string) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (!curricula) return;
    const cIds = new Set<string>();
    const sIds = new Set<string>();
    const lIds = new Set<string>();

    curricula.forEach((c) => {
      cIds.add(c.id);
      (c.sections || []).forEach((s) => {
        sIds.add(s.id);
        (s.lessons || []).forEach((l) => lIds.add(l.id));
      });
      (c.lessons || []).forEach((l) => lIds.add(l.id));
    });

    setExpandedCurricula(cIds);
    setExpandedSections(sIds);
    setExpandedLessons(lIds);
  };

  const collapseAll = () => {
    setExpandedCurricula(new Set());
    setExpandedSections(new Set());
    setExpandedLessons(new Set());
  };

  const createCurriculumMutation = useMutation({
    mutationFn: async (data: any) => (await api.curriculum.create(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      setIsCurriculumModalOpen(false);
      setCurriculumTitle('');
      setCurriculumDescription('');
      setCurriculumGrade('GRADE_1');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const isOfficialCurriculum = (c: any) =>
    c.code === 'G11-T1-EB-2026' || (c.authority === 'OFFICIAL' && c.code?.startsWith('G11'));

  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const allCurricula = curricula || [];
  const selection = useBulkSelection(allCurricula, (c) => !isOfficialCurriculum(c));

  const deleteCurriculumMutation = useMutation({
    mutationFn: async (id: string) => (await api.curriculum.delete(id)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const bulkDeleteCurriculaMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return (await api.curriculum.bulkDelete(ids)).data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      selection.clear();
      setIsBulkDeleteOpen(false);
      toast.success(
        isArabic
          ? `تم حذف ${data.count} منهج دراسي بنجاح`
          : `Successfully deleted ${data.count} curriculum tracks`
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });


  // Section mutations
  const createSectionMutation = useMutation({
    mutationFn: async ({ curriculumId, data }: { curriculumId: string; data: any }) =>
      (await api.curriculum.createSection(curriculumId, data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      setIsSectionModalOpen(false);
      setSectionTitle('');
      setSectionDescription('');
      setEditingSection(null);
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ sectionId, data }: { sectionId: string; data: any }) =>
      (await api.curriculum.updateSection(sectionId, data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      setIsSectionModalOpen(false);
      setEditingSection(null);
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => (await api.curriculum.deleteSection(id)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const reorderSectionsMutation = useMutation({
    mutationFn: async ({ curriculumId, items }: { curriculumId: string; items: { id: string; order: number }[] }) =>
      (await api.curriculum.reorderSections(curriculumId, { items })).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
    }
  });

  // Lesson mutations
  const createLessonMutation = useMutation({
    mutationFn: async (data: any) => (await api.lessons.create(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      setIsLessonModalOpen(false);
      setLessonTitle('');
      setLessonDescription('');
      setExternalResourceUrl('');
      setExternalResourceTitle('');
      setIsFreeLesson(false);
      setVideoUrl('');
      setVideoDuration('');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => (await api.lessons.delete(id)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const reorderLessonsMutation = useMutation({
    mutationFn: async (items: { id: string; order: number; sectionId?: string | null }[]) =>
      (await api.lessons.reorder({ items })).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
    }
  });

  const handleCreateCurriculum = (e: React.FormEvent) => {
    e.preventDefault();
    createCurriculumMutation.mutate({
      title: curriculumTitle,
      description: curriculumDescription || undefined,
      type: curriculumType,
      grade: curriculumGrade
    });
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSection) {
      updateSectionMutation.mutate({
        sectionId: editingSection.id,
        data: {
          title: sectionTitle,
          description: sectionDescription || undefined
        }
      });
    } else {
      createSectionMutation.mutate({
        curriculumId: selectedCurriculumForSection,
        data: {
          title: sectionTitle,
          description: sectionDescription || undefined
        }
      });
    }
  };

  const handleCreateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    createLessonMutation.mutate({
      curriculumId: selectedCurriculumId,
      sectionId: selectedSectionId || undefined,
      title: lessonTitle,
      description: lessonDescription || undefined,
      difficulty: lessonDifficulty,
      estimatedDurationMinutes: Number(estimatedDuration),
      isFree: isFreeLesson,
      accessType: isFreeLesson ? 'FREE' : 'ATTENDANCE_REQUIRED',
      videoUrl: videoUrl.trim() || undefined,
      videoDurationSeconds: videoDuration ? Number(videoDuration) : undefined,
      externalResourceUrl: externalResourceUrl.trim() || undefined,
      externalResourceTitle: externalResourceTitle.trim() || undefined,
      content: lessonContent
    });
  };

  const moveSection = (curriculumId: string, sections: Section[], index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const items = reordered.map((sec, i) => ({ id: sec.id, order: i + 1 }));
    reorderSectionsMutation.mutate({ curriculumId, items });
  };

  const moveLesson = (lessons: any[], index: number, direction: 'up' | 'down', sectionId?: string | null) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    const reordered = [...lessons];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const items = reordered.map((l, i) => ({
      id: l.id,
      order: i + 1,
      sectionId: sectionId ?? l.sectionId ?? null
    }));
    reorderLessonsMutation.mutate(items);
  };

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('curriculum.title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('curriculum.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <Button
              size="sm"
              variant="ghost"
              onClick={expandAll}
              className="text-xs font-bold gap-1.5 h-8 text-brand-600 dark:text-brand-400"
              title={isArabic ? 'توسيع كافة المناهج والفصول والدروس' : 'Expand All'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{isArabic ? 'توسيع الكل' : 'Expand All'}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={collapseAll}
              className="text-xs font-bold gap-1.5 h-8 text-slate-600 dark:text-slate-400"
              title={isArabic ? 'طي كافة المناهج والفصول والدروس' : 'Collapse All'}
            >
              <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{isArabic ? 'طي الكل' : 'Collapse All'}</span>
            </Button>
          </div>

          <Button variant="outline" onClick={() => setIsCurriculumModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>{t('curriculum.createCurriculum')}</span>
          </Button>
          <Button onClick={() => {
            if (curricula && curricula.length > 0) {
              setSelectedCurriculumId(curricula[0].id);
            }
            setIsLessonModalOpen(true);
          }}>
            <Plus className="w-4 h-4" />
            <span>{t('curriculum.createLesson')}</span>
          </Button>
        </div>
      </div>

      {/* Grade Filter Bar (Admin Unrestricted Grade View) */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
        {[
          { key: 'ALL', label: isArabic ? 'جميع المراحل الدراسية' : 'All Grades' },
          { key: 'GRADE_1', label: isArabic ? 'الصف الأول الثانوي' : '1st Grade' },
          { key: 'GRADE_2', label: isArabic ? 'الصف الثاني الثانوي' : '2nd Grade' },
          { key: 'GRADE_3', label: isArabic ? 'الصف الثالث الثانوي' : '3rd Grade' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setGradeFilter(tab.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              gradeFilter === tab.key
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bulk Selection Bar */}
      <BulkSelectionBar
        totalItems={allCurricula.length}
        selectedCount={selection.selectedCount}
        isAllSelected={selection.isAllSelected}
        isIndeterminate={selection.isIndeterminate}
        onToggleSelectAll={selection.toggleSelectAll}
        onDeselectAll={selection.deselectAll}
        onDeleteSelected={() => setIsBulkDeleteOpen(true)}
        isLoading={bulkDeleteCurriculaMutation.isPending}
      />

      <div className="space-y-10">
        {curricula?.filter((c) => gradeFilter === 'ALL' || c.grade === gradeFilter).map((curriculum) => {
          const sections = curriculum.sections || [];
          const isOfficial = isOfficialCurriculum(curriculum);
          const isSelected = selection.isSelected(curriculum.id);
          const isCurriculumExpanded = expandedCurricula.has(curriculum.id);
          const allLessonsCount = (curriculum.lessons || []).length;
          // Lessons not attached to any section
          const unsectionedLessons = (curriculum.lessons || []).filter(
            (l) => !l.sectionId || !sections.some((s) => s.id === l.sectionId)
          );

          return (
            <div
              key={curriculum.id}
              className={`space-y-5 rounded-3xl p-5 sm:p-6 border transition-all ${
                isSelected
                  ? 'ring-2 ring-brand-500/40 border-brand-400 bg-brand-50/10 dark:bg-brand-950/10'
                  : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/80 dark:border-slate-800/80'
              }`}
            >
              {/* Course Track Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  {/* Expand/Collapse Chevron */}
                  <button
                    type="button"
                    onClick={() => toggleCurriculum(curriculum.id)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition shrink-0"
                    title={
                      isCurriculumExpanded
                        ? isArabic ? 'طي المنهج' : 'Collapse Curriculum'
                        : isArabic ? 'توسيع المنهج' : 'Expand Curriculum'
                    }
                  >
                    {isCurriculumExpanded ? (
                      <ChevronDown className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 rtl:rotate-180" />
                    )}
                  </button>

                  {/* Selection Checkbox */}
                  <div className="pt-1 sm:pt-0 shrink-0">
                    {isOfficial ? (
                      <div
                        title={isArabic ? 'المنهج الرسمي المعتمد — محمي من الحذف' : 'Official Curriculum — Protected from deletion'}
                        className="cursor-not-allowed opacity-40"
                      >
                        <input
                          type="checkbox"
                          disabled
                          checked={false}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                        />
                      </div>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => selection.toggle(curriculum.id)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer accent-brand-600"
                      />
                    )}
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2
                        className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 cursor-pointer hover:text-brand-600 transition"
                        onClick={() => toggleCurriculum(curriculum.id)}
                      >
                        {localizeText(curriculum.title)}
                      </h2>
                      <Badge variant="primary" size="sm">{formatStatus(curriculum.type)}</Badge>

                      {curriculum.grade && (
                        <Badge
                          variant="outline"
                          size="sm"
                          className="gap-1 font-semibold border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40"
                        >
                          {curriculum.grade === 'GRADE_1'
                            ? (isArabic ? 'الصف الأول الثانوي' : '1st Grade')
                            : curriculum.grade === 'GRADE_2'
                            ? (isArabic ? 'الصف الثاني الثانوي' : '2nd Grade')
                            : (isArabic ? 'الصف الثالث الثانوي' : '3rd Grade')}
                        </Badge>
                      )}

                      {isOfficial && (
                        <Badge
                          variant="success"
                          size="sm"
                          className="gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{isArabic ? 'المنهج الرسمي المعتمد' : 'Official Curriculum'}</span>
                        </Badge>
                      )}

                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <span>{sections.length} {t('curriculum.sections')}</span>
                        <span>•</span>
                        <span>{allLessonsCount} {t('curriculum.lessons')}</span>
                      </div>
                    </div>
                    {curriculum.description && (
                      <p className="text-xs text-slate-500 mt-1">{localizeText(curriculum.description)}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedCurriculumForSection(curriculum.id);
                      setEditingSection(null);
                      setSectionTitle('');
                      setSectionDescription('');
                      setIsSectionModalOpen(true);
                    }}
                    className="text-brand-600 border-brand-200 hover:bg-brand-50 dark:border-brand-800 dark:hover:bg-brand-950/40"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{t('curriculum.addSection')}</span>
                  </Button>

                  {!isOfficial && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurriculumToDelete({ id: curriculum.id, title: curriculum.title })}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Sections Tree (Tier 1 Expanded View) */}
              {isCurriculumExpanded && (
              <div className="space-y-4">
                {sections.length === 0 && unsectionedLessons.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs italic bg-white/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    {t('curriculum.noSections')}
                  </div>
                )}

                {sections.map((section, secIdx) => {
                  const sectionLessons = section.lessons || [];
                  const isSectionExpanded = expandedSections.has(section.id);

                  return (
                    <div
                      key={section.id}
                      className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs"
                    >
                      {/* Section Title Bar (Tier 2) */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleSection(section.id)}
                            className="p-1 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-500 transition shrink-0"
                            title={
                              isSectionExpanded
                                ? isArabic ? 'طي الفصل' : 'Collapse Section'
                                : isArabic ? 'توسيع الفصل' : 'Expand Section'
                            }
                          >
                            {isSectionExpanded ? (
                              <ChevronDown className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                            )}
                          </button>
                          <Layers className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3
                                className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 cursor-pointer hover:text-brand-600 transition truncate"
                                onClick={() => toggleSection(section.id)}
                              >
                                {localizeText(section.title)}
                              </h3>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 shrink-0">
                                {sectionLessons.length} {t('curriculum.lessons')}
                              </span>
                            </div>
                            {section.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{localizeText(section.description)}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Reorder Section Up / Down */}
                          <button
                            onClick={() => moveSection(curriculum.id, sections, secIdx, 'up')}
                            disabled={secIdx === 0}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                            title={t('curriculum.reorderUp')}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveSection(curriculum.id, sections, secIdx, 'down')}
                            disabled={secIdx === sections.length - 1}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                            title={t('curriculum.reorderDown')}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedCurriculumId(curriculum.id);
                              setSelectedSectionId(section.id);
                              setIsLessonModalOpen(true);
                            }}
                            className="text-xs text-brand-600"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t('curriculum.createLesson')}</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedCurriculumForSection(curriculum.id);
                              setEditingSection(section);
                              setSectionTitle(section.title);
                              setSectionDescription(section.description || '');
                              setIsSectionModalOpen(true);
                            }}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSectionToDelete({ id: section.id, title: section.title })}
                            className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Lessons Grid in this Section (Tier 2 Collapsible) */}
                      {isSectionExpanded && (
                        <div className="p-3.5 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                          {sectionLessons.length === 0 ? (
                            <div className="col-span-full py-4 text-center text-xs text-slate-400 italic">
                              {t('curriculum.noSections')}
                            </div>
                          ) : (
                            sectionLessons.map((lesson, lessonIdx) => {
                              const isLessonExpanded = expandedLessons.has(lesson.id);
                              return (
                                <Card
                                  key={lesson.id}
                                  className={`p-4 flex flex-col justify-between gap-3 border-slate-200/80 dark:border-slate-800/80 shadow-xs transition ${
                                    isLessonExpanded ? 'ring-2 ring-brand-500/20 bg-brand-50/5 dark:bg-brand-950/5' : ''
                                  }`}
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={() => toggleLesson(lesson.id)}
                                          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-600 transition shrink-0"
                                          title={
                                            isLessonExpanded
                                              ? isArabic ? 'طي تفاصيل الدرس' : 'Collapse Details'
                                              : isArabic ? 'عرض تفاصيل الدرس' : 'Expand Details'
                                          }
                                        >
                                          {isLessonExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
                                          ) : (
                                            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                                          )}
                                        </button>
                                        <Badge variant="outline" size="sm">{formatStatus(lesson.difficulty)}</Badge>
                                        {lesson.isFree && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                            <Sparkles className="w-3 h-3" />
                                            {t('curriculum.isFree')}
                                          </span>
                                        )}
                                        {lesson.videoUrl || lesson.video?.playbackId ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                            <Video className="w-3 h-3" />
                                            <span>فيديو جاهز</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                            <span>بدون فيديو</span>
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => moveLesson(sectionLessons, lessonIdx, 'up', section.id)}
                                          disabled={lessonIdx === 0}
                                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                                          title={t('curriculum.reorderUp')}
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => moveLesson(sectionLessons, lessonIdx, 'down', section.id)}
                                          disabled={lessonIdx === sectionLessons.length - 1}
                                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                                          title={t('curriculum.reorderDown')}
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    <h4
                                      className="font-bold text-sm text-slate-900 dark:text-slate-100 cursor-pointer hover:text-brand-600 transition"
                                      onClick={() => toggleLesson(lesson.id)}
                                    >
                                      {localizeText(lesson.title)}
                                    </h4>

                                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(lesson.estimatedDurationMinutes)}
                                      </span>
                                      {lesson.accessType && (
                                        <span>• {formatStatus(lesson.accessType)}</span>
                                      )}
                                    </div>

                                    {/* Tier 3 Expanded View */}
                                    {isLessonExpanded && (
                                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs animate-fadeIn">
                                        {lesson.description && (
                                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                            {localizeText(lesson.description)}
                                          </p>
                                        )}

                                        {lesson.externalResourceUrl && (
                                          <a
                                            href={lesson.externalResourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                            <span>{lesson.externalResourceTitle || (isArabic ? 'المورد الخارجي المرفق' : 'External Resource')}</span>
                                          </a>
                                        )}

                                        {lesson.video && (
                                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 flex items-center justify-between">
                                            <span>{isArabic ? 'مزود الفيديو:' : 'Video Provider:'} <strong>{lesson.video.provider}</strong></span>
                                            <span>{isArabic ? 'الحالة:' : 'Status:'} <Badge variant={lesson.video.status === 'READY' ? 'success' : 'warning'} size="sm">{lesson.video.status}</Badge></span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setLessonToDelete({ id: lesson.id, title: lesson.title })}
                                      className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>

                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setActiveVideoLesson(lesson)}
                                        className="text-xs text-brand-600 border-brand-200 hover:bg-brand-50 dark:border-brand-800 flex items-center gap-1.5"
                                      >
                                        <Video className="w-3.5 h-3.5" />
                                        <span>
                                          {lesson.video?.status === 'READY' || lesson.videoUrl
                                            ? t('videos.managerTitle')
                                            : t('videos.startUpload')}
                                        </span>
                                        {lesson.video?.status === 'READY' && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        )}
                                        {(lesson.video?.status === 'PROCESSING' || lesson.video?.status === 'PENDING_UPLOAD') && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                        )}
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => navigate(`/admin/lessons/${lesson.id}/edit`)}
                                      >
                                        <Edit className="w-3 h-3" />
                                        <span>{t('curriculum.editLesson')}</span>
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Unsectioned Lessons (Transitional / Direct Lessons) */}
                {unsectionedLessons.length > 0 && (
                  <div className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 p-4">
                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                      <FolderTree className="w-4 h-4" />
                      <span>{t('curriculum.lessons')} ({isArabic ? 'دروس مباشرة بدون فصل' : 'Uncategorized'})</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {unsectionedLessons.map((lesson, idx) => {
                        const isLessonExpanded = expandedLessons.has(lesson.id);
                        return (
                          <Card
                            key={lesson.id}
                            className={`p-4 flex flex-col justify-between gap-3 border-slate-200/80 dark:border-slate-800/80 shadow-xs transition ${
                              isLessonExpanded ? 'ring-2 ring-brand-500/20 bg-brand-50/5 dark:bg-brand-950/5' : ''
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => toggleLesson(lesson.id)}
                                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-600 transition shrink-0"
                                    title={
                                      isLessonExpanded
                                        ? isArabic ? 'طي تفاصيل الدرس' : 'Collapse Details'
                                        : isArabic ? 'عرض تفاصيل الدرس' : 'Expand Details'
                                    }
                                  >
                                    {isLessonExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                                    )}
                                  </button>
                                  <Badge variant="outline" size="sm">{formatStatus(lesson.difficulty)}</Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => moveLesson(unsectionedLessons, idx, 'up', null)}
                                    disabled={idx === 0}
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => moveLesson(unsectionedLessons, idx, 'down', null)}
                                    disabled={idx === unsectionedLessons.length - 1}
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <h4
                                className="font-bold text-sm text-slate-900 dark:text-slate-100 cursor-pointer hover:text-brand-600 transition"
                                onClick={() => toggleLesson(lesson.id)}
                              >
                                {localizeText(lesson.title)}
                              </h4>

                              {/* Tier 3 Expanded View */}
                              {isLessonExpanded && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs animate-fadeIn">
                                  {lesson.description && (
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                      {localizeText(lesson.description)}
                                    </p>
                                  )}
                                  {lesson.video && (
                                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 flex items-center justify-between">
                                      <span>{isArabic ? 'مزود الفيديو:' : 'Video Provider:'} <strong>{lesson.video.provider}</strong></span>
                                      <span>{isArabic ? 'الحالة:' : 'Status:'} <Badge variant={lesson.video.status === 'READY' ? 'success' : 'warning'} size="sm">{lesson.video.status}</Badge></span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setLessonToDelete({ id: lesson.id, title: lesson.title })}
                                className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>

                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setActiveVideoLesson(lesson)}
                                  className="text-xs text-brand-600 border-brand-200 hover:bg-brand-50 dark:border-brand-800 flex items-center gap-1.5"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  <span>
                                    {lesson.video?.status === 'READY' || lesson.videoUrl
                                      ? t('videos.managerTitle')
                                      : t('videos.startUpload')}
                                  </span>
                                  {lesson.video?.status === 'READY' && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  )}
                                  {(lesson.video?.status === 'PROCESSING' || lesson.video?.status === 'PENDING_UPLOAD') && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/admin/lessons/${lesson.id}/edit`)}
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>{t('curriculum.editLesson')}</span>
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New / Edit Section Modal */}
      <Dialog
        isOpen={isSectionModalOpen}
        onClose={() => {
          setIsSectionModalOpen(false);
          setEditingSection(null);
        }}
        title={editingSection ? t('curriculum.editSection') : t('curriculum.addSection')}
        maxWidth="md"
      >
        <form onSubmit={handleSaveSection} className="space-y-4 py-2">
          <Input
            label={t('curriculum.sectionTitle')}
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
            required
            placeholder="e.g. Section 1: HTML & CSS Core"
          />
          <Input
            label={t('curriculum.sectionDescription')}
            value={sectionDescription}
            onChange={(e) => setSectionDescription(e.target.value)}
            placeholder="Key concepts covered in this module..."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsSectionModalOpen(false);
                setEditingSection(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              isLoading={createSectionMutation.isPending || updateSectionMutation.isPending}
            >
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* New Curriculum Modal */}
      <Dialog
        isOpen={isCurriculumModalOpen}
        onClose={() => setIsCurriculumModalOpen(false)}
        title={t('curriculum.createCurriculum')}
        maxWidth="md"
      >
        <form onSubmit={handleCreateCurriculum} className="space-y-4 py-2">
          <Input
            label={t('curriculum.title')}
            value={curriculumTitle}
            onChange={(e) => setCurriculumTitle(e.target.value)}
            required
          />
          <Input
            label={t('tasks.shortDescription')}
            value={curriculumDescription}
            onChange={(e) => setCurriculumDescription(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={t('curriculum.track')}
              value={curriculumType}
              onChange={(e) => setCurriculumType(e.target.value)}
              options={[
                { value: 'OFFICIAL_EB', label: formatStatus('OFFICIAL_EB') },
                { value: 'ACADEMY', label: formatStatus('ACADEMY') }
              ]}
            />
            <Select
              label={isArabic ? 'الصف الدراسي المستهدف' : 'Target Student Grade'}
              value={curriculumGrade}
              onChange={(e) => setCurriculumGrade(e.target.value as StudentGrade)}
              options={[
                { value: 'GRADE_1', label: isArabic ? 'الصف الأول الثانوي (Grade 1)' : 'Grade 1 (1st Secondary)' },
                { value: 'GRADE_2', label: isArabic ? 'الصف الثاني الثانوي (Grade 2)' : 'Grade 2 (2nd Secondary)' },
                { value: 'GRADE_3', label: isArabic ? 'الصف الثالث الثانوي (Grade 3)' : 'Grade 3 (3rd Secondary)' }
              ]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCurriculumModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createCurriculumMutation.isPending}>
              {t('curriculum.createCurriculum')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* New Lesson Modal */}
      <Dialog
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        title={t('curriculum.createLesson')}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLesson} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={t('curriculum.title')}
              value={selectedCurriculumId}
              onChange={(e) => {
                setSelectedCurriculumId(e.target.value);
                setSelectedSectionId('');
              }}
              options={
                curricula?.map((c) => ({
                  value: c.id,
                  label: `${localizeText(c.title)} (${formatStatus(c.type)})`
                })) || []
              }
              required
            />

            <Select
              label={t('curriculum.sections')}
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              options={[
                { value: '', label: '-- No Section (Uncategorized) --' },
                ...((curricula?.find((c) => c.id === selectedCurriculumId)?.sections || []).map((s) => ({
                  value: s.id,
                  label: localizeText(s.title)
                })))
              ]}
            />
          </div>

          <Input
            label={t('curriculum.lessonTitle')}
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
            required
          />

          <Input
            label={t('curriculum.lessonDescription')}
            value={lessonDescription}
            onChange={(e) => setLessonDescription(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={t('tasks.difficulty')}
              value={lessonDifficulty}
              onChange={(e) => setLessonDifficulty(e.target.value)}
              options={[
                { value: 'BEGINNER', label: formatStatus('BEGINNER') },
                { value: 'INTERMEDIATE', label: formatStatus('INTERMEDIATE') },
                { value: 'ADVANCED', label: formatStatus('ADVANCED') }
              ]}
            />
            <Input
              label={t('curriculum.estimatedDuration')}
              type="number"
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(Number(e.target.value))}
              required
            />
          </div>

          {/* Video & Free Preview Settings */}
          <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isFreeLesson}
                onChange={(e) => setIsFreeLesson(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {t('curriculum.isFree')}
              </span>
            </label>
            <p className="text-[11px] text-slate-500">{t('curriculum.isFreeHint')}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input
                label={t('curriculum.videoUrl')}
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <Input
                label={t('curriculum.videoDuration')}
                type="number"
                placeholder="1200"
                value={videoDuration}
                onChange={(e) => setVideoDuration(e.target.value ? Number(e.target.value) : '')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-800/40">
            <Input
              label={t('curriculum.externalResourceUrl')}
              placeholder="https://www.canva.com/..."
              value={externalResourceUrl}
              onChange={(e) => setExternalResourceUrl(e.target.value)}
            />
            <Input
              label={t('curriculum.externalResourceTitle')}
              placeholder={t('lessons.externalPresentation')}
              value={externalResourceTitle}
              onChange={(e) => setExternalResourceTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('curriculum.lessonContent')}
            </label>
            <RichTextEditor
              content={lessonContent}
              onChange={setLessonContent}
              minHeight="180px"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsLessonModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createLessonMutation.isPending} disabled={!selectedCurriculumId}>
              {t('curriculum.createLesson')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Quick Lesson Video Manager Dialog */}
      <Dialog
        isOpen={Boolean(activeVideoLesson)}
        onClose={() => setActiveVideoLesson(null)}
        title={`${t('videos.managerTitle')} — ${activeVideoLesson ? localizeText(activeVideoLesson.title) : ''}`}
        maxWidth="lg"
      >
        {activeVideoLesson && (
          <div className="py-2">
            <AdminVideoManager
              lessonId={activeVideoLesson.id}
              attachedVideo={activeVideoLesson.video}
              legacyVideoUrl={activeVideoLesson.videoUrl}
              legacyVideoDuration={activeVideoLesson.videoDurationSeconds}
              onVideoChanged={(asset, url, duration) => {
                queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
                queryClient.invalidateQueries({ queryKey: ['adminLesson', activeVideoLesson.id] });
                setActiveVideoLesson((prev) =>
                  prev
                    ? {
                        ...prev,
                        video: asset,
                        videoUrl: url || asset?.playbackUrl,
                        videoDurationSeconds: duration || asset?.durationSeconds
                      }
                    : null
                );
              }}
            />
          </div>
        )}
      </Dialog>

      {/* Confirm Delete Section Dialog */}
      <ConfirmDialog
        isOpen={Boolean(sectionToDelete)}
        onClose={() => setSectionToDelete(null)}
        onConfirm={() => {
          if (sectionToDelete) {
            deleteSectionMutation.mutate(sectionToDelete.id, {
              onSuccess: () => setSectionToDelete(null)
            });
          }
        }}
        title={t('curriculum.deleteSection')}
        description={`${t('curriculum.confirmDeleteSection')} "${sectionToDelete?.title}"`}
        isLoading={deleteSectionMutation.isPending}
        isDestructive={true}
      />

      {/* Confirm Delete Curriculum Dialog */}
      <ConfirmDialog
        isOpen={Boolean(curriculumToDelete)}
        onClose={() => setCurriculumToDelete(null)}
        onConfirm={() => {
          if (curriculumToDelete) {
            deleteCurriculumMutation.mutate(curriculumToDelete.id, {
              onSuccess: () => setCurriculumToDelete(null)
            });
          }
        }}
        title={t('curriculum.deleteCurriculum')}
        description={`${t('curriculum.confirmDelete')} "${curriculumToDelete?.title}"`}
        isLoading={deleteCurriculumMutation.isPending}
        isDestructive={true}
      />

      {/* Confirm Bulk Delete Curricula Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteCurriculaMutation.mutate(selection.selectedIds)}
        title={
          isArabic
            ? `حذف ${selection.selectedCount} منهج دراسي؟`
            : `Delete ${selection.selectedCount} curriculum tracks?`
        }
        description={
          isArabic
            ? `هل أنت متأكد من حذف ${selection.selectedCount} منهج دراسي محدد؟ سيتم حذف المناهج وجميع الوحدات والدروس والمهام والكويزات التابعة لها نهائياً. لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to delete ${selection.selectedCount} selected curriculum tracks? This will permanently delete the curricula and all associated sections, lessons, tasks, and quizzes. This action cannot be undone.`
        }
        isLoading={bulkDeleteCurriculaMutation.isPending}
        isDestructive={true}
      />


      {/* Confirm Delete Lesson Dialog */}
      <ConfirmDialog
        isOpen={Boolean(lessonToDelete)}
        onClose={() => setLessonToDelete(null)}
        onConfirm={() => {
          if (lessonToDelete) {
            deleteLessonMutation.mutate(lessonToDelete.id, {
              onSuccess: () => setLessonToDelete(null)
            });
          }
        }}
        title={t('curriculum.deleteLesson')}
        description={`${t('curriculum.confirmDeleteLesson')} "${lessonToDelete?.title}"`}
        isLoading={deleteLessonMutation.isPending}
        isDestructive={true}
      />
    </div>
  );
}

export function AdminLessonEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [isFree, setIsFree] = useState(false);
  const [accessType, setAccessType] = useState<LessonAccessType>('ATTENDANCE_REQUIRED');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | ''>('');
  const [attachedVideo, setAttachedVideo] = useState<VideoAsset | null>(null);
  const [externalResourceUrl, setExternalResourceUrl] = useState('');
  const [externalResourceTitle, setExternalResourceTitle] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const { data: lesson, isLoading } = useQuery({
    queryKey: ['adminLesson', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      const res = (await api.lessons.getById(id)).data.data;
      setTitle(res.title);
      setContent(res.content || '');
      setDescription(res.description || '');
      setSectionId(res.sectionId || null);
      setIsFree(res.isFree ?? false);
      setAccessType(res.accessType || 'ATTENDANCE_REQUIRED');
      setVideoUrl(res.videoUrl || '');
      setVideoDurationSeconds(res.videoDurationSeconds ?? '');
      setAttachedVideo(res.video || null);
      setExternalResourceUrl(res.externalResourceUrl || '');
      setExternalResourceTitle(res.externalResourceTitle || '');
      setIsPublished(res.isPublished ?? true);
      return res;
    },
    enabled: Boolean(id)
  });

  const { data: curriculumSections } = useQuery({
    queryKey: ['adminCurriculumSections', lesson?.curriculumId],
    queryFn: async () => {
      if (!lesson?.curriculumId) return [];
      return (await api.curriculum.listSections(lesson.curriculumId)).data.data;
    },
    enabled: Boolean(lesson?.curriculumId)
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return (await api.lessons.update(id, {
        title,
        content,
        description,
        sectionId: sectionId || null,
        isFree,
        accessType,
        videoId: attachedVideo?.id || null,
        videoUrl: videoUrl.trim() || undefined,
        videoDurationSeconds: videoDurationSeconds ? Number(videoDurationSeconds) : undefined,
        externalResourceUrl: externalResourceUrl.trim() || undefined,
        externalResourceTitle: externalResourceTitle.trim() || undefined,
        isPublished
      })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLesson', id] });
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/admin/curriculum')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('curriculum.title')}</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
          >
            {isPreviewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{isPreviewMode ? 'Exit Preview' : 'Preview Content'}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => updateMutation.mutate()}
            isLoading={updateMutation.isPending}
          >
            <span>{t('common.save')}</span>
          </Button>
        </div>
      </div>

      {isPreviewMode ? (
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">{title}</h1>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
          </div>
          <MarkdownViewer content={content} />
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label={t('curriculum.lessonTitle')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <Select
                label={t('curriculum.sections')}
                value={sectionId || ''}
                onChange={(e) => setSectionId(e.target.value || null)}
                options={[
                  { value: '', label: '-- No Section (Uncategorized) --' },
                  ...(curriculumSections?.map((s) => ({
                    value: s.id,
                    label: s.title
                  })) || [])
                ]}
              />
            </div>

            <Input
              label={t('curriculum.lessonDescription')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {/* Video & Free Preview Configuration */}
            <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => {
                      setIsFree(e.target.checked);
                      if (e.target.checked) setAccessType('FREE');
                      else setAccessType('ATTENDANCE_REQUIRED');
                    }}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    {t('curriculum.isFree')}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">{t('curriculum.accessType')}:</span>
                  <select
                    value={accessType}
                    onChange={(e) => setAccessType(e.target.value as LessonAccessType)}
                    className="text-xs font-semibold rounded-lg px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <option value="ATTENDANCE_REQUIRED">Attendance Required</option>
                    <option value="FREE">Free Preview</option>
                    <option value="ENROLLED">Enrolled Only</option>
                  </select>
                </div>
              </div>

              {/* Managed Video Component */}
              <AdminVideoManager
                lessonId={id}
                attachedVideo={attachedVideo}
                legacyVideoUrl={videoUrl}
                legacyVideoDuration={videoDurationSeconds ? Number(videoDurationSeconds) : undefined}
                onVideoChanged={(asset, url, duration) => {
                  setAttachedVideo(asset);
                  if (asset) {
                    setVideoUrl(asset.playbackUrl || '');
                    setVideoDurationSeconds(asset.durationSeconds ?? '');
                  } else {
                    setVideoUrl(url || '');
                    setVideoDurationSeconds(duration ?? '');
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-800/40">
              <Input
                label={t('curriculum.externalResourceUrl')}
                value={externalResourceUrl}
                onChange={(e) => setExternalResourceUrl(e.target.value)}
              />
              <Input
                label={t('curriculum.externalResourceTitle')}
                value={externalResourceTitle}
                onChange={(e) => setExternalResourceTitle(e.target.value)}
              />
            </div>
          </Card>

          <Card className="p-6 space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('curriculum.lessonContent')}
            </label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              minHeight="350px"
            />
          </Card>
        </div>
      )}
    </div>
  );
}
