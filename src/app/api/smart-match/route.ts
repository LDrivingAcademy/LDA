import { NextResponse } from "next/server";
import { runSmartMatch, type SmartMatchInput } from "@/lib/smart-match";

export async function POST(request: Request) {
  const input = (await request.json()) as SmartMatchInput;

  return NextResponse.json(runSmartMatch(input));
}
