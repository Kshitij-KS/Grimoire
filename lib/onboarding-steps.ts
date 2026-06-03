/**
 * Onboarding step definitions and state types.
 * Guides new users through their first world experience in 4 steps.
 */

export interface OnboardingState {
  currentStep: number; // 0-3
  completedSteps: [boolean, boolean, boolean, boolean];
  dismissed: boolean;
  finished: boolean;
}

export interface OnboardingStep {
  id: string;
  title: string;
  section: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { id: "write-lore", title: "Inscribe Your First Lore", section: "lore" },
  { id: "view-entity", title: "Discover Extracted Entities", section: "bible" },
  { id: "forge-soul", title: "Forge a Soul", section: "souls" },
  { id: "chat-soul", title: "Speak with Your Creation", section: "souls" },
] as const;

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  currentStep: 0,
  completedSteps: [false, false, false, false],
  dismissed: false,
  finished: false,
};
