import "./App.css";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { ToastContainer, Toast } from "@/components/ui/toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ToastType = 'completed' | 'incomplete' | 'important' | 'not-important';
import { useState, useMemo, useEffect, useRef, useCallback } from "react";

const PAGE_SIZE = 50;

// Task type based on schema
type Task = {
  _id: string;
  _creationTime: number;
  text: string;
  description?: string;
  isCompleted: boolean;
  isImportant?: boolean;
  createdAt?: number;
  updatedAt?: number;
  duration?: number;
  historyCount: number;
  userId?: string;
};

// Removed FilterType - now using showCompleted and showIncomplete booleans
type DurationFilterType = 'all' | 'quick' | 'long';
type ImportanceFilterType = 'all' | 'important' | 'not-important';
type SortType = 'latest' | 'inactive' | 'newest' | 'oldest' | 'frequent' | 'unfrequent' | 'quickest' | 'longest';
type ViewMode = 'compact' | 'extended' | 'list';
type TabType = 'tasks' | 'stats';
type StatsSortColumn = 'user' | 'completed' | 'incomplete' | 'important' | 'changes' | 'lastActive' | 'inactive' | 'short' | 'long';
type SortDirection = 'asc' | 'desc';

function formatDuration(minutes: number | undefined): string {
  if (!minutes) return "Unknown";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function periodToDays(period: string): number {
  switch (period) {
    case '5 days': return 5;
    case '10 days': return 10;
    case '15 days': return 15;
    case '1 month': return 30;
    case '2 months': return 60;
    case '3 months': return 90;
    case '6 months': return 180;
    case '1 year': return 365;
    default: return 5;
  }
}

function calculateIntervalCount(days: number): number {
  // Return a number between 5 and 12 that makes sense for the period
  if (days <= 5) return 5;
  if (days <= 10) return 6;
  if (days <= 15) return 7;
  if (days <= 30) return 8;
  if (days <= 60) return 9;
  if (days <= 90) return 10;
  if (days <= 180) return 11;
  return 12; // 365 days
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
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onToggleCompleted}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          showCompleted 
            ? "bg-green-600 text-white" 
            : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
        }`}
      >
        ✓ Completed
      </button>
      <button
        onClick={onToggleIncomplete}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          showIncomplete 
            ? "bg-neutral-500 text-white" 
            : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
        }`}
      >
        ○ Incomplete
      </button>
      <button
        onClick={onToggleImportant}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          showImportant 
            ? "bg-amber-500 text-white" 
            : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
        }`}
      >
        ★ Important
      </button>
      <button
        onClick={onToggleNotImportant}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          showNotImportant 
            ? "bg-neutral-500 text-white" 
            : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
        }`}
      >
        ☆ Not Important
      </button>
    </div>
  );
}

function TaskHistory({ taskId, showCompleted, showIncomplete, showImportant, showNotImportant }: { 
  taskId: string; 
  showCompleted: boolean; 
  showIncomplete: boolean;
  showImportant: boolean;
  showNotImportant: boolean;
}) {
  const history = useQuery(api.tasks.getTaskHistory, { taskId: taskId as any });

  if (!history) {
    return <div className="text-neutral-500 text-sm">Loading history...</div>;
  }

  if (history.length === 0) {
    return <div className="text-neutral-500 text-sm">No status changes recorded yet.</div>;
  }

  // Filter history based on selected chips
  const filteredHistory = history.filter(entry => {
    const hasAnyFilter = showCompleted || showIncomplete || showImportant || showNotImportant;
    if (!hasAnyFilter) return true; // Show all
    
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

  // Sort by changedAt descending (latest first)
  const sortedHistory = [...filteredHistory].sort((a, b) => b.changedAt - a.changedAt);

  if (sortedHistory.length === 0) {
    return <div className="text-neutral-500 text-sm">No matching entries.</div>;
  }

  return (
    <div className="space-y-2">
      {sortedHistory.map((entry) => {
        const isCompletionChange = !entry.changeType || entry.changeType === "completion";
        const isImportanceChange = entry.changeType === "importance";
        
        return (
          <div
            key={entry._id}
            className="flex justify-between items-center py-2 px-3 bg-neutral-800 rounded-lg"
          >
            <span className={
              isImportanceChange 
                ? (entry.changedTo ? "text-amber-400" : "text-neutral-400")
                : (entry.changedTo ? "text-green-400" : "text-neutral-400")
            }>
              {isImportanceChange 
                ? (entry.changedTo ? "★ Important" : "☆ Not Important")
                : (entry.changedTo ? "✓ Completed" : "○ Incomplete")
              }
            </span>
            <span className="text-neutral-500 text-sm">
              {formatDateTime(entry.changedAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Read initial values from URL
function getInitialParams() {
  const params = new URLSearchParams(window.location.search);
  const showCompleted = params.get('completed');
  const showIncomplete = params.get('incomplete');
  const durationFilter = params.get('duration') as DurationFilterType | null;
  const importanceFilter = params.get('importance') as ImportanceFilterType | null;
  const sort = params.get('sort') as SortType | null;
  const view = params.get('view') as ViewMode | null;
  const tab = params.get('tab') as TabType | null;
  const usersParam = params.get('users');
  const selectedUsers = usersParam ? usersParam.split(',').filter(Boolean) : [];
  
  return {
    showCompleted: showCompleted === null ? true : showCompleted === 'true',
    showIncomplete: showIncomplete === null ? true : showIncomplete === 'true',
    durationFilter: durationFilter && ['all', 'quick', 'long'].includes(durationFilter) ? durationFilter : 'all',
    importanceFilter: importanceFilter && ['all', 'important', 'not-important'].includes(importanceFilter) ? importanceFilter : 'all',
    sort: sort && ['latest', 'inactive', 'newest', 'oldest', 'frequent', 'unfrequent', 'quickest', 'longest'].includes(sort) ? sort : 'latest',
    viewMode: view && ['compact', 'extended', 'list'].includes(view) ? view : 'compact',
    tab: tab && ['tasks', 'stats'].includes(tab) ? tab : 'tasks',
    selectedUsers: new Set(selectedUsers),
  };
}

function App() {
  const initialParams = getInitialParams();
  const [showCompleted, setShowCompleted] = useState(initialParams.showCompleted);
  const [showIncomplete, setShowIncomplete] = useState(initialParams.showIncomplete);
  const [durationFilter, setDurationFilter] = useState<DurationFilterType>(initialParams.durationFilter);
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilterType>(initialParams.importanceFilter);
  const [sort, setSort] = useState<SortType>(initialParams.sort);
  const [viewMode, setViewMode] = useState<ViewMode>(initialParams.viewMode);
  const [activeTab, setActiveTab] = useState<TabType>(initialParams.tab);
  const [statsSortColumn, setStatsSortColumn] = useState<StatsSortColumn>('lastActive');
  const [statsSortDirection, setStatsSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [historyShowCompleted, setHistoryShowCompleted] = useState(false);
  const [historyShowIncomplete, setHistoryShowIncomplete] = useState(false);
  const [historyShowImportant, setHistoryShowImportant] = useState(false);
  const [historyShowNotImportant, setHistoryShowNotImportant] = useState(false);
  const [latestChangesShowCompleted, setLatestChangesShowCompleted] = useState(false);
  const [latestChangesShowIncomplete, setLatestChangesShowIncomplete] = useState(false);
  const [latestChangesShowImportant, setLatestChangesShowImportant] = useState(false);
  const [latestChangesShowNotImportant, setLatestChangesShowNotImportant] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(initialParams.selectedUsers);
  const [latestChangesCursor, setLatestChangesCursor] = useState<number | null>(null);
  const [accumulatedChanges, setAccumulatedChanges] = useState<any[]>([]);
  const [activityMode, setActivityMode] = useState<'delta' | 'total'>('delta');
  const [activityPeriod, setActivityPeriod] = useState<'5 days' | '10 days' | '15 days' | '1 month' | '2 months' | '3 months' | '6 months' | '1 year'>('5 days');
  
  // Fetch all users
  const users = useQuery(api.tasks.getAllUsers);
  
  // Fetch latest changes (paginated)
  const latestChangesPage = useQuery(api.tasks.getLatestChanges, {
    limit: 15,
    cursor: latestChangesCursor ?? undefined,
    userIds: selectedUsers.size > 0 ? Array.from(selectedUsers) as any : undefined,
    showCompleted: latestChangesShowCompleted || undefined,
    showIncomplete: latestChangesShowIncomplete || undefined,
    showImportant: latestChangesShowImportant || undefined,
    showNotImportant: latestChangesShowNotImportant || undefined,
  });
  
  // Fetch changes over time for chart
  const changesOverTime = useQuery(api.tasks.getChangesOverTime, {
    userIds: selectedUsers.size > 0 ? Array.from(selectedUsers) as any : undefined,
    days: periodToDays(activityPeriod),
  });
  
  // Reset accumulated changes when selectedUsers or filters change
  useEffect(() => {
    setAccumulatedChanges([]);
    setLatestChangesCursor(null);
    setIsLoadingMore(false);
    lastProcessedPageRef.current = null;
  }, [selectedUsers, latestChangesShowCompleted, latestChangesShowIncomplete, latestChangesShowImportant, latestChangesShowNotImportant]);
  
  // Track the last processed page to avoid duplicate processing
  const lastProcessedPageRef = useRef<string | null>(null);
  
  // Accumulate changes when new page loads
  useEffect(() => {
    if (latestChangesPage) {
      // Create a unique key for this page based on cursor and changes
      const pageKey = `${latestChangesCursor ?? 'initial'}-${latestChangesPage.changes.length}`;
      
      // Only process if this is a new page
      if (pageKey !== lastProcessedPageRef.current) {
        setAccumulatedChanges(prev => {
          // If cursor is null, this is the first page, replace all
          if (latestChangesCursor === null) {
            lastProcessedPageRef.current = pageKey;
            return latestChangesPage.changes || [];
          }
          // Otherwise, append new changes (preserve existing during loading)
          const existingIds = new Set(prev.map(c => c._id));
          const newChanges = (latestChangesPage.changes || []).filter(c => !existingIds.has(c._id));
          lastProcessedPageRef.current = pageKey;
          return [...prev, ...newChanges];
        });
      }
    }
    // Don't clear accumulated changes when latestChangesPage is undefined (during loading)
  }, [latestChangesPage, latestChangesCursor]);
  
  // Reset last processed page when selectedUsers changes
  useEffect(() => {
    lastProcessedPageRef.current = null;
  }, [selectedUsers]);
  
  // Changes are already filtered on the server, so use accumulatedChanges directly
  const latestChanges = accumulatedChanges;
  const hasMoreChanges = latestChangesPage?.hasMore ?? false;
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Track when new page data arrives to clear loading state
  useEffect(() => {
    if (latestChangesPage && isLoadingMore) {
      // Check if this is a new page (not the initial load)
      if (latestChangesCursor !== null) {
        setIsLoadingMore(false);
      }
    }
  }, [latestChangesPage, latestChangesCursor, isLoadingMore]);
  
  // Load more latest changes button handler
  const loadMoreLatestChanges = useCallback(() => {
    if (latestChangesPage?.hasMore && latestChangesPage?.nextCursor !== null && latestChangesPage?.nextCursor !== undefined) {
      setIsLoadingMore(true);
      setLatestChangesCursor(latestChangesPage.nextCursor);
    }
  }, [latestChangesPage]);
  
  // Debounce search query (400ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setVisibleCount(PAGE_SIZE);
    }, 400);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Toggle handlers that ensure at least one is always selected
  const toggleShowCompleted = () => {
    if (showCompleted && !showIncomplete) return; // Can't deselect if it's the only one
    setShowCompleted(!showCompleted);
    setVisibleCount(PAGE_SIZE);
  };
  
  const toggleShowIncomplete = () => {
    if (showIncomplete && !showCompleted) return; // Can't deselect if it's the only one
    setShowIncomplete(!showIncomplete);
    setVisibleCount(PAGE_SIZE);
  };
  
  // Update URL when filters/sort/view/tab change
  useEffect(() => {
    const params = new URLSearchParams();
    if (!showCompleted) params.set('completed', 'false');
    if (!showIncomplete) params.set('incomplete', 'false');
    if (durationFilter !== 'all') params.set('duration', durationFilter);
    if (importanceFilter !== 'all') params.set('importance', importanceFilter);
    if (sort !== 'latest') params.set('sort', sort);
    if (viewMode !== 'compact') params.set('view', viewMode);
    if (activeTab !== 'tasks') params.set('tab', activeTab);
    if (selectedUsers.size > 0) params.set('users', Array.from(selectedUsers).join(','));
    
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    
    window.history.replaceState({}, '', newUrl);
  }, [showCompleted, showIncomplete, durationFilter, importanceFilter, sort, viewMode, activeTab, selectedUsers]);
  
  const allTasksQuery = useQuery(api.tasks.listAllWithHistoryCount, { 
    searchQuery: debouncedSearchQuery.trim() || undefined,
    userIds: selectedUsers.size > 0 ? Array.from(selectedUsers) as any[] : undefined
  });
  const isLoading = allTasksQuery === undefined;
  const allTasks = allTasksQuery ?? [];
  
  const toggleCompleted = useMutation(api.tasks.toggleCompleted);
  const toggleImportant = useMutation(api.tasks.toggleImportant);
  const [togglingTasks, setTogglingTasks] = useState<Set<string>>(new Set());
  const [togglingImportance, setTogglingImportance] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);
  
  // Look up the selected task from fresh query data
  const selectedTask = selectedTaskId ? allTasks?.find(t => t._id === selectedTaskId) ?? null : null;
  
  // Sort and filter tasks
  const sortedAndFilteredTasks = useMemo(() => {
    // First filter by status
    let filtered = allTasks.filter(task => {
      if (showCompleted && showIncomplete) return true;
      if (showCompleted && task.isCompleted) return true;
      if (showIncomplete && !task.isCompleted) return true;
      return false;
    });
    
    // Then filter by duration
    filtered = filtered.filter(task => {
      if (durationFilter === 'all') return true;
      const duration = task.duration ?? 0;
      if (durationFilter === 'quick') return duration <= 15;
      if (durationFilter === 'long') return duration > 15;
      return true;
    });
    
    // Then filter by importance
    filtered = filtered.filter(task => {
      if (importanceFilter === 'all') return true;
      if (importanceFilter === 'important') return task.isImportant === true;
      if (importanceFilter === 'not-important') return !task.isImportant;
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
  }, [allTasks, showCompleted, showIncomplete, durationFilter, importanceFilter, sort]);
  
  // Calculate user statistics
  const userStats = useMemo(() => {
    if (!users || !allTasks) return [];
    
    const stats = users.map(user => {
      const userTasks = allTasks.filter(task => task.userId === user._id);
      
      const completed = userTasks.filter(task => task.isCompleted).length;
      const incomplete = userTasks.filter(task => !task.isCompleted).length;
      const important = userTasks.filter(task => task.isImportant).length;
      const changes = userTasks.reduce((sum, task) => sum + task.historyCount, 0);
      
      // Find the most recent updatedAt among user's tasks
      const lastActive = userTasks.length > 0
        ? Math.max(...userTasks.map(task => task.updatedAt ?? 0))
        : undefined;
      
      // Count inactive tasks (never updated - updatedAt is undefined or equals createdAt)
      const inactive = userTasks.filter(task => 
        !task.updatedAt || (task.createdAt && task.updatedAt === task.createdAt)
      ).length;
      
      // Count short tasks (duration <= 15 minutes)
      const short = userTasks.filter(task => (task.duration ?? 0) <= 15).length;
      
      // Count long tasks (duration > 15 minutes)
      const long = userTasks.filter(task => (task.duration ?? 0) > 15).length;
      
      return {
        user,
        completed,
        incomplete,
        important,
        changes,
        lastActive,
        inactive,
        short,
        long,
      };
    });
    
    // Sort stats based on selected column and direction
    const sorted = [...stats].sort((a, b) => {
      let aValue: number | string | undefined;
      let bValue: number | string | undefined;
      
      switch (statsSortColumn) {
        case 'user':
          aValue = a.user.name.toLowerCase();
          bValue = b.user.name.toLowerCase();
          break;
        case 'completed':
          aValue = a.completed;
          bValue = b.completed;
          break;
        case 'incomplete':
          aValue = a.incomplete;
          bValue = b.incomplete;
          break;
        case 'important':
          aValue = a.important;
          bValue = b.important;
          break;
        case 'changes':
          aValue = a.changes;
          bValue = b.changes;
          break;
        case 'lastActive':
          aValue = a.lastActive ?? 0;
          bValue = b.lastActive ?? 0;
          break;
        case 'inactive':
          aValue = a.inactive;
          bValue = b.inactive;
          break;
        case 'short':
          aValue = a.short;
          bValue = b.short;
          break;
        case 'long':
          aValue = a.long;
          bValue = b.long;
          break;
      }
      
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;
      
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = (aValue as number) - (bValue as number);
      }
      
      return statsSortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [users, allTasks, statsSortColumn, statsSortDirection]);
  
  // Filter user stats based on selected users
  const filteredUserStats = useMemo(() => {
    if (selectedUsers.size === 0) {
      return userStats; // Show all users if none selected
    }
    return userStats.filter(stat => selectedUsers.has(stat.user._id));
  }, [userStats, selectedUsers]);
  
  // Handle stats column sorting
  const handleStatsSort = (column: StatsSortColumn) => {
    if (statsSortColumn === column) {
      // Toggle direction if same column
      setStatsSortDirection(statsSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with ascending direction
      setStatsSortColumn(column);
      setStatsSortDirection('asc');
    }
  };
  
  // Paginate for infinite scroll
  const visibleTasks = sortedAndFilteredTasks.slice(0, visibleCount);
  const hasMore = visibleCount < sortedAndFilteredTasks.length;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleLoadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleLoadMore, hasMore]);

  const handleToggle = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const wasCompleted = task.isCompleted;
    setTogglingTasks(prev => new Set(prev).add(task._id));
    try {
      await toggleCompleted({ id: task._id as any });
      addToast(`Task marked as ${wasCompleted ? 'incomplete' : 'complete'}`, wasCompleted ? 'incomplete' : 'completed');
    } finally {
      setTogglingTasks(prev => {
        const next = new Set(prev);
        next.delete(task._id);
        return next;
      });
    }
  };

  const handleToggleImportant = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const wasImportant = task.isImportant;
    setTogglingImportance(prev => new Set(prev).add(task._id));
    try {
      await toggleImportant({ id: task._id as any });
      addToast(`Task marked as ${wasImportant ? 'not important' : 'important'}`, wasImportant ? 'not-important' : 'important');
    } finally {
      setTogglingImportance(prev => {
        const next = new Set(prev);
        next.delete(task._id);
        return next;
      });
    }
  };

  const sortOptions: { value: SortType; label: string }[] = [
    { value: 'latest', label: 'Latest Updated' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'frequent', label: 'Frequent' },
    { value: 'unfrequent', label: 'Unfrequent' },
    { value: 'quickest', label: 'Quickest' },
    { value: 'longest', label: 'Longest' },
  ];

  return (
    <div className="min-h-screen w-full bg-neutral-900">
      <div className="w-[90%] max-w-[2000px] mx-auto">
        {/* Fixed Header with Filters */}
        <div className="sticky top-0 z-10 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-800 px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-white">Konoha Task Manager</h1>
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-4 py-2 rounded-md transition-colors font-medium ${
                  activeTab === 'tasks'
                    ? 'bg-neutral-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Tasks
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 rounded-md transition-colors font-medium ${
                  activeTab === 'stats'
                    ? 'bg-neutral-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Stats
              </button>
            </div>
            {/* User images */}
            {users && users.length > 0 && (
              <div className="flex items-center gap-2">
                {users.map((user) => {
                  const isSelected = selectedUsers.has(user._id);
                  return (
                    <button
                      key={user._id}
                      onClick={() => {
                        const newSelected = new Set(selectedUsers);
                        if (isSelected) {
                          newSelected.delete(user._id);
                        } else {
                          newSelected.add(user._id);
                        }
                        setSelectedUsers(newSelected);
                        setVisibleCount(PAGE_SIZE);
                      }}
                      className={`w-8 h-8 rounded-full overflow-hidden flex-shrink-0 transition-all relative ${
                        isSelected 
                          ? '' 
                          : 'border border-neutral-700/50 hover:border-neutral-600'
                      } ${!user.image ? (isSelected ? 'bg-blue-500/20' : 'bg-neutral-700/50') : 'bg-transparent'}`}
                      title={user.name}
                    >
                      {user.image ? (
                        <img
                          src={`data:image/jpeg;base64,${user.image}`}
                          alt={user.name}
                          className={`w-full h-full object-cover absolute inset-0 ${isSelected ? 'opacity-100' : 'opacity-50'}`}
                          style={{ display: 'block' }}
                        />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center text-xs ${
                          isSelected ? 'text-blue-300 opacity-100' : 'text-neutral-400 opacity-50'
                        }`}>
                          {user.name.charAt(0)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {activeTab === 'tasks' && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter buttons */}
            <div className="flex gap-2">
              <button
                onClick={toggleShowCompleted}
                className={`px-5 py-2 rounded-full font-medium transition-all ${
                  showCompleted
                    ? "bg-green-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                } ${showCompleted && !showIncomplete ? 'cursor-not-allowed' : ''}`}
              >
                ✓ Completed
              </button>
              <button
                onClick={toggleShowIncomplete}
                className={`px-5 py-2 rounded-full font-medium transition-all ${
                  showIncomplete
                    ? "bg-neutral-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                } ${showIncomplete && !showCompleted ? 'cursor-not-allowed' : ''}`}
              >
                ○ Incomplete
              </button>
            </div>
            
            {/* Duration filter buttons */}
            <div className="flex gap-2 border-l border-neutral-700 pl-3">
              <button
                onClick={() => {
                  setDurationFilter(durationFilter === 'quick' ? 'all' : 'quick');
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  durationFilter === 'quick'
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                ⚡ Quick
              </button>
              <button
                onClick={() => {
                  setDurationFilter(durationFilter === 'long' ? 'all' : 'long');
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  durationFilter === 'long'
                    ? "bg-orange-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                🕐 Long
              </button>
            </div>
            
            {/* Importance filter */}
            <div className="flex gap-2 border-l border-neutral-700 pl-3">
              <button
                onClick={() => {
                  setImportanceFilter(importanceFilter === 'important' ? 'all' : 'important');
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  importanceFilter === 'important'
                    ? "bg-amber-500 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                ★ Important
              </button>
            </div>
            
            {/* Search input */}
            <div className="flex-1 border-l border-neutral-700 pl-3 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Search tasks..."
                className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-600 placeholder:text-neutral-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors p-1"
                  aria-label="Clear search"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 4L4 12M4 4l8 8" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Sort dropdown and View toggle */}
            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 text-sm">Sort:</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as SortType);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="bg-neutral-800 text-white border border-neutral-700 rounded-lg pl-4 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-600 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* View mode toggle */}
              <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'compact'
                      ? 'bg-neutral-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Compact view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="5" height="5" rx="1" />
                    <rect x="9.5" y="2" width="5" height="5" rx="1" />
                    <rect x="17" y="2" width="5" height="5" rx="1" />
                    <rect x="2" y="9.5" width="5" height="5" rx="1" />
                    <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
                    <rect x="17" y="9.5" width="5" height="5" rx="1" />
                    <rect x="2" y="17" width="5" height="5" rx="1" />
                    <rect x="9.5" y="17" width="5" height="5" rx="1" />
                    <rect x="17" y="17" width="5" height="5" rx="1" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('extended')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'extended'
                      ? 'bg-neutral-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Extended view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-neutral-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="List view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="8" rx="1" />
                    <rect x="3" y="13" width="18" height="8" rx="1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Content based on active tab */}
        <div className="px-6 py-8">
        {activeTab === 'tasks' ? (
        <>
        {isLoading ? (
          viewMode === 'list' ? (
            // List view skeleton
            <div className="flex flex-col gap-3">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-xl px-5 py-4 bg-neutral-800 animate-pulse"
                >
                  <div className="w-3 h-3 rounded-full bg-neutral-700 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="h-5 bg-neutral-700 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-neutral-700 rounded w-1/2"></div>
                  </div>
                  <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                    <div className="text-center">
                      <div className="h-3 bg-neutral-700 rounded w-12 mb-1"></div>
                      <div className="h-4 bg-neutral-700 rounded w-10"></div>
                    </div>
                    <div className="text-center">
                      <div className="h-3 bg-neutral-700 rounded w-12 mb-1"></div>
                      <div className="h-4 bg-neutral-700 rounded w-14"></div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <div className="h-8 bg-neutral-700 rounded w-[90px]"></div>
                    <div className="h-8 bg-neutral-700 rounded w-[90px]"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'extended' ? (
            // Extended view skeleton
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gridAutoRows: '1fr' }}>
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-2xl p-5 bg-neutral-800 animate-pulse min-h-[305px]"
                >
                  <div className="h-6 bg-neutral-700 rounded-lg w-3/4 mb-3"></div>
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="h-4 bg-neutral-700 rounded w-full"></div>
                    <div className="h-4 bg-neutral-700 rounded w-full"></div>
                    <div className="h-4 bg-neutral-700 rounded w-full"></div>
                    <div className="h-4 bg-neutral-700 rounded w-2/3"></div>
                  </div>
                  <div className="space-y-3 mb-4 py-3">
                    {/* Primary card - full width */}
                    <div className="bg-neutral-700/30 rounded-lg p-3 border border-neutral-700/50 text-center">
                      <div className="h-3 bg-neutral-700 rounded w-12 mb-1 mx-auto"></div>
                      <div className="h-4 bg-neutral-700 rounded w-16 mx-auto"></div>
                    </div>
                    {/* Secondary cards - 3 in a row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-neutral-700/30 rounded-lg p-3 border border-neutral-700/50 text-center">
                        <div className="h-3 bg-neutral-700 rounded w-12 mb-1 mx-auto"></div>
                        <div className="h-4 bg-neutral-700 rounded w-14 mx-auto"></div>
                      </div>
                      <div className="bg-neutral-700/30 rounded-lg p-3 border border-neutral-700/50 text-center">
                        <div className="h-3 bg-neutral-700 rounded w-12 mb-1 mx-auto"></div>
                        <div className="h-4 bg-neutral-700 rounded w-10 mx-auto"></div>
                      </div>
                      <div className="bg-neutral-700/30 rounded-lg p-3 border border-neutral-700/50 text-center">
                        <div className="h-3 bg-neutral-700 rounded w-12 mb-1 mx-auto"></div>
                        <div className="h-4 bg-neutral-700 rounded w-10 mx-auto"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Compact view skeleton
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gridAutoRows: '1fr' }}>
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-2xl p-5 bg-neutral-800 animate-pulse min-h-[220px]"
                >
                  <div className="h-6 bg-neutral-700 rounded-lg w-3/4 mb-3"></div>
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="h-4 bg-neutral-700 rounded w-full"></div>
                    <div className="h-4 bg-neutral-700 rounded w-full"></div>
                    <div className="h-4 bg-neutral-700 rounded w-full"></div>
                    <div className="h-4 bg-neutral-700 rounded w-2/3"></div>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/10">
                    <div className="h-4 bg-neutral-700 rounded w-16"></div>
                    <div className="flex gap-2">
                      <div className="h-7 bg-neutral-700 rounded w-16"></div>
                      <div className="h-7 bg-neutral-700 rounded w-20"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : visibleTasks.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-neutral-500 text-lg">No tasks found</div>
          </div>
        ) : (
          <>
            <div className={viewMode === 'list' ? 'flex flex-col gap-3' : 'grid gap-5'} style={viewMode !== 'list' ? { 
              gridTemplateColumns: viewMode === 'compact' ? 'repeat(auto-fill, minmax(300px, 1fr))' : 'repeat(auto-fill, minmax(400px, 1fr))',
              gridAutoRows: '1fr'
            } : undefined}>
              {visibleTasks.map((task) => {
                const isToggling = togglingTasks.has(task._id) || togglingImportance.has(task._id);
                const taskUser = users?.find(u => u._id === task.userId);
                
                // List View
                if (viewMode === 'list') {
                  return (
                    <div
                      key={task._id}
                      onClick={() => setSelectedTaskId(task._id)}
                      className={`flex flex-col rounded-xl overflow-hidden transition-all duration-200 bg-neutral-800 cursor-pointer ${
                        task.isImportant ? 'ring-[1.5px] ring-amber-500 ring-inset' : task.isCompleted ? 'ring-[1.5px] ring-green-500 ring-inset' : ''
                      } ${isToggling ? 'opacity-70 animate-pulse' : ''} hover:scale-[1.02] hover:z-10 relative`}
                    >
                      {/* Content */}
                      <div className="flex items-center gap-4 px-5 py-4">
                        {/* User */}
                        {taskUser && (
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-neutral-700/50 flex-shrink-0">
                            {taskUser.image ? (
                              <img
                                src={`data:image/jpeg;base64,${taskUser.image}`}
                                alt={taskUser.name}
                                className="w-full h-full object-cover"
                                title={taskUser.name}
                              />
                            ) : (
                              <div className="w-full h-full bg-neutral-700/50 flex items-center justify-center text-neutral-400 text-sm">
                                {taskUser.name.charAt(0)}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Title and description */}
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-base font-semibold truncate ${task.isCompleted ? 'text-neutral-400' : 'text-white'}`}>
                            {task.text}
                          </h3>
                          <p className="text-sm truncate text-neutral-500">
                            {task.description || "No description"}
                          </p>
                        </div>
                        
                        {/* Important toggle */}
                        <span
                          onClick={(e) => handleToggleImportant(e, task)}
                          className={`text-xl flex-shrink-0 transition-transform hover:scale-125 select-none ${
                            task.isImportant ? 'text-amber-400' : 'text-neutral-600'
                          } ${(togglingTasks.has(task._id) || togglingImportance.has(task._id)) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                          title={task.isImportant ? "Remove importance" : "Mark as important"}
                        >
                          {togglingImportance.has(task._id) ? (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            task.isImportant ? '★' : '☆'
                          )}
                        </span>
                        
                        {/* Status toggle */}
                        <span
                          onClick={(e) => handleToggle(e, task)}
                          className={`text-xl flex-shrink-0 transition-transform hover:scale-125 select-none ${
                            task.isCompleted ? 'text-green-500' : 'text-neutral-600'
                          } ${(togglingTasks.has(task._id) || togglingImportance.has(task._id)) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                          title={task.isCompleted ? "Mark as incomplete" : "Mark as complete"}
                        >
                          {togglingTasks.has(task._id) ? (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            task.isCompleted ? '✓' : '○'
                          )}
                        </span>
                      
                        {/* Meta info */}
                        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                          <div className="text-center">
                            <div className="text-xs text-neutral-500">Duration</div>
                            <div className="text-sm font-medium text-white">{formatDuration(task.duration)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-neutral-500">Updated</div>
                            <div className="text-sm font-medium text-white">{formatRelativeTime(task.updatedAt)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-neutral-500">Changes</div>
                            <div className="text-sm font-medium text-white">{task.historyCount}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Card Views (Compact & Extended)
                return (
                <div
                  key={task._id}
                  onClick={() => setSelectedTaskId(task._id)}
                  className={`group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 bg-neutral-800 cursor-pointer ${
                    task.isImportant ? 'ring-[1.5px] ring-amber-500 ring-inset' : task.isCompleted ? 'ring-[1.5px] ring-green-500 ring-inset' : ''
                  } ${isToggling ? 'opacity-70 animate-pulse' : ''} hover:scale-[1.05] hover:z-10`}
                >
                  <div className={`${viewMode === 'extended' ? 'px-5 pt-5 pb-3' : 'p-5'} flex flex-col flex-1`}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* User */}
                      {taskUser && (
                        <div className={`${viewMode === 'extended' ? 'w-10 h-10' : 'w-6 h-6'} rounded-full overflow-hidden border border-neutral-700/50 flex-shrink-0`}>
                          {taskUser.image ? (
                            <img
                              src={`data:image/jpeg;base64,${taskUser.image}`}
                              alt={taskUser.name}
                              className="w-full h-full object-cover"
                              title={taskUser.name}
                            />
                          ) : (
                            <div className={`w-full h-full bg-neutral-700/50 flex items-center justify-center text-neutral-400 ${viewMode === 'extended' ? 'text-sm' : 'text-xs'}`}>
                              {taskUser.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      )}
                      <h3 
                        className={`${viewMode === 'extended' ? 'text-xl' : 'text-lg'} font-semibold leading-snug ${
                          viewMode === 'compact' ? 'line-clamp-1' : ''
                        } ${task.isCompleted ? 'text-neutral-400' : 'text-white'}`}
                        title={viewMode === 'compact' ? task.text : undefined}
                      >
                        {task.text}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        onClick={(e) => handleToggleImportant(e, task)}
                        className={`text-xl flex-shrink-0 transition-transform hover:scale-125 select-none ${
                          task.isImportant ? 'text-amber-400' : 'text-neutral-600'
                        } ${(togglingTasks.has(task._id) || togglingImportance.has(task._id)) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                        title={task.isImportant ? "Remove importance" : "Mark as important"}
                      >
                        {togglingImportance.has(task._id) ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          task.isImportant ? '★' : '☆'
                        )}
                      </span>
                      <span
                        onClick={(e) => handleToggle(e, task)}
                        className={`text-xl flex-shrink-0 transition-transform hover:scale-125 select-none ${
                          task.isCompleted ? 'text-green-500' : 'text-neutral-600'
                        } ${(togglingTasks.has(task._id) || togglingImportance.has(task._id)) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                        title={task.isCompleted ? "Mark as incomplete" : "Mark as complete"}
                      >
                        {togglingTasks.has(task._id) ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          task.isCompleted ? '✓' : '○'
                        )}
                      </span>
                    </div>
                  </div>
                  <p 
                    className={`text-sm leading-relaxed ${
                      viewMode === 'compact' ? 'line-clamp-2 mb-2' : 'mb-4 flex-1'
                    } ${
                      task.isCompleted ? "text-neutral-500" : "text-neutral-400"
                    }`}
                    title={viewMode === 'compact' && task.description ? task.description : undefined}
                  >
                    {task.description || "No description"}
                  </p>
                  
                  {viewMode === 'extended' && (() => {
                    // Determine primary info based on sort (same logic as compact view)
                    const primaryInfo = 
                      sort === 'newest' || sort === 'oldest' ? 'created' :
                      sort === 'quickest' || sort === 'longest' ? 'duration' :
                      sort === 'frequent' || sort === 'unfrequent' ? 'changes' :
                      'updated';
                    
                    // Create all info items
                    const allInfo = [
                      { key: 'created', label: 'Created', value: formatRelativeTime(task.createdAt) },
                      { key: 'updated', label: 'Updated', value: formatRelativeTime(task.updatedAt) },
                      { key: 'duration', label: 'Duration', value: formatDuration(task.duration) },
                      { key: 'changes', label: 'Changes', value: task.historyCount.toString() }
                    ];
                    
                    // Separate primary and secondary info
                    const primaryItem = allInfo.find(item => item.key === primaryInfo)!;
                    const secondaryItems = allInfo.filter(item => item.key !== primaryInfo);
                    
                    return (
                      <div className="space-y-3 py-2">
                        {/* Primary card - full width */}
                        <div className="bg-neutral-700/30 rounded-lg p-3 border border-neutral-700/50 text-center">
                          <div className="text-xs mb-1 text-neutral-500">{primaryItem.label}</div>
                          <div className="text-sm font-medium text-white">{primaryItem.value}</div>
                        </div>
                        {/* Secondary cards - 3 in a row */}
                        <div className="grid grid-cols-3 gap-3">
                          {secondaryItems.map((item) => (
                            <div key={item.key} className="bg-neutral-700/30 rounded-lg p-3 border border-neutral-700/50 text-center">
                              <div className="text-xs mb-1 text-neutral-500">{item.label}</div>
                              <div className="text-sm font-medium text-white">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {viewMode === 'compact' && (
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-neutral-700">
                      <span className="text-xs text-neutral-500">
                        {sort === 'newest' || sort === 'oldest' 
                          ? formatRelativeTime(task.createdAt)
                          : sort === 'quickest' || sort === 'longest'
                          ? formatDuration(task.duration)
                          : sort === 'frequent' || sort === 'unfrequent'
                          ? `${task.historyCount} change${task.historyCount !== 1 ? 's' : ''}`
                          : formatRelativeTime(task.updatedAt)}
                      </span>
                    </div>
                  )}
                  </div>
                </div>
              );
              })}
            </div>

            {/* Load More Trigger */}
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              {hasMore ? (
                <div className="text-neutral-500 text-sm">Loading more...</div>
              ) : visibleTasks.length > 0 ? (
                <div className="text-neutral-600 text-sm">All tasks loaded</div>
              ) : null}
            </div>
          </>
        )}
        </>
        ) : (
          /* Stats Tab */
          <div className="pt-4 pb-8">
            {isLoading ? (
              <>
                {selectedUsers.size === 1 ? (
                  /* Single User Card Skeleton */
                  <Card className="bg-neutral-800 border-neutral-700">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="w-16 h-16 rounded-full bg-neutral-700/50 animate-pulse flex-shrink-0"></div>
                          <div>
                            <div className="h-7 w-32 bg-neutral-700/50 rounded animate-pulse mb-2"></div>
                            <div className="h-4 w-40 bg-neutral-700/50 rounded animate-pulse"></div>
                          </div>
                        </div>
                        <div className="flex gap-4 flex-1 flex-wrap">
                          {[...Array(7)].map((_, index) => (
                            <div key={index} className="bg-neutral-700/30 rounded-lg p-4 border border-neutral-700/50 flex-1 text-center min-w-[120px]">
                              <div className="h-3 w-16 bg-neutral-700/50 rounded animate-pulse mb-2 mx-auto"></div>
                              <div className="h-8 w-12 bg-neutral-700/50 rounded animate-pulse mx-auto"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  /* Multiple Users Grid Skeleton */
                  <Card className="bg-neutral-800 border-neutral-700">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto" style={{ height: '570px' }}>
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-neutral-700">
                              <th className="text-left py-2 px-2 text-sm font-semibold text-neutral-400">User</th>
                              <th className="text-center py-2 px-2 text-sm font-semibold text-neutral-400">Complete</th>
                              <th className="text-center py-2 px-2 text-sm font-semibold text-neutral-400">Incomplete</th>
                              <th className="text-center py-2 px-2 text-sm font-semibold text-neutral-400">Important</th>
                              <th className="text-center py-2 px-2 text-sm font-semibold text-neutral-400">Changes</th>
                              <th className="text-center py-2 px-2 text-sm font-semibold text-neutral-400">Inactive</th>
                              <th className="text-center py-2 px-2 text-sm font-semibold text-neutral-400">Short</th>
                              <th className="text-center py-2 px-2 text-sm font-semibold text-neutral-400">Long</th>
                              <th className="text-center py-2 px-2 text-sm font-semibold text-neutral-400">Last Active</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...Array(5)].map((_, index) => (
                              <tr key={index} className={`border-b border-neutral-800 ${index % 2 === 0 ? 'bg-neutral-800/50' : 'bg-neutral-900/50'}`}>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-neutral-700/50 animate-pulse"></div>
                                    <div className="h-4 w-24 bg-neutral-700/50 rounded animate-pulse"></div>
                                  </div>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <div className="h-4 w-8 bg-neutral-700/50 rounded animate-pulse mx-auto"></div>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <div className="h-4 w-8 bg-neutral-700/50 rounded animate-pulse mx-auto"></div>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <div className="h-4 w-8 bg-neutral-700/50 rounded animate-pulse mx-auto"></div>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <div className="h-4 w-8 bg-neutral-700/50 rounded animate-pulse mx-auto"></div>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <div className="h-4 w-8 bg-neutral-700/50 rounded animate-pulse mx-auto"></div>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <div className="h-4 w-8 bg-neutral-700/50 rounded animate-pulse mx-auto"></div>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <div className="h-4 w-8 bg-neutral-700/50 rounded animate-pulse mx-auto"></div>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <div className="h-4 w-16 bg-neutral-700/50 rounded animate-pulse mx-auto"></div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Chart and Latest Changes Cards Skeleton */}
                <div className="flex gap-4 mt-6">
                  {/* Activity Chart Card Skeleton */}
                  <div className="flex-1">
                    <Card className="bg-neutral-800 border-neutral-700">
                      <CardContent className="pt-2 pb-3 px-3">
                        <h3 className="text-lg font-semibold text-white mb-2 text-center">Activity</h3>
                        <div className="h-[420px] relative">
                          {/* Chart skeleton */}
                          <div className="absolute bottom-0 left-0 right-0 top-0 flex flex-col">
                            {/* Y-axis skeleton */}
                            <div className="flex-1 flex items-end justify-start pr-2">
                              <div className="space-y-8">
                                {[...Array(5)].map((_, i) => (
                                  <div key={i} className="h-3 w-8 bg-neutral-700/50 rounded animate-pulse"></div>
                                ))}
                              </div>
                            </div>
                            {/* X-axis skeleton */}
                            <div className="h-16 flex items-end justify-around px-4 pb-2">
                              {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-3 w-10 bg-neutral-700/50 rounded animate-pulse"></div>
                              ))}
                            </div>
                          </div>
                          {/* Chart lines skeleton */}
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="skeletonGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#404040" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#404040" stopOpacity="0.1" />
                              </linearGradient>
                            </defs>
                            {[...Array(3)].map((_, lineIndex) => {
                              const points = Array.from({ length: 5 }, (_, i) => {
                                const x = 50 + (i * 70);
                                const y = 350 - (Math.random() * 200 + 50);
                                return `${x},${y}`;
                              }).join(' ');
                              return (
                                <polyline
                                  key={lineIndex}
                                  points={points}
                                  fill="none"
                                  stroke="#404040"
                                  strokeWidth="2"
                                  strokeDasharray="5,5"
                                  opacity="0.5"
                                  className="animate-pulse"
                                />
                              );
                            })}
                          </svg>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Latest Changes Card Skeleton */}
                  <div className="w-1/3 flex-shrink-0">
                    <Card className="bg-neutral-800 border-neutral-700">
                      <CardContent className="pt-2 pb-3 px-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-white">Latest Changes</h3>
                          <div className="flex items-center gap-1.5">
                            {[...Array(4)].map((_, i) => (
                              <div key={i} className="w-7 h-7 rounded-full bg-neutral-700/50 animate-pulse"></div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5 h-[420px] overflow-y-auto scrollbar-thumb-only">
                          {[...Array(6)].map((_, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 py-1.5 px-2 bg-neutral-700/30 rounded-lg"
                            >
                              <div className="w-8 h-8 rounded-full bg-neutral-700/50 animate-pulse flex-shrink-0"></div>
                              <div className="flex-1 min-w-0">
                                <div className="h-4 w-full bg-neutral-700/50 rounded animate-pulse mb-2"></div>
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-20 bg-neutral-700/50 rounded animate-pulse"></div>
                                  <div className="h-3 w-24 bg-neutral-700/50 rounded animate-pulse"></div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            ) : filteredUserStats.length === 0 ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-neutral-500 text-lg">No users found</div>
              </div>
            ) : (
              <>
            {filteredUserStats.length === 1 ? (
              /* Single User Card View */
              (() => {
                const stat = filteredUserStats[0];
                return (
                  <Card className="bg-neutral-800 border-neutral-700">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="w-16 h-16 rounded-full overflow-hidden border border-neutral-700/50 flex-shrink-0">
                            {stat.user.image ? (
                              <img
                                src={`data:image/jpeg;base64,${stat.user.image}`}
                                alt={stat.user.name}
                                className="w-full h-full object-cover"
                                title={stat.user.name}
                              />
                            ) : (
                              <div className="w-full h-full bg-neutral-700/50 flex items-center justify-center text-neutral-400 text-xl">
                                {stat.user.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-white mb-1">{stat.user.name}</h2>
                            <p className="text-neutral-400 text-sm">
                              Last Active: {stat.lastActive ? formatRelativeTime(stat.lastActive) : 'Never'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-4 flex-1 flex-wrap">
                          <div className="bg-neutral-700/30 rounded-lg p-4 border border-neutral-700/50 flex-1 text-center min-w-[120px]">
                            <div className="text-xs mb-1 text-neutral-500">Complete</div>
                            <div className="text-2xl font-bold text-white">{stat.completed}</div>
                          </div>
                          <div className="bg-neutral-700/30 rounded-lg p-4 border border-neutral-700/50 flex-1 text-center min-w-[120px]">
                            <div className="text-xs mb-1 text-neutral-500">Incomplete</div>
                            <div className="text-2xl font-bold text-white">{stat.incomplete}</div>
                          </div>
                          <div className="bg-neutral-700/30 rounded-lg p-4 border border-neutral-700/50 flex-1 text-center min-w-[120px]">
                            <div className="text-xs mb-1 text-neutral-500">Important</div>
                            <div className="text-2xl font-bold text-white">{stat.important}</div>
                          </div>
                          <div className="bg-neutral-700/30 rounded-lg p-4 border border-neutral-700/50 flex-1 text-center min-w-[120px]">
                            <div className="text-xs mb-1 text-neutral-500">Changes</div>
                            <div className="text-2xl font-bold text-white">{stat.changes}</div>
                          </div>
                          <div className="bg-neutral-700/30 rounded-lg p-4 border border-neutral-700/50 flex-1 text-center min-w-[120px]">
                            <div className="text-xs mb-1 text-neutral-500">Inactive</div>
                            <div className="text-2xl font-bold text-white">{stat.inactive}</div>
                          </div>
                          <div className="bg-neutral-700/30 rounded-lg p-4 border border-neutral-700/50 flex-1 text-center min-w-[120px]">
                            <div className="text-xs mb-1 text-neutral-500">Short</div>
                            <div className="text-2xl font-bold text-white">{stat.short}</div>
                          </div>
                          <div className="bg-neutral-700/30 rounded-lg p-4 border border-neutral-700/50 flex-1 text-center min-w-[120px]">
                            <div className="text-xs mb-1 text-neutral-500">Long</div>
                            <div className="text-2xl font-bold text-white">{stat.long}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()
            ) : (
              /* Multiple Users Grid View */
              <Card className="bg-neutral-800 border-neutral-700">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-700">
                          <th 
                            className="text-left py-2 px-2 text-sm font-semibold text-neutral-400 cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleStatsSort('user')}
                          >
                            <div className="flex items-center gap-2">
                              User
                              {statsSortColumn === 'user' && (
                                <span className="text-white">
                                  {statsSortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="text-center py-2 px-2 text-sm font-semibold text-neutral-400 cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleStatsSort('completed')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Complete
                              {statsSortColumn === 'completed' && (
                                <span className="text-white">
                                  {statsSortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="text-center py-2 px-2 text-sm font-semibold text-neutral-400 cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleStatsSort('incomplete')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Incomplete
                              {statsSortColumn === 'incomplete' && (
                                <span className="text-white">
                                  {statsSortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="text-center py-2 px-2 text-sm font-semibold text-neutral-400 cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleStatsSort('important')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Important
                              {statsSortColumn === 'important' && (
                                <span className="text-white">
                                  {statsSortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="text-center py-2 px-2 text-sm font-semibold text-neutral-400 cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleStatsSort('changes')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Changes
                              {statsSortColumn === 'changes' && (
                                <span className="text-white">
                                  {statsSortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="text-center py-2 px-2 text-sm font-semibold text-neutral-400 cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleStatsSort('inactive')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Inactive
                              {statsSortColumn === 'inactive' && (
                                <span className="text-white">
                                  {statsSortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="text-center py-2 px-2 text-sm font-semibold text-neutral-400 cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleStatsSort('short')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Short
                              {statsSortColumn === 'short' && (
                                <span className="text-white">
                                  {statsSortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="text-center py-2 px-2 text-sm font-semibold text-neutral-400 cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleStatsSort('long')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Long
                              {statsSortColumn === 'long' && (
                                <span className="text-white">
                                  {statsSortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="text-center py-2 px-2 text-sm font-semibold text-neutral-400 cursor-pointer hover:text-white transition-colors select-none"
                            onClick={() => handleStatsSort('lastActive')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Last Active
                              {statsSortColumn === 'lastActive' && (
                                <span className="text-white">
                                  {statsSortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUserStats.map((stat, index) => (
                          <tr key={stat.user._id} className={`border-b border-neutral-800 transition-colors ${index % 2 === 0 ? 'bg-neutral-800/50' : 'bg-neutral-900/50'} hover:bg-neutral-700/50`}>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-700/50 flex-shrink-0">
                                  {stat.user.image ? (
                                    <img
                                      src={`data:image/jpeg;base64,${stat.user.image}`}
                                      alt={stat.user.name}
                                      className="w-full h-full object-cover"
                                      title={stat.user.name}
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-neutral-700/50 flex items-center justify-center text-neutral-400 text-sm">
                                      {stat.user.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <span className="text-white font-medium">{stat.user.name}</span>
                              </div>
                            </td>
                            <td className="text-center py-2 px-2 text-white">{stat.completed}</td>
                            <td className="text-center py-2 px-2 text-white">{stat.incomplete}</td>
                            <td className="text-center py-2 px-2 text-white">{stat.important}</td>
                            <td className="text-center py-2 px-2 text-white">{stat.changes}</td>
                            <td className="text-center py-2 px-2 text-white">{stat.inactive}</td>
                            <td className="text-center py-2 px-2 text-white">{stat.short}</td>
                            <td className="text-center py-2 px-2 text-white">{stat.long}</td>
                            <td className="text-center py-2 px-2 text-neutral-400 text-sm">
                              {stat.lastActive ? formatRelativeTime(stat.lastActive) : 'Never'}
                            </td>
                          </tr>
                        ))}
                        {/* Total Row */}
                        {(() => {
                          const totals = filteredUserStats.reduce((acc, stat) => ({
                            completed: acc.completed + stat.completed,
                            incomplete: acc.incomplete + stat.incomplete,
                            important: acc.important + stat.important,
                            changes: acc.changes + stat.changes,
                            inactive: acc.inactive + stat.inactive,
                            short: acc.short + stat.short,
                            long: acc.long + stat.long,
                          }), {
                            completed: 0,
                            incomplete: 0,
                            important: 0,
                            changes: 0,
                            inactive: 0,
                            short: 0,
                            long: 0,
                          });
                          return (
                            <tr className="border-t-2 border-neutral-700 bg-neutral-800/70">
                              <td className="py-2 px-2">
                                <span className="text-white font-bold">TOTAL</span>
                              </td>
                              <td className="text-center py-2 px-2 text-white font-bold">{totals.completed}</td>
                              <td className="text-center py-2 px-2 text-white font-bold">{totals.incomplete}</td>
                              <td className="text-center py-2 px-2 text-white font-bold">{totals.important}</td>
                              <td className="text-center py-2 px-2 text-white font-bold">{totals.changes}</td>
                              <td className="text-center py-2 px-2 text-white font-bold">{totals.inactive}</td>
                              <td className="text-center py-2 px-2 text-white font-bold">{totals.short}</td>
                              <td className="text-center py-2 px-2 text-white font-bold">{totals.long}</td>
                              <td className="text-center py-2 px-2 text-neutral-400 text-sm"></td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Chart and Latest Changes Cards */}
            <div className="flex gap-4 mt-6">
              {/* Activity Chart Card */}
              <div className="flex-1">
                <Card className="bg-neutral-800 border-neutral-700">
                  <CardContent className="pt-2 pb-3 px-3">
                    <div className="flex items-center justify-between mb-2 relative">
                      <h3 className="text-lg font-semibold text-white">Activity</h3>
                      <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-neutral-700/50 rounded-lg p-0.5">
                        <button
                          onClick={() => setActivityMode('delta')}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            activityMode === 'delta'
                              ? 'bg-neutral-600 text-white'
                              : 'text-neutral-400 hover:text-neutral-300'
                          }`}
                          title="Delta (daily changes)"
                        >
                          Δ Delta
                        </button>
                        <button
                          onClick={() => setActivityMode('total')}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            activityMode === 'total'
                              ? 'bg-neutral-600 text-white'
                              : 'text-neutral-400 hover:text-neutral-300'
                          }`}
                          title="Total (cumulative)"
                        >
                          Σ Total
                        </button>
                      </div>
                      <select
                        value={activityPeriod}
                        onChange={(e) => setActivityPeriod(e.target.value as any)}
                        className="bg-neutral-700/50 border border-neutral-600 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      >
                        <option value="5 days">5 days</option>
                        <option value="10 days">10 days</option>
                        <option value="15 days">15 days</option>
                        <option value="1 month">1 month</option>
                        <option value="2 months">2 months</option>
                        <option value="3 months">3 months</option>
                        <option value="6 months">6 months</option>
                        <option value="1 year">1 year</option>
                      </select>
                    </div>
                    {changesOverTime === undefined ? (
                      <div className="h-[420px] relative">
                        {/* Chart skeleton */}
                        <div className="absolute bottom-0 left-0 right-0 top-0 flex flex-col">
                          {/* Y-axis skeleton */}
                          <div className="flex-1 flex items-end justify-start pr-2">
                            <div className="space-y-8">
                              {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-3 w-8 bg-neutral-700/50 rounded animate-pulse"></div>
                              ))}
                            </div>
                          </div>
                          {/* X-axis skeleton */}
                          <div className="h-16 flex items-end justify-around px-4 pb-2">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="h-3 w-10 bg-neutral-700/50 rounded animate-pulse"></div>
                            ))}
                          </div>
                        </div>
                        {/* Chart lines skeleton */}
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="skeletonGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#404040" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#404040" stopOpacity="0.1" />
                            </linearGradient>
                          </defs>
                          {[...Array(selectedUsers.size || 1)].map((_, lineIndex) => {
                            const points = Array.from({ length: 5 }, (_, i) => {
                              const x = 50 + (i * 70);
                              const y = 350 - (Math.random() * 200 + 50);
                              return `${x},${y}`;
                            }).join(' ');
                            return (
                              <polyline
                                key={lineIndex}
                                points={points}
                                fill="none"
                                stroke="#404040"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                                opacity="0.5"
                                className="animate-pulse"
                              />
                            );
                          })}
                        </svg>
                      </div>
                    ) : changesOverTime.length === 0 ? (
                      <div className="h-[420px] flex items-center justify-center">
                        <div className="text-neutral-500 text-sm">No data available</div>
                      </div>
                    ) : (() => {
                      // Aggregate data into intervals
                      const days = periodToDays(activityPeriod);
                      const intervalCount = calculateIntervalCount(days);
                      const now = Date.now();
                      const startTime = now - (days * 24 * 60 * 60 * 1000);
                      const intervalDuration = (now - startTime) / intervalCount;
                      
                      // Create intervals
                      const intervals: Array<{ start: number; end: number; label: string; timestamp: number }> = [];
                      for (let i = 0; i < intervalCount; i++) {
                        const intervalStart = startTime + (i * intervalDuration);
                        const intervalEnd = i === intervalCount - 1 ? now : startTime + ((i + 1) * intervalDuration);
                        const intervalDate = new Date(intervalStart);
                        const day = String(intervalDate.getDate()).padStart(2, '0');
                        const month = String(intervalDate.getMonth() + 1).padStart(2, '0');
                        intervals.push({
                          start: intervalStart,
                          end: intervalEnd,
                          label: `${day}.${month}`,
                          timestamp: intervalStart,
                        });
                      }
                      
                      // Aggregate data into intervals
                      const usersToInclude = users && (selectedUsers.size > 0 
                        ? users.filter(u => selectedUsers.has(u._id))
                        : users) || [];
                      
                      let chartData = intervals.map(interval => {
                        const formatted: any = {
                          time: interval.label,
                          timestamp: interval.timestamp,
                        };
                        
                        // Sum all data points within this interval
                        usersToInclude.forEach(user => {
                          let sum = 0;
                          changesOverTime.forEach((item: any) => {
                            if (item.time >= interval.start && item.time < interval.end) {
                              sum += ((item as any)[user._id] as number) || 0;
                            }
                          });
                          formatted[user.name] = sum;
                        });
                        
                        return formatted;
                      });
                      
                      // Calculate cumulative totals if mode is "total"
                      if (activityMode === 'total') {
                        const cumulativeTotals: Record<string, number> = {};
                        usersToInclude.forEach(user => {
                          cumulativeTotals[user.name] = 0;
                        });
                        
                        chartData = chartData.map((item: any) => {
                          const newItem = { ...item };
                          usersToInclude.forEach(user => {
                            const intervalValue = item[user.name] || 0;
                            cumulativeTotals[user.name] += intervalValue;
                            newItem[user.name] = cumulativeTotals[user.name];
                          });
                          return newItem;
                        });
                      }
                      
                      // Get user colors
                      const userColors: Record<string, string> = {};
                      if (users) {
                        const usersToInclude = selectedUsers.size > 0 
                          ? users.filter(u => selectedUsers.has(u._id))
                          : users;
                        usersToInclude.forEach(user => {
                          if (user.color) {
                            userColors[user.name] = user.color;
                          }
                        });
                      }
                      
                      // Default colors if user colors not set
                      const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
                      let colorIndex = 0;
                      
                      return (
                        <>
                          <div className="h-[420px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                                <XAxis 
                                  dataKey="time" 
                                  stroke="#9ca3af"
                                  style={{ fontSize: '12px' }}
                                  interval={0}
                                  angle={-45}
                                  textAnchor="end"
                                  height={80}
                                />
                                <YAxis 
                                  stroke="#9ca3af"
                                  style={{ fontSize: '12px' }}
                                  allowDecimals={false}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: '#262626', 
                                    border: '1px solid #404040',
                                    borderRadius: '6px',
                                    color: '#fff'
                                  }}
                                />
                                {users && (() => {
                                  const usersToShow = selectedUsers.size > 0 
                                    ? users.filter(u => selectedUsers.has(u._id))
                                    : users;
                                  
                                  return usersToShow.map((user) => {
                                    const color = userColors[user.name] || user.color || defaultColors[colorIndex++ % defaultColors.length];
                                    return (
                                      <Line
                                        key={user._id}
                                        type="monotone"
                                        dataKey={user.name}
                                        stroke={color}
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: color }}
                                        activeDot={{ r: 5 }}
                                      />
                                    );
                                  });
                                })()}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          {/* User avatars legend */}
                          <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                            {(() => {
                              const usersToShow = selectedUsers.size > 0 
                                ? users?.filter(u => selectedUsers.has(u._id))
                                : users;
                              
                              return usersToShow?.map((user) => {
                                const userColor = user.color || '#9ca3af';
                                return (
                                  <div
                                    key={user._id}
                                    className="w-8 h-8 rounded-full overflow-hidden border-2 flex-shrink-0"
                                    style={{ borderColor: userColor }}
                                    title={user.name}
                                  >
                                    {user.image ? (
                                      <img
                                        src={`data:image/jpeg;base64,${user.image}`}
                                        alt={user.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-neutral-700/50 flex items-center justify-center text-neutral-400 text-xs">
                                        {user.name.charAt(0)}
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
              
              {/* Latest Changes Card */}
              <div className="w-1/3 flex-shrink-0 h-[470px]">
              <Card className="bg-neutral-800 border-neutral-700">
                <CardContent className="pt-2 pb-3 px-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-white">Latest Changes</h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setLatestChangesShowCompleted(!latestChangesShowCompleted)}
                        className={`w-7 h-7 rounded-full text-xs font-medium transition-colors flex items-center justify-center ${
                          latestChangesShowCompleted 
                            ? "bg-green-600 text-white" 
                            : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
                        }`}
                        title="Completed"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setLatestChangesShowIncomplete(!latestChangesShowIncomplete)}
                        className={`w-7 h-7 rounded-full text-xs font-medium transition-colors flex items-center justify-center ${
                          latestChangesShowIncomplete 
                            ? "bg-neutral-500 text-white" 
                            : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
                        }`}
                        title="Incomplete"
                      >
                        ○
                      </button>
                      <button
                        onClick={() => setLatestChangesShowImportant(!latestChangesShowImportant)}
                        className={`w-7 h-7 rounded-full text-xs font-medium transition-colors flex items-center justify-center ${
                          latestChangesShowImportant 
                            ? "bg-amber-500 text-white" 
                            : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
                        }`}
                        title="Important"
                      >
                        ★
                      </button>
                      <button
                        onClick={() => setLatestChangesShowNotImportant(!latestChangesShowNotImportant)}
                        className={`w-7 h-7 rounded-full text-xs font-medium transition-colors flex items-center justify-center ${
                          latestChangesShowNotImportant 
                            ? "bg-neutral-500 text-white" 
                            : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
                        }`}
                        title="Not Important"
                      >
                        ☆
                      </button>
                    </div>
                  </div>
                  {latestChangesPage === undefined && accumulatedChanges.length === 0 ? (
                    <div className="space-y-1.5 h-[420px] overflow-y-auto scrollbar-thumb-only">
                      {[...Array(6)].map((_, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 py-1.5 px-2 bg-neutral-700/30 rounded-lg"
                        >
                          {selectedUsers.size !== 1 && (
                            <div className="w-8 h-8 rounded-full bg-neutral-700/50 animate-pulse flex-shrink-0"></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="h-4 w-full bg-neutral-700/50 rounded animate-pulse mb-2"></div>
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-20 bg-neutral-700/50 rounded animate-pulse"></div>
                              <div className="h-3 w-24 bg-neutral-700/50 rounded animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : latestChanges.length === 0 ? (
                    <div className="h-[420px] flex items-center justify-center">
                      <div className="text-neutral-500 text-sm">No changes found</div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 h-[470px] overflow-y-auto scrollbar-thumb-only">
                      {latestChanges.map((change) => {
                        if (!change) return null;
                        const isImportanceChange = change.changeType === "importance";
                        const showAvatar = selectedUsers.size !== 1;
                        
                        return (
                          <div
                            key={change._id}
                            className="flex items-center gap-3 py-1.5 px-2 bg-neutral-700/30 rounded-lg"
                          >
                            {showAvatar && change.user && (
                              <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-700/50 flex-shrink-0">
                                {change.user.image ? (
                                  <img
                                    src={`data:image/jpeg;base64,${change.user.image}`}
                                    alt={change.user.name}
                                    className="w-full h-full object-cover"
                                    title={change.user.name}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-neutral-700/50 flex items-center justify-center text-neutral-400 text-xs">
                                    {change.user.name.charAt(0)}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white truncate" title={change.task.text}>
                                {change.task.text}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={
                                  isImportanceChange 
                                    ? (change.changedTo ? "text-amber-400 text-xs" : "text-neutral-400 text-xs")
                                    : (change.changedTo ? "text-green-400 text-xs" : "text-neutral-400 text-xs")
                                }>
                                  {isImportanceChange 
                                    ? (change.changedTo ? "★ Important" : "☆ Not Important")
                                    : (change.changedTo ? "✓ Completed" : "○ Incomplete")
                                  }
                                </span>
                                <span className="text-neutral-500 text-xs">
                                  {formatDateTime(change.changedAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Load More Button */}
                      <div className="py-2 flex justify-center">
                        {isLoadingMore ? (
                          <div className="text-neutral-500 text-xs">Loading more...</div>
                        ) : hasMoreChanges ? (
                          <Button
                            onClick={loadMoreLatestChanges}
                            variant="outline"
                            className="bg-neutral-700/50 border-neutral-600 text-white hover:bg-neutral-600"
                          >
                            Load more
                          </Button>
                        ) : latestChanges.length > 0 ? (
                          <div className="text-neutral-600 text-xs">All changes loaded</div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            </div>
            </>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Task Details Sheet */}
      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <SheetContent className="bg-neutral-900 border-neutral-700 text-white flex flex-col h-full w-[510px] sm:max-w-[510px]">
          {selectedTask && (() => {
            const drawerTaskUser = users?.find(u => u._id === selectedTask.userId);
            return (
              <>
                <SheetHeader className="pr-8">
                  <SheetTitle className="text-white text-xl flex items-center gap-3">
                    {drawerTaskUser && (
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-neutral-700/50 flex-shrink-0">
                        {drawerTaskUser.image ? (
                          <img
                            src={`data:image/jpeg;base64,${drawerTaskUser.image}`}
                            alt={drawerTaskUser.name}
                            className="w-full h-full object-cover"
                            title={drawerTaskUser.name}
                          />
                        ) : (
                          <div className="w-full h-full bg-neutral-700/50 flex items-center justify-center text-neutral-400 text-sm">
                            {drawerTaskUser.name.charAt(0)}
                          </div>
                        )}
                      </div>
                    )}
                    {selectedTask.text}
                  </SheetTitle>
                  <SheetDescription className="text-neutral-400 flex items-center gap-3">
                    <span className={selectedTask.isCompleted ? "text-green-500" : "text-neutral-400"}>
                      {selectedTask.isCompleted ? "✓ Completed" : "○ Incomplete"}
                    </span>
                    <span className={selectedTask.isImportant ? "text-amber-400" : "text-neutral-400"}>
                      {selectedTask.isImportant ? "★ Important" : "☆ Not Important"}
                    </span>
                  </SheetDescription>
                </SheetHeader>
                
                <div className="mt-6 space-y-6 flex flex-col flex-1 min-h-0">
                <div className="flex-shrink-0">
                  <h3 className="text-sm font-medium text-neutral-400 mb-2">Description</h3>
                  <p className="text-white/90 leading-relaxed">
                    {selectedTask.description || "No description available."}
                  </p>
                </div>
                
                <div className="space-y-3 flex-shrink-0">
                  <div className="flex justify-between items-center py-2 border-b border-neutral-700">
                    <span className="text-neutral-400">Duration</span>
                    <span className="text-white">{formatDuration(selectedTask.duration)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-neutral-700">
                    <span className="text-neutral-400">Created</span>
                    <span 
                      className="text-white cursor-help" 
                      title={selectedTask.createdAt ? formatDateTime(selectedTask.createdAt) : "Unknown"}
                    >
                      {formatRelativeTime(selectedTask.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-neutral-700">
                    <span className="text-neutral-400">Last Updated</span>
                    <span 
                      className="text-white cursor-help" 
                      title={selectedTask.updatedAt ? formatDateTime(selectedTask.updatedAt) : "Unknown"}
                    >
                      {formatRelativeTime(selectedTask.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-shrink-0 mb-3">
                    <h3 className="text-sm font-medium text-neutral-400 mb-2">Changes</h3>
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
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <TaskHistory 
                      taskId={selectedTask._id} 
                      showCompleted={historyShowCompleted}
                      showIncomplete={historyShowIncomplete}
                      showImportant={historyShowImportant}
                      showNotImportant={historyShowNotImportant}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 pb-2 flex-shrink-0 flex gap-2">
                <Button
                  onClick={async () => {
                    const wasImportant = selectedTask.isImportant;
                    setTogglingImportance(prev => new Set(prev).add(selectedTask._id));
                    try {
                      await toggleImportant({ id: selectedTask._id as any });
                      addToast(`Task marked as ${wasImportant ? 'not important' : 'important'}`, wasImportant ? 'not-important' : 'important');
                    } finally {
                      setTogglingImportance(prev => {
                        const next = new Set(prev);
                        next.delete(selectedTask._id);
                        return next;
                      });
                    }
                  }}
                  disabled={togglingTasks.has(selectedTask._id) || togglingImportance.has(selectedTask._id)}
                  className={`flex-1 py-6 text-base font-medium flex items-center justify-center gap-2 ${
                    togglingImportance.has(selectedTask._id) 
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  } ${selectedTask.isImportant 
                    ? "bg-neutral-700 hover:bg-neutral-600" 
                    : "bg-amber-500 hover:bg-amber-600"
                  }`}
                >
                  {togglingImportance.has(selectedTask._id) ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <span>{selectedTask.isImportant ? "☆" : "★"}</span>
                  )}
                  <span>{selectedTask.isImportant ? "Remove Importance" : "Mark as Important"}</span>
                </Button>
                <Button
                  onClick={async () => {
                    const wasCompleted = selectedTask.isCompleted;
                    setTogglingTasks(prev => new Set(prev).add(selectedTask._id));
                    try {
                      await toggleCompleted({ id: selectedTask._id as any });
                      addToast(`Task marked as ${wasCompleted ? 'incomplete' : 'complete'}`, wasCompleted ? 'incomplete' : 'completed');
                    } finally {
                      setTogglingTasks(prev => {
                        const next = new Set(prev);
                        next.delete(selectedTask._id);
                        return next;
                      });
                    }
                  }}
                  disabled={togglingTasks.has(selectedTask._id) || togglingImportance.has(selectedTask._id)}
                  className={`flex-1 py-6 text-base font-medium flex items-center justify-center gap-2 ${
                    togglingTasks.has(selectedTask._id) 
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  } ${selectedTask.isCompleted 
                    ? "bg-neutral-700 hover:bg-neutral-600" 
                    : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {togglingTasks.has(selectedTask._id) ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <span>{selectedTask.isCompleted ? "○" : "✓"}</span>
                  )}
                  <span>{selectedTask.isCompleted ? "Mark as Incomplete" : "Mark as Complete"}</span>
                </Button>
              </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
