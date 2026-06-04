"use client";

import * as Switch from "@radix-ui/react-switch";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { useFocusModeStore } from "@/lib/stores/focus-mode-store";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/* ─── Types ─── */

type AmbientIntensity = "subtle" | "medium" | "vivid";

const AMBIENT_OPTIONS: { value: AmbientIntensity; label: string }[] = [
  { value: "subtle", label: "Subtle" },
  { value: "medium", label: "Medium" },
  { value: "vivid", label: "Vivid" },
];

/* ─── Toggle Row ─── */

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
  id: string;
}

function ToggleRow({ label, description, checked, onCheckedChange, id }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between rounded-[18px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3.5">
      <label htmlFor={id} className="cursor-pointer">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-secondary">{description}</p>
      </label>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface)] transition-colors duration-150 data-[state=checked]:bg-[var(--accent)]"
      >
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
    </div>
  );
}

/* ─── Preferences Tab ─── */

export function PreferencesTab() {
  const {
    ambientIntensity,
    typewriterScrolling,
    showParagraphFocus,
    toolbarAutoHide,
    setAmbientIntensity,
    toggleTypewriterScrolling,
    toggleParagraphFocus,
    toggleToolbarAutoHide,
  } = useFocusModeStore();

  return (
    <div className="space-y-6">
      {/* Appearance section */}
      <section>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
          Appearance
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-[18px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">Appearance</p>
              <p className="mt-0.5 text-xs text-secondary">
                Dark parchment or illuminated manuscript
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3.5 opacity-50">
            <p className="text-sm font-medium text-foreground">Ambient audio</p>
            <p className="mt-0.5 text-xs text-secondary">
              Toggle dark fantasy atmosphere from the world sidebar
            </p>
          </div>
        </div>
      </section>

      {/* Writing preferences section */}
      <section>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
          Writing Preferences
        </h2>
        <div className="space-y-3">
          {/* Ambient intensity select */}
          <div className="flex items-center justify-between rounded-[18px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3.5">
            <label htmlFor="ambient-intensity" className="cursor-pointer">
              <p className="text-sm font-medium text-foreground">Ambient intensity</p>
              <p className="mt-0.5 text-xs text-secondary">
                How vivid the atmospheric effects appear in focus mode
              </p>
            </label>
            <Select.Root
              value={ambientIntensity}
              onValueChange={(value) => setAmbientIntensity(value as AmbientIntensity)}
            >
              <Select.Trigger
                id="ambient-intensity"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
                aria-label="Select ambient intensity"
              >
                <Select.Value />
                <Select.Icon>
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  className="z-50 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-lg"
                  position="popper"
                  sideOffset={4}
                >
                  <Select.Viewport className="p-1">
                    {AMBIENT_OPTIONS.map((option) => (
                      <Select.Item
                        key={option.value}
                        value={option.value}
                        className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] data-[highlighted]:text-[var(--accent)]"
                      >
                        <Select.ItemIndicator className="inline-flex w-4 items-center justify-center">
                          <Check className="h-3.5 w-3.5" />
                        </Select.ItemIndicator>
                        <Select.ItemText>{option.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          {/* Typewriter scrolling toggle */}
          <ToggleRow
            id="typewriter-scrolling"
            label="Typewriter scrolling"
            description="Keep the active line centered vertically while typing"
            checked={typewriterScrolling}
            onCheckedChange={toggleTypewriterScrolling}
          />

          {/* Paragraph focus toggle */}
          <ToggleRow
            id="paragraph-focus"
            label="Paragraph focus"
            description="Dim surrounding paragraphs to highlight your current one"
            checked={showParagraphFocus}
            onCheckedChange={toggleParagraphFocus}
          />

          {/* Toolbar auto-hide toggle */}
          <ToggleRow
            id="toolbar-auto-hide"
            label="Toolbar auto-hide"
            description="Hide the formatting toolbar after a few seconds of inactivity"
            checked={toolbarAutoHide}
            onCheckedChange={toggleToolbarAutoHide}
          />
        </div>
      </section>
    </div>
  );
}
