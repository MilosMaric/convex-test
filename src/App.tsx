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
import { useState, useMemo, useEffect } from "react";

const PAGE_SIZE = 50;

// Task type based on schema
type Task = {
  _id: string;
  _creationTime: number;
  text: string;
  description?: string;
  isCompleted: boolean;
  createdAt?: number;
  updatedAt?: number;
  duration?: number;
  historyCount: number;
};

type FilterType = 'all' | 'completed' | 'incomplete';
type DurationFilterType = 'all' | 'quick' | 'long';
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
  onToggleCompleted, 
  onToggleIncomplete 
}: { 
  showCompleted: boolean; 
  showIncomplete: boolean; 
  onToggleCompleted: () => void; 
  onToggleIncomplete: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onToggleCompleted}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          showCompleted 
            ? "bg-green-600 text-white" 
            : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
        }`}
      >
        Completed
      </button>
      <button
        onClick={onToggleIncomplete}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          showIncomplete 
            ? "bg-neutral-500 text-white" 
            : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
        }`}
      >
        Incomplete
      </button>
    </div>
  );
}

function TaskHistory({ taskId, showCompleted, showIncomplete }: { 
  taskId: string; 
  showCompleted: boolean; 
  showIncomplete: boolean;
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
    if (!showCompleted && !showIncomplete) return true; // Show all
    if (showCompleted && entry.changedTo) return true;
    if (showIncomplete && !entry.changedTo) return true;
    return false;
  });

  if (filteredHistory.length === 0) {
    return <div className="text-neutral-500 text-sm">No matching entries.</div>;
  }

  return (
    <div className="space-y-2">
      {filteredHistory.map((entry) => (
        <div
          key={entry._id}
          className="flex justify-between items-center py-2 px-3 bg-neutral-800 rounded-lg"
        >
          <span className={entry.changedTo ? "text-green-400" : "text-neutral-400"}>
            {entry.changedTo ? "✓ Completed" : "○ Incomplete"}
          </span>
          <span className="text-neutral-500 text-sm">
            {formatDateTime(entry.changedAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Read initial values from URL
function getInitialParams() {
  const params = new URLSearchParams(window.location.search);
  const filter = params.get('filter') as FilterType | null;
  const durationFilter = params.get('duration') as DurationFilterType | null;
  const sort = params.get('sort') as SortType | null;
  const view = params.get('view') as ViewMode | null;
  
  return {
    filter: filter && ['all', 'completed', 'incomplete'].includes(filter) ? filter : 'all',
    durationFilter: durationFilter && ['all', 'quick', 'long'].includes(durationFilter) ? durationFilter : 'all',
    sort: sort && ['latest', 'inactive', 'newest', 'oldest', 'frequent', 'unfrequent', 'quickest', 'longest'].includes(sort) ? sort : 'latest',
    viewMode: view && ['compact', 'extended', 'list'].includes(view) ? view : 'compact',
  };
}

function App() {
  const initialParams = getInitialParams();
  const [filter, setFilter] = useState<FilterType>(initialParams.filter);
  const [durationFilter, setDurationFilter] = useState<DurationFilterType>(initialParams.durationFilter);
  const [sort, setSort] = useState<SortType>(initialParams.sort);
  const [viewMode, setViewMode] = useState<ViewMode>(initialParams.viewMode);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [historyShowCompleted, setHistoryShowCompleted] = useState(false);
  const [historyShowIncomplete, setHistoryShowIncomplete] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  
  // Update URL when filters/sort/view change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('filter', filter);
    if (durationFilter !== 'all') params.set('duration', durationFilter);
    if (sort !== 'latest') params.set('sort', sort);
    if (viewMode !== 'compact') params.set('view', viewMode);
    
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    
    window.history.replaceState({}, '', newUrl);
  }, [filter, durationFilter, sort, viewMode]);
  
  const allTasksQuery = useQuery(api.tasks.listAllWithHistoryCount);
  const isLoading = allTasksQuery === undefined;
  const allTasks = allTasksQuery ?? [];
  
  const toggleCompleted = useMutation(api.tasks.toggleCompleted);
  const [togglingTasks, setTogglingTasks] = useState<Set<string>>(new Set());
  
  // Look up the selected task from fresh query data
  const selectedTask = selectedTaskId ? allTasks?.find(t => t._id === selectedTaskId) ?? null : null;
  
  // Sort and filter tasks
  const sortedAndFilteredTasks = useMemo(() => {
    // First filter by status
    let filtered = allTasks.filter(task => {
      if (filter === 'all') return true;
      if (filter === 'completed') return task.isCompleted;
      if (filter === 'incomplete') return !task.isCompleted;
      return true;
    });
    
    // Then filter by duration
    filtered = filtered.filter(task => {
      if (durationFilter === 'all') return true;
      const duration = task.duration ?? 0;
      if (durationFilter === 'quick') return duration <= 15;
      if (durationFilter === 'long') return duration > 15;
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
  }, [allTasks, filter, durationFilter, sort]);
  
  // Paginate for infinite scroll
  const visibleTasks = sortedAndFilteredTasks.slice(0, visibleCount);
  const hasMore = visibleCount < sortedAndFilteredTasks.length;

  const handleLoadMore = () => {
    if (hasMore) {
      setVisibleCount(prev => prev + PAGE_SIZE);
    }
  };

  const handleToggle = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setTogglingTasks(prev => new Set(prev).add(task._id));
    try {
      await toggleCompleted({ id: task._id as any });
    } finally {
      setTogglingTasks(prev => {
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
          <h1 className="text-3xl font-bold text-white mb-4">Tasks</h1>
          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFilter('all');
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`px-5 py-2 rounded-full font-medium transition-all ${
                  filter === 'all'
                    ? "bg-white text-neutral-900"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setFilter('completed');
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`px-5 py-2 rounded-full font-medium transition-all ${
                  filter === 'completed'
                    ? "bg-green-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => {
                  setFilter('incomplete');
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`px-5 py-2 rounded-full font-medium transition-all ${
                  filter === 'incomplete'
                    ? "bg-neutral-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                Incomplete
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
                Quick (≤15m)
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
                Long (&gt;15m)
              </button>
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
                const isToggling = togglingTasks.has(task._id);
                
                // List View
                if (viewMode === 'list') {
                  return (
                    <div
                      key={task._id}
                      className={`flex items-center gap-4 rounded-xl px-5 py-4 transition-all duration-200 ${
                        task.isCompleted 
                          ? "bg-green-600/90" 
                          : "bg-neutral-800"
                      } ${isToggling ? 'opacity-70 animate-pulse' : ''}`}
                    >
                      {/* Status indicator */}
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        task.isCompleted ? 'bg-white/80' : 'bg-neutral-600'
                      }`} />
                      
                      {/* Title and description */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-white truncate">
                          {task.text}
                        </h3>
                        <p className={`text-sm truncate ${
                          task.isCompleted ? "text-white/60" : "text-neutral-500"
                        }`}>
                          {task.description || "No description"}
                        </p>
                      </div>
                      
                      {/* Meta info */}
                      <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                        <div className="text-center">
                          <div className={`text-xs ${task.isCompleted ? 'text-white/50' : 'text-neutral-500'}`}>Duration</div>
                          <div className={`text-sm font-medium ${task.isCompleted ? 'text-white/90' : 'text-white'}`}>{formatDuration(task.duration)}</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-xs ${task.isCompleted ? 'text-white/50' : 'text-neutral-500'}`}>Updated</div>
                          <div className={`text-sm font-medium ${task.isCompleted ? 'text-white/90' : 'text-white'}`}>{formatRelativeTime(task.updatedAt)}</div>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          onClick={() => setSelectedTaskId(task._id)}
                          size="sm"
                          className="text-xs px-3 py-1.5 h-auto w-[90px] bg-neutral-600 hover:bg-neutral-500 text-white"
                        >
                          Details
                        </Button>
                        <Button
                          onClick={(e) => handleToggle(e, task)}
                          size="sm"
                          disabled={isToggling}
                          className={`text-xs px-3 py-1.5 h-auto w-[90px] ${
                            task.isCompleted 
                              ? "bg-neutral-600 hover:bg-neutral-500 text-white" 
                              : "bg-green-600 hover:bg-green-700 text-white"
                          } ${isToggling ? 'cursor-not-allowed' : ''}`}
                        >
                          {isToggling ? (
                            <svg className="animate-spin h-4 w-4 mx-auto" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            task.isCompleted ? "Incomplete" : "Complete"
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                }
                
                // Card Views (Compact & Extended)
                return (
                <div
                  key={task._id}
                  className={`group relative flex flex-col rounded-2xl p-5 transition-all duration-200 ${
                    task.isCompleted 
                      ? "bg-green-600/90" 
                      : "bg-neutral-800"
                  } ${isToggling ? 'opacity-70 animate-pulse' : ''}`}
                >
                  <h3 className="text-lg font-semibold text-white mb-3 leading-snug">
                    {task.text}
                  </h3>
                  <p className={`text-sm leading-relaxed mb-4 flex-1 ${
                    task.isCompleted ? "text-white/80" : "text-neutral-400"
                  }`}>
                    {task.description || "No description"}
                  </p>
                  
                  {viewMode === 'extended' && (
                    <div className={`grid grid-cols-3 gap-3 mb-4 py-3 border-y ${task.isCompleted ? 'border-white/20' : 'border-neutral-700'}`}>
                      <div>
                        <div className={`text-xs mb-1 ${task.isCompleted ? 'text-white/50' : 'text-neutral-500'}`}>Created</div>
                        <div className={`text-sm font-medium ${task.isCompleted ? 'text-white/90' : 'text-white'}`}>{formatRelativeTime(task.createdAt)}</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-xs mb-1 ${task.isCompleted ? 'text-white/50' : 'text-neutral-500'}`}>Updated</div>
                        <div className={`text-sm font-medium ${task.isCompleted ? 'text-white/90' : 'text-white'}`}>{formatRelativeTime(task.updatedAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs mb-1 ${task.isCompleted ? 'text-white/50' : 'text-neutral-500'}`}>Duration</div>
                        <div className={`text-sm font-medium ${task.isCompleted ? 'text-white/90' : 'text-white'}`}>{formatDuration(task.duration)}</div>
                      </div>
                    </div>
                  )}
                  
                  {viewMode === 'compact' ? (
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/10">
                      <span className={`text-xs ${task.isCompleted ? "text-white/60" : "text-neutral-500"}`}>
                        {sort === 'newest' || sort === 'oldest' 
                          ? formatRelativeTime(task.createdAt)
                          : sort === 'quickest' || sort === 'longest'
                          ? formatDuration(task.duration)
                          : sort === 'frequent' || sort === 'unfrequent'
                          ? `${task.historyCount} status change${task.historyCount !== 1 ? 's' : ''}`
                          : formatRelativeTime(task.updatedAt)}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setSelectedTaskId(task._id)}
                          size="sm"
                          className={`text-xs px-3 py-1 h-auto ${
                            task.isCompleted 
                              ? "bg-neutral-600 hover:bg-neutral-500 text-white" 
                              : "bg-neutral-600 hover:bg-neutral-500 text-white"
                          }`}
                        >
                          Details
                        </Button>
                        <Button
                          onClick={(e) => handleToggle(e, task)}
                          size="sm"
                          disabled={isToggling}
                          className={`text-xs px-3 py-1 h-auto min-w-[80px] ${
                            task.isCompleted 
                              ? "bg-neutral-600 hover:bg-neutral-500 text-white" 
                              : "bg-green-600 hover:bg-green-700 text-white"
                          } ${isToggling ? 'cursor-not-allowed' : ''}`}
                        >
                          {isToggling ? (
                            <svg className="animate-spin h-4 w-4 mx-auto" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            task.isCompleted ? "Incomplete" : "Complete"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mt-auto">
                      <Button
                        onClick={() => setSelectedTaskId(task._id)}
                        className={`w-full py-3 ${
                          task.isCompleted 
                            ? "bg-neutral-600 hover:bg-neutral-500 text-white" 
                            : "bg-neutral-600 hover:bg-neutral-500 text-white"
                        }`}
                      >
                        Details
                      </Button>
                      <Button
                        onClick={(e) => handleToggle(e, task)}
                        disabled={isToggling}
                        className={`w-full py-3 ${
                          task.isCompleted 
                            ? "bg-neutral-600 hover:bg-neutral-500 text-white" 
                            : "bg-green-600 hover:bg-green-700 text-white"
                        } ${isToggling ? 'cursor-not-allowed' : ''}`}
                      >
                        {isToggling ? (
                          <svg className="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          task.isCompleted ? "Mark as Incomplete" : "Mark as Complete"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
              })}
            </div>

            {/* Load More Trigger */}
            <div className="py-8 flex justify-center">
              {hasMore ? (
                <button
                  onClick={handleLoadMore}
                  className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                >
                  Load More ({sortedAndFilteredTasks.length - visibleCount} remaining)
                </button>
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
        <SheetContent className="bg-neutral-900 border-neutral-700 text-white flex flex-col h-full">
          {selectedTask && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white text-xl">{selectedTask.text}</SheetTitle>
                <SheetDescription className="text-neutral-400">
                  {selectedTask.isCompleted ? "✓ Completed" : "○ Incomplete"}
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
                    <span className="text-white">{formatRelativeTime(selectedTask.createdAt)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-neutral-700">
                    <span className="text-neutral-400">Last Updated</span>
                    <span className="text-white">{formatRelativeTime(selectedTask.updatedAt)}</span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-shrink-0 mb-3">
                    <h3 className="text-sm font-medium text-neutral-400 mb-2">Status History</h3>
                    <HistoryFilterChips
                      showCompleted={historyShowCompleted}
                      showIncomplete={historyShowIncomplete}
                      onToggleCompleted={() => setHistoryShowCompleted(!historyShowCompleted)}
                      onToggleIncomplete={() => setHistoryShowIncomplete(!historyShowIncomplete)}
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <TaskHistory 
                      taskId={selectedTask._id} 
                      showCompleted={historyShowCompleted}
                      showIncomplete={historyShowIncomplete}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 pb-2 flex-shrink-0">
                <Button
                  onClick={() => {
                    toggleCompleted({ id: selectedTask._id as any });
                  }}
                  className={`w-full ${selectedTask.isCompleted 
                    ? "bg-neutral-700 hover:bg-neutral-600" 
                    : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {selectedTask.isCompleted ? "Mark as Incomplete" : "Mark as Complete"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default App;
