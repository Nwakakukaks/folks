import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const normalizedSlug = (params.slug || "").toLowerCase().replace(/[^a-z0-9-_]/g, "");

  if (!normalizedSlug) {
    return NextResponse.json({ error: "Invalid agent slug" }, { status: 400 });
  }

  const skillPath = path.join(process.cwd(), "src", "agents", "skills", normalizedSlug, "SKILL.md");

  try {
    const content = await fs.readFile(skillPath, "utf-8");
    return NextResponse.json({ slug: normalizedSlug, content });
  } catch {
    return NextResponse.json({ error: "Skill file not found" }, { status: 404 });
  }
}
