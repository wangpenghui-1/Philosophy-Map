import type { Metadata } from "next";
import AtlasApp from "./_components/AtlasApp";

export const metadata: Metadata = {
  title: "思想星图 · 210位思想家的世界哲学地图",
  description: "从古代世界到当代思想，在电影化3D地球与知识库中探索210位思想家、核心概念、代表文本及有来源的思想关系。",
};

export default function Home() {
  return <AtlasApp initialMode="story" />;
}
