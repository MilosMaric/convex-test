import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    description: v.optional(v.string()),
    isCompleted: v.boolean(),
    isImportant: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    duration: v.optional(v.number()), // Duration in minutes
  }),
  taskHistory: defineTable({
    taskId: v.id("tasks"),
    changeType: v.optional(v.string()), // "completion" or "importance"
    changedTo: v.boolean(), // true = completed/important, false = incomplete/not-important
    changedAt: v.number(),
  }).index("by_task", ["taskId"]),
});