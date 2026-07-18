"use client";

import { create } from "zustand";
import { atlasTimelineEndYear, type QuestionId } from "../_data/atlas";

export type AtlasMode = "story" | "explore";
export type QualityTier = "high" | "medium" | "low";

interface AtlasState {
  mode: AtlasMode;
  isPlaying: boolean;
  chapterIndex: number;
  selectedThinkerId: string | null;
  selectedRelationId: string | null;
  activeQuestionId: QuestionId | null;
  timelineYear: number;
  listViewOpen: boolean;
  searchOpen: boolean;
  quality: QualityTier;
  compareIds: string[];
  setMode: (mode: AtlasMode) => void;
  setPlaying: (isPlaying: boolean) => void;
  setChapterIndex: (chapterIndex: number) => void;
  selectThinker: (id: string | null) => void;
  selectRelation: (id: string | null) => void;
  setQuestion: (id: QuestionId | null) => void;
  setTimelineYear: (year: number) => void;
  setListViewOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setQuality: (quality: QualityTier) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
}

export const useAtlasStore = create<AtlasState>((set) => ({
  mode: "story",
  isPlaying: true,
  chapterIndex: 0,
  selectedThinkerId: null,
  selectedRelationId: null,
  activeQuestionId: null,
  timelineYear: atlasTimelineEndYear,
  listViewOpen: false,
  searchOpen: false,
  quality: "high",
  compareIds: [],
  setMode: (mode) => set({ mode, isPlaying: mode === "story" }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setChapterIndex: (chapterIndex) => set({ chapterIndex, selectedThinkerId: null, selectedRelationId: null }),
  selectThinker: (selectedThinkerId) => set({ selectedThinkerId, selectedRelationId: null }),
  selectRelation: (selectedRelationId) => set({ selectedRelationId, selectedThinkerId: null }),
  setQuestion: (activeQuestionId) => set({ activeQuestionId, selectedThinkerId: null, selectedRelationId: null }),
  setTimelineYear: (timelineYear) => set({ timelineYear }),
  setListViewOpen: (listViewOpen) => set({ listViewOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setQuality: (quality) => set({ quality }),
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
