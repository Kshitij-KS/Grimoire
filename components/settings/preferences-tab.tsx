"use client";

import * as Switch from "@radix-ui/react-switch";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check, Palette, PenLine } from "lucide-react";
import { useFocusModeStore } from "@/lib/stores/focus-mode-store";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  SettingsSection,
  SettingRow,
} from "@/components/settings/settings-primitives";

/* ─── Types ─── */

type AmbientIntensity = "subtle" | "medium" | "vivid";

const AMBIENT_OPTIONS: { value: AmbientIntensity; label: string }[] = [
  { value: "subtle", label: "Subtle" },
  { value: "medium", label: "Medium" },
  { value: "vivid", label: "Vivid" },
];

/* ─── Toggle control ─── */

function Toggle({
  id,
  checked,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface)] transition-colors duration-150 data-[state=checked]:border-transparent data-[state=checked]:bg-[var(--accent)]"
    >
      <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[22px]" />
    </Switch.Root>
  );
}

/* ─── Ambient intensity select ─── */

function AmbientSelect({
  value,
  onValueChange,
}: {
  value: AmbientIntensity;
  onValueChange: (value: AmbientIntensity) => void;
}) {
  return (
    <Select.Root value={value} onValueChange={(v) => onValueChange(v as AmbientIntensity)}>
      <Select.Trigger
        id="ambient-intensity"
        className="inline-flex h-9 min-w-[120px] shrink-0 items-center justify-between gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-foreground transition-colors hover:border-[var(--border-focus)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_40%,transparent)]"
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
      {/* Appearance */}
      <SettingsSection
        icon={Palette}
        title="Appearance"
        description="Tune how Grimoire looks and feels."
        tone="ai-pulse"
      >
        <div className="space-y-3">
          <SettingRow
            label="Theme"
            description="Dark obsidian or illuminated manuscript."
            control={<ThemeToggle />}
          />
          <SettingRow
            label="Ambient audio"
            description="Toggle dark fantasy atmosphere from the world sidebar."
            disabled
            control={
              <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Soon
              </span>
            }
          />
        </div>
      </SettingsSection>

      {/* Writing */}
      <SettingsSection
        icon={PenLine}
        title="Writing"
        description="Defaults for immersive focus mode."
      >
        <div className="space-y-3">
          <SettingRow
            htmlFor="ambient-intensity"
            label="Ambient intensity"
            description="How vivid the atmospheric effects appear in focus mode."
            control={
              <AmbientSelect value={ambientIntensity} onValueChange={setAmbientIntensity} />
            }
          />
          <SettingRow
            htmlFor="typewriter-scrolling"
            label="Typewriter scrolling"
            description="Keep the active line centered vertically while typing."
            control={
              <Toggle
                id="typewriter-scrolling"
                checked={typewriterScrolling}
                onCheckedChange={toggleTypewriterScrolling}
              />
            }
          />
          <SettingRow
            htmlFor="paragraph-focus"
            label="Paragraph focus"
            description="Dim surrounding paragraphs to highlight your current one."
            control={
              <Toggle
                id="paragraph-focus"
                checked={showParagraphFocus}
                onCheckedChange={toggleParagraphFocus}
              />
            }
          />
          <SettingRow
            htmlFor="toolbar-auto-hide"
            label="Toolbar auto-hide"
            description="Hide the formatting toolbar after a few seconds of inactivity."
            control={
              <Toggle
                id="toolbar-auto-hide"
                checked={toolbarAutoHide}
                onCheckedChange={toggleToolbarAutoHide}
              />
            }
          />
        </div>
      </SettingsSection>
    </div>
  );
}
