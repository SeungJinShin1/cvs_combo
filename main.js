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

let currentBrand = '';
let currentBudget = 3000;
let currentResult = null;
const STORAGE_KEY = 'cvs_omakase_list'; // 로컬 스토리지 키

// 화면 전환
window.goToStep = (step) => {
    document.querySelectorAll('.step-container').forEach(el => el.classList.add('hidden'));
    const targetId = isNaN(step) ? `step-${step}` : `step-${step}`;
    const target = document.getElementById(targetId);
    if (target) target.classList.remove('hidden');
    // 화면 전환 시 스크롤 맨 위로
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 선택 핸들러 함수들
window.selectBrand = (brand) => { 
    currentBrand = brand; 
    goToStep('budget'); 
};
window.selectBudget = (budget) => { 
    currentBudget = budget; 
    goToStep(2); 
};

// AI 추천 생성 (Cloudflare Functions 호출)
window.generateOmakase = async (mood) => {
    goToStep('loading');

    try {
        // [보안] API 키는 서버(functions/recommend.js)에 숨겨져 있습니다.
        // 브라우저에서는 /recommend 경로로 요청만 보냅니다.
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
            throw new Error(data.error || "메뉴 추천 실패");
        }

        // AI 응답 데이터 검증
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error("AI가 유효한 응답을 주지 않았습니다.");
        }

        const resultText = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(resultText);
        
        currentResult = result;
        displayResult(result);

    } catch (error) {
        console.error("AI Error:", error);
        alert(`알바생이 바쁘네요! (${error.message})`);
        goToStep(2); // 오류 시 다시 선택 화면으로
    }
};

// 결과 표시 함수
function displayResult(res) {
    document.getElementById('res-title').innerText = res.combo_name;
    document.getElementById('res-brand').innerText = `Store: ${currentBrand}`;
    document.getElementById('res-price').innerText = `₩ ${res.total_price_estimate.toLocaleString()}`;
    document.getElementById('res-comment').innerText = res.ai_comment;
    
    // 구성품 목록 생성
    const itemsHtml = res.items.map(i => `
        <div class="flex justify-between">
            <span>- ${i.name}</span>
            <span>${i.price.toLocaleString()}</span>
        </div>`).join('');
    document.getElementById('res-items').innerHTML = itemsHtml;

    // 레시피 단계 생성
    const recipeHtml = res.recipe_steps.map((s,idx) => `<p class="mb-1">${idx+1}. ${s}</p>`).join('');
    document.getElementById('res-recipe').innerHTML = recipeHtml;

    goToStep('result');
}

// 저장하기 함수 (최대 3개, 큐 방식)
function saveToFavorites() {
    if (!currentResult) return;

    const savedData = localStorage.getItem(STORAGE_KEY);
    let list = savedData ? JSON.parse(savedData) : [];

    const newItem = {
        id: Date.now(),
        ...currentResult,
        store_brand: currentBrand,
        savedAt: Date.now()
    };

    // 리스트 맨 앞에 추가
    list.unshift(newItem);

    // 3개 넘으면 가장 오래된 것(뒤쪽) 삭제
    if (list.length > 3) {
        list = list.slice(0, 3);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    loadFavorites();
    alert("저장되었습니다! (최근 3개까지 보관)");
}

// 저장 목록 불러오기 함수
function loadFavorites() {
    const listEl = document.getElementById('favorites-list');
    const countEl = document.getElementById('fav-count');
    
    const savedData = localStorage.getItem(STORAGE_KEY);
    const list = savedData ? JSON.parse(savedData) : [];

    if (countEl) countEl.innerText = list.length;
    if (!listEl) return;

    if (list.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500 text-center py-4 text-xs">저장된 내역이 없습니다.</p>';
        return;
    }

    listEl.innerHTML = '';
    
    list.forEach(data => {
        const card = document.createElement('div');
        card.className = 'bg-slate-800 p-4 rounded-xl flex justify-between items-center border-l-4 border-orange-500 cursor-pointer hover:bg-slate-700 transition-colors mb-3';
        card.innerHTML = `
            <div class="flex-1 pr-2">
                <p class="font-bold text-sm text-white truncate">${data.combo_name}</p>
                <p class="text-[10px] text-gray-400">${data.store_brand} • ₩${data.total_price_estimate.toLocaleString()}</p>
            </div>
            <button class="text-xs bg-slate-600 px-3 py-2 rounded text-white hover:bg-slate-500 whitespace-nowrap">보기</button>
        `;
        
        // 카드 전체 클릭 이벤트 (상세 보기)
        const viewAction = (e) => {
            if(e) e.stopPropagation();
            currentBrand = data.store_brand;
            displayResult(data);
        };

        card.onclick = viewAction;
        card.querySelector('button').onclick = viewAction;
        
        listEl.appendChild(card);
    });
}

// 초기화 로직
const saveBtn = document.getElementById('save-to-favorites');
if (saveBtn) saveBtn.onclick = saveToFavorites;

// 페이지 로드 시 저장된 목록 불러오기
loadFavorites();

// HTML onclick에서 사용할 수 있도록 전역 함수로 등록
window.saveToFavorites = saveToFavorites;