import { useState, useCallback, useMemo } from 'react';

export function useBulkSelection<T extends { id: string }>(
  items: T[],
  filterSelectable: (item: T) => boolean = () => true
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectableItems = useMemo(
    () => items.filter(filterSelectable),
    [items, filterSelectable]
  );

  const selectableIds = useMemo(
    () => selectableItems.map((i) => i.id),
    [selectableItems]
  );

  const selectedCount = useMemo(() => {
    let count = 0;
    const selectableSet = new Set(selectableIds);
    for (const id of selectedIds) {
      if (selectableSet.has(id)) count++;
    }
    return count;
  }, [selectedIds, selectableIds]);

  const isAllSelected = useMemo(
    () => selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id)),
    [selectableIds, selectedIds]
  );

  const isIndeterminate = useMemo(
    () => selectedCount > 0 && !isAllSelected,
    [selectedCount, isAllSelected]
  );

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(selectableIds));
  }, [selectableIds]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [isAllSelected, deselectAll, selectAll]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedArray = useMemo(
    () => Array.from(selectedIds).filter((id) => selectableIds.includes(id)),
    [selectedIds, selectableIds]
  );

  return {
    selectedIds: selectedArray,
    selectedCount,
    isAllSelected,
    isIndeterminate,
    isSelected,
    toggle,
    selectAll,
    deselectAll,
    toggleSelectAll,
    clear
  };
}
