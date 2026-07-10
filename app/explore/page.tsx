import type { Metadata } from "next";
import AtlasApp from "../_components/AtlasApp";

export const metadata: Metadata = {
  title: "自由探索",
  description: "旋转3D思想地球，按问题和时间探索哲学人物、文本与关系证据。",
};

export default function ExplorePage() {
  return <AtlasApp initialMode="explore" />;
}

