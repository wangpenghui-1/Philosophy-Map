"use client";

import { create } from "zustand";
import { atlasTimelineEndYear, type QuestionId } from "../_data/atlas";
import type { FocusDepth, QualityPreference } from "../_components/atlas-visual-policy";

export type AtlasMode = "story" | "explore";
export type QualityTier = "high" | "medium" | "low";
export type JourneyPhase = "idle" | "entry" | "playing" | "paused" | "completed" | "legacy";

interface AtlasState {
  mode: AtlasMode;
  isPlaying: boolean;
  chapterIndex: number;
  journeyPhase: JourneyPhase;
  activeJourneyId: string | null;
  journeyNodeIndex: number;
  journeyCameraRevision: number;
  selectedThinkerId: string | null;
  selectedRelationId: string | null;
  activeQuestionId: QuestionId | null;
  timelineYear: number;
  isTimelineScrubbing: boolean;
  listViewOpen: boolean;
  searchOpen: boolean;
  quality: QualityTier;
  qualityPreference: QualityPreference;
  focusDepth: FocusDepth;
  compareIds: string[];
  setMode: (mode: AtlasMode) => void;
  setPlaying: (isPlaying: boolean) => void;
  setChapterIndex: (chapterIndex: number) => void;
  showJourneyEntry: () => void;
  startJourney: (journeyId: string) => void;
  pauseJourney: () => void;
  resumeJourney: () => void;
  setJourneyNodeIndex: (nodeIndex: number) => void;
  completeJourney: () => void;
  leaveJourney: () => void;
  selectThinker: (id: string | null) => void;
  selectRelation: (id: string | null) => void;
  setQuestion: (id: QuestionId | null) => void;
  setTimelineYear: (year: number) => void;
  setTimelineScrubbing: (scrubbing: boolean) => void;
  setListViewOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setQuality: (quality: QualityTier) => void;
  setQualityPreference: (preference: QualityPreference) => void;
  setFocusDepth: (depth: FocusDepth) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
}

export const useAtlasStore = create<AtlasState>((set) => ({
  mode: "story",
  isPlaying: true,
  chapterIndex: 0,
  journeyPhase: "entry",
  activeJourneyId: null,
  journeyNodeIndex: 0,
  journeyCameraRevision: 0,
  selectedThinkerId: null,
  selectedRelationId: null,
  activeQuestionId: null,
  timelineYear: atlasTimelineEndYear,
  isTimelineScrubbing: false,
  listViewOpen: false,
  searchOpen: false,
  quality: "medium",
  qualityPreference: "auto",
  focusDepth: 1,
  compareIds: [],
  setMode: (mode) => set({ mode, isPlaying: mode === "story" }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setChapterIndex: (chapterIndex) => set({ chapterIndex, selectedThinkerId: null, selectedRelationId: null }),
  showJourneyEntry: () => set({
    mode: "story",
    isPlaying: false,
    journeyPhase: "entry",
    activeJourneyId: null,
    journeyNodeIndex: 0,
    selectedThinkerId: null,
    selectedRelationId: null,
  }),
  startJourney: (activeJourneyId) => set({
    mode: "story",
    isPlaying: true,
    journeyPhase: "playing",
    activeJourneyId,
    journeyNodeIndex: 0,
    journeyCameraRevision: 1,
    selectedThinkerId: null,
    selectedRelationId: null,
  }),
  pauseJourney: () => set((state) => state.journeyPhase === "playing"
    ? { isPlaying: false, journeyPhase: "paused" }
    : {}),
  resumeJourney: () => set((state) => state.journeyPhase === "paused"
    ? {
        isPlaying: true,
        journeyPhase: "playing",
        journeyCameraRevision: state.journeyCameraRevision + 1,
        selectedThinkerId: null,
        selectedRelationId: null,
      }
    : {}),
  setJourneyNodeIndex: (journeyNodeIndex) => set((state) => ({
    journeyNodeIndex,
    journeyCameraRevision: state.journeyCameraRevision + 1,
    selectedThinkerId: null,
    selectedRelationId: null,
  })),
  completeJourney: () => set({ isPlaying: false, journeyPhase: "completed" }),
  leaveJourney: () => set({
    mode: "explore",
    isPlaying: false,
    journeyPhase: "idle",
    activeJourneyId: null,
    journeyNodeIndex: 0,
  }),
  selectThinker: (selectedThinkerId) => set({ selectedThinkerId, selectedRelationId: null }),
  selectRelation: (selectedRelationId) => set({ selectedRelationId, selectedThinkerId: null }),
  setQuestion: (activeQuestionId) => set({ activeQuestionId, selectedThinkerId: null, selectedRelationId: null }),
  setTimelineYear: (timelineYear) => set({ timelineYear }),
  setTimelineScrubbing: (isTimelineScrubbing) => set({ isTimelineScrubbing }),
  setListViewOpen: (listViewOpen) => set({ listViewOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setQuality: (quality) => set({ quality }),
  setQualityPreference: (qualityPreference) => set({ qualityPreference }),
  setFocusDepth: (focusDepth) => set({ focusDepth }),
  toggleCompare: (id) =>
    set((state) => {
      if (state.compareIds.includes(id)) {
        return { compareIds: state.compareIds.filter((value) => value !== id) };
      }
      if (state.compareIds.length >= 2) {
        return { compareIds: [state.compareIds[1], id], selectedThinkerId: null, selectedRelationId: null };
      }
      const compareIds = [...state.compareIds, id];
      return compareIds.length === 2
        ? { compareIds, selectedThinkerId: null, selectedRelationId: null }
        : { compareIds };
    }),
  clearCompare: () => set({ compareIds: [] }),
}));
