import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase 설정 (필요시 주석 해제하여 사용)
// const firebaseConfig = JSON.parse(__firebase_config);
// const appId = typeof __app_id !== 'undefined' ? __app_id : 'cvs-omakase';

// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);

// [수정됨] 클라이언트 사이드 API 키 제거
// 브라우저에서는 키를 관리하지 않고, Cloudflare Functions(/recommend)가 처리합니다.

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

// [수정됨] 직접 호출하던 fetchWithBackoff 함수는 더 이상 필요하지 않아 삭제하거나,
// 나중에 다른 용도로 쓸 수 있게 놔둘 수 있습니다. (여기서는 간결함을 위해 제거하고 직접 호출합니다)

window.generateOmakase = async (mood) => {
    // [수정됨] API 키 확인 로직 제거 (서버가 확인하므로)
    
    goToStep('loading');

    try {
        // [핵심 변경] 구글 API 직접 호출 -> 내 Cloudflare 서버(/recommend)로 요청
        // API 키는 서버(functions/recommend.js)에만 숨겨져 있어 안전합니다.
        const response = await fetch('/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                brand: currentBrand,
                budget: currentBudget,
                mood: mood
            })
        });

        const data = await response.json();

        // 서버에서 에러가 발생했다면(키 없음 등) 예외 처리
        if (!response.ok) {
            throw new Error(data.error || "메뉴 추천을 가져오는데 실패했습니다.");
        }

        // Gemini API 응답 구조에서 텍스트 결과만 추출하여 파싱
        // (functions/recommend.js가 그대로 반환해준 구조)
        const resultText = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(resultText);
        
        currentResult = result;
        displayResult(result);

    } catch (error) {
        console.error("Error:", error);
        // 에러 메시지를 사용자에게 알림
        alert(`알바생이 지금 좀 바쁘네요! 사유: ${error.message}`);
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

// Firebase 관련 로직 (필요시 주석 해제)
/*
const initAuth = async () => {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
    } else {
        await signInAnonymously(auth);
    }
};

onAuthStateChanged(auth, (u) => { if (u) { user = u; loadFavorites(); } });

async function saveToFavorites() {
    if (!user || !currentResult) return;
    const favCol = collection(db, 'artifacts', appId, 'users', user.uid, 'favorites');
    await addDoc(favCol, { ...currentResult, store_brand: currentBrand, savedAt: Date.now() });
    alert("저장되었습니다!");
}

function loadFavorites() {
    if (!user) return;
    const favCol = collection(db, 'artifacts', appId, 'users', user.uid, 'favorites');
    onSnapshot(favCol, (snapshot) => {
        const list = document.getElementById('favorites-list');
        document.getElementById('fav-count').innerText = snapshot.size;
        list.innerHTML = snapshot.empty ? '<p class="text-gray-600 text-center py-5 text-sm">저장된 조합이 없습니다.</p>' : '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const card = document.createElement('div');
            card.className = 'bg-slate-800 p-4 rounded-xl flex justify-between items-center border-l-4 border-orange-500';
            card.innerHTML = `<div><p class="font-bold text-sm">${data.combo_name}</p><p class="text-[10px] text-gray-400">${data.store_brand}</p></div>
                                      <div class="flex gap-2"><button class="v-btn text-xs bg-slate-700 px-3 py-1 rounded">보기</button><button class="d-btn text-xs text-red-500">삭제</button></div>`;
            list.appendChild(card);
            card.querySelector('.v-btn').onclick = () => { currentBrand = data.store_brand; displayResult(data); };
            card.querySelector('.d-btn').onclick = () => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'favorites', docSnap.id));
        });
    }, (err) => console.error(err));
}

if (document.getElementById('save-to-favorites')) {
    document.getElementById('save-to-favorites').onclick = saveToFavorites;
}
// initAuth(); 
*/