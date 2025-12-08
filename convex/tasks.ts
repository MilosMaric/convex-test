import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getAllUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const listAllWithHistoryCount = query({
  args: { 
    searchQuery: v.optional(v.string()),
    userIds: v.optional(v.array(v.id("users")))
  },
  handler: async (ctx, args) => {
    let tasks = await ctx.db.query("tasks").collect();
    
    // Filter by user IDs if provided
    if (args.userIds && args.userIds.length > 0) {
      tasks = tasks.filter(task => task.userId && args.userIds!.includes(task.userId));
    }
    
    // Filter by search query if provided
    if (args.searchQuery && args.searchQuery.trim()) {
      const query = args.searchQuery.toLowerCase().trim();
      tasks = tasks.filter(task => {
        const titleMatch = task.text.toLowerCase().includes(query);
        const descriptionMatch = task.description?.toLowerCase().includes(query) ?? false;
        return titleMatch || descriptionMatch;
      });
    }
    
    const tasksWithCount = await Promise.all(
      tasks.map(async (task) => {
        const history = await ctx.db
          .query("taskHistory")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .collect();
        return { ...task, historyCount: history.length };
      })
    );
    return tasksWithCount;
  },
});

export const toggleCompleted = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");
    const now = Date.now();
    const newStatus = !task.isCompleted;
    await ctx.db.patch(args.id, { isCompleted: newStatus, updatedAt: now });
    // Record history
    await ctx.db.insert("taskHistory", {
      taskId: args.id,
      changeType: "completion",
      changedTo: newStatus,
      changedAt: now,
    });
    return await ctx.db.get(args.id);
  },
});

export const toggleImportant = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");
    const now = Date.now();
    const newStatus = !task.isImportant;
    await ctx.db.patch(args.id, { 
      isImportant: newStatus, 
      updatedAt: now 
    });
    // Record history
    await ctx.db.insert("taskHistory", {
      taskId: args.id,
      changeType: "importance",
      changedTo: newStatus,
      changedAt: now,
    });
    return await ctx.db.get(args.id);
  },
});

export const getTaskHistory = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taskHistory")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();
  },
});

export const getLatestChanges = query({
  args: { 
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()), // changedAt timestamp for pagination
    userIds: v.optional(v.array(v.id("users"))),
    showCompleted: v.optional(v.boolean()),
    showIncomplete: v.optional(v.boolean()),
    showImportant: v.optional(v.boolean()),
    showNotImportant: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const cursor = args.cursor ?? Date.now();
    const hasAnyFilter = args.showCompleted !== undefined || args.showIncomplete !== undefined || 
                         args.showImportant !== undefined || args.showNotImportant !== undefined;
    const hasUserFilter = args.userIds && args.userIds.length > 0;
    
    // Build a set of allowed user IDs for quick lookup
    const allowedUserIds = hasUserFilter ? new Set(args.userIds) : null;
    
    // Query history directly using the changedAt index (much more efficient)
    // Fetch more than needed to account for filtering
    const fetchMultiplier = (hasAnyFilter || hasUserFilter) ? 10 : 2;
    const historyEntries = await ctx.db
      .query("taskHistory")
      .withIndex("by_changed_at", (q) => q.lt("changedAt", cursor))
      .order("desc")
      .take(limit * fetchMultiplier);
    
    if (historyEntries.length === 0) {
      return { changes: [], nextCursor: null, hasMore: false };
    }
    
    // Batch fetch all unique tasks referenced by these history entries
    const taskIds = [...new Set(historyEntries.map(e => e.taskId))];
    const tasks = await Promise.all(taskIds.map(id => ctx.db.get(id)));
    const taskMap = new Map(tasks.filter(t => t !== null).map(t => [t!._id, t!]));
    
    // Filter history entries
    let filteredEntries = historyEntries.filter(entry => {
      const task = taskMap.get(entry.taskId);
      if (!task) return false;
      
      // Filter by user if needed
      if (allowedUserIds && (!task.userId || !allowedUserIds.has(task.userId))) {
        return false;
      }
      
      // Filter by change type if filters are provided
      if (hasAnyFilter) {
        const isCompletionChange = !entry.changeType || entry.changeType === "completion";
        const isImportanceChange = entry.changeType === "importance";
        
        if (isCompletionChange) {
          if (args.showCompleted && entry.changedTo) return true;
          if (args.showIncomplete && !entry.changedTo) return true;
        }
        
        if (isImportanceChange) {
          if (args.showImportant && entry.changedTo) return true;
          if (args.showNotImportant && !entry.changedTo) return true;
        }
        
        return false;
      }
      
      return true;
    });
    
    // Take only what we need
    const pageHistory = filteredEntries.slice(0, limit);
    
    // Batch fetch users for the final results
    const userIdsNeeded = new Set<string>();
    pageHistory.forEach(entry => {
      const task = taskMap.get(entry.taskId);
      if (task?.userId) {
        userIdsNeeded.add(task.userId);
      }
    });
    
    const usersData = await Promise.all([...userIdsNeeded].map(id => ctx.db.get(id as any)));
    const usersMap = new Map<string, { _id: string; name: string; image?: string }>();
    usersData.forEach(u => {
      if (u) {
        const user = u as any;
        usersMap.set(user._id, { _id: user._id, name: user.name, image: user.image });
      }
    });
    
    // Build the result
    const changesWithTasks = pageHistory.map((entry) => {
      const task = taskMap.get(entry.taskId);
      if (!task) return null;
      
      const user = task.userId ? usersMap.get(task.userId) : null;
      
      return {
        ...entry,
        task: {
          _id: task._id,
          text: task.text,
        },
        user: user ? {
          _id: user._id,
          name: user.name,
          image: user.image,
        } : null,
      };
    }).filter(change => change !== null);
    
    // Calculate next cursor
    const nextCursor = pageHistory.length === limit && pageHistory.length > 0
      ? pageHistory[pageHistory.length - 1].changedAt
      : null;
    
    return {
      changes: changesWithTasks,
      nextCursor,
      hasMore: nextCursor !== null,
    };
  },
});

export const getChangesOverTime = query({
  args: {
    userIds: v.optional(v.array(v.id("users"))),
    days: v.optional(v.number()), // Number of days to look back (default 5)
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 5;
    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const endTime = Date.now();
    const hasUserFilter = args.userIds && args.userIds.length > 0;
    const allowedUserIds = hasUserFilter ? new Set(args.userIds!.map(id => id.toString())) : null;
    
    // Query history directly using the changedAt index (single indexed query)
    const historyEntries = await ctx.db
      .query("taskHistory")
      .withIndex("by_changed_at", (q) => q.gte("changedAt", startTime).lte("changedAt", endTime))
      .collect();
    
    // Batch fetch all unique tasks referenced by these history entries
    const taskIds = [...new Set(historyEntries.map(e => e.taskId))];
    const tasks = await Promise.all(taskIds.map(id => ctx.db.get(id)));
    const taskMap = new Map<string, { userId?: string }>();
    tasks.forEach(t => {
      if (t) taskMap.set(t._id, { userId: t.userId });
    });
    
    // Initialize all days in the range
    const dailyData: Record<string, Record<string, number>> = {};
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayKey = dayStart.toString();
      dailyData[dayKey] = {};
    }
    
    // Count changes per day per user
    for (const entry of historyEntries) {
      const task = taskMap.get(entry.taskId);
      if (!task?.userId) continue;
      
      // Filter by user if needed
      if (allowedUserIds && !allowedUserIds.has(task.userId.toString())) continue;
      
      // Get start of day (midnight) for this entry
      const entryDate = new Date(entry.changedAt);
      const dayStart = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate()).getTime();
      const dayKey = dayStart.toString();
      
      if (!dailyData[dayKey]) {
        dailyData[dayKey] = {};
      }
      dailyData[dayKey][task.userId] = (dailyData[dayKey][task.userId] || 0) + 1;
    }
    
    // Convert to array format, including all days in range
    const result = Object.entries(dailyData).map(([time, userCounts]) => ({
      time: parseInt(time),
      ...userCounts,
    }));
    
    return result.sort((a, b) => a.time - b.time);
  },
});
