export default async function handler(req, res) {
  console.log("API start");

  try {
    const { sentence, keywords, imageDescription } = req.body;

    console.log("input:", sentence);

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
            role: "user",
            content: `请批改句子并返回JSON：${sentence}`
          }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();

    console.log("OpenAI response:", data);

    if (!data.choices) {
      return res.status(500).json({
        error: "OpenAI返回错误",
        detail: data
      });
    }

    const text = data.choices[0].message.content;

    return res.status(200).json({
      raw: text,
      message: "AI已返回（调试模式）"
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);

    return res.status(500).json({
      error: "服务器异常",
      detail: err.message
    });
  }
}
