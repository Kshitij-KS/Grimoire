"use client";

import { useState } from "react";
import { SUPPORTED_EVAL_TASKS } from "@/lib/constants";
import type { EvalTaskId } from "@/lib/constants";

interface TaskSelectorProps {
  selected: EvalTaskId[];
  onChange: (tasks: EvalTaskId[]) => void;
  disabled?: boolean;
}

type Category = string;

const CATEGORY_ICONS: Record<Category, string> = {
  "Reasoning": "⚔️",
  "Common Sense": "🌙",
  "Knowledge": "📜",
};

export function TaskSelector({ selected, onChange, disabled = false }: TaskSelectorProps) {
  const categories = Array.from(new Set(SUPPORTED_EVAL_TASKS.map((t) => t.category)));

  const toggle = (id: EvalTaskId) => {
    if (disabled) return;
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const toggleCategory = (category: Category) => {
    if (disabled) return;
    const catTasks = SUPPORTED_EVAL_TASKS.filter((t) => t.category === category).map(
      (t) => t.id as EvalTaskId,
    );
    const allSelected = catTasks.every((id) => selected.includes(id));
    if (allSelected) {
      onChange(selected.filter((id) => !catTasks.includes(id)));
    } else {
      const newSet = new Set([...selected, ...catTasks]);
      onChange(Array.from(newSet) as EvalTaskId[]);
    }
  };

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const catTasks = SUPPORTED_EVAL_TASKS.filter((t) => t.category === category);
        const allSelected = catTasks.every((t) => selected.includes(t.id as EvalTaskId));
        const someSelected = catTasks.some((t) => selected.includes(t.id as EvalTaskId));

        return (
          <div key={category} className="space-y-2">
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              disabled={disabled}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest transition-colors"
              style={{
                color: allSelected
                  ? "var(--accent)"
                  : someSelected
                  ? "var(--accent-soft)"
                  : "var(--text-muted)",
              }}
            >
              <span>{CATEGORY_ICONS[category] ?? "◈"}</span>
              <span>{category}</span>
              <span
                className="ml-auto text-[10px] normal-case tracking-normal"
                style={{ color: "var(--text-muted)" }}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </span>
            </button>

            {/* Task chips */}
            <div className="flex flex-wrap gap-2">
              {catTasks.map((task) => {
                const isSelected = selected.includes(task.id as EvalTaskId);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => toggle(task.id as EvalTaskId)}
                    disabled={disabled}
                    title={`~${task.approxSamples.toLocaleString()} questions total`}
                    className="group relative flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-all duration-150 active:scale-[0.97] active:transition-none disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                        : "var(--surface)",
                      borderColor: isSelected ? "var(--accent)" : "var(--border)",
                      color: isSelected ? "var(--accent-soft)" : "var(--text-muted)",
                    }}
                  >
                    {/* Rune dot */}
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full transition-colors"
                      style={{
                        backgroundColor: isSelected ? "var(--accent)" : "var(--border-focus)",
                      }}
                    />
                    {task.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Selection count */}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {selected.length === 0
          ? "Select at least one task to begin"
          : `${selected.length} task${selected.length !== 1 ? "s" : ""} selected`}
      </p>
    </div>
  );
}
