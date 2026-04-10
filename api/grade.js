// 使用 DeepSeek API 批改句子
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sentence, keywords, imageDescription } = req.body;

  if (!sentence || !keywords) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务器配置错误：未设置 DEEPSEEK_API_KEY' });
  }

  const prompt = `你是一位汉语语法专家，专门评估学生造句中**补语**的使用是否正确。

【任务】根据图片描述和关键词，判断学生的造句是否恰当，特别关注补语。

【规则】
1. 没有补语扣分（最多扣30分）。
2. 补语正确则指出类型（结果/趋向/可能/程度/状态）。
3. 补语错误则解释原因并给出正确句子。
4. 检查主谓宾、语序、逻辑。
5. 评分：0-100分。

【图片描述】${imageDescription}
【关键词】${keywords.join('、')}
【学生造句】${sentence}

【输出格式】严格 JSON：
{
  "score": 整数,
  "complementType": "结果补语/趋向补语/可能补语/程度补语/状态补语/无",
  "isCorrect": true/false,
  "comment": "详细评价",
  "correction": "错误时的正确句子",
  "encouragement": "鼓励语"
}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that outputs only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API 错误:', errorText);
      return res.status(500).json({ error: 'AI 服务调用失败' });
    }

    const data = await response.json();
    const aiContent = data.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(aiContent);

    return res.status(200).json({
      score: parsed.score ?? 0,
      complementType: parsed.complementType ?? '未识别',
      isCorrect: parsed.isCorrect ?? false,
      comment: parsed.comment ?? '暂无评价',
      correction: parsed.correction ?? '',
      encouragement: parsed.encouragement ?? '继续努力！'
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'AI 响应超时，请稍后重试' });
    }
    console.error('请求异常:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
