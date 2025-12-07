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
import { ToastContainer, Toast } from "@/components/ui/toast";

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

  if (filteredHistory.length === 0) {
    return <div className="text-neutral-500 text-sm">No matching entries.</div>;
  }

  return (
    <div className="space-y-2">
      {filteredHistory.map((entry) => {
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
  const usersParam = params.get('users');
  const selectedUsers = usersParam ? usersParam.split(',').filter(Boolean) : [];
  
  return {
    showCompleted: showCompleted === null ? true : showCompleted === 'true',
    showIncomplete: showIncomplete === null ? true : showIncomplete === 'true',
    durationFilter: durationFilter && ['all', 'quick', 'long'].includes(durationFilter) ? durationFilter : 'all',
    importanceFilter: importanceFilter && ['all', 'important', 'not-important'].includes(importanceFilter) ? importanceFilter : 'all',
    sort: sort && ['latest', 'inactive', 'newest', 'oldest', 'frequent', 'unfrequent', 'quickest', 'longest'].includes(sort) ? sort : 'latest',
    viewMode: view && ['compact', 'extended', 'list'].includes(view) ? view : 'compact',
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [historyShowCompleted, setHistoryShowCompleted] = useState(false);
  const [historyShowIncomplete, setHistoryShowIncomplete] = useState(false);
  const [historyShowImportant, setHistoryShowImportant] = useState(false);
  const [historyShowNotImportant, setHistoryShowNotImportant] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(initialParams.selectedUsers);
  
  // Fetch all users
  const users = useQuery(api.tasks.getAllUsers);
  
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
  
  // Update URL when filters/sort/view change
  useEffect(() => {
    const params = new URLSearchParams();
    if (!showCompleted) params.set('completed', 'false');
    if (!showIncomplete) params.set('incomplete', 'false');
    if (durationFilter !== 'all') params.set('duration', durationFilter);
    if (importanceFilter !== 'all') params.set('importance', importanceFilter);
    if (sort !== 'latest') params.set('sort', sort);
    if (viewMode !== 'compact') params.set('view', viewMode);
    if (selectedUsers.size > 0) params.set('users', Array.from(selectedUsers).join(','));
    
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    
    window.history.replaceState({}, '', newUrl);
  }, [showCompleted, showIncomplete, durationFilter, importanceFilter, sort, viewMode, selectedUsers]);
  
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
        </div>

        {/* Task Grid */}
        <div className="px-6 py-8">
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
                  className="flex flex-col rounded-2xl p-5 bg-neutral-800 animate-pulse min-h-[320px]"
                >
                  <div className="h-6 bg-neutral-700 rounded-lg w-3/4 mb-3"></div>
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="h-4 bg-neutral-700 rounded w-full"></div>
                    <div className="h-4 bg-neutral-700 rounded w-full"></div>
                    <div className="h-4 bg-neutral-700 rounded w-full"></div>
                    <div className="h-4 bg-neutral-700 rounded w-2/3"></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4 py-3 border-y border-neutral-700">
                    <div>
                      <div className="h-3 bg-neutral-700 rounded w-12 mb-1"></div>
                      <div className="h-4 bg-neutral-700 rounded w-16"></div>
                    </div>
                    <div className="text-center">
                      <div className="h-3 bg-neutral-700 rounded w-12 mb-1 mx-auto"></div>
                      <div className="h-4 bg-neutral-700 rounded w-14 mx-auto"></div>
                    </div>
                    <div className="text-right">
                      <div className="h-3 bg-neutral-700 rounded w-12 mb-1 ml-auto"></div>
                      <div className="h-4 bg-neutral-700 rounded w-10 ml-auto"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <div className="h-12 bg-neutral-700 rounded"></div>
                    <div className="h-12 bg-neutral-700 rounded"></div>
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
                  <div className="p-5 flex flex-col flex-1">
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
                  
                  {viewMode === 'extended' && (
                    <div className="grid grid-cols-3 gap-3 mb-4 py-3 border-y border-neutral-700">
                      <div>
                        <div className="text-xs mb-1 text-neutral-500">Created</div>
                        <div className="text-sm font-medium text-white">{formatRelativeTime(task.createdAt)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs mb-1 text-neutral-500">Updated</div>
                        <div className="text-sm font-medium text-white">{formatRelativeTime(task.updatedAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs mb-1 text-neutral-500">Duration</div>
                        <div className="text-sm font-medium text-white">{formatDuration(task.duration)}</div>
                      </div>
                    </div>
                  )}
                  
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
