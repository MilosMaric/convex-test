import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const getAllUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const get = query({
  args: { page: v.optional(v.number()), pageSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const page = args.page ?? 0;
    const pageSize = args.pageSize ?? 9;
    const allTasks = await ctx.db.query("tasks").collect();
    return allTasks.slice(page * pageSize, (page + 1) * pageSize);
  },
});

export const listPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .order("asc")
      .paginate(args.paginationOpts);
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

export const toggleAll = mutation({
  args: { ids: v.array(v.id("tasks")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      const task = await ctx.db.get(id);
      if (task) {
        const newStatus = !task.isCompleted;
        await ctx.db.patch(id, { isCompleted: newStatus, updatedAt: now });
        // Record history
        await ctx.db.insert("taskHistory", {
          taskId: id,
          changedTo: newStatus,
          changedAt: now,
        });
      }
    }
    return true;
  },
});

export const setAllCompleted = mutation({
  args: { ids: v.array(v.id("tasks")), value: v.boolean() },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      const task = await ctx.db.get(id);
      if (task && task.isCompleted !== args.value) {
        await ctx.db.patch(id, { isCompleted: args.value, updatedAt: now });
        // Record history only if status actually changed
        await ctx.db.insert("taskHistory", {
          taskId: id,
          changedTo: args.value,
          changedAt: now,
        });
      }
    }
    return true;
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
    const cursor = args.cursor ?? Date.now(); // Start from now if no cursor
    const maxTasksToCheck = 200; // Limit tasks we check to avoid reading too much
    
    // Get relevant tasks first (filtered by user if needed)
    let tasks = await ctx.db.query("tasks").collect();
    
    if (args.userIds && args.userIds.length > 0) {
      tasks = tasks.filter(task => task.userId && args.userIds!.includes(task.userId));
    }
    
    // Sort tasks by updatedAt descending and limit to avoid reading too much history
    tasks.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const recentTasks = tasks.slice(0, maxTasksToCheck);
    
    // Get history entries only for these recent tasks, filtered by cursor
    const allHistory: any[] = [];
    for (const task of recentTasks) {
      const history = await ctx.db
        .query("taskHistory")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .collect();
      // Filter by cursor (only get entries before the cursor timestamp)
      const filteredHistory = history.filter(entry => entry.changedAt < cursor);
      allHistory.push(...filteredHistory);
    }
    
    // Filter by change type if filters are provided
    let filteredHistory = allHistory;
    const hasAnyFilter = args.showCompleted !== undefined || args.showIncomplete !== undefined || 
                         args.showImportant !== undefined || args.showNotImportant !== undefined;
    
    if (hasAnyFilter) {
      filteredHistory = allHistory.filter(entry => {
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
      });
    }
    
    // Sort by changedAt descending and limit
    filteredHistory.sort((a, b) => b.changedAt - a.changedAt);
    const pageHistory = filteredHistory.slice(0, limit);
    
    // Create a map of task data for quick lookup
    const taskMap = new Map(recentTasks.map(t => [t._id, t]));
    
    // Fetch user details only for the final results
    const userIds = new Set<string>();
    pageHistory.forEach(entry => {
      const task = taskMap.get(entry.taskId);
      if (task?.userId) {
        userIds.add(task.userId);
      }
    });
    
    const usersMap = new Map();
    for (const userId of userIds) {
      const user = await ctx.db.get(userId as any);
      if (user) {
        usersMap.set(userId, user);
      }
    }
    
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
    
    // Calculate next cursor (oldest changedAt in this page, or null if no more)
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
    
    // Get all tasks (filtered by user if needed)
    let tasks = await ctx.db.query("tasks").collect();
    
    if (args.userIds && args.userIds.length > 0) {
      tasks = tasks.filter(task => task.userId && args.userIds!.includes(task.userId));
    }
    
    // Get all history entries for these tasks within the time range
    const allHistory: any[] = [];
    for (const task of tasks) {
      const history = await ctx.db
        .query("taskHistory")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .collect();
      const filteredHistory = history.filter(entry => 
        entry.changedAt >= startTime && entry.changedAt <= endTime
      );
      allHistory.push(...filteredHistory.map(entry => ({
        ...entry,
        userId: task.userId,
      })));
    }
    
    // Group by day and user
    const dailyData: Record<string, Record<string, number>> = {};
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Initialize all days in the range (last 5 days)
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayKey = dayStart.toString();
      dailyData[dayKey] = {};
    }
    
    // Count changes per day per user
    for (const entry of allHistory) {
      if (!entry.userId) continue;
      // Get start of day (midnight) for this entry
      const entryDate = new Date(entry.changedAt);
      const dayStart = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate()).getTime();
      const dayKey = dayStart.toString();
      
      if (!dailyData[dayKey]) {
        dailyData[dayKey] = {};
      }
      dailyData[dayKey][entry.userId] = (dailyData[dayKey][entry.userId] || 0) + 1;
    }
    
    // Convert to array format, including all days in range
    const result = Object.entries(dailyData).map(([time, userCounts]) => ({
      time: parseInt(time),
      ...userCounts,
    }));
    
    return result.sort((a, b) => a.time - b.time);
  },
});

export const completedCount = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").filter(q => q.eq(q.field("isCompleted"), true)).collect().then(tasks => tasks.length);
  },
});

export const completedCountOnPage = query({
  args: { page: v.optional(v.number()), pageSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const page = args.page ?? 0;
    const pageSize = args.pageSize ?? 9;
    const allTasks = await ctx.db.query("tasks").collect();
    const pageTasks = allTasks.slice(page * pageSize, (page + 1) * pageSize);
    return pageTasks.filter(task => task.isCompleted).length;
  },
});

export const totalCount = query({
  args: {},
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    return allTasks.length;
  },
});

export const backfillTimestamps = mutation({
  args: {},
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    const now = Date.now();
    let count = 0;
    for (const task of allTasks) {
      if (!task.createdAt || !task.updatedAt) {
        await ctx.db.patch(task._id, {
          createdAt: task.createdAt ?? now,
          updatedAt: task.updatedAt ?? now,
        });
        count++;
      }
    }
    return { updated: count };
  },
});

// Map of task titles to descriptions
const taskDescriptions: Record<string, string> = {
  "Buy groceries": "Pick up fresh vegetables, fruits, milk, bread and other essentials from the local supermarket for the week.",
  "Go for a swim": "Head to the community pool for a refreshing swim session to stay fit and healthy.",
  "Integrate Convex": "Set up Convex backend for real-time data synchronization and seamless database operations in the app.",
  "Walk the dog": "Take the dog out for a 30-minute walk around the neighborhood for exercise and fresh air.",
  "Walk the dog123": "Take the dog out for a morning stroll around the park, ensuring they get enough exercise today.",
  "Pay bills": "Review and pay all outstanding utility bills, credit cards, and subscription services before the due dates.",
  "Clean the house": "Do a thorough cleaning including vacuuming, mopping floors, dusting surfaces, and organizing cluttered areas.",
  "Call mom": "Have a catch-up phone call with mom to check in, share updates, and hear about her week.",
  "Read a book": "Spend some quiet time reading the current book, aiming to finish at least two chapters today.",
  "Go to the gym": "Complete a full workout session including cardio, strength training, and stretching exercises.",
  "Write report": "Draft and finalize the quarterly progress report with all relevant metrics and key achievements.",
  "Team meeting": "Attend the scheduled team sync to discuss project updates, blockers, and upcoming milestones.",
  "Code review": "Review pull requests from team members, provide constructive feedback, and approve ready changes.",
  "Fix bug": "Investigate and resolve the reported issue causing unexpected behavior in the application.",
  "Update docs": "Revise and improve the project documentation to reflect recent changes and new features.",
  "Plan sprint": "Organize and prioritize tasks for the upcoming sprint based on team capacity and goals.",
  "Deploy app": "Push the latest version to production after running all tests and getting final approval.",
  "Design mockup": "Create visual mockups for the new feature based on requirements and user feedback.",
  "Database backup": "Run a complete backup of all production databases and verify the integrity of backup files.",
  "Security audit": "Conduct a thorough review of security practices and address any identified vulnerabilities.",
};

// Generic descriptions for tasks not in the map
const genericDescriptions = [
  "Complete this important task efficiently and thoroughly to maintain productivity and meet deadlines.",
  "Focus on finishing this item with attention to detail and quality to ensure the best results.",
  "Tackle this task with dedication, breaking it down into smaller steps if needed for better progress.",
  "Work on this item systematically, ensuring all requirements are met and nothing is overlooked.",
  "Prioritize completing this task today to stay on track with your goals and commitments.",
  "Give this task your full attention to deliver quality results and move forward with the project.",
  "Address this item promptly to prevent any delays and keep everything running smoothly.",
  "Dedicate focused time to this task, eliminating distractions for maximum efficiency and output.",
];

export const backfillDescriptions = mutation({
  args: {},
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    let count = 0;
    let genericIndex = 0;
    
    for (const task of allTasks) {
      if (!task.description) {
        let description = taskDescriptions[task.text];
        
        if (!description) {
          // Use a generic description based on index
          description = genericDescriptions[genericIndex % genericDescriptions.length];
          genericIndex++;
        }
        
        await ctx.db.patch(task._id, { description });
        count++;
      }
    }
    return { updated: count };
  },
});

// Old estimateDuration removed - using new one below

export const backfillDurations = mutation({
  args: {},
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    let count = 0;
    
    for (const task of allTasks) {
      // Update all tasks with random duration between 1 and 300
      const duration = Math.floor(Math.random() * 300) + 1;
      await ctx.db.patch(task._id, { duration });
      count++;
    }
    return { updated: count };
  },
});

export const backfillRandomCreatedAt = mutation({
  args: {},
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const fiftyDaysMs = 50 * 24 * 60 * 60 * 1000;
    
    let count = 0;
    for (const task of allTasks) {
      // Random time between 3 and 50 days ago
      const randomDaysAgoMs = threeDaysMs + Math.random() * (fiftyDaysMs - threeDaysMs);
      const createdAt = now - randomDaysAgoMs;
      
      await ctx.db.patch(task._id, { createdAt });
      count++;
    }
    return { updated: count };
  },
});

// Task title templates for generating unique tasks
const taskVerbs = [
  "Review", "Update", "Create", "Design", "Implement", "Test", "Debug", "Refactor",
  "Document", "Analyze", "Research", "Plan", "Schedule", "Organize", "Clean",
  "Fix", "Optimize", "Deploy", "Configure", "Setup", "Install", "Migrate",
  "Backup", "Monitor", "Track", "Report", "Present", "Discuss", "Evaluate",
  "Approve", "Submit", "Complete", "Finalize", "Draft", "Edit", "Proofread",
  "Send", "Reply", "Follow up on", "Confirm", "Cancel", "Reschedule", "Book",
  "Order", "Purchase", "Return", "Exchange", "Inventory", "Stock", "Restock",
  "Prepare", "Cook", "Bake", "Wash", "Dry", "Iron", "Fold", "Sort", "File",
  "Archive", "Delete", "Remove", "Add", "Insert", "Attach", "Detach", "Connect",
  "Disconnect", "Sync", "Export", "Import", "Download", "Upload", "Share",
  "Publish", "Unpublish", "Hide", "Show", "Enable", "Disable", "Activate",
  "Deactivate", "Register", "Unregister", "Subscribe", "Unsubscribe", "Join",
  "Leave", "Invite", "Accept", "Decline", "Negotiate", "Sign", "Seal", "Stamp"
];

const taskNouns = [
  "project proposal", "quarterly report", "budget spreadsheet", "marketing campaign",
  "user feedback", "customer survey", "team meeting notes", "presentation slides",
  "API documentation", "database schema", "security audit", "performance metrics",
  "sales forecast", "inventory list", "employee handbook", "training materials",
  "client contract", "vendor agreement", "partnership deal", "press release",
  "blog post", "newsletter", "social media content", "video script", "podcast outline",
  "website redesign", "mobile app update", "server configuration", "network settings",
  "firewall rules", "backup procedures", "disaster recovery plan", "incident report",
  "bug tracker", "feature request", "user story", "sprint backlog", "release notes",
  "changelog", "roadmap", "milestone", "deadline", "timeline", "Gantt chart",
  "org chart", "flowchart", "wireframe", "mockup", "prototype", "MVP",
  "alpha version", "beta release", "production deployment", "hotfix", "patch",
  "upgrade", "downgrade", "rollback", "maintenance window", "outage notification",
  "status page", "health check", "load test", "stress test", "unit tests",
  "integration tests", "end-to-end tests", "code review", "pull request", "merge conflict",
  "branch strategy", "git workflow", "CI/CD pipeline", "Docker container", "Kubernetes cluster",
  "AWS resources", "Azure services", "GCP project", "database migration", "cache invalidation",
  "session management", "authentication flow", "authorization rules", "encryption keys",
  "SSL certificate", "DNS records", "domain transfer", "email templates", "notification settings",
  "webhook integration", "third-party API", "payment gateway", "subscription plan",
  "pricing page", "checkout flow", "shopping cart", "wishlist feature", "recommendation engine",
  "search functionality", "filter options", "sorting algorithm", "pagination logic",
  "lazy loading", "infinite scroll", "responsive design", "accessibility audit",
  "SEO optimization", "analytics dashboard", "conversion tracking", "A/B test",
  "user onboarding", "tutorial walkthrough", "help documentation", "FAQ section",
  "support tickets", "live chat", "chatbot responses", "knowledge base", "community forum"
];

const taskContexts = [
  "for the new client", "before the deadline", "for Q1 review", "for the annual meeting",
  "for the board presentation", "for the stakeholder update", "for the team sync",
  "for the product launch", "for the marketing push", "for the sales team",
  "for the engineering team", "for the design team", "for the support team",
  "for the HR department", "for the finance team", "for the legal review",
  "for the compliance check", "for the security team", "for the DevOps team",
  "for the QA team", "for the UX research", "for the data analysis",
  "for the machine learning model", "for the AI integration", "for the automation",
  "for the workflow improvement", "for the process optimization", "for the cost reduction",
  "for the efficiency gain", "for the quality improvement", "for the customer satisfaction",
  "for the user experience", "for the brand awareness", "for the market expansion",
  "for the international launch", "for the localization", "for the translation",
  "for the accessibility compliance", "for the GDPR requirements", "for the SOC2 audit",
  "for the ISO certification", "for the partner integration", "for the vendor onboarding",
  "for the contractor agreement", "for the freelancer project", "for the intern program",
  "for the mentorship initiative", "for the training session", "for the workshop",
  "for the conference", "for the webinar", "for the podcast episode", "for the video series"
];

function generateDescription(title: string): string {
  const descriptions = [
    `Complete ${title.toLowerCase()} with attention to detail and ensure all requirements are met before the deadline.`,
    `Work on ${title.toLowerCase()} systematically, documenting progress and any blockers encountered along the way.`,
    `Focus on ${title.toLowerCase()} to deliver high-quality results that meet stakeholder expectations.`,
    `Prioritize ${title.toLowerCase()} and coordinate with relevant team members for successful completion.`,
    `Handle ${title.toLowerCase()} efficiently while maintaining quality standards and best practices.`,
    `Execute ${title.toLowerCase()} following established guidelines and procedures for consistency.`,
    `Tackle ${title.toLowerCase()} with a structured approach, breaking it down into manageable subtasks.`,
    `Address ${title.toLowerCase()} promptly to avoid delays and ensure smooth project progression.`,
    `Manage ${title.toLowerCase()} effectively by setting clear milestones and tracking progress regularly.`,
    `Accomplish ${title.toLowerCase()} by collaborating with the team and leveraging available resources.`,
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

export const seedTasks = mutation({
  args: { count: v.number() },
  handler: async (ctx, args) => {
    const existingTasks = await ctx.db.query("tasks").collect();
    const existingTitles = new Set(existingTasks.map(t => t.text.toLowerCase()));
    
    const now = Date.now();
    const fiftyMonthsMs = 50 * 30 * 24 * 60 * 60 * 1000; // ~50 months
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    const fiveDaysAgo = now - fiveDaysMs;
    
    const generatedTitles = new Set<string>();
    let created = 0;
    let attempts = 0;
    const maxAttempts = args.count * 10; // Prevent infinite loop
    
    while (created < args.count && attempts < maxAttempts) {
      attempts++;
      
      // Generate a unique title
      const verb = taskVerbs[Math.floor(Math.random() * taskVerbs.length)];
      const noun = taskNouns[Math.floor(Math.random() * taskNouns.length)];
      const useContext = Math.random() > 0.5;
      const context = useContext ? " " + taskContexts[Math.floor(Math.random() * taskContexts.length)] : "";
      
      const title = `${verb} ${noun}${context}`;
      const titleLower = title.toLowerCase();
      
      // Skip if title already exists
      if (existingTitles.has(titleLower) || generatedTitles.has(titleLower)) {
        continue;
      }
      
      generatedTitles.add(titleLower);
      
      // Random createdAt in the past 50 months
      const createdAt = now - Math.random() * fiftyMonthsMs;
      
      // Random updatedAt between createdAt and 5 days ago
      const updatedAt = createdAt + Math.random() * (fiveDaysAgo - createdAt);
      
      // Random completion status
      const isCompleted = Math.random() > 0.5;
      
      // Generate description based on title
      const description = generateDescription(title);
      
      await ctx.db.insert("tasks", {
        text: title,
        description,
        isCompleted,
        createdAt,
        updatedAt,
        userId: undefined, // Old seedTasks doesn't use userId
      });
      
      created++;
    }
    
    return { created, attempts };
  },
});

// Naruto-themed tasks
const narutoTasks = [
  { title: "Master Rasengan Training", description: "Practice creating and maintaining the Rasengan for 3 hours straight without losing control" },
  { title: "Shadow Clone Jutsu Practice", description: "Create 100 shadow clones and maintain them for 30 minutes to improve chakra control" },
  { title: "Sage Mode Training", description: "Meditate at Mount Myoboku to gather natural energy and achieve perfect sage mode balance" },
  { title: "Rescue Mission: Find Sasuke", description: "Track down and bring back Sasuke from Orochimaru's hideout before he goes too far" },
  { title: "Protect Konoha Village", description: "Patrol the village perimeter and ensure all citizens are safe from any threats" },
  { title: "Learn Wind Style Jutsu", description: "Master wind chakra nature transformation and create new wind-based techniques" },
  { title: "Train with Kakashi Sensei", description: "Complete daily training session with Kakashi to improve taijutsu and ninjutsu skills" },
  { title: "Help Iruka Sensei", description: "Assist Iruka with academy students and help teach the next generation of ninja" },
  { title: "Master Nine-Tails Chakra", description: "Learn to control and work together with Kurama to access more powerful chakra modes" },
  { title: "Complete D-Rank Mission", description: "Help an elderly villager with daily chores and errands around Konoha" },
  { title: "Train with Jiraiya", description: "Learn advanced ninja techniques and life lessons from the legendary Sannin" },
  { title: "Defeat Pain", description: "Protect Konoha from Pain's invasion and save all the villagers from destruction" },
  { title: "Master Six Paths Sage Mode", description: "Achieve the ultimate form by combining sage mode with Six Paths chakra" },
  { title: "Save Gaara", description: "Rescue Gaara from the Akatsuki and bring him back to the Sand Village safely" },
  { title: "Learn Talk No Jutsu", description: "Master the art of understanding and connecting with others to resolve conflicts peacefully" },
  { title: "Train with Might Guy", description: "Complete intense physical training to build strength and endurance like a true shinobi" },
  { title: "Protect Team 7", description: "Ensure Sakura and Sasuke are safe during dangerous missions and support them in battle" },
  { title: "Master Flying Thunder God", description: "Learn Minato's signature teleportation technique to move instantly across the battlefield" },
  { title: "Defeat Madara Uchiha", description: "Face the legendary shinobi and protect the entire shinobi world from his Infinite Tsukuyomi" },
  { title: "Become Hokage", description: "Work hard every day to achieve the dream of becoming the greatest Hokage Konoha has ever seen" },
  { title: "Save the Shinobi Alliance", description: "Unite all five great nations and lead them to victory in the Fourth Great Ninja War" },
  { title: "Master Tailed Beast Bomb", description: "Learn to combine chakra with Kurama to create devastating tailed beast bomb attacks" },
  { title: "Train with Killer Bee", description: "Learn perfect jinchuriki control and master the art of working with tailed beasts" },
  { title: "Protect Hinata", description: "Keep Hinata safe during missions and show her that her feelings are important" },
  { title: "Master Multi-Shadow Clone Jutsu", description: "Create thousands of shadow clones to overwhelm enemies and gather information quickly" },
  { title: "Learn Summoning Jutsu", description: "Master the art of summoning toads from Mount Myoboku to aid in battle" },
  { title: "Complete Chunin Exams", description: "Pass all three stages of the Chunin Exams and prove readiness for higher rank missions" },
  { title: "Defeat Kaguya Otsutsuki", description: "Face the ultimate threat and seal away the progenitor of chakra to save the world" },
  { title: "Train with Hagoromo", description: "Learn from the Sage of Six Paths and receive the ultimate power to protect everyone" },
  { title: "Master Truth-Seeking Balls", description: "Learn to create and control the powerful truth-seeking balls using Six Paths chakra" },
  { title: "Protect Boruto", description: "Guide and protect the next generation, especially your son Boruto, as he grows as a ninja" },
  { title: "Maintain Peace Between Villages", description: "Work as Hokage to ensure lasting peace and cooperation between all ninja villages" },
  { title: "Train with Shikamaru", description: "Practice strategic thinking and teamwork with the smartest ninja in Konoha" },
  { title: "Master Rasenshuriken", description: "Perfect the ultimate wind-style technique that combines Rasengan with wind chakra nature" },
  { title: "Save the Jinchuriki", description: "Rescue all tailed beast hosts from Akatsuki and prevent the extraction of tailed beasts" },
  { title: "Learn Medical Ninjutsu", description: "Study healing techniques to help injured comrades and civilians during missions" },
  { title: "Master Chakra Chains", description: "Learn to use chakra chains like Kushina to restrain and control powerful enemies" },
  { title: "Defeat Obito Uchiha", description: "Face your former friend and bring him back from the darkness to save the world" },
  { title: "Train with Tsunade", description: "Learn from the Fifth Hokage about leadership, strength, and protecting what matters most" },
  { title: "Master Baryon Mode", description: "Achieve the ultimate power by combining Kurama's chakra with your own in perfect harmony" },
  { title: "Protect Konoha from Pain", description: "Face the leader of Akatsuki and prevent the destruction of your beloved village" },
  { title: "Learn to Control Kurama", description: "Build a true partnership with the Nine-Tails and work together as equals" },
  { title: "Complete S-Rank Mission", description: "Take on the most dangerous missions to protect Konoha and prove your worth as a ninja" },
  { title: "Master Sage Art Techniques", description: "Combine sage mode with various jutsu to create powerful sage art attacks" },
  { title: "Train with Rock Lee", description: "Push your physical limits through intense training and never give up on your goals" },
  { title: "Save the World", description: "Protect everyone you care about and ensure a future where peace and understanding prevail" },
];

export const updateAllTasksToNaruto = mutation({
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    let updated = 0;
    
    for (let i = 0; i < allTasks.length; i++) {
      const task = allTasks[i];
      const narutoTask = narutoTasks[i % narutoTasks.length];
      
      await ctx.db.patch(task._id, {
        text: narutoTask.title,
        description: narutoTask.description,
      });
      
      updated++;
    }
    
    return { updated, total: allTasks.length };
  },
});

// Backfill task history
export const backfillTaskHistory = mutation({
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    const now = Date.now();
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1).getTime(); // January 1st of current year
    
    let tasksBackfilled = 0;
    let totalHistoryItems = 0;
    
    for (let i = 0; i < allTasks.length; i++) {
      // Skip every 4th task (index 3, 7, 11, etc.)
      if (i % 4 === 3) {
        continue;
      }
      
      const task = allTasks[i];
      
      // Generate random number of history items (5-50)
      const historyCount = Math.floor(Math.random() * 46) + 5; // 5 to 50 inclusive
      
      // Generate history items
      for (let j = 0; j < historyCount; j++) {
        // Random change type: "completion" or "importance"
        const changeType = Math.random() < 0.5 ? "completion" : "importance";
        
        // Random value: true or false
        const changedTo = Math.random() < 0.5;
        
        // Random datetime in this year up to today
        const randomTimestamp = Math.floor(Math.random() * (now - yearStart + 1)) + yearStart;
        
        await ctx.db.insert("taskHistory", {
          taskId: task._id,
          changeType,
          changedTo,
          changedAt: randomTimestamp,
        });
        
        totalHistoryItems++;
      }
      
      tasksBackfilled++;
    }
    
    return {
      tasksBackfilled,
      totalHistoryItems,
      totalTasks: allTasks.length,
    };
  },
});

// Truncate all tables
export const truncateAllTables = mutation({
  handler: async (ctx) => {
    // Delete all task history
    const allHistory = await ctx.db.query("taskHistory").collect();
    for (const history of allHistory) {
      await ctx.db.delete(history._id);
    }
    
    // Delete all tasks
    const allTasks = await ctx.db.query("tasks").collect();
    for (const task of allTasks) {
      await ctx.db.delete(task._id);
    }
    
    // Delete all users
    const allUsers = await ctx.db.query("users").collect();
    for (const user of allUsers) {
      await ctx.db.delete(user._id);
    }
    
    return {
      deletedHistory: allHistory.length,
      deletedTasks: allTasks.length,
      deletedUsers: allUsers.length,
    };
  },
});

// Add users
export const addUsers = mutation({
  handler: async (ctx) => {
    const userNames = ["Naruto", "Sasuke", "Sakura", "Kakashi", "Hinata", "Jiraya", "Rock Lee", "Shikamaru", "Konohamaru"];
    const userIds: Record<string, string> = {};
    
    for (const name of userNames) {
      const userId = await ctx.db.insert("users", { name });
      userIds[name] = userId;
    }
    
    return { userIds, count: userNames.length };
  },
});

// Generate duration as random number between 1 and 300 minutes
function estimateDuration(title: string, description: string): number {
  return Math.floor(Math.random() * 300) + 1; // Random between 1 and 300
}

// Character-specific tasks
const characterTasks: Record<string, Array<{ title: string; description: string }>> = {
  Naruto: [
    { title: "Master Rasengan", description: "Perfect the spiral chakra technique taught by Jiraiya and learn to control the rotating energy without a shadow clone" },
    { title: "Befriend Kurama", description: "Build trust with the Nine-Tailed Fox and learn to work together as partners instead of being controlled by the beast" },
    { title: "Learn Sage Mode", description: "Train at Mount Myoboku to master natural energy and become a Sage capable of sensing and using nature's chakra" },
    { title: "Protect Konoha", description: "Defend the Hidden Leaf Village from any threats and ensure the safety of all villagers and fellow ninja" },
    { title: "Become Hokage", description: "Work towards achieving the dream of becoming the leader of Konoha and protecting everyone in the village" },
    { title: "Master Shadow Clone Jutsu", description: "Perfect the ability to create thousands of shadow clones for training, combat, and information gathering" },
    { title: "Save Sasuke", description: "Bring back Sasuke from the darkness and help him find his way back to the village and his friends" },
    { title: "Learn Wind Style", description: "Master wind nature transformation and combine it with Rasengan to create powerful new techniques" },
    { title: "Defeat Pain", description: "Face the leader of Akatsuki and protect Konoha from destruction while finding a way to end the cycle of hatred" },
    { title: "Master Tailed Beast Bomb", description: "Learn to combine Kurama's chakra with your own to create devastating tailed beast bomb attacks" },
    { title: "Train with Jiraiya", description: "Learn advanced ninja techniques, life lessons, and the way of the ninja from the legendary Sannin" },
    { title: "Protect Hinata", description: "Keep Hinata safe during missions and show her that her feelings are important and valued" },
    { title: "Master Six Paths Sage Mode", description: "Achieve the ultimate form by combining sage mode with Six Paths chakra from Hagoromo" },
    { title: "Defeat Kaguya", description: "Face the ultimate threat and seal away the progenitor of chakra to save the entire world from destruction" },
    { title: "Learn Truth-Seeking Balls", description: "Master the creation and control of truth-seeking balls using Six Paths chakra and understand their power" },
    { title: "Master Baryon Mode", description: "Achieve the ultimate power by combining Kurama's chakra with your own in perfect harmony for maximum strength" },
    { title: "Complete Chunin Exams", description: "Pass all three stages of the Chunin Exams and prove readiness for higher rank missions and responsibilities" },
    { title: "Learn Rasenshuriken", description: "Perfect the ultimate wind-style technique that combines Rasengan with wind chakra nature transformation" },
    { title: "Protect Iruka Sensei", description: "Ensure the safety of your first teacher who believed in you and helped shape your ninja path" },
    { title: "Master Multi-Shadow Clone Jutsu", description: "Create thousands of shadow clones to overwhelm enemies and gather information quickly in battle" },
    { title: "Learn to Control Nine-Tails", description: "Gain control over the Nine-Tailed Fox's chakra without losing yourself to the beast's rage" },
    { title: "Defeat Madara", description: "Face the legendary Uchiha and stop his plan to cast the Infinite Tsukuyomi on the entire world" },
    { title: "Master Frog Kumite", description: "Learn the unique taijutsu style from the toads at Mount Myoboku that uses natural energy" },
    { title: "Protect Team 7", description: "Keep Sakura and Sasuke safe during missions and always bring your team back home together" },
    { title: "Learn Flying Thunder God", description: "Master the space-time ninjutsu technique to instantly teleport to marked locations during combat" },
    { title: "Defeat Obito", description: "Face the masked man and help him break free from the darkness that consumed his heart" },
    { title: "Master Chakra Chains", description: "Learn to use chakra chains like Kushina to restrain and control powerful enemies in battle" },
    { title: "Protect the Next Generation", description: "Guide and protect Boruto and the new generation of ninja as they grow and learn" },
    { title: "Master Talk No Jutsu", description: "Use your ability to understand others and help them find their way back from darkness through words" },
    { title: "Achieve Peace", description: "Work towards creating a world where all ninja villages can coexist in harmony without constant war" },
  ],
  Sasuke: [
    { title: "Master Sharingan", description: "Awaken and fully develop the Uchiha clan's kekkei genkai to see through techniques and copy jutsu" },
    { title: "Awaken Mangekyo Sharingan", description: "Experience the pain of loss and unlock the ultimate form of the Sharingan with devastating powers" },
    { title: "Learn Chidori", description: "Master Kakashi's signature lightning technique and make it your own with perfect chakra control" },
    { title: "Defeat Itachi", description: "Face your older brother and seek revenge for the massacre of the Uchiha clan" },
    { title: "Master Susanoo", description: "Unlock the ultimate defense and offense technique that manifests as a giant warrior made of chakra" },
    { title: "Learn Amaterasu", description: "Master the black flames that burn everything and cannot be extinguished until the target is destroyed" },
    { title: "Awaken Rinnegan", description: "Obtain the ultimate dojutsu by combining Indra and Asura's chakra to see the truth of all things" },
    { title: "Master Lightning Style", description: "Perfect all lightning nature transformation techniques and create new powerful jutsu variations" },
    { title: "Defeat Orochimaru", description: "Overcome the snake sannin and free yourself from his influence and experiments" },
    { title: "Protect Sakura", description: "Keep Sakura safe and show her that you care about her despite your cold exterior" },
    { title: "Master Fire Style", description: "Perfect all fire nature transformation techniques passed down through the Uchiha clan" },
    { title: "Learn Space-Time Ninjutsu", description: "Master the ability to create portals and teleport using your Rinnegan powers" },
    { title: "Defeat Danzo", description: "Face the corrupt leader of Root and avenge the Uchiha clan for their massacre" },
    { title: "Master Kenjutsu", description: "Perfect your sword skills and become an unmatched master of blade combat" },
    { title: "Learn Genjutsu", description: "Master the art of illusion techniques using your Sharingan to trap enemies in false realities" },
    { title: "Protect Naruto", description: "Work together with Naruto to protect the village and acknowledge him as your friend and rival" },
    { title: "Master Chidori Variations", description: "Create new forms of Chidori including Chidori Stream, Chidori Sharp Spear, and Chidori Senbon" },
    { title: "Learn Kirin", description: "Master the ultimate lightning technique that calls down natural lightning from the sky" },
    { title: "Defeat Deidara", description: "Face the explosive artist and prove that your Sharingan can see through any technique" },
    { title: "Master Taijutsu", description: "Perfect your hand-to-hand combat skills and combine them with your Sharingan's predictive abilities" },
    { title: "Learn to Control Curse Mark", description: "Master the power of Orochimaru's curse mark without losing yourself to its influence" },
    { title: "Protect Team Taka", description: "Lead and protect your team of rogue ninja while pursuing your goals" },
    { title: "Master Amenotejikara", description: "Learn to instantly swap positions with objects or people using your Rinnegan's unique ability" },
    { title: "Defeat Kaguya", description: "Work with Naruto to seal away the progenitor of chakra and save the world" },
    { title: "Learn Truth-Seeking Balls", description: "Master the creation and control of truth-seeking orbs using Six Paths chakra" },
    { title: "Protect Sarada", description: "Be a father to Sarada and protect her as she grows into a strong ninja" },
    { title: "Master Indra's Arrow", description: "Learn the ultimate technique passed down from Indra Otsutsuki" },
    { title: "Learn to Forgive", description: "Let go of hatred and learn to trust others again after years of seeking revenge" },
    { title: "Master All Five Elements", description: "Learn to use all five basic nature transformations with perfect mastery" },
    { title: "Become a True Ninja", description: "Find your own path as a ninja and protect what matters most without being consumed by darkness" },
  ],
  Sakura: [
    { title: "Master Medical Ninjutsu", description: "Become the greatest medical ninja in Konoha and learn to heal any injury or illness" },
    { title: "Learn Chakra Enhanced Strength", description: "Perfect the ability to focus chakra into your fists for devastating physical attacks" },
    { title: "Master Genjutsu", description: "Develop your natural talent for genjutsu and learn to break free from any illusion" },
    { title: "Train with Tsunade", description: "Learn from the Fifth Hokage about medical techniques, leadership, and protecting what matters" },
    { title: "Master Creation Rebirth", description: "Learn Tsunade's ultimate technique to instantly regenerate any injury by storing chakra" },
    { title: "Protect Naruto and Sasuke", description: "Support your teammates and prove that you're not just a burden but a valuable team member" },
    { title: "Learn Strength of a Hundred", description: "Master the technique to store massive amounts of chakra in your forehead seal" },
    { title: "Master Chakra Scalpel", description: "Perfect the ability to use chakra as a surgical tool for precise medical procedures" },
    { title: "Defeat Sasori", description: "Face the puppet master and prove your strength by defeating an Akatsuki member" },
    { title: "Master Poison Resistance", description: "Develop immunity to poisons and learn to identify and treat any toxic substance" },
    { title: "Learn Mystical Palm Technique", description: "Master the ability to heal injuries by channeling chakra through your hands" },
    { title: "Protect Ino", description: "Maintain your friendship with Ino and work together as strong kunoichi" },
    { title: "Master Cherry Blossom Impact", description: "Perfect the technique to create massive shockwaves by striking the ground with chakra" },
    { title: "Learn to Control Chakra", description: "Develop perfect chakra control to become an expert medical ninja and fighter" },
    { title: "Master Byakugou Seal", description: "Create and maintain the seal that stores years of accumulated chakra for emergency use" },
    { title: "Protect Sarada", description: "Raise Sarada as a single mother and teach her to be strong and independent" },
    { title: "Master All Medical Techniques", description: "Learn every medical ninjutsu technique and become the best healer in the world" },
    { title: "Learn to Fight", description: "Develop your combat skills so you can protect yourself and others without relying on teammates" },
    { title: "Master Chakra Threads", description: "Learn to manipulate objects and puppets using chakra threads like a puppet master" },
    { title: "Protect Konoha Hospital", description: "Ensure the safety of all patients and medical staff during any crisis" },
    { title: "Learn Advanced Diagnosis", description: "Master the ability to instantly diagnose any medical condition using chakra sensing" },
    { title: "Master Regeneration Technique", description: "Learn to regenerate lost limbs and organs using advanced medical ninjutsu" },
    { title: "Protect the Next Generation", description: "Guide and protect the new generation of medical ninja as they learn and grow" },
    { title: "Master Poison Creation", description: "Learn to create and use poisons effectively for both medical and combat purposes" },
    { title: "Learn to Work Alone", description: "Develop independence and prove you can handle missions without always needing backup" },
    { title: "Master Chakra Knife", description: "Perfect the technique to create and throw chakra-infused knives with precision" },
    { title: "Protect Team 7", description: "Support Naruto and Sasuke as the team's medical ninja and emotional anchor" },
    { title: "Master All Five Elements", description: "Learn to use all basic nature transformations to become a well-rounded ninja" },
    { title: "Learn to Lead", description: "Develop leadership skills and become capable of leading missions and teams" },
    { title: "Become the Best Medical Ninja", description: "Surpass even Tsunade and become the greatest medical ninja in history" },
  ],
  Kakashi: [
    { title: "Master Sharingan", description: "Perfect the use of your borrowed Sharingan and learn to copy thousands of jutsu" },
    { title: "Teach Team 7", description: "Guide Naruto, Sasuke, and Sakura to become strong ninja and protect them as they grow" },
    { title: "Master Chidori", description: "Perfect your signature lightning technique and teach it to worthy students" },
    { title: "Learn Mangekyo Sharingan", description: "Awaken the ultimate form of Sharingan and master Kamui's space-time abilities" },
    { title: "Protect Konoha", description: "Serve as a loyal ninja of the Hidden Leaf and protect the village from all threats" },
    { title: "Master Lightning Style", description: "Perfect all lightning nature transformation techniques and create new variations" },
    { title: "Learn Kamui", description: "Master the ability to send objects and people to another dimension using your Mangekyo" },
    { title: "Defeat Obito", description: "Face your former teammate and help him find his way back from the darkness" },
    { title: "Master All Five Elements", description: "Learn to use all basic nature transformations with perfect mastery" },
    { title: "Protect the Next Generation", description: "Guide and protect the new generation of ninja as the Sixth Hokage" },
    { title: "Master Taijutsu", description: "Perfect your hand-to-hand combat skills and teach them to your students" },
    { title: "Learn to Use Both Kamui", description: "Master both long-range and short-range Kamui abilities for maximum effectiveness" },
    { title: "Defeat Zabuza", description: "Face the Demon of the Hidden Mist and protect your students during their first real mission" },
    { title: "Master Genjutsu", description: "Perfect the art of illusion techniques and learn to break free from any genjutsu" },
    { title: "Learn Purple Lightning", description: "Create a new lightning technique after losing your Sharingan that doesn't require it" },
    { title: "Protect Rin", description: "Remember and honor Rin's memory while learning to move forward from the past" },
    { title: "Master Ninja Tools", description: "Perfect the use of all ninja tools and weapons for maximum combat effectiveness" },
    { title: "Learn to Lead", description: "Develop leadership skills and become worthy of the Hokage position" },
    { title: "Master Shadow Clone Jutsu", description: "Perfect the ability to create multiple clones for training and combat" },
    { title: "Protect Minato's Legacy", description: "Honor the Fourth Hokage's memory by protecting Naruto and teaching him well" },
    { title: "Master Earth Style", description: "Perfect all earth nature transformation techniques for defense and offense" },
    { title: "Learn Water Style", description: "Master all water nature transformation techniques learned from Zabuza" },
    { title: "Defeat Pain", description: "Face the leader of Akatsuki and protect Konoha alongside your students" },
    { title: "Master Fire Style", description: "Perfect all fire nature transformation techniques for powerful offensive attacks" },
    { title: "Learn Wind Style", description: "Master wind nature transformation to complement your lightning techniques" },
    { title: "Protect Iruka", description: "Support your fellow teacher and ensure the safety of Konoha's academy students" },
    { title: "Master Susanoo", description: "Learn to manifest the ultimate defense technique using your Mangekyo Sharingan" },
    { title: "Learn to Read Icha Icha", description: "Find time to read your favorite book series even during the busiest missions" },
    { title: "Master All Jutsu", description: "Copy and master over a thousand different jutsu using your Sharingan" },
    { title: "Become the Best Teacher", description: "Guide your students to surpass you and become stronger than the previous generation" },
  ],
  Hinata: [
    { title: "Master Byakugan", description: "Perfect the use of the Hyuga clan's kekkei genkai to see chakra and 360-degree vision" },
    { title: "Learn Gentle Fist", description: "Master the Hyuga clan's unique taijutsu style that attacks the chakra network directly" },
    { title: "Protect Naruto", description: "Always watch over Naruto and be ready to protect him whenever he needs help" },
    { title: "Master Eight Trigrams", description: "Perfect the Hyuga clan's ultimate technique to strike all 361 tenketsu points" },
    { title: "Overcome Shyness", description: "Build confidence and learn to speak up for yourself and express your feelings" },
    { title: "Master Twin Lion Fists", description: "Learn the advanced Gentle Fist technique that creates chakra lions from your hands" },
    { title: "Protect Hanabi", description: "Support your younger sister and help her grow into a strong Hyuga clan member" },
    { title: "Master Rotation", description: "Perfect the defensive technique that creates a spinning barrier of chakra" },
    { title: "Learn to Lead", description: "Develop leadership skills to one day lead the Hyuga clan as its head" },
    { title: "Protect Neji", description: "Help your cousin break free from the curse seal and find his own path" },
    { title: "Master Air Palm", description: "Perfect the technique to release chakra from your palms as a long-range attack" },
    { title: "Learn Medical Ninjutsu", description: "Develop healing abilities to support your teammates during missions" },
    { title: "Master Byakugan's Range", description: "Extend the range of your Byakugan vision to see further and more clearly" },
    { title: "Protect Boruto and Himawari", description: "Raise your children to be strong and kind while protecting them from harm" },
    { title: "Master Vacuum Palm", description: "Learn the technique to create powerful vacuum attacks using chakra manipulation" },
    { title: "Overcome Main Branch Prejudice", description: "Work to change the Hyuga clan's traditions and treat branch family members equally" },
    { title: "Master Chakra Scalpel", description: "Perfect the medical technique to use chakra as a precise surgical tool" },
    { title: "Learn to Fight Confidently", description: "Develop self-confidence in battle and trust in your own abilities" },
    { title: "Master Eight Trigrams Sixty-Four Palms", description: "Perfect the technique to strike 64 tenketsu points in rapid succession" },
    { title: "Protect the Hyuga Clan", description: "Ensure the safety and prosperity of your clan while working for positive change" },
    { title: "Master Gentle Step Twin Lion Fists", description: "Learn the ultimate Gentle Fist technique combining speed and power" },
    { title: "Learn to Express Feelings", description: "Overcome your shyness and learn to tell Naruto how you truly feel" },
    { title: "Master Byakugan's Penetration", description: "Develop the ability to see through objects and detect hidden enemies" },
    { title: "Protect Konoha", description: "Serve as a loyal ninja of the Hidden Leaf and protect the village alongside Naruto" },
    { title: "Master All Gentle Fist Techniques", description: "Learn every technique in the Hyuga clan's Gentle Fist style" },
    { title: "Learn to Work with Team 8", description: "Perfect teamwork with Kiba and Shino to become an effective squad" },
    { title: "Master Chakra Sensing", description: "Develop the ability to sense chakra from great distances using your Byakugan" },
    { title: "Protect the Next Generation", description: "Guide and protect young Hyuga clan members as they learn and grow" },
    { title: "Master Eight Trigrams One Hundred Twenty-Eight Palms", description: "Perfect the ultimate technique to strike all tenketsu points" },
    { title: "Become a Strong Kunoichi", description: "Prove that you're not weak and can protect those you care about" },
  ],
  Jiraya: [
    { title: "Write Icha Icha Series", description: "Complete the next volume of your popular adult novel series that everyone secretly reads" },
    { title: "Train Naruto", description: "Teach Naruto to control the Nine-Tails and master powerful techniques like Rasengan" },
    { title: "Master Sage Mode", description: "Perfect the ability to use natural energy from Mount Myoboku for enhanced power" },
    { title: "Spy on Akatsuki", description: "Gather intelligence on the Akatsuki organization and their plans to capture tailed beasts" },
    { title: "Master Toad Summoning", description: "Perfect the ability to summon giant toads from Mount Myoboku for combat support" },
    { title: "Protect Konoha", description: "Serve as one of the Legendary Sannin and protect the Hidden Leaf Village from threats" },
    { title: "Learn Rasengan", description: "Master the spiral chakra technique and teach it to worthy students like Naruto" },
    { title: "Master All Five Elements", description: "Learn to use all basic nature transformations with perfect mastery" },
    { title: "Defeat Pain", description: "Face your former student and try to bring him back from the path of destruction" },
    { title: "Master Frog Kumite", description: "Perfect the unique taijutsu style that uses natural energy from the toads" },
    { title: "Spy on Hot Springs", description: "Conduct important research at various hot springs for your novels" },
    { title: "Protect Tsunade", description: "Keep your teammate and friend safe while she serves as the Fifth Hokage" },
    { title: "Master Barrier Techniques", description: "Learn to create powerful barriers to trap enemies and protect allies" },
    { title: "Learn to Predict the Future", description: "Use your knowledge and experience to foresee potential threats and outcomes" },
    { title: "Master Fire Style", description: "Perfect all fire nature transformation techniques for powerful offensive attacks" },
    { title: "Protect the Next Generation", description: "Train and guide young ninja to become strong and protect the future" },
    { title: "Master Earth Style", description: "Perfect all earth nature transformation techniques for defense and offense" },
    { title: "Learn Water Style", description: "Master all water nature transformation techniques for versatile combat options" },
    { title: "Master Genjutsu", description: "Perfect the art of illusion techniques to trap and confuse enemies" },
    { title: "Protect Orochimaru's Legacy", description: "Remember your former teammate and ensure his research doesn't fall into wrong hands" },
    { title: "Master Toad Oil Bullet", description: "Perfect the technique to spit flammable oil and combine it with fire style" },
    { title: "Learn to Lead", description: "Develop leadership skills and guide missions as one of the Legendary Sannin" },
    { title: "Master Shadow Clone Jutsu", description: "Perfect the ability to create multiple clones for training and combat" },
    { title: "Protect Minato's Son", description: "Watch over Naruto and ensure he grows up strong and protected" },
    { title: "Master All Jutsu", description: "Learn and master a vast array of techniques to become a versatile fighter" },
    { title: "Learn to Write Better", description: "Improve your writing skills and create even more popular novels" },
    { title: "Master Sealing Techniques", description: "Learn powerful sealing jutsu to trap enemies and tailed beasts" },
    { title: "Protect the Tailed Beasts", description: "Ensure the safety of all jinchuriki and prevent Akatsuki from capturing them" },
    { title: "Master Sage Art Techniques", description: "Combine sage mode with various jutsu to create powerful new techniques" },
    { title: "Become the Best Teacher", description: "Train students to surpass you and become stronger than the previous generation" },
  ],
  "Rock Lee": [
    { title: "Master Taijutsu", description: "Perfect your hand-to-hand combat skills and become the strongest taijutsu user in Konoha" },
    { title: "Open the Eight Gates", description: "Train to safely open all eight inner gates and unleash your full physical potential" },
    { title: "Train with Might Guy", description: "Learn from your sensei and follow the path of hard work and determination" },
    { title: "Master Drunken Fist", description: "Perfect the unpredictable fighting style that makes you even more dangerous in combat" },
    { title: "Protect Neji and Tenten", description: "Support your teammates and ensure Team Guy always completes missions successfully" },
    { title: "Master Primary Lotus", description: "Perfect the ultimate taijutsu technique that combines speed, power, and precision" },
    { title: "Learn to Use Ninja Tools", description: "Master weapons and tools despite not being able to use ninjutsu or genjutsu" },
    { title: "Defeat Gaara", description: "Face the jinchuriki of the One-Tail and prove that hard work can overcome natural talent" },
    { title: "Master Secondary Lotus", description: "Perfect the advanced taijutsu technique that builds upon the Primary Lotus" },
    { title: "Protect Konoha", description: "Serve as a loyal ninja of the Hidden Leaf and protect the village with your strength" },
    { title: "Master Front Lotus", description: "Perfect the technique that combines high-speed movement with devastating strikes" },
    { title: "Learn to Overcome Limitations", description: "Prove that you can become a great ninja even without ninjutsu or genjutsu" },
    { title: "Master Reverse Lotus", description: "Perfect the defensive technique that uses your opponent's momentum against them" },
    { title: "Protect the Next Generation", description: "Train and guide young ninja to understand the value of hard work" },
    { title: "Master All Taijutsu Styles", description: "Learn every taijutsu technique and become an unmatched hand-to-hand fighter" },
    { title: "Learn to Lead", description: "Develop leadership skills and become capable of leading missions and teams" },
    { title: "Master Konoha's Strongest Kick", description: "Perfect the ultimate kicking technique that can shatter any defense" },
    { title: "Protect Might Guy", description: "Support your sensei and ensure he never gives up on his dreams" },
    { title: "Master Speed Techniques", description: "Develop incredible speed through pure physical training and determination" },
    { title: "Learn to Work with Team Guy", description: "Perfect teamwork with Neji and Tenten to become an unstoppable squad" },
    { title: "Master Strength Training", description: "Build incredible physical strength through endless hours of training and dedication" },
    { title: "Protect the Youth", description: "Inspire young ninja to work hard and never give up on their dreams" },
    { title: "Master All Eight Gates", description: "Learn to safely open each of the eight inner gates for maximum power" },
    { title: "Learn to Fight Without Limits", description: "Push past your physical limits and achieve feats thought impossible" },
    { title: "Master Combo Techniques", description: "Perfect combination attacks that chain multiple taijutsu moves together" },
    { title: "Protect the Springtime of Youth", description: "Maintain the spirit of youth and passion that drives you forward" },
    { title: "Master Endurance", description: "Develop incredible stamina to fight for extended periods without tiring" },
    { title: "Learn to Inspire Others", description: "Motivate others through your example of hard work and determination" },
    { title: "Master All Physical Techniques", description: "Learn every physical technique possible to become the ultimate taijutsu master" },
    { title: "Become a True Ninja", description: "Prove that you can be a great ninja through hard work alone" },
  ],
  Shikamaru: [
    { title: "Master Shadow Possession", description: "Perfect the Nara clan's signature technique to control enemies through their shadows" },
    { title: "Develop Strategies", description: "Create complex battle plans and strategies with an IQ over 200" },
    { title: "Protect Asuma", description: "Support your sensei and learn from him about protecting the next generation" },
    { title: "Master Shadow Strangle", description: "Perfect the technique to strangle enemies using shadow manipulation" },
    { title: "Learn to Lead", description: "Develop leadership skills and become capable of leading missions and teams" },
    { title: "Master Shadow Sewing", description: "Perfect the technique to bind multiple enemies using shadow threads" },
    { title: "Protect Choji and Ino", description: "Support your teammates and ensure Team 10 always succeeds together" },
    { title: "Master Shadow Imitation", description: "Perfect the ability to make enemies copy your movements through shadow control" },
    { title: "Learn Advanced Tactics", description: "Develop even more complex strategies to outthink any opponent" },
    { title: "Protect Temari", description: "Support your wife and partner from the Sand Village during missions" },
    { title: "Master Shadow Neck Bind", description: "Perfect the technique to bind enemies' necks using shadow manipulation" },
    { title: "Learn to Work Efficiently", description: "Find ways to complete missions with minimal effort and maximum effectiveness" },
    { title: "Master All Shadow Techniques", description: "Learn every technique in the Nara clan's shadow manipulation style" },
    { title: "Protect Shikadai", description: "Raise your son and teach him to be smart and strategic like you" },
    { title: "Master Shadow Gathering", description: "Perfect the technique to gather and control multiple shadows at once" },
    { title: "Learn to Overcome Laziness", description: "Push past your natural laziness when the situation truly requires it" },
    { title: "Master Shadow Stitching", description: "Perfect the technique to stitch shadows together for complex control" },
    { title: "Protect Konoha", description: "Serve as a strategic advisor and protect the Hidden Leaf Village with your intelligence" },
    { title: "Master Chakra Control", description: "Perfect chakra control to extend your shadow techniques to maximum range" },
    { title: "Learn to Coordinate Teams", description: "Develop the ability to coordinate multiple teams during large-scale missions" },
    { title: "Master Shadow Clone Coordination", description: "Perfect the ability to work with shadow clones for complex strategies" },
    { title: "Protect the Next Generation", description: "Guide and protect young ninja as they learn and grow" },
    { title: "Master All Five Elements", description: "Learn to use all basic nature transformations to become versatile" },
    { title: "Learn to Think Ahead", description: "Develop the ability to predict enemy movements and plan multiple steps ahead" },
    { title: "Master Shadow Extension", description: "Perfect the ability to extend your shadow to reach distant enemies" },
    { title: "Protect the Nara Clan", description: "Ensure the safety and prosperity of your clan while serving Konoha" },
    { title: "Master Complex Strategies", description: "Create multi-layered plans that account for every possible outcome" },
    { title: "Learn to Work with Others", description: "Perfect teamwork skills to coordinate effectively with any team" },
    { title: "Master Shadow Manipulation", description: "Learn every possible way to manipulate shadows for combat and utility" },
    { title: "Become the Best Strategist", description: "Surpass all other strategists and become the greatest tactical mind in Konoha" },
  ],
  Konohamaru: [
    { title: "Master Rasengan", description: "Learn Naruto's signature technique and perfect the spiral chakra attack" },
    { title: "Become Hokage", description: "Follow in your grandfather's footsteps and work towards becoming the Seventh Hokage" },
    { title: "Train with Naruto", description: "Learn from your hero and mentor to become a strong ninja like him" },
    { title: "Master Shadow Clone Jutsu", description: "Perfect the ability to create multiple clones for training and combat" },
    { title: "Protect Konoha", description: "Serve as a loyal ninja of the Hidden Leaf and protect the village" },
    { title: "Master Fire Style", description: "Perfect all fire nature transformation techniques learned from your grandfather" },
    { title: "Learn to Lead", description: "Develop leadership skills to one day lead Konoha as its Hokage" },
    { title: "Protect Moegi and Udon", description: "Support your teammates and ensure Team Ebisu always succeeds together" },
    { title: "Master Wind Style", description: "Learn wind nature transformation to combine with your Rasengan" },
    { title: "Learn Rasenshuriken", description: "Master the ultimate wind-style technique that combines Rasengan with wind chakra" },
    { title: "Protect the Next Generation", description: "Guide and protect Boruto and the new generation of ninja" },
    { title: "Master All Five Elements", description: "Learn to use all basic nature transformations with perfect mastery" },
    { title: "Learn to Work with Team 7", description: "Perfect teamwork skills to coordinate effectively with any team" },
    { title: "Protect Your Grandfather's Legacy", description: "Honor the Third Hokage's memory by becoming a great ninja" },
    { title: "Master Taijutsu", description: "Perfect your hand-to-hand combat skills to become a well-rounded fighter" },
    { title: "Learn to Inspire Others", description: "Motivate others through your example and leadership like Naruto does" },
    { title: "Master Multi-Shadow Clone Jutsu", description: "Create hundreds of shadow clones for overwhelming combat advantage" },
    { title: "Protect the Academy Students", description: "Ensure the safety of young ninja students as they learn and grow" },
    { title: "Master Genjutsu", description: "Learn the art of illusion techniques to trap and confuse enemies" },
    { title: "Learn to Overcome Challenges", description: "Face difficult situations and prove you can handle any mission" },
    { title: "Master Ninja Tools", description: "Perfect the use of all ninja tools and weapons for maximum effectiveness" },
    { title: "Protect Iruka Sensei", description: "Support your teacher and ensure the safety of Konoha's academy" },
    { title: "Master Chakra Control", description: "Perfect chakra control to use techniques more efficiently and effectively" },
    { title: "Learn to Work Alone", description: "Develop independence and prove you can handle missions without backup" },
    { title: "Master All Jutsu", description: "Learn a wide variety of techniques to become a versatile and capable ninja" },
    { title: "Protect the Hokage", description: "Serve as a bodyguard and support the current Hokage in their duties" },
    { title: "Master Sage Mode", description: "Learn to use natural energy from Mount Myoboku for enhanced power" },
    { title: "Learn to Lead Missions", description: "Develop the ability to lead missions and coordinate teams effectively" },
    { title: "Master All Rasengan Variations", description: "Learn every possible variation of the Rasengan technique" },
    { title: "Become a True Hokage", description: "Prove you're worthy of the Hokage title and can protect everyone in Konoha" },
  ],
};

// Seed tasks for all users
export const seedTasksForUsers = mutation({
  handler: async (ctx) => {
    // Get all users
    const users = await ctx.db.query("users").collect();
    if (users.length === 0) {
      throw new Error("No users found. Please run addUsers first.");
    }
    
    const now = Date.now();
    const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);
    const twoYearsAgo = now - (2 * 365 * 24 * 60 * 60 * 1000);
    
    let totalCreated = 0;
    
    for (const user of users) {
      const userTasks = characterTasks[user.name] || [];
      if (userTasks.length === 0) {
        continue;
      }
      
      // Create 30 tasks for this user
      for (let i = 0; i < 30; i++) {
        const taskIndex = i % userTasks.length;
        const taskTemplate = userTasks[taskIndex];
        
        // Random createdAt between 2 years ago and 5 days ago
        const createdAt = Math.floor(Math.random() * (fiveDaysAgo - twoYearsAgo) + twoYearsAgo);
        
        // Duration based on title and description
        const duration = estimateDuration(taskTemplate.title, taskTemplate.description);
        
        // Random completion status (30% completed)
        const isCompleted = Math.random() < 0.3;
        
        // Random importance (20% important)
        const isImportant = Math.random() < 0.2;
        
        await ctx.db.insert("tasks", {
          text: taskTemplate.title,
          description: taskTemplate.description,
          isCompleted,
          isImportant,
          createdAt,
          updatedAt: createdAt, // Same as createdAt
          duration,
          userId: user._id,
        });
        
        totalCreated++;
      }
    }
    
    return { created: totalCreated, usersProcessed: users.length };
  },
});

// Set all tasks to incomplete and not important
export const resetAllTasksStatus = mutation({
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    let updated = 0;
    
    for (const task of allTasks) {
      await ctx.db.patch(task._id, {
        isCompleted: false,
        isImportant: false,
      });
      updated++;
    }
    
    return { updated, total: allTasks.length };
  },
});

// Backfill all task durations with random numbers between 1 and 300
export const backfillRandomDurations = mutation({
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    let updated = 0;
    
    for (const task of allTasks) {
      const duration = Math.floor(Math.random() * 300) + 1; // Random between 1 and 300 (inclusive)
      await ctx.db.patch(task._id, { duration });
      updated++;
    }
    
    return { updated, total: allTasks.length };
  },
});

// Update user image
export const updateUserColor = mutation({
  args: { 
    userId: v.id("users"),
    color: v.string()
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { color: args.color });
    return await ctx.db.get(args.userId);
  },
});

export const updateUserImage = mutation({
  args: {
    userId: v.id("users"),
    imageBase64: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      image: args.imageBase64,
    });
    return { success: true };
  },
});
