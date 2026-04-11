export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  const { sentence, keywords, imageDescription } = req.body;

  if (!sentence) {
    return res.status(400).json({ message: "句子不能为空" });
  }

  const prompt = `
你是一名专业对外汉语老师，正在批改学生造句。

【任务】
- 检查学生句子是否正确
- 必须使用关键词：${keywords?.join("、")}
- 场景：${imageDescription}

【你必须做的事情】
1. 判断是否正确
2. 找出错误（如果有）
3. 给出标准正确句子（非常重要！）
4. 简单解释原因
5. 给鼓励

【必须严格输出 JSON，不允许任何解释文字】

格式如下：
{
  "score": number,
  "isCorrect": boolean,
  "error": "错误说明（没有错误写'无'）",
  "correction": "标准正确句子",
  "explanation": "简单解释",
  "encouragement": "鼓励语"
}

学生句子：
${sentence}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "你必须只输出JSON，不允许任何解释，不允许Markdown。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();

    let text = data?.choices?.[0]?.message?.content || "";

    // 清理 AI 输出
    text = text.replace(/```json|```/g, "").trim();

    let result;

    try {
      result = JSON.parse(text);
    } catch (e) {
      // ❗AI没按格式输出时的兜底（保证一定有结果）
      return res.status(200).json({
        score: 60,
        isCorrect: false,
        error: "AI格式错误",
        correction: sentence + "（AI修正失败，但已返回原句）",
        explanation: "系统无法解析AI输出，但已返回结果",
        encouragement: "继续加油！"
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error(error);

    return res.status(200).json({
      score: 50,
      isCorrect: false,
      error: "服务器错误",
      correction: sentence,
      explanation: "系统异常",
      encouragement: "再试一次！"
    });
  }
}
