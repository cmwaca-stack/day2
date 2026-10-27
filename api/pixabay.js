// Vercel 서버리스 함수: 환경변수 PIXABAY_API_KEY 를 사용해 Pixabay 를 대신 호출한다.
// 브라우저에는 Key 가 노출되지 않는다.
module.exports = async (req, res) => {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) {
    return res.status(500).json({ error: '서버에 PIXABAY_API_KEY 환경변수가 설정되지 않았어요.' });
  }

  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: '검색어를 입력하세요.' });
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(20, Math.max(3, parseInt(req.query.per_page, 10) || 10));

  const url = 'https://pixabay.com/api/?' + new URLSearchParams({
    key, q, page, per_page: perPage,
    image_type: 'photo', lang: 'ko', safesearch: 'true',
  });

  try {
    const r = await fetch(url);
    if (!r.ok) {
      return res.status(502).json({ error: 'Pixabay 요청 실패 (' + r.status + ')' });
    }
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({
      totalHits: data.totalHits,
      hits: data.hits.map(h => ({ webformatURL: h.webformatURL, tags: h.tags })),
    });
  } catch (e) {
    return res.status(502).json({ error: 'Pixabay 에 연결하지 못했어요.' });
  }
};
