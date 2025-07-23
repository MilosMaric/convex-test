import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
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
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    for (const task of tasks) {
      await ctx.db.patch(task._id, { isCompleted: !task.isCompleted });
    }
    return true;
  },
});

export const setAllCompleted = mutation({
  args: { value: v.boolean() },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query("tasks").collect();
    for (const task of tasks) {
      await ctx.db.patch(task._id, { isCompleted: args.value });
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