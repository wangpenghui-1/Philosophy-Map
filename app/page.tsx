import type { Metadata } from "next";
import AtlasApp from "./_components/AtlasApp";

export const metadata: Metadata = {
  title: "思想星图 · 3D世界哲学样片",
  description: "从故事模式进入一个以3D地球为主体、关系均带来源的世界哲学探索样片。",
};

export default function Home() {
  return <AtlasApp initialMode="story" />;
}

