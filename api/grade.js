export default async function handler(req, res) {
  // 允许跨域（方便调试）
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // 只接受 POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // 检查环境变量
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('环境变量 DEEPSEEK_API_KEY 未设置');
      return res.status(500).json({ 
        error: 'DEEPSEEK_API_KEY 环境变量未设置',
        hint: '请在 Vercel 项目 Settings → Environment Variables 中添加'
      });
    }

    // 解析请求体
    const { sentence, keywords, imageDescription } = req.body;
    if (!sentence || !keywords) {
      return res.status(400).json({ error: '缺少 sentence 或 keywords' });
    }

    // 构造提示词
    const prompt = `你是一位汉语语法专家。请根据图片描述（${imageDescription}）和关键词（${keywords.join('、')}），评价学生的造句：“${sentence}”。要求关注补语的使用是否正确。

输出格式必须是 JSON：
{
  "score": 85,
  "complementType": "结果补语",
  "isCorrect": true,
  "comment": "句子完整，补语使用正确。",
  "correction": "",
  "encouragement": "很好！"
}`;

    // 调用 DeepSeek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Output only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API 返回错误:', response.status, errorText);
      return res.status(500).json({ error: 'DeepSeek API 调用失败', details: errorText });
    }

    const data = await response.json();
    const aiContent = data.choices[0]?.message?.content || '{}';
    console.log('AI 返回:', aiContent);

    let parsed;
    try {
      parsed = JSON.parse(aiContent);
    } catch (e) {
      console.error('JSON 解析失败:', aiContent);
      parsed = {};
    }

    const result = {
      score: parsed.score ?? 0,
      complementType: parsed.complementType ?? '未识别',
      isCorrect: parsed.isCorrect ?? false,
      comment: parsed.comment ?? '无评语',
      correction: parsed.correction ?? '',
      encouragement: parsed.encouragement ?? '继续加油！'
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Handler 捕获错误:', error);
    return res.status(500).json({ 
      error: '服务器内部错误', 
      message: error.message,
      stack: error.stack 
    });
  }
}
