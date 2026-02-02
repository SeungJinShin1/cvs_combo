/**
 * Gemini API에 요청을 보내고 결과를 반환하는 프록시 함수입니다.
 */
export default async function handler(req, res) {
  // 1. HTTP 메서드 확인 (POST만 허용)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. 환경 변수 확인 (Vercel 대시보드에서 설정한 값)
    // Vercel은 process.env 객체를 통해 환경 변수에 접근합니다.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server Configuration Error: API Key not found." });
    }

    // 3. 요청 데이터 파싱 (Vercel은 req.body로 바로 접근 가능)
    const { brand, budget, mood } = req.body;

    const systemPrompt = `당신은 한국 편의점 전문가 '꿀조합 마스터'입니다. 브랜드: ${brand}, 예산: ${budget}원 이내, 기분: ${mood}에 맞는 상품 조합을 추천하세요. 결과는 반드시 JSON으로만 응답하세요: { "combo_name": "String", "total_price_estimate": Number, "items": [{"name": "String", "price": Number}], "recipe_steps": ["String"], "ai_comment": "String" }`;

    // 4. Google Gemini API 호출
    // 미국 서버에서 요청하므로 최신 모델인 'gemini-2.5-flash'를 사용해도 지역 제한에 걸리지 않습니다.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `추천해줘: ${brand}, ${budget}원, ${mood}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json" },
        // 안전 필터 해제 (술/매운 음식 허용)
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    const data = await response.json();
    
    // 5. 에러 처리
    if (data.error) {
        console.error("Google API Error:", data.error);
        return res.status(500).json({ 
            error: `Google API Error: ${data.error.message}`,
            details: data.error 
        });
    }

    // 6. 성공 응답
    return res.status(200).json(data);

  } catch (error) {
    console.error("Server Function Error:", error);
    return res.status(500).json({ error: `Server Error: ${error.message}` });
  }
}