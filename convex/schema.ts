import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    image: v.optional(v.string()), // Base64-encoded image
    color: v.optional(v.string()), // Hex color code
  }),
  tasks: defineTable({
    text: v.string(),
    description: v.optional(v.string()),
    isCompleted: v.boolean(),
    isImportant: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    duration: v.optional(v.number()), // Duration in minutes
    userId: v.optional(v.id("users")), // Optional for backward compatibility
  }).index("by_user", ["userId"]),
  taskHistory: defineTable({
    taskId: v.id("tasks"),
    changeType: v.optional(v.string()), // "completion" or "importance"
    changedTo: v.boolean(), // true = completed/important, false = incomplete/not-important
    changedAt: v.number(),
  }).index("by_task", ["taskId"])
    .index("by_changed_at", ["changedAt"]),
});