document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const steps = {
        step1: document.getElementById('step1'),
        step2: document.getElementById('step2'),
        loading: document.getElementById('loading'),
        result: document.getElementById('result'),
    };

    const storeButtons = document.querySelectorAll('.store-btn');
    const moodButtons = document.querySelectorAll('.mood-btn');
    const retryButton = document.getElementById('retry-btn');
    const loadingText = document.getElementById('loading-text');
    const resultCard = document.querySelector('.result-card'); // Added for animation

    // User choices
    let userChoices = {
        store: '',
        mood: ''
    };

    // --- Mock Data (AI Simulation) ---
    const mockApi = {
        stress: [
            {
                combo_name: "치즈폭포 불닭 정식",
                store_brand: "GS25",
                mood_tag: "스트레스 만땅",
                total_price_estimate: 6800,
                calorie_estimate: 1200, // 임시 값
                items: [
                    { name: "불닭볶음면", category: "Main", price: 1800 },
                    { name: "스트링치즈", category: "Topping", price: 1500 },
                    { name: "비엔나 소시지", category: "Topping", price: 2500 },
                    { name: "쿨피스", category: "Drink", price: 1000 },
                ],
                recipe_steps: [
                    "1. 불닭볶음면을 조리법대로 익힌 후 물을 조금만 남기고 버립니다.",
                    "2. 스트링치즈와 소시지를 잘라 넣고 소스를 부어 섞어줍니다.",
                    "3. 전자레인지에 1분 30초 돌려 치즈를 완전히 녹이면 완성! 쿨피스로 매운맛을 달래주세요."
                ],
                ai_comment: "이거 먹으면 내일 얼굴 붓지만 후회는 없다."
            }
        ],
        drink: [
            {
                combo_name: "공화춘의 눈물 세트",
                store_brand: "CU",
                mood_tag: "퇴근길 혼술",
                total_price_estimate: 15900,
                calorie_estimate: 1500, // 임시 값
                items: [
                    { name: "공화춘 짜장", category: "Main", price: 1900 },
                    { name: "삶은계란 2입", category: "Side", price: 2000 },
                    { name: "캔맥주 (4캔)", category: "Drink", price: 12000 },
                ],
                recipe_steps: [
                    "1. 공화춘 짜장면을 맛있게 조리합니다.",
                    "2. 삶은계란 하나는 반으로 잘라 짜장면 위에 올립니다.",
                    "3. 남은 계란과 함께 시원한 캔맥주를 곁들여 하루의 피로를 날려보세요."
                ],
                ai_comment: "퇴근길의 고단함, 이 한 잔으로 씻어내리."
            }
        ],
        hangover: [
            {
                combo_name: "속풀리는 황태해장국밥",
                store_brand: "세븐일레븐",
                mood_tag: "해장이 시급해",
                total_price_estimate: 6800,
                calorie_estimate: 800, // 임시 값
                items: [
                    { name: "컵누들 우동맛", category: "Main", price: 1200 },
                    { name: "감동란 1개", category: "Side", price: 1100 },
                    { name: "북어채 한 줌", category: "Topping", price: 3000 },
                    { name: "헛개수", category: "Drink", price: 1500 },
                ],
                recipe_steps: [
                    "1. 컵누들에 뜨거운 물과 북어채를 함께 넣고 3분간 익힙니다.",
                    "2. 뚜껑을 열고 감동란을 쪼개 넣습니다.",
                    "3. 시원한 헛개수와 함께 먹으면 숙취 해소에 최고입니다."
                ],
                ai_comment: "어제의 나는 잊어라. 새로운 아침을 맞이하는 의식."
            }
        ],
        sugar: [
             {
                combo_name: "극강의 당 충전 세트",
                store_brand: "이마트24",
                mood_tag: "당 떨어짐",
                total_price_estimate: 6500,
                calorie_estimate: 1000, // 임시 값
                items: [
                    { name: "초코우유 500ml", category: "Drink", price: 1800 },
                    { name: "티라미수 케이크", category: "Dessert", price: 3500 },
                    { name: "초코바", category: "Snack", price: 1200 },
                ],
                recipe_steps: [
                    "1. 모든 것을 다 꺼내놓는다.",
                    "2. 먹는다.",
                    "3. 행복해진다."
                ],
                ai_comment: "혈관에 초코시럽이 흐르는 기분!"
            }
        ],
        diet: [
            {
                combo_name: "죄책감 없는 단백질 폭탄",
                store_brand: "GS25",
                mood_tag: "나름 다이어트",
                total_price_estimate: 7500,
                calorie_estimate: 500, // 임시 값
                items: [
                    { name: "훈제 닭가슴살", category: "Main", price: 3800 },
                    { name: "감동란 2개", category: "Side", price: 2200 },
                    { name: "아몬드브리즈", category: "Drink", price: 1500 },
                ],
                recipe_steps: [
                    "1. 닭가슴살을 전자레인지에 30초 데웁니다.",
                    "2. 감동란과 함께 먹으며 단백질을 보충합니다.",
                    "3. 마무리는 깔끔한 아몬드브리즈로!"
                ],
                ai_comment: "운동 끝나고 먹으면 근손실 걱정 끝!"
            }
        ],
    };

    const loadingMessages = [
        "AI가 유통기한 확인 중...",
        "전자레인지 줄 서는 중...",
        "사장님 몰래 신상품 스캔 중...",
        "최상의 조합을 위해 냉장고 뒤지는 중..."
    ];

    // --- Functions ---
    const showStep = (stepName) => {
        Object.values(steps).forEach(step => step.classList.add('hidden'));
        if (steps[stepName]) {
            steps[stepName].classList.remove('hidden');
        }
    };

    const displayResult = (resultData) => {
        // Populate data
        document.getElementById('result-title').textContent = resultData.combo_name;
        document.getElementById('result-comment').textContent = resultData.ai_comment;
        document.getElementById('result-price').textContent = `${resultData.total_price_estimate.toLocaleString()}원`;
        document.getElementById('result-recipe').innerHTML = resultData.recipe_steps.map(step => `<span>${step}</span>`).join('<br>');

        const ingredientsList = document.getElementById('result-ingredients');
        ingredientsList.innerHTML = '';
        resultData.items.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${item.name}</span><span>${item.price.toLocaleString()}원</span>`;
            ingredientsList.appendChild(li);
        });

        // Trigger animation
        showStep('result');
        // We use a short delay to ensure the element is visible before adding the class
        setTimeout(() => {
            resultCard.classList.add('is-printing');
        }, 10);
    };

    const startLoading = () => {
        showStep('loading');
        let messageIndex = 0;
        loadingText.textContent = loadingMessages[messageIndex];
        const interval = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            loadingText.textContent = loadingMessages[messageIndex];
        }, 1500);

        setTimeout(() => {
            clearInterval(interval);
            const results = mockApi[userChoices.mood] || mockApi.stress;
            const randomResult = results[Math.floor(Math.random() * results.length)];
            displayResult(randomResult);
        }, 4000); // 4초 후 결과 표시
    };
    
    const reset = () => {
        userChoices = { store: '', mood: '' };
        resultCard.classList.remove('is-printing'); // Remove class for re-animation
        showStep('step1');
    };

    // --- Event Listeners ---
    storeButtons.forEach(button => {
        button.addEventListener('click', () => {
            userChoices.store = button.dataset.store;
            showStep('step2');
        });
    });

    moodButtons.forEach(button => {
        button.addEventListener('click', () => {
            userChoices.mood = button.dataset.mood;
            startLoading();
        });
    });

    retryButton.addEventListener('click', reset);
    
    // Initial setup
    reset();
});
