import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase 설정
// const firebaseConfig = JSON.parse(__firebase_config);
// const appId = typeof __app_id !== 'undefined' ? __app_id : 'cvs-omakase';

// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);

/**
 * [보안 패치] 하드코딩된 API Key를 제거했습니다.
 * Vite 등의 빌드 도구를 사용한다면 .env 파일에 VITE_GEMINI_API_KEY를 정의하세요.
 * GitHub 배포 시에는 각 배포 서비스(Vercel, Netlify 등)의 환경 변수 설정에 키를 입력해야 합니다.
 */
const apiKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY)
                ? import.meta.env.VITE_GEMINI_API_KEY
                : "";

let user = null;
let currentBrand = '';
let currentBudget = 3000;
let currentResult = null;

window.goToStep = (step) => {
    document.querySelectorAll('.step-container').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(isNaN(step) ? `step-${step}` : `step-${step}`);
    if (target) target.classList.remove('hidden');
};

window.selectBrand = (brand) => { currentBrand = brand; goToStep('budget'); };
window.selectBudget = (budget) => { currentBudget = budget; goToStep(2); };

async function fetchWithBackoff(url, options, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return await response.json();
        } catch (err) {
            if (i === retries - 1) throw err;
        }
        const delay = Math.pow(2, i) * 1000;
        await new Promise(res => setTimeout(res, delay));
    }
}

window.generateOmakase = async (mood) => {
    if (!apiKey) {
        alert("API 키가 설정되지 않았습니다. .env 설정이나 배포 환경 변수를 확인하세요.");
        goToStep(2);
        return;
    }

    goToStep('loading');

    const systemPrompt = `당신은 한국 편의점 전문가 '꿀조합 마스터'입니다.
    브랜드: ${currentBrand}, 예산: ${currentBudget}원 이내, 기분: ${mood}에 맞는 상품 조합을 추천하세요.
    반드시 아래 JSON만 출력하세요:
    { "combo_name": "String", "total_price_estimate": Number, "items": [{"name": "String", "price": Number}], "recipe_steps": ["String"], "ai_comment": "String" }`;

    try {
        const data = await fetchWithBackoff(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `추천해줘: ${currentBrand}, ${currentBudget}원, ${mood}` }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const result = JSON.parse(data.candidates[0].content.parts[0].text);
        currentResult = result;
        displayResult(result);

    } catch (error) {
        console.error("Error:", error);
        alert("알바생이 지금 바쁘네요! API 키 유효성이나 네트워크를 확인해주세요.");
        goToStep(2);
    }
};

function displayResult(res) {
    document.getElementById('res-title').innerText = res.combo_name;
    document.getElementById('res-brand').innerText = `Store: ${currentBrand}`;
    document.getElementById('res-price').innerText = `₩ ${res.total_price_estimate.toLocaleString()}`;
    document.getElementById('res-comment').innerText = res.ai_comment;
    document.getElementById('res-items').innerHTML = res.items.map(i => `<div class="flex justify-between"><span>- ${i.name}</span><span>${i.price.toLocaleString()}</span></div>`).join('');
    document.getElementById('res-recipe').innerHTML = res.recipe_steps.map((s,idx) => `<p>${idx+1}. ${s}</p>`).join('');
    goToStep('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// const initAuth = async () => {
//     if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
//         await signInWithCustomToken(auth, __initial_auth_token);
//     } else {
//         await signInAnonymously(auth);
//     }
// };

// onAuthStateChanged(auth, (u) => { if (u) { user = u; loadFavorites(); } });

// async function saveToFavorites() {
//     if (!user || !currentResult) return;
//     const favCol = collection(db, 'artifacts', appId, 'users', user.uid, 'favorites');
//     await addDoc(favCol, { ...currentResult, store_brand: currentBrand, savedAt: Date.now() });
//     alert("저장되었습니다!");
// }

// function loadFavorites() {
//     if (!user) return;
//     const favCol = collection(db, 'artifacts', appId, 'users', user.uid, 'favorites');
//     onSnapshot(favCol, (snapshot) => {
//         const list = document.getElementById('favorites-list');
//         document.getElementById('fav-count').innerText = snapshot.size;
//         list.innerHTML = snapshot.empty ? '<p class="text-gray-600 text-center py-5 text-sm">저장된 조합이 없습니다.</p>' : '';
//         snapshot.forEach(docSnap => {
//             const data = docSnap.data();
//             const card = document.createElement('div');
//             card.className = 'bg-slate-800 p-4 rounded-xl flex justify-between items-center border-l-4 border-orange-500';
//             card.innerHTML = `<div><p class="font-bold text-sm">${data.combo_name}</p><p class="text-[10px] text-gray-400">${data.store_brand}</p></div>
//                                       <div class="flex gap-2"><button class="v-btn text-xs bg-slate-700 px-3 py-1 rounded">보기</button><button class="d-btn text-xs text-red-500">삭제</button></div>`;
//             list.appendChild(card);
//             card.querySelector('.v-btn').onclick = () => { currentBrand = data.store_brand; displayResult(data); };
//             card.querySelector('.d-btn').onclick = () => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'favorites', docSnap.id));
//         });
//     }, (err) => console.error(err));
// }

// document.getElementById('save-to-favorites').onclick = saveToFavorites;
// initAuth();