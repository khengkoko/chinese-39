export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "只支持 POST 请求" });
  }

  const { sentence, keywords, imageDescription } = req.body;

  if (!sentence) {
    return res.status(400).json({ message: "句子不能为空" });
  }

  const prompt = `
你是一位专业的对外汉语老师，请批改学生句子。

【任务】
- 学生必须使用关键词：${keywords.join("、")}
- 场景：${imageDescription}
- 判断补语类型（结果 / 趋向 / 可能 / 程度 / 状态）
- 检查语法和自然度
- 给出修改句

【评分标准】
- 补语使用（40分）
- 语法（30分）
- 自然度（30分）

【必须输出 JSON（不能有任何多余文字）】
{
  "score": number,
  "complementType": "字符串",
  "comment": "指出具体问题",
  "correction": "修改后的句子",
  "encouragement": "一句鼓励的话",
  "errorDetail": "具体错误解释（如有）",
  "keywordCheck": "关键词使用情况"
}

学生句子：${sentence}
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
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    const data = await response.json();

    let text = data.choices[0].message.content;

    // 清理 ```json
    text = text.replace(/```json|```/g, "").trim();

    let result;

    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error("JSON解析失败");
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("AI错误:", error);

    return res.status(200).json({
      score: 60,
      complementType: "未识别",
      comment: "系统暂时无法分析，请重试",
      correction: sentence,
      encouragement: "再试一次！",
      errorDetail: "AI返回异常",
      keywordCheck: "未检测"
    });
  }
}
