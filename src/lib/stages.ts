import type { AssetStatus, ProjectStage, UserRole } from '../types';

export interface StageMeta {
  value: ProjectStage;
  label: string;
  bg: string;
  text: string;
  step: number;
}

/** Single source of truth for the production pipeline — used by Projects and Portfolio. */
export const STAGES: StageMeta[] = [
  { value: 'composing',   label: 'Composing',   bg: 'bg-[#0071e3]/10', text: 'text-[#0071e3]', step: 1 },
  { value: 'arranging',   label: 'Arranging',   bg: 'bg-[#af52de]/10', text: 'text-[#af52de]', step: 2 },
  { value: 'live_inputs', label: 'Live Inputs', bg: 'bg-[#ff9500]/10', text: 'text-[#ff9500]', step: 3 },
  { value: 'mixing',      label: 'Mixing',      bg: 'bg-[#ff2d55]/10', text: 'text-[#ff2d55]', step: 4 },
  { value: 'mastering',   label: 'Mastering',   bg: 'bg-[#5ac8fa]/15', text: 'text-[#0a84c1]', step: 5 },
  { value: 'completed',   label: 'Completed',   bg: 'bg-[#34c759]/10', text: 'text-[#34c759]', step: 6 },
];

export const TOTAL_STAGES = STAGES.length;

export function getStage(value: ProjectStage): StageMeta {
  return STAGES.find(s => s.value === value) || STAGES[0];
}

export function stageProgress(value: ProjectStage) {
  return Math.round((getStage(value).step / TOTAL_STAGES) * 100);
}

export const ASSET_STATUS: Record<AssetStatus, { bg: string; text: string; dot: string; label: string }> = {
  operational:  { bg: 'bg-[#34c759]/10', text: 'text-[#1a7f37]', dot: 'bg-[#34c759]', label: 'Operational' },
  needs_repair: { bg: 'bg-[#ff3b30]/10', text: 'text-[#c9302c]', dot: 'bg-[#ff3b30]', label: 'Needs repair' },
  maintenance:  { bg: 'bg-[#ff9f0a]/12', text: 'text-[#a86500]', dot: 'bg-[#ff9f0a]', label: 'Maintenance' },
  missing:      { bg: 'bg-[#86868b]/12', text: 'text-[#6e6e73]', dot: 'bg-[#86868b]', label: 'Missing' },
};

export const ROLE_META: Record<UserRole, { label: string; bg: string; text: string }> = {
  admin:        { label: 'Admin',        bg: 'bg-[#0071e3]/10', text: 'text-[#0071e3]' },
  junior_admin: { label: 'Jr. Admin',    bg: 'bg-[#ff9f0a]/12', text: 'text-[#a86500]' },
  member:       { label: 'Student',      bg: 'bg-[#34c759]/10', text: 'text-[#1a7f37]' },
};
