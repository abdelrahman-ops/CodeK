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
  ExternalLink,
  CheckSquare,
  HelpCircle,
  Unlink,
  Link as LinkIcon,
  Search
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
  const [curriculumTrack, setCurriculumTrack] = useState('');
  const [curriculumAuthority, setCurriculumAuthority] = useState('OFFICIAL');
  const [editingCurriculum, setEditingCurriculum] = useState<any | null>(null);
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
      return (await api.curriculum.list({ includeDetails: true })).data.data;
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
      setEditingCurriculum(null);
      setCurriculumTitle('');
      setCurriculumDescription('');
      setCurriculumGrade('GRADE_1');
      setCurriculumTrack('');
      setCurriculumAuthority('OFFICIAL');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const updateCurriculumMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => (await api.curriculum.update(id, data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      setIsCurriculumModalOpen(false);
      setEditingCurriculum(null);
      setCurriculumTitle('');
      setCurriculumDescription('');
      setCurriculumGrade('GRADE_1');
      setCurriculumTrack('');
      setCurriculumAuthority('OFFICIAL');
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

  const handleSaveCurriculum = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: curriculumTitle,
      description: curriculumDescription || undefined,
      type: curriculumType,
      grade: curriculumGrade,
      track: curriculumTrack || undefined,
      authority: curriculumAuthority
    };

    if (editingCurriculum) {
      updateCurriculumMutation.mutate({ id: editingCurriculum.id, data: payload });
    } else {
      createCurriculumMutation.mutate(payload);
    }
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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
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
                        className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-brand-600 transition"
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
                      setEditingCurriculum(curriculum);
                      setCurriculumTitle(localizeText(curriculum.title));
                      setCurriculumDescription(curriculum.description || '');
                      setCurriculumType(curriculum.type);
                      setCurriculumGrade(curriculum.grade || 'GRADE_1');
                      setCurriculumTrack(curriculum.track || '');
                      setCurriculumAuthority(curriculum.authority || 'OFFICIAL');
                      setIsCurriculumModalOpen(true);
                    }}
                    className="text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    <span>{isArabic ? 'تعديل المنهج' : 'Edit Track'}</span>
                  </Button>

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
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                            <Sparkles className="w-3 h-3" />
                                            {t('curriculum.isFree')}
                                          </span>
                                        )}
                                        {lesson.videoUrl || lesson.video?.playbackId ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                            <Video className="w-3 h-3" />
                                            <span>فيديو جاهز</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
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

      {/* Curriculum Modal (Create / Edit) */}
      <Dialog
        isOpen={isCurriculumModalOpen}
        onClose={() => {
          setIsCurriculumModalOpen(false);
          setEditingCurriculum(null);
        }}
        title={editingCurriculum ? (isArabic ? 'تعديل المنهج الدراسي' : 'Edit Curriculum Track') : t('curriculum.createCurriculum')}
        maxWidth="md"
      >
        <form onSubmit={handleSaveCurriculum} className="space-y-4 py-2">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={isArabic ? 'المسار / التخصص (Track Code / Title)' : 'Track / Specialty'}
              value={curriculumTrack}
              onChange={(e) => setCurriculumTrack(e.target.value)}
              placeholder="e.g. AI & Web Architecture 2030"
            />
            <Select
              label={isArabic ? 'جهة الاعتماد والصفة' : 'Authority'}
              value={curriculumAuthority}
              onChange={(e) => setCurriculumAuthority(e.target.value)}
              options={[
                { value: 'OFFICIAL', label: isArabic ? 'المنهج الرسمي المعتمد (وزارة التربية والتعليم)' : 'Official EB Track (Ministry of Ed)' },
                { value: 'COMMUNITY', label: isArabic ? 'مسار أكاديمي مخصص / حر' : 'Academy / Custom Track' }
              ]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsCurriculumModalOpen(false);
                setEditingCurriculum(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              isLoading={editingCurriculum ? updateCurriculumMutation.isPending : createCurriculumMutation.isPending}
            >
              {editingCurriculum ? (isArabic ? 'حفظ التعديلات' : 'Save Changes') : t('curriculum.createCurriculum')}
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
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const toast = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [pageRange, setPageRange] = useState('');
  const [authority, setAuthority] = useState('OFFICIAL');
  const [difficulty, setDifficulty] = useState('BEGINNER');
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(45);
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

  // Concept Cards Management
  const [conceptCards, setConceptCards] = useState<any[]>([]);
  const [isConceptModalOpen, setIsConceptModalOpen] = useState(false);
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  const [cardTitle, setCardTitle] = useState('');
  const [cardExplanation, setCardExplanation] = useState('');
  const [cardKeyConcept, setCardKeyConcept] = useState('');
  const [cardSummary, setCardSummary] = useState('');

  const { data: lesson, isLoading } = useQuery({
    queryKey: ['adminLesson', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      const res = (await api.lessons.getById(id)).data.data;
      setTitle(res.title);
      setContent(res.content || '');
      setDescription(res.description || '');
      setPageRange(res.pageRange || '');
      setAuthority(res.authority || 'OFFICIAL');
      setDifficulty(res.difficulty || 'BEGINNER');
      setEstimatedDurationMinutes(res.estimatedDurationMinutes || 45);
      setConceptCards(Array.isArray(res.conceptCards) ? res.conceptCards : []);
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

  // Task Linking & Quick Create
  const [isLinkTaskModalOpen, setIsLinkTaskModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState('DAILY_TASK');
  const [newTaskDifficulty, setNewTaskDifficulty] = useState('BEGINNER');
  const [newTaskXp, setNewTaskXp] = useState(30);
  const [newTaskInstructions, setNewTaskInstructions] = useState('');

  const { data: allTasksList, isLoading: isAllTasksLoading } = useQuery({
    queryKey: ['adminAllTasks'],
    queryFn: async () => (await api.tasks.list()).data.data,
    enabled: isLinkTaskModalOpen
  });

  const linkTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!id) return;
      return (await api.tasks.update(taskId, { lessonId: id })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLesson', id] });
      queryClient.invalidateQueries({ queryKey: ['adminAllTasks'] });
      setIsLinkTaskModalOpen(false);
      toast.success(isArabic ? 'تم ربط المهمة بالدرس بنجاح' : 'Task linked to lesson');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const unlinkTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return (await api.tasks.update(taskId, { lessonId: null })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLesson', id] });
      queryClient.invalidateQueries({ queryKey: ['adminAllTasks'] });
      toast.success(isArabic ? 'تم فك ارتباط المهمة بالدرس' : 'Task unlinked from lesson');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return (await api.tasks.create({
        lessonId: id,
        title: newTaskTitle.trim(),
        description: newTaskTitle.trim(),
        instructions: newTaskInstructions.trim() || newTaskTitle.trim(),
        taskType: newTaskType,
        difficulty: newTaskDifficulty,
        xpReward: Number(newTaskXp) || 30,
        estimatedDurationMinutes: 45,
        isPublished: true
      })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLesson', id] });
      setIsCreateTaskModalOpen(false);
      setNewTaskTitle('');
      setNewTaskInstructions('');
      toast.success(isArabic ? 'تم إنشاء المهمة وربطها بالدرس بنجاح' : 'Task created and linked');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  // Quiz Linking & Quick Create
  const [isLinkQuizModalOpen, setIsLinkQuizModalOpen] = useState(false);
  const [isCreateQuizModalOpen, setIsCreateQuizModalOpen] = useState(false);
  const [quizSearchQuery, setQuizSearchQuery] = useState('');
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDescription, setNewQuizDescription] = useState('');
  const [newQuizDuration, setNewQuizDuration] = useState(15);
  const [newQuizTotalMarks, setNewQuizTotalMarks] = useState(20);
  const [newQuizXp, setNewQuizXp] = useState(30);

  const { data: allExamsList, isLoading: isAllExamsLoading } = useQuery({
    queryKey: ['adminAllExams'],
    queryFn: async () => (await api.exams.list()).data.data,
    enabled: isLinkQuizModalOpen
  });

  const linkQuizMutation = useMutation({
    mutationFn: async (examId: string) => {
      if (!id) return;
      return (await api.exams.update(examId, { lessonId: id, isQuiz: true })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLesson', id] });
      queryClient.invalidateQueries({ queryKey: ['adminAllExams'] });
      setIsLinkQuizModalOpen(false);
      toast.success(isArabic ? 'تم ربط الكويز بالدرس بنجاح' : 'Quiz linked to lesson');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const unlinkQuizMutation = useMutation({
    mutationFn: async (examId: string) => {
      return (await api.exams.update(examId, { lessonId: null })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLesson', id] });
      queryClient.invalidateQueries({ queryKey: ['adminAllExams'] });
      toast.success(isArabic ? 'تم فك ارتباط الكويز بالدرس' : 'Quiz unlinked from lesson');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const createQuizMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return (await api.exams.create({
        lessonId: id,
        curriculumId: lesson?.curriculumId,
        title: newQuizTitle.trim(),
        description: newQuizDescription.trim() || undefined,
        durationMinutes: Number(newQuizDuration) || 15,
        totalMarks: Number(newQuizTotalMarks) || 20,
        xpReward: Number(newQuizXp) || 30,
        isQuiz: true,
        isPublished: true
      })).data.data;
    },
    onSuccess: (newExam) => {
      queryClient.invalidateQueries({ queryKey: ['adminLesson', id] });
      setIsCreateQuizModalOpen(false);
      setNewQuizTitle('');
      setNewQuizDescription('');
      toast.success(isArabic ? 'تم إنشاء الكويز بنجاح! سيتم تحويلك لإضافة الأسئلة' : 'Quiz created! Redirecting to add questions');
      if (newExam?.id) {
        navigate(`/admin/exams/${newExam.id}/builder`);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return (await api.lessons.update(id, {
        title,
        content,
        description,
        pageRange: pageRange.trim() || null,
        authority,
        difficulty,
        estimatedDurationMinutes: Number(estimatedDurationMinutes),
        conceptCards,
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

  const openAddConceptModal = () => {
    setEditingCardIndex(null);
    setCardTitle('');
    setCardExplanation('');
    setCardKeyConcept('');
    setCardSummary('');
    setIsConceptModalOpen(true);
  };

  const openEditConceptModal = (index: number) => {
    const card = conceptCards[index];
    if (!card) return;
    setEditingCardIndex(index);
    setCardTitle(card.title || '');
    setCardExplanation(card.explanation || '');
    setCardKeyConcept(card.keyConcept || '');
    setCardSummary(card.summary || '');
    setIsConceptModalOpen(true);
  };

  const handleSaveConceptCard = (e: React.FormEvent) => {
    e.preventDefault();
    const newCard = {
      title: cardTitle.trim(),
      explanation: cardExplanation.trim() || undefined,
      keyConcept: cardKeyConcept.trim() || undefined,
      summary: cardSummary.trim() || undefined
    };

    if (editingCardIndex !== null) {
      const updated = [...conceptCards];
      updated[editingCardIndex] = newCard;
      setConceptCards(updated);
    } else {
      setConceptCards([...conceptCards, newCard]);
    }
    setIsConceptModalOpen(false);
  };

  const handleDeleteConceptCard = (index: number) => {
    setConceptCards(conceptCards.filter((_, i) => i !== index));
  };

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/admin/curriculum')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('curriculum.title')}</span>
        </button>

        <div className="flex items-center gap-2">
          {lesson?.curriculumId && (
            <a
              href={`/student/courses/${lesson.curriculumId}/lessons/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-brand-600" />
              <span>{isArabic ? 'معاينة تجربة الطالب' : 'Student View'}</span>
            </a>
          )}

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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
          </div>
          <MarkdownViewer content={content} />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Card 1: Core Lesson Information & Provenance */}
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-600" />
              <span>{isArabic ? 'بيانات الدرس والاعتماد والتوثيق' : 'Core Lesson & Provenance'}</span>
            </h3>

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

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input
                label={isArabic ? 'صفحات كتاب الوزارة (Page Range)' : 'Textbook Page Range'}
                placeholder="e.g. ص 4 - 11"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
              />

              <Select
                label={isArabic ? 'جهة الاعتماد' : 'Authority'}
                value={authority}
                onChange={(e) => setAuthority(e.target.value)}
                options={[
                  { value: 'OFFICIAL', label: isArabic ? 'المنهج الرسمي المعتمد (وزارة التربية والتعليم)' : 'Official EB Track' },
                  { value: 'COMMUNITY', label: isArabic ? 'محتوى أكاديمي مخصص / حر' : 'Academy Track' }
                ]}
              />

              <Select
                label={t('tasks.difficulty')}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                options={[
                  { value: 'BEGINNER', label: formatStatus('BEGINNER') },
                  { value: 'INTERMEDIATE', label: formatStatus('INTERMEDIATE') },
                  { value: 'ADVANCED', label: formatStatus('ADVANCED') }
                ]}
              />

              <Input
                label={t('curriculum.estimatedDuration')}
                type="number"
                value={estimatedDurationMinutes}
                onChange={(e) => setEstimatedDurationMinutes(Number(e.target.value))}
                required
              />
            </div>

            <Input
              label={t('curriculum.lessonDescription')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Card>

          {/* Card 2: Media, Video & Presentation Configuration */}
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
              <Video className="w-4 h-4 text-brand-600" />
              <span>{isArabic ? 'وسائط الشرح والفيديو والعروض التقديمية' : 'Media, Video & Presentations'}</span>
            </h3>

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
          </Card>

          {/* Card 3: Interactive Concept Cards Deck Manager */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>{isArabic ? 'بطاقات المفاهيم التفاعلية (Concept Flashcards)' : 'Interactive Concept Cards'}</span>
                  <Badge variant="outline" size="sm">{conceptCards.length}</Badge>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isArabic
                    ? 'البطاقات التعليمية التي يتفاعل معها الطالب في تبويب المفاهيم والملخص.'
                    : 'Interactive cards students flip and study in the Concepts & Summary tab.'}
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openAddConceptModal}
                className="gap-1.5 text-xs font-bold border-brand-200 text-brand-600 hover:bg-brand-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isArabic ? 'إضافة بطاقة مفهوم' : 'Add Concept Card'}</span>
              </Button>
            </div>

            {conceptCards.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                {isArabic
                  ? 'لم تتم إضافة أي بطاقات مفاهيم لهذا الدرس بعد. اضغط على الزر أعلاه لإضافة بطاقة.'
                  : 'No concept cards added yet. Click the button above to add a card.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {conceptCards.map((card: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{card.title}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditConceptModal(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteConceptCard(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {card.explanation && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{card.explanation}</p>
                      )}

                      {card.keyConcept && (
                        <p className="text-[11px] text-brand-600 font-semibold mt-1">
                          <strong>{isArabic ? 'المفهوم الأساسي: ' : 'Key Concept: '}</strong>{card.keyConcept}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Card 4: Detailed Lesson Content */}
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

          {/* Card 5: Connected Tasks & Applications */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  <span>{isArabic ? 'المهام والتطبيقات العملية المرتبطة بالدرس' : 'Connected Tasks & Challenges'}</span>
                  <Badge variant="outline" size="sm">{lesson?.tasks?.length || 0}</Badge>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isArabic
                    ? 'المهام التطبيقية والتحديات البرمجية التي تظهر للطالب في تبويب المهام.'
                    : 'Engineering tasks and challenges displayed in the student Tasks tab.'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsLinkTaskModalOpen(true)}
                  className="gap-1.5 text-xs font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'ربط مهمة موجودة' : 'Link Existing Task'}</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsCreateTaskModalOpen(true)}
                  className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'إنشاء مهمة سريعة للدرس' : 'Quick Create Task'}</span>
                </Button>
              </div>
            </div>

            {(!lesson?.tasks || lesson.tasks.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <CheckSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-600 dark:text-slate-400">
                  {isArabic
                    ? 'لا توجد مهام مرتبطة بهذا الدرس حالياً.'
                    : 'No tasks connected to this lesson yet.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isArabic
                    ? 'يمكنك ربط مهمة موجودة من بنك المهام أو إنشاء مهمة جديدة تظهر للطالب فوراً.'
                    : 'You can link an existing task from the task bank or create a new one.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lesson.tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-emerald-300 transition flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" size="sm">{formatStatus(task.taskType || task.difficulty)}</Badge>
                        <Badge variant="success" size="sm">+{task.xpReward || 30} XP</Badge>
                        {task.isPublished === false && (
                          <Badge variant="warning" size="sm">{isArabic ? 'مسودة' : 'Draft'}</Badge>
                        )}
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">{task.title}</h4>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/tasks?id=${task.id}`)}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isArabic ? 'تعديل في بنك المهام' : 'Edit in Tasks Bank'}</span>
                        <ChevronRight className="w-3 h-3 rtl:rotate-180" />
                      </button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(isArabic ? 'هل أنت متأكد من فك ارتباط هذه المهمة بالدرس؟' : 'Unlink task from lesson?')) {
                            unlinkTaskMutation.mutate(task.id);
                          }
                        }}
                        isLoading={unlinkTaskMutation.isPending}
                        className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 px-2"
                        title={isArabic ? 'فك ارتباط هذه المهمة بالدرس' : 'Unlink task from lesson'}
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'فك الارتباط' : 'Unlink'}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Card 6: Connected Assessment Quizzes */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                  <span>{isArabic ? 'الاختبارات والكويزات التقييمية المرتبطة بالدرس' : 'Connected Assessment Quizzes'}</span>
                  <Badge variant="outline" size="sm">{lesson?.exams?.length || 0}</Badge>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isArabic
                    ? 'الكويزات التفاعلية التي تظهر للطالب في تبويب الاختبار التقييمي.'
                    : 'Interactive quizzes that appear in the student Quiz tab.'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsLinkQuizModalOpen(true)}
                  className="gap-1.5 text-xs font-bold border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'ربط كويز أو امتحان موجود' : 'Link Existing Quiz'}</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsCreateQuizModalOpen(true)}
                  className="gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'إنشاء كويز سريع للدرس' : 'Quick Create Quiz'}</span>
                </Button>
              </div>
            </div>

            {(!lesson?.exams || lesson.exams.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <HelpCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-600 dark:text-slate-400">
                  {isArabic
                    ? 'لا يوجد كويز تقييمي مرتبط بهذا الدرس حالياً.'
                    : 'No quiz connected to this lesson yet.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isArabic
                    ? 'يمكنك ربط امتحان/كويز من بنك الامتحانات أو إنشاء كويز سريع وإضافة أسئلته.'
                    : 'You can link an existing quiz or create a new quick quiz.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lesson.exams.map((exam: any) => (
                  <div
                    key={exam.id}
                    className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-amber-300 transition flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" size="sm">{exam.durationMinutes} min</Badge>
                        <Badge variant="warning" size="sm">+{exam.xpReward || 30} XP</Badge>
                        {exam.totalMarks && (
                          <Badge variant="secondary" size="sm">{exam.totalMarks} {isArabic ? 'درجة' : 'pts'}</Badge>
                        )}
                        {exam.isPublished === false && (
                          <Badge variant="outline" size="sm">{isArabic ? 'مسودة' : 'Draft'}</Badge>
                        )}
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">{exam.title}</h4>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/exams/${exam.id}/builder`)}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isArabic ? 'تعديل الأسئلة في المنشئ' : 'Edit Questions in Builder'}</span>
                        <ChevronRight className="w-3 h-3 rtl:rotate-180" />
                      </button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(isArabic ? 'هل أنت متأكد من فك ارتباط هذا الكويز بالدرس؟' : 'Unlink quiz from lesson?')) {
                            unlinkQuizMutation.mutate(exam.id);
                          }
                        }}
                        isLoading={unlinkQuizMutation.isPending}
                        className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 px-2"
                        title={isArabic ? 'فك ارتباط هذا الكويز بالدرس' : 'Unlink quiz from lesson'}
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'فك الارتباط' : 'Unlink'}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal: Add / Edit Concept Card */}
      <Dialog
        isOpen={isConceptModalOpen}
        onClose={() => setIsConceptModalOpen(false)}
        title={editingCardIndex !== null ? (isArabic ? 'تعديل بطاقة مفهوم' : 'Edit Concept Card') : (isArabic ? 'إضافة بطاقة مفهوم جديدة' : 'Add Concept Card')}
        maxWidth="md"
      >
        <form onSubmit={handleSaveConceptCard} className="space-y-4 py-2">
          <Input
            label={isArabic ? 'عنوان المفهوم (Title)' : 'Concept Title'}
            value={cardTitle}
            onChange={(e) => setCardTitle(e.target.value)}
            placeholder="e.g. قانون مور (Moore's Law)"
            required
          />
          <Input
            label={isArabic ? 'المفهوم الأساسي المركز (Key Concept)' : 'Key Concept'}
            value={cardKeyConcept}
            onChange={(e) => setCardKeyConcept(e.target.value)}
            placeholder="e.g. تضاعف الترانزستورات كل سنتين"
          />
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isArabic ? 'الشرح والتوضيح (Explanation)' : 'Explanation'}
            </label>
            <textarea
              value={cardExplanation}
              onChange={(e) => setCardExplanation(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px]"
              placeholder="شرح مبسط وواضح يستوعبه الطالب..."
            />
          </div>
          <Input
            label={isArabic ? 'الخلاصة المستفادة (Summary Takeaway)' : 'Summary'}
            value={cardSummary}
            onChange={(e) => setCardSummary(e.target.value)}
            placeholder="e.g. خفض التكلفة العالمية للأجهزة وزيادة سرعتها"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsConceptModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {isArabic ? 'حفظ البطاقة' : 'Save Card'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal: Link Existing Task */}
      <Dialog
        isOpen={isLinkTaskModalOpen}
        onClose={() => setIsLinkTaskModalOpen(false)}
        title={isArabic ? 'ربط مهمة موجودة بهذا الدرس' : 'Link Existing Task to Lesson'}
        maxWidth="lg"
      >
        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute top-3 start-3 text-slate-400" />
            <input
              type="text"
              placeholder={isArabic ? 'بحث في بنك المهام بالعنوان...' : 'Search tasks by title...'}
              value={taskSearchQuery}
              onChange={(e) => setTaskSearchQuery(e.target.value)}
              className="w-full ps-9 pe-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="max-h-[350px] overflow-y-auto space-y-2 pe-1">
            {isAllTasksLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">{t('common.loading')}</div>
            ) : (() => {
              const currentTaskIds = new Set((lesson?.tasks || []).map((t: any) => t.id));
              const filtered = (allTasksList || []).filter((t: any) =>
                !taskSearchQuery || t.title.toLowerCase().includes(taskSearchQuery.toLowerCase())
              );

              if (filtered.length === 0) {
                return (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {isArabic ? 'لا توجد مهام مطابقة للبحث' : 'No matching tasks found'}
                  </div>
                );
              }

              return filtered.map((task: any) => {
                const isAlreadyLinked = currentTaskIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition flex items-center justify-between gap-3 bg-white dark:bg-slate-900"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" size="sm">{formatStatus(task.taskType || task.difficulty)}</Badge>
                        <Badge variant="success" size="sm">+{task.xpReward || 30} XP</Badge>
                        {task.lessonId && task.lessonId !== id && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {isArabic ? 'مرتبطة بدرس آخر' : 'Linked to another lesson'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{task.title}</h4>
                    </div>

                    {isAlreadyLinked ? (
                      <Badge variant="success" size="sm" className="shrink-0">
                        {isArabic ? 'مرتبطة بالفعل' : 'Already Linked'}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => linkTaskMutation.mutate(task.id)}
                        isLoading={linkTaskMutation.isPending}
                        className="shrink-0 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1 h-8"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'ربط بالدرس' : 'Link to Lesson'}</span>
                      </Button>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setIsLinkTaskModalOpen(false)}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal: Quick Create Task */}
      <Dialog
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        title={isArabic ? 'إنشاء مهمة سريعة للدرس' : 'Quick Create Task for Lesson'}
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTaskMutation.mutate();
          }}
          className="space-y-4 py-2"
        >
          <Input
            label={isArabic ? 'عنوان المهمة' : 'Task Title'}
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="e.g. تطبيق خوارزمية البحث الخطي"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label={isArabic ? 'نوع المهمة' : 'Task Type'}
              value={newTaskType}
              onChange={(e) => setNewTaskType(e.target.value)}
              options={[
                { value: 'DAILY_TASK', label: isArabic ? 'مهمة تطبيقية (Daily)' : 'Daily Task' },
                { value: 'ENGINEERING_TASK', label: isArabic ? 'تحدي هندسي (Engineering)' : 'Engineering Challenge' },
                { value: 'PROJECT', label: isArabic ? 'مشروع برمجي (Project)' : 'Project' }
              ]}
            />

            <Select
              label={isArabic ? 'مستوى الصعوبة' : 'Difficulty'}
              value={newTaskDifficulty}
              onChange={(e) => setNewTaskDifficulty(e.target.value)}
              options={[
                { value: 'BEGINNER', label: isArabic ? 'مبتدئ' : 'Beginner' },
                { value: 'INTERMEDIATE', label: isArabic ? 'متوسط' : 'Intermediate' },
                { value: 'ADVANCED', label: isArabic ? 'متقدم' : 'Advanced' }
              ]}
            />

            <Input
              label={isArabic ? 'نقاط الخبرة (XP)' : 'XP Reward'}
              type="number"
              value={newTaskXp}
              onChange={(e) => setNewTaskXp(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isArabic ? 'تعليمات المهمة والمطلوب' : 'Instructions & Requirements'}
            </label>
            <textarea
              value={newTaskInstructions}
              onChange={(e) => setNewTaskInstructions(e.target.value)}
              placeholder="اكتب خطوات الحل أو المطلوب تنفيذه من الطالب..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[90px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsCreateTaskModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              isLoading={createTaskMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isArabic ? 'إنشاء وربط بالدرس' : 'Create & Link'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal: Link Existing Quiz */}
      <Dialog
        isOpen={isLinkQuizModalOpen}
        onClose={() => setIsLinkQuizModalOpen(false)}
        title={isArabic ? 'ربط كويز أو امتحان بهذا الدرس' : 'Link Existing Quiz to Lesson'}
        maxWidth="lg"
      >
        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute top-3 start-3 text-slate-400" />
            <input
              type="text"
              placeholder={isArabic ? 'بحث في الامتحانات والكويزات بالعنوان...' : 'Search quizzes by title...'}
              value={quizSearchQuery}
              onChange={(e) => setQuizSearchQuery(e.target.value)}
              className="w-full ps-9 pe-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="max-h-[350px] overflow-y-auto space-y-2 pe-1">
            {isAllExamsLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">{t('common.loading')}</div>
            ) : (() => {
              const currentExamIds = new Set((lesson?.exams || []).map((e: any) => e.id));
              const filtered = (allExamsList || []).filter((ex: any) =>
                !quizSearchQuery || ex.title.toLowerCase().includes(quizSearchQuery.toLowerCase())
              );

              if (filtered.length === 0) {
                return (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {isArabic ? 'لا توجد امتحانات أو كويزات مطابقة للبحث' : 'No matching quizzes found'}
                  </div>
                );
              }

              return filtered.map((exam: any) => {
                const isAlreadyLinked = currentExamIds.has(exam.id);
                return (
                  <div
                    key={exam.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 transition flex items-center justify-between gap-3 bg-white dark:bg-slate-900"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" size="sm">{exam.durationMinutes} min</Badge>
                        <Badge variant="warning" size="sm">+{exam.xpReward || 30} XP</Badge>
                        {exam.totalMarks && (
                          <Badge variant="secondary" size="sm">{exam.totalMarks} {isArabic ? 'درجة' : 'pts'}</Badge>
                        )}
                        {exam.lessonId && exam.lessonId !== id && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {isArabic ? 'مرتبط بدرس آخر' : 'Linked to another lesson'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{exam.title}</h4>
                    </div>

                    {isAlreadyLinked ? (
                      <Badge variant="success" size="sm" className="shrink-0">
                        {isArabic ? 'مرتبط بالفعل' : 'Already Linked'}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => linkQuizMutation.mutate(exam.id)}
                        isLoading={linkQuizMutation.isPending}
                        className="shrink-0 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 gap-1 h-8"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'ربط بالدرس' : 'Link to Lesson'}</span>
                      </Button>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setIsLinkQuizModalOpen(false)}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal: Quick Create Quiz */}
      <Dialog
        isOpen={isCreateQuizModalOpen}
        onClose={() => setIsCreateQuizModalOpen(false)}
        title={isArabic ? 'إنشاء كويز تقييمي جديد للدرس' : 'Quick Create Quiz for Lesson'}
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createQuizMutation.mutate();
          }}
          className="space-y-4 py-2"
        >
          <Input
            label={isArabic ? 'عنوان الكويز' : 'Quiz Title'}
            value={newQuizTitle}
            onChange={(e) => setNewQuizTitle(e.target.value)}
            placeholder="e.g. كويز تقييمي سريع على المفاهيم الأساسية"
            required
          />

          <Input
            label={isArabic ? 'الوصف (اختياري)' : 'Description (Optional)'}
            value={newQuizDescription}
            onChange={(e) => setNewQuizDescription(e.target.value)}
            placeholder="e.g. اختبار قصير لاختبار مدى استيعاب الدرس"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={isArabic ? 'المدة (بالدقائق)' : 'Duration (min)'}
              type="number"
              value={newQuizDuration}
              onChange={(e) => setNewQuizDuration(Number(e.target.value))}
            />

            <Input
              label={isArabic ? 'الدرجة الكلية' : 'Total Marks'}
              type="number"
              value={newQuizTotalMarks}
              onChange={(e) => setNewQuizTotalMarks(Number(e.target.value))}
            />

            <Input
              label={isArabic ? 'نقاط الخبرة (XP)' : 'XP Reward'}
              type="number"
              value={newQuizXp}
              onChange={(e) => setNewQuizXp(Number(e.target.value))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsCreateQuizModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              isLoading={createQuizMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isArabic ? 'إنشاء والانتقال لإضافة الأسئلة' : 'Create & Add Questions'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
