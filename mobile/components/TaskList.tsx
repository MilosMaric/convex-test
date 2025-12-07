import { StyleSheet, FlatList, Pressable, ActivityIndicator, Modal, View as RNView, Text as RNText, ScrollView, Dimensions } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useState, useCallback, useMemo } from 'react';
import { Id } from 'convex/_generated/dataModel';

import { Text, View } from '@/components/Themed';

type FilterType = 'all' | 'completed' | 'incomplete' | 'important';
export type SortType = 'latest' | 'inactive' | 'newest' | 'oldest' | 'frequent' | 'unfrequent' | 'quickest' | 'longest';
export type DurationFilterType = 'all' | 'quick' | 'long';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_SIZE = 9;
const HORIZONTAL_PADDING = Math.max(12, SCREEN_WIDTH * 0.05);
const TASK_CARD_WIDTH = SCREEN_WIDTH - (HORIZONTAL_PADDING * 2);

export const sortOptions: { value: SortType; label: string }[] = [
  { value: 'latest', label: 'Latest Updated' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'frequent', label: 'Frequent' },
  { value: 'unfrequent', label: 'Unfrequent' },
  { value: 'quickest', label: 'Quickest' },
  { value: 'longest', label: 'Longest' },
];

function formatDuration(minutes: number | undefined): string {
  if (!minutes) return "Unknown";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return "Unknown";
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

function HistoryFilterChips({ 
  showCompleted, 
  showIncomplete,
  showImportant,
  showNotImportant,
  onToggleCompleted, 
  onToggleIncomplete,
  onToggleImportant,
  onToggleNotImportant
}: { 
  showCompleted: boolean; 
  showIncomplete: boolean;
  showImportant: boolean;
  showNotImportant: boolean;
  onToggleCompleted: () => void; 
  onToggleIncomplete: () => void;
  onToggleImportant: () => void;
  onToggleNotImportant: () => void;
}) {
  return (
    <RNView style={historyStyles.chipsContainer}>
      <Pressable
        onPress={onToggleCompleted}
        style={[
          historyStyles.chip,
          showCompleted ? historyStyles.chipActiveCompleted : historyStyles.chipInactive
        ]}
      >
        <RNText style={[
          historyStyles.chipIcon,
          showCompleted ? historyStyles.chipTextActive : historyStyles.chipTextInactive
        ]}>
          ✓
        </RNText>
      </Pressable>
      <Pressable
        onPress={onToggleIncomplete}
        style={[
          historyStyles.chip,
          showIncomplete ? historyStyles.chipActiveIncomplete : historyStyles.chipInactive
        ]}
      >
        <RNText style={[
          historyStyles.chipIcon,
          showIncomplete ? historyStyles.chipTextActive : historyStyles.chipTextInactive
        ]}>
          ○
        </RNText>
      </Pressable>
      <Pressable
        onPress={onToggleImportant}
        style={[
          historyStyles.chip,
          showImportant ? historyStyles.chipActiveImportant : historyStyles.chipInactive
        ]}
      >
        <RNText style={[
          historyStyles.chipIcon,
          showImportant ? historyStyles.chipTextActive : historyStyles.chipTextInactive
        ]}>
          ★
        </RNText>
      </Pressable>
      <Pressable
        onPress={onToggleNotImportant}
        style={[
          historyStyles.chip,
          showNotImportant ? historyStyles.chipActiveIncomplete : historyStyles.chipInactive
        ]}
      >
        <RNText style={[
          historyStyles.chipIcon,
          showNotImportant ? historyStyles.chipTextActive : historyStyles.chipTextInactive
        ]}>
          ☆
        </RNText>
      </Pressable>
    </RNView>
  );
}

function TaskHistory({ taskId, showCompleted, showIncomplete, showImportant, showNotImportant }: { 
  taskId: Id<"tasks">; 
  showCompleted: boolean; 
  showIncomplete: boolean;
  showImportant: boolean;
  showNotImportant: boolean;
}) {
  const history = useQuery(api.tasks.getTaskHistory, { taskId });

  if (!history) {
    return <RNText style={historyStyles.loading}>Loading history...</RNText>;
  }

  if (history.length === 0) {
    return <RNText style={historyStyles.empty}>No changes recorded yet.</RNText>;
  }

  // Filter history based on selected chips
  const filteredHistory = history.filter(entry => {
    const hasAnyFilter = showCompleted || showIncomplete || showImportant || showNotImportant;
    if (!hasAnyFilter) return true;
    
    const isCompletionChange = !entry.changeType || entry.changeType === "completion";
    const isImportanceChange = entry.changeType === "importance";
    
    if (isCompletionChange) {
      if (showCompleted && entry.changedTo) return true;
      if (showIncomplete && !entry.changedTo) return true;
    }
    
    if (isImportanceChange) {
      if (showImportant && entry.changedTo) return true;
      if (showNotImportant && !entry.changedTo) return true;
    }
    
    return false;
  });

  if (filteredHistory.length === 0) {
    return <RNText style={historyStyles.empty}>No matching entries.</RNText>;
  }

  return (
    <RNView style={historyStyles.container}>
      {filteredHistory.map((entry) => {
        const isCompletionChange = !entry.changeType || entry.changeType === "completion";
        const isImportanceChange = entry.changeType === "importance";
        
        return (
          <RNView key={entry._id} style={historyStyles.entry}>
            <RNText style={
              isImportanceChange 
                ? (entry.changedTo ? historyStyles.important : historyStyles.incomplete)
                : (entry.changedTo ? historyStyles.completed : historyStyles.incomplete)
            }>
              {isImportanceChange 
                ? (entry.changedTo ? "★ Important" : "☆ Not Important")
                : (entry.changedTo ? "✓ Completed" : "○ Incomplete")
              }
            </RNText>
            <RNText style={historyStyles.date}>
              {formatDateTime(entry.changedAt)}
            </RNText>
          </RNView>
        );
      })}
    </RNView>
  );
}

const historyStyles = StyleSheet.create({
  container: {
    gap: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInactive: {
    backgroundColor: '#333',
  },
  chipActiveCompleted: {
    backgroundColor: '#16a34a',
  },
  chipActiveIncomplete: {
    backgroundColor: '#525252',
  },
  chipActiveImportant: {
    backgroundColor: '#f59e0b',
  },
  chipIcon: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },
  chipTextInactive: {
    color: '#888',
  },
  loading: {
    color: '#666',
    fontSize: 14,
  },
  empty: {
    color: '#666',
    fontSize: 14,
  },
  entry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 8,
  },
  completed: {
    color: '#4ade80',
    fontSize: 14,
  },
  incomplete: {
    color: '#888',
    fontSize: 14,
  },
  important: {
    color: '#fbbf24',
    fontSize: 14,
  },
  date: {
    color: '#666',
    fontSize: 12,
  },
});

// Simple Task Item Component
function TaskItem({ 
  item, 
  onPress
}: { 
  item: any; 
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.taskCard,
        styles.taskIncomplete,
        item.isCompleted && styles.taskCompletedDimmed,
        item.isImportant && styles.taskImportant,
      ]}
      onPress={onPress}
    >
      <RNView style={styles.taskHeader}>
        <RNText style={[styles.taskStatusIcon, item.isCompleted && styles.taskStatusIconCompleted]}>
          {item.isCompleted ? '✓' : '○'}
        </RNText>
        <RNText style={[styles.taskText, item.isCompleted && styles.taskTextCompleted]} numberOfLines={1}>
          {item.text}
        </RNText>
        <RNText style={[styles.taskImportanceIcon, item.isImportant && styles.taskImportanceIconActive]}>
          {item.isImportant ? '★' : '☆'}
        </RNText>
      </RNView>
      {item.description && (
        <RNText style={styles.taskDescription} numberOfLines={2}>
          {item.description}
        </RNText>
      )}
      <RNText style={styles.taskHint}>Tap for details</RNText>
    </Pressable>
  );
}


interface TaskListProps {
  filter: FilterType;
  sort: SortType;
  onSortChange: (sort: SortType) => void;
  durationFilter?: DurationFilterType;
  onDurationFilterChange?: (filter: DurationFilterType) => void;
}

export default function TaskList({ filter, sort, onSortChange, durationFilter = 'all', onDurationFilterChange }: TaskListProps) {
  const allTasks = useQuery(api.tasks.listAllWithHistoryCount) ?? [];
  const toggleCompleted = useMutation(api.tasks.toggleCompleted);
  const toggleImportant = useMutation(api.tasks.toggleImportant);
  
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"tasks"> | null>(null);
  const [historyShowCompleted, setHistoryShowCompleted] = useState(false);
  const [historyShowIncomplete, setHistoryShowIncomplete] = useState(false);
  const [historyShowImportant, setHistoryShowImportant] = useState(false);
  const [historyShowNotImportant, setHistoryShowNotImportant] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<Id<"tasks"> | null>(null);
  const [togglingType, setTogglingType] = useState<'importance' | 'completion' | null>(null);
  
  const selectedTask = selectedTaskId ? allTasks.find(t => t._id === selectedTaskId) ?? null : null;

  const handleToggleComplete = useCallback(async (taskId: Id<"tasks">) => {
    setTogglingTaskId(taskId);
    setTogglingType('completion');
    try {
      await toggleCompleted({ id: taskId });
    } finally {
      setTogglingTaskId(null);
      setTogglingType(null);
    }
  }, [toggleCompleted]);

  const handleToggleImportant = useCallback(async (taskId: Id<"tasks">) => {
    setTogglingTaskId(taskId);
    setTogglingType('importance');
    try {
      await toggleImportant({ id: taskId });
    } finally {
      setTogglingTaskId(null);
      setTogglingType(null);
    }
  }, [toggleImportant]);

  // Sort and filter tasks
  const sortedAndFilteredTasks = useMemo(() => {
    let filtered = allTasks.filter(task => {
      // Status filter
      if (filter === 'all') {
        // All tasks - no status filter
      } else if (filter === 'completed') {
        if (!task.isCompleted) return false;
      } else if (filter === 'incomplete') {
        if (task.isCompleted) return false;
      } else if (filter === 'important') {
        if (!task.isImportant) return false;
      }
      
      // Duration filter
      if (durationFilter === 'quick') {
        if ((task.duration ?? 0) > 15) return false;
      } else if (durationFilter === 'long') {
        if ((task.duration ?? 0) <= 15) return false;
      }
      // 'all' duration filter - no filtering
      
      return true;
    });
    
    return filtered.sort((a, b) => {
      switch (sort) {
        case 'latest':
          return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
        case 'inactive':
          return (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
        case 'newest':
          return (b.createdAt ?? 0) - (a.createdAt ?? 0);
        case 'oldest':
          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        case 'frequent':
          return b.historyCount - a.historyCount;
        case 'unfrequent':
          return a.historyCount - b.historyCount;
        case 'quickest':
          return (a.duration ?? 0) - (b.duration ?? 0);
        case 'longest':
          return (b.duration ?? 0) - (a.duration ?? 0);
        default:
          return 0;
      }
    });
  }, [allTasks, filter, sort, durationFilter]);

  const visibleTasks = sortedAndFilteredTasks.slice(0, visibleCount);
  const hasMore = visibleCount < sortedAndFilteredTasks.length;

  const handleLoadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  const getTitle = () => {
    switch (filter) {
      case 'all': return 'All Tasks';
      case 'completed': return 'Completed';
      case 'incomplete': return 'Incomplete';
      case 'important': return 'Important';
    }
  };

  const currentSortLabel = sortOptions.find(o => o.value === sort)?.label ?? 'Sort';
  const isLoading = allTasks.length === 0 && !allTasks;
  
  const cycleDurationFilter = useCallback(() => {
    if (!onDurationFilterChange) return;
    const nextFilter: DurationFilterType = durationFilter === 'all' ? 'quick' : durationFilter === 'quick' ? 'long' : 'all';
    onDurationFilterChange(nextFilter);
    setVisibleCount(PAGE_SIZE);
  }, [durationFilter, onDurationFilterChange]);
  
  const getDurationFilterIcon = () => {
    switch (durationFilter) {
      case 'all': return '⊙';
      case 'quick': return '⚡';
      case 'long': return '🕐';
    }
  };
  
  const getDurationFilterLabel = () => {
    switch (durationFilter) {
      case 'all': return 'All';
      case 'quick': return 'Quick';
      case 'long': return 'Long';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{getTitle()}</Text>
      
      <RNView style={styles.filtersRow}>
        <Pressable 
          style={styles.sortButton}
          onPress={() => setShowSortPicker(true)}
        >
          <RNText style={styles.sortButtonLabel}>Sort: </RNText>
          <RNText style={styles.sortButtonValue}>{currentSortLabel}</RNText>
          <RNText style={styles.sortButtonChevron}>▼</RNText>
        </Pressable>
        
        {onDurationFilterChange && (
          <Pressable 
            style={styles.durationButton}
            onPress={cycleDurationFilter}
          >
            <RNText style={styles.durationButtonIcon}>{getDurationFilterIcon()}</RNText>
            <RNText style={styles.durationButtonLabel}>{getDurationFilterLabel()}</RNText>
          </Pressable>
        )}
      </RNView>
      
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      
      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <TaskItem
            item={item}
            onPress={() => setSelectedTaskId(item._id)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tasks found</Text>
        }
        ListFooterComponent={
          hasMore ? (
            <RNText style={styles.allLoadedText}>Loading more...</RNText>
          ) : visibleTasks.length > 0 ? (
            <RNText style={styles.allLoadedText}>All tasks loaded</RNText>
          ) : null
        }
      />

      {/* Sort Picker Modal */}
      <Modal
        visible={showSortPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortPicker(false)}
      >
        <Pressable 
          style={styles.sortModalOverlay}
          onPress={() => setShowSortPicker(false)}
        >
          <RNView style={styles.sortModalContent}>
            <RNText style={styles.sortModalTitle}>Sort By</RNText>
            {sortOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.sortOption,
                  sort === option.value && styles.sortOptionActive
                ]}
                onPress={() => {
                  onSortChange(option.value);
                  setVisibleCount(PAGE_SIZE);
                  setShowSortPicker(false);
                }}
              >
                <RNText style={[
                  styles.sortOptionText,
                  sort === option.value && styles.sortOptionTextActive
                ]}>
                  {option.label}
                </RNText>
                {sort === option.value && (
                  <RNText style={styles.sortOptionCheck}>✓</RNText>
                )}
              </Pressable>
            ))}
          </RNView>
        </Pressable>
      </Modal>

      {/* Full Screen Task Detail View */}
      <Modal
        visible={!!selectedTaskId}
        animationType="slide"
        onRequestClose={() => setSelectedTaskId(null)}
      >
        {selectedTask && (
          <RNView style={styles.fullScreenContainer}>
            {/* Header with close button */}
            <RNView style={styles.fullScreenHeader}>
              <Pressable style={styles.closeButtonFull} onPress={() => setSelectedTaskId(null)}>
                <RNText style={styles.closeButtonText}>✕</RNText>
              </Pressable>
              <RNText style={styles.fullScreenTitle} numberOfLines={1} ellipsizeMode="tail">{selectedTask.text}</RNText>
              <RNView style={styles.headerIndicators}>
                <RNText style={selectedTask.isImportant ? styles.headerImportantIcon : styles.headerNotImportantIcon}>
                  {selectedTask.isImportant ? "★" : "☆"}
                </RNText>
                <RNText style={selectedTask.isCompleted ? styles.headerStatusIconCompleted : styles.headerStatusIcon}>
                  {selectedTask.isCompleted ? "✓" : "○"}
                </RNText>
              </RNView>
            </RNView>
            
            {/* Fixed content */}
            <RNView style={styles.fullScreenFixedContent}>
              <RNView style={styles.sheetSection}>
                <RNText style={styles.sheetLabel}>Description</RNText>
                <RNText style={styles.sheetDescription}>
                  {selectedTask.description || "No description available."}
                </RNText>
              </RNView>
              
              <RNView style={styles.sheetDivider} />
              
              <RNView style={styles.sheetRow}>
                <RNText style={styles.sheetRowLabel}>Duration</RNText>
                <RNText style={styles.sheetRowValue}>{formatDuration(selectedTask.duration)}</RNText>
              </RNView>
              
              <RNView style={styles.sheetRow}>
                <RNText style={styles.sheetRowLabel}>Created</RNText>
                <RNText style={styles.sheetRowValue}>{formatRelativeTime(selectedTask.createdAt)}</RNText>
              </RNView>
              
              <RNView style={styles.sheetRow}>
                <RNText style={styles.sheetRowLabel}>Last Updated</RNText>
                <RNText style={styles.sheetRowValue}>{formatRelativeTime(selectedTask.updatedAt)}</RNText>
              </RNView>

              <RNView style={styles.sheetHistorySection}>
                <RNView style={styles.sheetHistoryHeader}>
                  <RNText style={styles.sheetLabelInHeader}>Changes</RNText>
                  <HistoryFilterChips
                    showCompleted={historyShowCompleted}
                    showIncomplete={historyShowIncomplete}
                    showImportant={historyShowImportant}
                    showNotImportant={historyShowNotImportant}
                    onToggleCompleted={() => setHistoryShowCompleted(!historyShowCompleted)}
                    onToggleIncomplete={() => setHistoryShowIncomplete(!historyShowIncomplete)}
                    onToggleImportant={() => setHistoryShowImportant(!historyShowImportant)}
                    onToggleNotImportant={() => setHistoryShowNotImportant(!historyShowNotImportant)}
                  />
                </RNView>
              </RNView>
            </RNView>
            
            {/* Scrollable history list only */}
            <ScrollView 
              style={styles.fullScreenHistoryScroll} 
              contentContainerStyle={styles.fullScreenHistoryScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <TaskHistory 
                taskId={selectedTask._id}
                showCompleted={historyShowCompleted}
                showIncomplete={historyShowIncomplete}
                showImportant={historyShowImportant}
                showNotImportant={historyShowNotImportant}
              />
            </ScrollView>
            
            {/* Fixed bottom buttons */}
            <RNView style={styles.fullScreenButtons}>
              <Pressable
                style={[
                  styles.sheetButton,
                  styles.sheetButtonHalf,
                  selectedTask.isImportant ? styles.sheetButtonInactive : styles.sheetButtonImportant,
                  (togglingTaskId === selectedTask._id && togglingType === 'completion') && styles.sheetButtonDisabled
                ]}
                onPress={() => handleToggleImportant(selectedTask._id)}
                disabled={togglingTaskId === selectedTask._id && togglingType === 'completion'}
              >
                {togglingTaskId === selectedTask._id && togglingType === 'importance' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <RNText style={styles.sheetButtonIcon}>
                    {selectedTask.isImportant ? "☆" : "★"}
                  </RNText>
                )}
              </Pressable>
              
              <Pressable
                style={[
                  styles.sheetButton,
                  styles.sheetButtonHalf,
                  selectedTask.isCompleted ? styles.sheetButtonInactive : styles.sheetButtonComplete,
                  (togglingTaskId === selectedTask._id && togglingType === 'importance') && styles.sheetButtonDisabled
                ]}
                onPress={() => handleToggleComplete(selectedTask._id)}
                disabled={togglingTaskId === selectedTask._id && togglingType === 'importance'}
              >
                {togglingTaskId === selectedTask._id && togglingType === 'completion' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <RNText style={styles.sheetButtonIcon}>
                    {selectedTask.isCompleted ? "○" : "✓"}
                  </RNText>
                )}
              </Pressable>
            </RNView>
          </RNView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sortButtonLabel: {
    color: '#888',
    fontSize: 14,
  },
  sortButtonValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  sortButtonChevron: {
    color: '#888',
    fontSize: 10,
    marginLeft: 8,
  },
  durationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  durationButtonIcon: {
    fontSize: 16,
    color: '#fff',
  },
  durationButtonLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  separator: {
    marginVertical: 16,
    height: 1,
    width: '80%',
  },
  listContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 20,
  },
  taskCard: {
    width: TASK_CARD_WIDTH,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  taskIncomplete: {
    backgroundColor: '#404040',
  },
  taskCompletedDimmed: {
    opacity: 0.7,
  },
  taskImportant: {
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskStatusIcon: {
    fontSize: 18,
    color: '#888',
    marginRight: 8,
  },
  taskStatusIconCompleted: {
    color: '#4ade80',
  },
  taskText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  taskTextCompleted: {
    color: '#aaa',
  },
  taskImportanceIcon: {
    fontSize: 18,
    color: '#555',
    marginLeft: 8,
  },
  taskImportanceIconActive: {
    color: '#f59e0b',
  },
  taskDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    lineHeight: 18,
    marginLeft: 26,
  },
  taskHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
    marginLeft: 26,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
  },
  allLoadedText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 16,
  },
  // Full Screen Styles
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButtonFull: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  fullScreenTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 12,
  },
  headerIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerImportantIcon: {
    fontSize: 18,
    color: '#f59e0b',
  },
  headerNotImportantIcon: {
    fontSize: 18,
    color: '#666',
  },
  headerStatusIcon: {
    fontSize: 18,
    color: '#888',
  },
  headerStatusIconCompleted: {
    fontSize: 18,
    color: '#16a34a',
  },
  fullScreenFixedContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  fullScreenHistoryScroll: {
    flex: 1,
  },
  fullScreenHistoryScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  fullScreenButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 40,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sheetStatus: {
    fontSize: 14,
    color: '#888',
  },
  importantBadge: {
    fontSize: 14,
    color: '#f59e0b',
  },
  notImportantBadge: {
    fontSize: 14,
    color: '#888',
  },
  sheetSection: {
    marginBottom: 16,
  },
  sheetLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetLabelInHeader: {
    fontSize: 12,
    color: '#888',
    marginBottom: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetDescription: {
    fontSize: 15,
    color: '#ddd',
    lineHeight: 22,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#333',
    marginTop: 8,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sheetRowLabel: {
    fontSize: 12,
    color: '#888',
  },
  sheetRowValue: {
    fontSize: 12,
    color: '#fff',
  },
  sheetHistorySection: {
    marginTop: 20,
    marginBottom: 0,
  },
  sheetHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionButtons: {
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  sheetButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetButtonHalf: {
    flex: 1,
  },
  sheetButtonComplete: {
    backgroundColor: '#16a34a',
  },
  sheetButtonImportant: {
    backgroundColor: '#f59e0b',
  },
  sheetButtonInactive: {
    backgroundColor: '#404040',
  },
  sheetButtonDisabled: {
    opacity: 0.5,
  },
  sheetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sheetButtonIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  // Sort Modal Styles
  sortModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  sortModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sortOptionActive: {
    backgroundColor: '#333',
  },
  sortOptionText: {
    color: '#888',
    fontSize: 16,
  },
  sortOptionTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  sortOptionCheck: {
    color: '#16a34a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
