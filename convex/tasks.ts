import { mutation, query } from "./_generated/server";
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

export const toggleCompleted = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.id, { isCompleted: !task.isCompleted });
    return await ctx.db.get(args.id);
  },
});

export const toggleAll = mutation({
  args: { ids: v.array(v.id("tasks")) },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const task = await ctx.db.get(id);
      if (task) await ctx.db.patch(id, { isCompleted: !task.isCompleted });
    }
    return true;
  },
});

export const setAllCompleted = mutation({
  args: { ids: v.array(v.id("tasks")), value: v.boolean() },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const task = await ctx.db.get(id);
      if (task) await ctx.db.patch(id, { isCompleted: args.value });
    }
    return true;
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