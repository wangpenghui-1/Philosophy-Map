import type { Metadata } from "next";
import AtlasApp from "./_components/AtlasApp";

export const metadata: Metadata = {
  title: "思想星图 · 120位哲学家的世界思想地图",
  description: "从古代世界到当代思想，在3D地球与知识库中探索120位哲学家、核心概念、代表文本及有来源的思想关系。",
};

export default function Home() {
  return <AtlasApp initialMode="story" />;
}
