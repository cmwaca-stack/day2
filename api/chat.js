// Vercel 서버리스 함수: 환경변수 GEMINI_API_KEY 를 사용해 Gemini API 를 대신 호출한다.
// 브라우저에는 Key 가 노출되지 않는다.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const SYSTEM = '너는 제주도 특산물을 알려 주는 친절한 에이전트 ‘제주 특산물 에이전트’야. ' +
  '한라봉·감귤·흑돼지·갈치·옥돔·오메기떡 같은 제주 특산물에 대해 존댓말로 짧게(3문장 이내) 답해. ' +
  '제철·선물용 추천을 해도 되지만 가격·재고처럼 바뀌는 정보는 단정하지 말고, 모르면 모른다고 말해. 제주 특산물과 무관한 질문은 정중히 돌려서 안내해.';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로만 보내 주세요.' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: '서버에 GEMINI_API_KEY 환경변수가 설정되지 않았어요.' });

  // 대화 기록: [{ role: 'user' | 'agent', text }] — 최근 12개만, 글자 수도 제한
  const history = (Array.isArray(req.body && req.body.messages) ? req.body.messages : []).slice(-12)
    .map(m => ({ role: m.role === 'agent' ? 'model' : 'user', parts: [{ text: String(m.text || '').slice(0, 500) }] }))
    .filter(m => m.parts[0].text);
  if (!history.length || history[history.length - 1].role !== 'user')
    return res.status(400).json({ error: '메시지가 비어 있어요.' });
  while (history[0].role !== 'user') history.shift();          // 대화는 사용자 발언으로 시작해야 한다

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: history }),
    });
    if (!r.ok) {
      console.error('gemini', r.status, (await r.text()).slice(0, 200));   // Vercel 로그에서 원인 확인
      return res.status(502).json({ error: 'Gemini 요청 실패 (' + r.status + ')' });
    }
    const j = await r.json();
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const reply = parts.map(p => p.text || '').join('').trim();
    if (!reply) return res.status(502).json({ error: 'Gemini 가 답을 주지 않았어요.' });
    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e.message);
    return res.status(502).json({ error: 'Gemini 에 연결하지 못했어요.' });
  }
};
