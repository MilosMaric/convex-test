import { StyleSheet, FlatList, Pressable, ActivityIndicator, Modal, View as RNView, Text as RNText, ScrollView, Dimensions } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useState, useCallback, useMemo } from 'react';
import { Id } from 'convex/_generated/dataModel';

import { Text, View } from '@/components/Themed';

type FilterType = 'all' | 'completed' | 'incomplete';
export type SortType = 'latest' | 'inactive' | 'newest' | 'oldest' | 'frequent' | 'unfrequent' | 'quickest' | 'longest';

const PAGE_SIZE = 9;

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
  onToggleCompleted, 
  onToggleIncomplete 
}: { 
  showCompleted: boolean; 
  showIncomplete: boolean; 
  onToggleCompleted: () => void; 
  onToggleIncomplete: () => void;
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
          historyStyles.chipText,
          showCompleted ? historyStyles.chipTextActive : historyStyles.chipTextInactive
        ]}>
          Completed
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
          historyStyles.chipText,
          showIncomplete ? historyStyles.chipTextActive : historyStyles.chipTextInactive
        ]}>
          Incomplete
        </RNText>
      </Pressable>
    </RNView>
  );
}

function TaskHistory({ taskId, showCompleted, showIncomplete }: { 
  taskId: Id<"tasks">; 
  showCompleted: boolean; 
  showIncomplete: boolean;
}) {
  const history = useQuery(api.tasks.getTaskHistory, { taskId });

  if (!history) {
    return <RNText style={historyStyles.loading}>Loading history...</RNText>;
  }

  if (history.length === 0) {
    return <RNText style={historyStyles.empty}>No status changes recorded yet.</RNText>;
  }

  // Filter history based on selected chips
  const filteredHistory = history.filter(entry => {
    if (!showCompleted && !showIncomplete) return true; // Show all
    if (showCompleted && entry.changedTo) return true;
    if (showIncomplete && !entry.changedTo) return true;
    return false;
  });

  if (filteredHistory.length === 0) {
    return <RNText style={historyStyles.empty}>No matching entries.</RNText>;
  }

  return (
    <RNView style={historyStyles.container}>
      {filteredHistory.map((entry) => (
        <RNView key={entry._id} style={historyStyles.entry}>
          <RNText style={entry.changedTo ? historyStyles.completed : historyStyles.incomplete}>
            {entry.changedTo ? "✓ Completed" : "○ Incomplete"}
          </RNText>
          <RNText style={historyStyles.date}>
            {formatDateTime(entry.changedAt)}
          </RNText>
        </RNView>
      ))}
    </RNView>
  );
}

const historyStyles = StyleSheet.create({
  container: {
    gap: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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
  date: {
    color: '#666',
    fontSize: 12,
  },
});

interface TaskListProps {
  filter: FilterType;
  sort: SortType;
  onSortChange: (sort: SortType) => void;
}

export default function TaskList({ filter, sort, onSortChange }: TaskListProps) {
  const allTasks = useQuery(api.tasks.listAllWithHistoryCount) ?? [];
  const toggleCompleted = useMutation(api.tasks.toggleCompleted);
  
  // Optimistic state: track which tasks are being toggled
  const [optimisticToggles, setOptimisticToggles] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"tasks"> | null>(null);
  const [historyShowCompleted, setHistoryShowCompleted] = useState(false);
  const [historyShowIncomplete, setHistoryShowIncomplete] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showSortPicker, setShowSortPicker] = useState(false);
  
  // Look up the selected task from fresh query data
  const selectedTask = selectedTaskId ? allTasks.find(t => t._id === selectedTaskId) ?? null : null;

  const handleToggle = useCallback(async (taskId: Id<"tasks">) => {
    // Add to optimistic toggles immediately
    setOptimisticToggles(prev => new Set(prev).add(taskId));
    
    try {
      await toggleCompleted({ id: taskId });
    } finally {
      // Remove from optimistic toggles after mutation completes
      setOptimisticToggles(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [toggleCompleted]);

  // Sort and filter tasks
  const sortedAndFilteredTasks = useMemo(() => {
    // First filter
    let filtered = allTasks.filter(task => {
      const isOptimisticallyToggled = optimisticToggles.has(task._id);
      const displayCompleted = isOptimisticallyToggled ? !task.isCompleted : task.isCompleted;
      
      if (filter === 'all') return true;
      if (filter === 'completed') return displayCompleted;
      if (filter === 'incomplete') return !displayCompleted;
      return true;
    });
    
    // Then sort
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
  }, [allTasks, filter, sort, optimisticToggles]);

  // Paginate for infinite scroll
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
    }
  };

  const currentSortLabel = sortOptions.find(o => o.value === sort)?.label ?? 'Sort';

  const isLoading = allTasks.length === 0 && !allTasks;
  const isLoadingMore = false;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  const handleDrawerToggle = async () => {
    if (selectedTask) {
      await toggleCompleted({ id: selectedTask._id });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{getTitle()}</Text>
      
      {/* Sort Picker */}
      <Pressable 
        style={styles.sortButton}
        onPress={() => setShowSortPicker(true)}
      >
        <RNText style={styles.sortButtonLabel}>Sort: </RNText>
        <RNText style={styles.sortButtonValue}>{currentSortLabel}</RNText>
        <RNText style={styles.sortButtonChevron}>▼</RNText>
      </Pressable>
      
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => {
          // Calculate display state with optimistic update
          const isOptimisticallyToggled = optimisticToggles.has(item._id);
          const displayCompleted = isOptimisticallyToggled ? !item.isCompleted : item.isCompleted;
          
          return (
            <Pressable
              style={({ pressed }) => [
                styles.taskCard,
                displayCompleted ? styles.taskCompleted : styles.taskIncomplete,
                pressed && styles.taskPressed,
              ]}
              onPress={() => handleToggle(item._id)}
              onLongPress={() => setSelectedTaskId(item._id)}
              delayLongPress={400}
            >
              <Text style={styles.taskText}>{item.text}</Text>
              {item.description && (
                <Text style={styles.taskDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <Text style={styles.taskHint}>Hold for details</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tasks found</Text>
        }
        ListFooterComponent={
          hasMore ? (
            <Pressable style={styles.loadMoreButton} onPress={handleLoadMore}>
              <RNText style={styles.loadMoreText}>
                Load More ({sortedAndFilteredTasks.length - visibleCount} remaining)
              </RNText>
            </Pressable>
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

      {/* Bottom Sheet Modal */}
      <Modal
        visible={!!selectedTask}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTaskId(null)}
      >
        <RNView style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedTaskId(null)} />
          <RNView style={styles.bottomSheet}>
            {selectedTask && (
              <>
                <RNView style={styles.sheetHandle} />
                
                <RNText style={styles.sheetTitle}>{selectedTask.text}</RNText>
                <RNText style={styles.sheetStatus}>
                  {selectedTask.isCompleted ? "✓ Completed" : "○ Incomplete"}
                </RNText>
                
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
                  <RNText style={styles.sheetLabel}>Status History</RNText>
                  <HistoryFilterChips
                    showCompleted={historyShowCompleted}
                    showIncomplete={historyShowIncomplete}
                    onToggleCompleted={() => setHistoryShowCompleted(!historyShowCompleted)}
                    onToggleIncomplete={() => setHistoryShowIncomplete(!historyShowIncomplete)}
                  />
                  <ScrollView 
                    style={styles.historyScrollView}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}
                  >
                    <TaskHistory 
                      taskId={selectedTask._id}
                      showCompleted={historyShowCompleted}
                      showIncomplete={historyShowIncomplete}
                    />
                  </ScrollView>
                </RNView>
                
                <Pressable
                  style={[
                    styles.sheetButton,
                    selectedTask.isCompleted ? styles.sheetButtonIncomplete : styles.sheetButtonComplete
                  ]}
                  onPress={handleDrawerToggle}
                >
                  <RNText style={styles.sheetButtonText}>
                    {selectedTask.isCompleted ? "Mark as Incomplete" : "Mark as Complete"}
                  </RNText>
                </Pressable>
              </>
            )}
          </RNView>
        </RNView>
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
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
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
  separator: {
    marginVertical: 16,
    height: 1,
    width: '80%',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  taskCard: {
    width: 320,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  taskCompleted: {
    backgroundColor: '#16a34a',
  },
  taskIncomplete: {
    backgroundColor: '#404040',
  },
  taskPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  taskText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
    lineHeight: 18,
  },
  taskHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
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
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#888',
  },
  // Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    height: Dimensions.get('window').height * 0.85,
  },
  sheetHistorySection: {
    marginTop: 16,
    flex: 1,
  },
  historyScrollView: {
    flex: 1,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#555',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  sheetStatus: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  sheetSection: {
    marginBottom: 16,
    marginTop: 16,
  },
  sheetLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
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
    marginVertical: 16,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sheetRowLabel: {
    fontSize: 14,
    color: '#888',
  },
  sheetRowValue: {
    fontSize: 14,
    color: '#fff',
  },
  sheetButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetButtonComplete: {
    backgroundColor: '#16a34a',
  },
  sheetButtonIncomplete: {
    backgroundColor: '#404040',
  },
  sheetButtonText: {
    color: '#fff',
    fontSize: 16,
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
  // Load More Styles
  loadMoreButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 16,
    alignSelf: 'center',
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  allLoadedText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 16,
  },
});
