import type { Metadata } from "next";
import AtlasApp from "./_components/AtlasApp";

export const metadata: Metadata = {
  title: "思想星图 · 30位哲学家的3D思想地图",
  description: "从苏格拉底、柏拉图到康德、马克思与福柯，在3D地球上探索30位哲学家及其有来源的思想关系。",
};

export default function Home() {
  return <AtlasApp initialMode="story" />;
}
