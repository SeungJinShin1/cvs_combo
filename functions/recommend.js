/**
 * Cloudflare Pages Functions: 서버 사이드에서 API 키를 안전하게 사용하여
 * Gemini API에 요청을 보내고 결과를 반환하는 프록시 함수입니다.
 */
export async function onRequestPost(context) {
    try {
      // 1. Cloudflare 대시보드에 등록한 변수 가져오기
      const apiKey = context.env.VITE_GEMINI_API_KEY;
      const { brand, budget, mood } = await context.request.json();
  
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Cloudflare 설정에서 API 키를 찾을 수 없습니다." }), { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
  
      const systemPrompt = `당신은 한국 편의점 전문가 '꿀조합 마스터'입니다. 브랜드: ${brand}, 예산: ${budget}원 이내, 기분: ${mood}에 맞는 상품 조합을 추천하세요. 결과는 반드시 JSON으로만 응답하세요: { "combo_name": "String", "total_price_estimate": Number, "items": [{"name": "String", "price": Number}], "recipe_steps": ["String"], "ai_comment": "String" }`;
  
      // 2. 서버 사이드에서 Gemini API 호출 (브라우저 네트워크 탭에 키가 노출되지 않음)
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `추천해줘: ${brand}, ${budget}원, ${mood}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
  
      const data = await response.json();
      
      // Cloudflare 환경에서는 Response 객체를 직접 반환해야 합니다.
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" }
      });
  
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }