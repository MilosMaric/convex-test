import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

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
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
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

// Duration estimates based on keywords
const durationKeywords: { keywords: string[]; minMinutes: number; maxMinutes: number }[] = [
  // Quick tasks (5-15 minutes)
  { keywords: ['reply', 'send', 'email', 'call', 'check', 'confirm', 'cancel', 'accept', 'decline'], minMinutes: 5, maxMinutes: 15 },
  { keywords: ['order', 'purchase', 'book', 'subscribe', 'unsubscribe'], minMinutes: 5, maxMinutes: 10 },
  
  // Short tasks (10-30 minutes)
  { keywords: ['review', 'read', 'update', 'edit', 'fix', 'sync', 'backup'], minMinutes: 10, maxMinutes: 30 },
  { keywords: ['clean', 'organize', 'sort', 'file', 'archive'], minMinutes: 15, maxMinutes: 30 },
  { keywords: ['water', 'walk', 'exercise', 'stretch'], minMinutes: 10, maxMinutes: 30 },
  
  // Medium tasks (30-60 minutes)
  { keywords: ['write', 'draft', 'create', 'design', 'plan', 'prepare'], minMinutes: 30, maxMinutes: 60 },
  { keywords: ['meeting', 'discuss', 'present', 'interview'], minMinutes: 30, maxMinutes: 60 },
  { keywords: ['cook', 'bake', 'meal', 'grocery', 'shop'], minMinutes: 30, maxMinutes: 60 },
  { keywords: ['gym', 'workout', 'swim', 'run', 'yoga'], minMinutes: 30, maxMinutes: 60 },
  
  // Long tasks (60-120 minutes)
  { keywords: ['implement', 'develop', 'code', 'debug', 'test', 'refactor'], minMinutes: 60, maxMinutes: 120 },
  { keywords: ['analyze', 'research', 'investigate', 'audit', 'evaluate'], minMinutes: 60, maxMinutes: 120 },
  { keywords: ['deploy', 'migrate', 'configure', 'setup', 'install'], minMinutes: 45, maxMinutes: 90 },
  { keywords: ['document', 'report', 'presentation'], minMinutes: 45, maxMinutes: 90 },
  
  // Very long tasks (120-240 minutes)
  { keywords: ['project', 'sprint', 'roadmap', 'strategy'], minMinutes: 120, maxMinutes: 240 },
  { keywords: ['training', 'workshop', 'conference', 'webinar'], minMinutes: 60, maxMinutes: 180 },
  { keywords: ['learn', 'study', 'course'], minMinutes: 60, maxMinutes: 120 },
];

function estimateDuration(title: string, description: string): number {
  const text = `${title} ${description}`.toLowerCase();
  
  for (const { keywords, minMinutes, maxMinutes } of durationKeywords) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return Math.floor(minMinutes + Math.random() * (maxMinutes - minMinutes));
      }
    }
  }
  
  // Default: random between 15 and 45 minutes
  return Math.floor(15 + Math.random() * 30);
}

export const backfillDurations = mutation({
  args: {},
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    let count = 0;
    
    for (const task of allTasks) {
      if (task.duration === undefined) {
        const duration = estimateDuration(task.text, task.description ?? "");
        await ctx.db.patch(task._id, { duration });
        count++;
      }
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
      });
      
      created++;
    }
    
    return { created, attempts };
  },
});