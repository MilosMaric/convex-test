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

export const completedCount = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").filter(q => q.eq(q.field("isCompleted"), true)).collect().then(tasks => tasks.length);
  },
});