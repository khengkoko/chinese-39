export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    const { sentence, keywords, imageDescription } = body;

    const prompt = `
你是中文老师，批改学生句子。

必须完成：
1. 判断对错
2. 找错误
3. 给正确句子（必须）
4. 简单解释

必须输出 JSON：
{
  "score": number,
  "isCorrect": boolean,
  "error": "错误说明",
  "correction": "正确句子",
  "explanation": "解释",
  "encouragement": "鼓励"
}

关键词：${keywords?.join("、")}
场景：${imageDescription}
句子：${sentence}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "只输出JSON，不允许解释" },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();

    let text = data?.choices?.[0]?.message?.content || "";
    text = text.replace(/```json|```/g, "").trim();

    let result;

    try {
      result = JSON.parse(text);
    } catch (e) {
      return new Response(JSON.stringify({
        score: 60,
        isCorrect: false,
        error: "JSON解析失败",
        correction: sentence,
        explanation: "AI输出异常",
        encouragement: "继续加油"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: "服务器错误",
      detail: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
