export interface GtmProductInput {
  name: string;
  cat: string;
  problem: string;
  benefit: string;
  diff: string;
  buyer: string;
  segment: string;
  comp: string;
  channels: string;
  pain: string;
  price: string;
  model: string;
  free: string;
  goal: string;
  current: string;
  budget: string;
}

export interface GtmPositioning {
  headline: string;
  subheadline: string;
  icp: string;
  message_hierarchy: string[];
}

export interface GtmOrganicChannel {
  channel: string;
  effort: string;
  impact: string;
  timeframe: string;
  tactics: string[];
}

export interface GtmPaidChannel {
  channel: string;
  priority: number;
  budget: string;
  when_to_start: string;
  key_tactic: string;
}

export interface GtmTimelineWeek {
  week: string;
  focus: string;
  tasks: string[];
}

export interface GtmKpi {
  metric: string;
  target: string;
  why: string;
}

export interface GtmStrategy {
  positioning: GtmPositioning;
  organic_channels: GtmOrganicChannel[];
  paid_channels: GtmPaidChannel[];
  launch_timeline: GtmTimelineWeek[];
  kpis: GtmKpi[];
  north_star: string;
  founder_advantage: string;
  biggest_risk: string;
}

export interface GtmPsychPrinciple {
  principle: string;
  tagline: string;
  generic_bad: string;
  generic_good: string;
  headline: string;
  tactics: string[];
  tags: string[];
}
