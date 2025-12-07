import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    description: v.optional(v.string()),
    isCompleted: v.boolean(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    duration: v.optional(v.number()), // Duration in minutes
  }),
  taskHistory: defineTable({
    taskId: v.id("tasks"),
    changedTo: v.boolean(), // true = completed, false = incomplete
    changedAt: v.number(),
  }).index("by_task", ["taskId"]),
});