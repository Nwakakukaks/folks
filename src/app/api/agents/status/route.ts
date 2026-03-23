import { NextResponse } from "next/server";

const MODEL = process.env.AGENT_REASON_MODEL || "qwen/qwen3-32b";

export async function GET() {
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY);

  return NextResponse.json({
    available: hasGroqKey,
    model: MODEL,
  });
}
