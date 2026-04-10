// 这是 Vercel Serverless 函数，用于调用阿里通义千问 API 批改句子

export default async function handler(req, res) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sentence, keywords, imageDescription } = req.body;

  if (!sentence || !keywords) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  // 从环境变量中读取阿里云 API Key（在 Vercel 项目中设置）
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error('未设置 DASHSCOPE_API_KEY 环境变量');
    return res.status(500).json({ error: '服务器配置错误' });
  }

  // 构造提示词 (精心设计以专注于补语评判)
  const prompt = `你是一位汉语语法专家，专门评估学生造句中**补语**的使用是否正确。

【任务】根据提供的图片描述和关键词，判断学生的造句是否恰当，特别关注补语的使用。

【规则】
1. 如果句子中根本没有补语，请指出并扣分（最多扣30分）。
2. 如果补语使用正确，请指出是哪种补语（结果/趋向/可能/程度/状态）。
3. 如果补语使用错误，请解释为什么错，并给出正确的句子。
4. 除了补语之外，也请检查主谓宾结构、语序、逻辑是否通顺。
5. 评分标准：0-100分，90分以上为完美，60分以下需要重新学习该补语。

【图片描述】${imageDescription}
【要求使用的关键词】${keywords.join('、')}
【学生造句】${sentence}

【输出格式】严格 JSON，不要输出其他任何内容：
{
  "score": 整数,
  "complementType": "结果补语/趋向补语/可能补语/程度补语/状态补语/无",
  "isCorrect": true/false,
  "comment": "详细评价，指出优点和错误",
  "correction": "如果错误，给出正确句子；如果正确，可为空字符串",
  "encouragement": "一句鼓励的话"
}`;

  // 调用阿里通义千问 API
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  const payload = {
    model: 'qwen-turbo',
    input: {
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs only valid JSON.' },
        { role: 'user', content: prompt }
      ]
    },
    parameters: {
      result_format: 'message',
      temperature: 0.3,   // 降低随机性，让批改更稳定
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('阿里云 API 错误:', errorText);
      return res.status(500).json({ error: 'AI 服务调用失败' });
    }

    const data = await response.json();
    let aiText = data.output?.choices?.[0]?.message?.content || '';

    // 尝试解析 JSON（AI 可能会在 JSON 前后加额外说明）
    let parsed;
    try {
      // 提取可能的 JSON 部分（防止 AI 输出额外文字）
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(aiText);
      }
    } catch (e) {
      console.error('解析 AI 返回失败:', aiText);
      // 降级返回一个友好提示
      parsed = {
        score: 0,
        complementType: '未知',
        isCorrect: false,
        comment: 'AI 返回格式异常，请稍后再试。',
        correction: '',
        encouragement: '再试试看！'
      };
    }

    // 确保必要字段存在
    return res.status(200).json({
      score: parsed.score ?? 0,
      complementType: parsed.complementType ?? '未识别',
      isCorrect: parsed.isCorrect ?? false,
      comment: parsed.comment ?? '暂无详细评价',
      correction: parsed.correction ?? '',
      encouragement: parsed.encouragement ?? '继续努力！'
    });
  } catch (error) {
    console.error('请求异常:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}