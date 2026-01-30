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
const STORAGE_KEY = 'cvs_omakase_list'; // 로컬 스토리지 저장 키

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
        // [보안] API 키는 서버(functions/recommend.js)에 숨겨져 있습니다.
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

// [핵심 변경] 데이터 저장 함수 (큐 구조: 신규 추가 시 오래된 것 자동 삭제)
function saveToFavorites() {
    if (!currentResult) {
        alert("저장할 추천 결과가 없습니다.");
        return;
    }

    // 1. 기존 데이터 가져오기 (없으면 빈 배열)
    const savedData = localStorage.getItem(STORAGE_KEY);
    let list = savedData ? JSON.parse(savedData) : [];

    // 2. 새 항목 객체 생성
    const newItem = {
        id: Date.now(), // 고유 ID
        ...currentResult,
        store_brand: currentBrand,
        savedAt: Date.now()
    };

    // 3. 리스트 맨 앞에 추가 (Unshift)
    list.unshift(newItem);

    // 4. 3개 초과 시 뒤(가장 오래된 것)에서부터 삭제 (Slice)
    if (list.length > 3) {
        list = list.slice(0, 3);
    }

    // 5. 다시 로컬 스토리지에 저장
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    
    // UI 갱신 및 알림
    loadFavorites();
    alert("저장되었습니다! (최대 3개까지 자동 관리됩니다)");
}

// [핵심 변경] 데이터 불러오기 함수 (삭제 버튼 제거됨)
function loadFavorites() {
    const listEl = document.getElementById('favorites-list');
    const countEl = document.getElementById('fav-count');
    
    // 로컬 스토리지에서 데이터 읽기
    const savedData = localStorage.getItem(STORAGE_KEY);
    const list = savedData ? JSON.parse(savedData) : [];

    if (countEl) countEl.innerText = list.length;
    if (!listEl) return;

    if (list.length === 0) {
        listEl.innerHTML = '<p class="text-gray-600 text-center py-5 text-sm">저장된 조합이 없습니다.</p>';
        return;
    }

    listEl.innerHTML = '';
    
    list.forEach(data => {
        const card = document.createElement('div');
        // 디자인: 클릭 가능하게 커서 포인터 추가 및 삭제 버튼 공간 제거
        card.className = 'bg-slate-800 p-4 rounded-xl flex justify-between items-center border-l-4 border-orange-500 hover:bg-slate-700 transition-colors cursor-pointer';
        card.innerHTML = `
            <div class="flex-1">
                <p class="font-bold text-sm text-white">${data.combo_name || '이름 없음'}</p>
                <p class="text-[10px] text-gray-400">${data.store_brand || '-'} • ₩${(data.total_price_estimate || 0).toLocaleString()}</p>
            </div>
            <div>
                <button class="v-btn text-xs bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded transition-colors">보기</button>
            </div>`;
        
        listEl.appendChild(card);
        
        // 카드 전체 클릭 시 보기 실행
        card.onclick = () => {
            currentBrand = data.store_brand; 
            displayResult(data);
        };

        // 보기 버튼 클릭 시 (이벤트 버블링 방지 및 실행)
        card.querySelector('.v-btn').onclick = (e) => { 
            e.stopPropagation(); 
            currentBrand = data.store_brand; 
            displayResult(data); 
        };
    });
}

// 이벤트 리스너 연결
const saveBtn = document.getElementById('save-to-favorites');
if (saveBtn) {
    saveBtn.onclick = saveToFavorites;
}

// 페이지 로드 시 저장된 목록 불러오기
loadFavorites();