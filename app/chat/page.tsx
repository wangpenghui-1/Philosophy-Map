import type { Metadata } from "next";
import { ChatClient } from "./ChatClient";
import styles from "./chat.module.css";

export const metadata: Metadata = { title: "有据可查的哲学对话", description: "只依据思想星图已发布内容回答，并逐条展示来源。" };

export default function ChatPage() {
  return <main className={styles.page}><ChatClient /></main>;
}
