console.log("main.js loaded");
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global Variables
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
let app, auth, db;

try {
    if (typeof __firebase_config !== 'undefined') {
        const firebaseConfig = JSON.parse(__firebase_config);
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'cvs-omakase';
        
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized successfully.");
    } else {
        console.error("Firebase config is not defined. App will run without Firebase features.");
    }
} catch (error) {
    console.error("Error initializing Firebase:", error);
}

let user = null;
let currentBrand = '';
let currentBudget = 0;
let currentResult = null;

// Step Control
window.goToStep = (stepNumber) => {
    document.querySelectorAll('.step-container').forEach(el => el.classList.add('hidden'));
    if (stepNumber === 1) document.getElementById('step-1').classList.remove('hidden');
    if (stepNumber === 2) document.getElementById('step-2').classList.remove('hidden');
    if (stepNumber === 3) document.getElementById('step-3').classList.remove('hidden');
    if (stepNumber === 'loading') document.getElementById('step-loading').classList.remove('hidden');
    if (stepNumber === 'result') document.getElementById('step-result').classList.remove('hidden');
};

window.selectBrand = (brand) => {
    console.log("Brand selected:", brand);
    currentBrand = brand;
    goToStep(2);
};

window.selectBudget = (budget) => {
    console.log("Budget selected:", budget);
    currentBudget = budget;
    goToStep(3);
};

// Loading Messages
const loadingMessages = [
    "AI 알바생이 유통기한 확인 중...",
    "전자레인지 줄 서는 중...",
    "온수기에 물이 끓는 중...",
    "결합 할인 카드 찾는 중...",
    "다른 알바생이랑 레시피 공유 중..."
];

// Gemini AI Call
window.generateOmakase = async (mood) => {
    goToStep('loading');
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
        document.getElementById('loading-text').innerText = loadingMessages[msgIdx % loadingMessages.length];
        msgIdx++;
    }, 2000);

    const systemPrompt = `당신은 한국의 편의점(GS25, CU, 세븐일레븐, 이마트24) 제품을 통달한 '편의점 꿀조합 마스터'입니다. 
    사용자가 선택한 브랜드와 기분(Mood), 그리고 예산(${currentBudget}원)에 맞춰, 현재 실제로 판매 중인 제품들을 조합해 가장 맛있는 레시피를 제안하세요.
    최종 가격은 반드시 예산을 초과해서는 안 됩니다.
    조합의 이름은 SNS에서 유행할 법한 재치 있는 이름으로 지으세요. 말투는 친근하고 유머러스한 '20대 편의점 알바생' 톤을 유지하세요.
    결과는 반드시 아래 JSON 형식으로만 응답하세요:
    {
        "combo_name": "String",
        "store_brand": "${currentBrand}",
        "mood_tag": "${mood}",
        "budget": ${currentBudget},
        "total_price_estimate": Number,
        "items": [{"name": String, "price": Number}],
        "recipe_steps": [String],
        "ai_comment": String
    }`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `브랜드: ${currentBrand}, 예산: ${currentBudget}원, 오늘의 기분: ${mood}` }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        const result = JSON.parse(data.candidates[0].content.parts[0].text);
        currentResult = result;
        displayResult(result);
    } catch (error) {
        console.error("AI 생성 실패:", error);
        alert("알바생이 지금 바쁘네요... 다시 시도해주세요!");
        goToStep(3);
    } finally {
        clearInterval(msgInterval);
    }
};

function displayResult(res) {
    document.getElementById('res-title').innerText = res.combo_name;
    document.getElementById('res-brand').innerText = `Store: ${res.store_brand}`;
    document.getElementById('res-price').innerText = `₩ ${res.total_price_estimate.toLocaleString()}`;
    document.getElementById('res-comment').innerText = res.ai_comment;

    const itemsList = document.getElementById('res-items');
    itemsList.innerHTML = res.items.map(item => `
        <div class="flex justify-between">
            <span>- ${item.name}</span>
            <span>${item.price.toLocaleString()}</span>
        </div>
    `).join('');

    const recipeList = document.getElementById('res-recipe');
    recipeList.innerHTML = res.recipe_steps.map(step => `<p>${step}</p>`).join('');

    goToStep('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Firestore Logic
const initAuth = async () => {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    } catch (err) { console.error("Auth failed", err); }
};

onAuthStateChanged(auth, (u) => {
    if (u) {
        user = u;
        loadFavorites();
    }
});

async function saveToFavorites() {
    if (!user || !currentResult) return;
    try {
        const favCol = collection(db, 'artifacts', appId, 'users', user.uid, 'favorites');
        await addDoc(favCol, {
            ...currentResult,
            savedAt: Date.now()
        });
        alert("저장 완료! '나의 오마카세'에서 확인하세요.");
    } catch (e) { console.error("Save failed", e); }
}

function loadFavorites() {
    if (!user) return;
    const favCol = collection(db, 'artifacts', appId, 'users', user.uid, 'favorites');
    onSnapshot(favCol, (snapshot) => {
        const list = document.getElementById('favorites-list');
        document.getElementById('fav-count').innerText = snapshot.size;
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<p class="text-gray-600 text-center py-10 text-sm">아직 저장된 조합이 없습니다.</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const card = document.createElement('div');
            card.className = 'bg-slate-800 p-4 rounded-xl flex justify-between items-center border-l-4 border-orange-500';
            card.innerHTML = `
                <div>
                    <p class="font-bold text-sm">${data.combo_name}</p>
                    <p class="text-[10px] text-gray-400">${data.store_brand} • ₩${data.total_price_estimate.toLocaleString()}</p>
                </div>
                <div class="flex gap-2">
                     <button class="view-btn text-xs bg-slate-700 px-3 py-1 rounded" data-id="${docSnap.id}">보기</button>
                     <button class="del-btn text-xs text-red-500" data-id="${docSnap.id}">삭제</button>
                </div>
            `;
            list.appendChild(card);

            card.querySelector('.view-btn').onclick = () => {
                currentResult = data;
                displayResult(data);
            };
            card.querySelector('.del-btn').onclick = async () => {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'favorites', docSnap.id));
            };
        });
    }, (err) => console.error("Snapshot error", err));
}

document.getElementById('save-to-favorites').onclick = saveToFavorites;

initAuth();