import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// [중요] Firebase 설정
// Cloudflare 배포 환경에서는 __firebase_config 변수가 없을 수 있습니다.
// 만약 배포 후 저장 기능이 안 된다면, 아래 else 부분의 객체에 
// Firebase Console > Project Settings의 실제 설정값을 채워넣으세요.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : {
        apiKey: "YOUR_API_KEY_FROM_FIREBASE_CONSOLE",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
        messagingSenderId: "SENDER_ID",
        appId: "APP_ID"
    };

const appId = typeof __app_id !== 'undefined' ? __app_id : 'cvs-omakase';

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let user = null;
let currentBrand = '';
let currentBudget = 3000;
let currentResult = null;

// 화면 전환 함수
window.goToStep = (step) => {
    document.querySelectorAll('.step-container').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(isNaN(step) ? `step-${step}` : `step-${step}`);
    if (target) target.classList.remove('hidden');
};

window.selectBrand = (brand) => { currentBrand = brand; goToStep('budget'); };
window.selectBudget = (budget) => { currentBudget = budget; goToStep(2); };

// AI 추천 생성 함수 (Cloudflare Functions 연동)
window.generateOmakase = async (mood) => {
    goToStep('loading');

    try {
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

        if (!response.ok) {
            throw new Error(data.error || "메뉴 추천을 가져오는데 실패했습니다.");
        }

        // 데이터 유효성 검사
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            const errorMsg = data.error ? data.error.message : "AI가 적절한 답변을 생성하지 못했습니다.";
            throw new Error(`AI 응답 오류: ${errorMsg}`);
        }

        const resultText = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(resultText);
        
        currentResult = result;
        displayResult(result);

    } catch (error) {
        console.error("Error:", error);
        alert(`알바생이 지금 좀 바쁘네요! 사유: ${error.message}`);
        goToStep(2);
    }
};

// 결과 화면 표시 함수
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

// [주석 해제됨 & 보강됨] Firebase 인증 초기화
const initAuth = async () => {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("인증 실패:", error);
    }
};

// 인증 상태 감지 및 데이터 로드
onAuthStateChanged(auth, (u) => { 
    if (u) { 
        user = u; 
        loadFavorites(); 
    } 
});

// [주석 해제됨] 데이터 저장 함수
async function saveToFavorites() {
    if (!user) {
        alert("로그인 정보를 확인 중입니다. 잠시 후 다시 시도해주세요.");
        return;
    }
    if (!currentResult) {
        alert("저장할 추천 결과가 없습니다.");
        return;
    }
    
    try {
        const favCol = collection(db, 'artifacts', appId, 'users', user.uid, 'favorites');
        await addDoc(favCol, { 
            ...currentResult, 
            store_brand: currentBrand, 
            savedAt: Date.now() 
        });
        alert("나의 오마카세 리스트에 저장되었습니다!");
    } catch (e) {
        console.error("Save Error:", e);
        alert("저장에 실패했습니다. Firebase 설정을 확인해주세요.");
    }
}

// [주석 해제됨 & 정렬 추가] 데이터 불러오기 함수
function loadFavorites() {
    if (!user) return;
    const favCol = collection(db, 'artifacts', appId, 'users', user.uid, 'favorites');
    
    onSnapshot(favCol, (snapshot) => {
        const list = document.getElementById('favorites-list');
        const countEl = document.getElementById('fav-count');
        
        if (countEl) countEl.innerText = snapshot.size;
        if (!list) return;

        if (snapshot.empty) {
            list.innerHTML = '<p class="text-gray-600 text-center py-5 text-sm">저장된 조합이 없습니다.</p>';
            return;
        }

        // 최신순 정렬 (savedAt 내림차순)
        const items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        items.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

        list.innerHTML = '';
        
        items.forEach(data => {
            const card = document.createElement('div');
            card.className = 'bg-slate-800 p-4 rounded-xl flex justify-between items-center border-l-4 border-orange-500 hover:bg-slate-700 transition-colors cursor-pointer';
            card.innerHTML = `
                <div class="flex-1">
                    <p class="font-bold text-sm text-white">${data.combo_name || '이름 없음'}</p>
                    <p class="text-[10px] text-gray-400">${data.store_brand || '-'} • ₩${(data.total_price_estimate || 0).toLocaleString()}</p>
                </div>
                <div class="flex gap-2">
                    <button class="v-btn text-xs bg-slate-600 hover:bg-slate-500 text-white px-3 py-1 rounded transition-colors">보기</button>
                    <button class="d-btn text-xs text-red-400 hover:text-red-300 transition-colors">삭제</button>
                </div>`;
            
            list.appendChild(card);
            
            // 보기 버튼
            card.querySelector('.v-btn').onclick = (e) => { 
                e.stopPropagation(); 
                currentBrand = data.store_brand; 
                displayResult(data); 
            };
            
            // 삭제 버튼
            card.querySelector('.d-btn').onclick = async (e) => { 
                e.stopPropagation(); 
                if(confirm('정말 삭제하시겠습니까?')) {
                    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'favorites', data.id));
                }
            };
        });
    }, (err) => console.error("데이터 로드 오류:", err));
}

// 저장 버튼 이벤트 연결
const saveBtn = document.getElementById('save-to-favorites');
if (saveBtn) {
    saveBtn.onclick = saveToFavorites;
}

// 앱 시작 시 인증 초기화 실행
initAuth();