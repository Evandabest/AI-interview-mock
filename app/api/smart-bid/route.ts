import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export async function POST(request: Request) {
  const { title, description, currentBid } = await request.json();

  const prompt = `The item is ${title}, this is the description of the item: ${description}, this is the current highest bid $${currentBid}, do you think it is smart to make a higher bid?`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return Response.json({ analysis: text });
  } catch (error) {
    return Response.json(
      { error: "Failed to generate analysis" },
      { status: 500 }
    );
  }
}