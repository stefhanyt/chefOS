import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    )
  }

  let body: { image: string; mediaType: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { image, mediaType } = body
  if (!image || !mediaType) {
    return NextResponse.json(
      { error: "Missing image or mediaType" },
      { status: 400 }
    )
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: image },
              },
              {
                type: "text",
                text: `You are a pantry assistant. Look at this food photo and identify the items.
Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "items": [
    { "name": "string", "quantity": number, "unit": "string", "category": "string" }
  ]
}
Use common pantry units (kg, g, L, mL, units, pack, dozen, bag).
Category should be one of: Produce, Dairy & Eggs, Meat & Seafood, Pantry Staples, Frozen, Beverages, Condiments, Bakery, Snacks, Other.
If you cannot identify any food items, return { "items": [] }.`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: `Anthropic API error: ${response.status}`, detail: text },
        { status: 502 }
      )
    }

    const data = await response.json()
    const content = data.content?.[0]?.text ?? "{}"

    try {
      const parsed = JSON.parse(content)
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ items: [] })
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to contact Anthropic API" },
      { status: 502 }
    )
  }
}
