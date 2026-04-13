// app.js

let prizes = [];
let wheelInstance = null;
let validatedCode = null;
let currentUserName = null;
let isDemoModeActive = false;

// DOM Elements
const loginSection = document.getElementById('login-section');
const wheelSection = document.getElementById('wheel-section');
const resultSection = document.getElementById('result-section');
const codeForm = document.getElementById('code-form');
const errorMsg = document.getElementById('error-message');
const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3'); // Success
const wowSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3'); // Jackpot / Applause
const tickSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3'); 
tickSound.volume = 0.5;

// Initialize
async function init() {
    prizes = await window.fetchPrizes();
    if (prizes.length === 0) {
        errorMsg.innerText = "Sistemde ödül bulunamadı. Lütfen yöneticiye başvurun.";
        return;
    }

    // Çark için özel mat/koyu ama çeşitli renk paleti (Parlak renklerden kaçınıyoruz)
    const themeColors = ['#9A3412', '#1E3A8A', '#166534', '#701A75', '#854D0E', '#4C1D95', '#b45309', '#0f766e'];
    prizes = prizes.map((p, index) => ({
        ...p,
        color: themeColors[index % themeColors.length]
    }));

    wheelInstance = new window.SpinWheel('wheelCanvas', prizes);
}

// 1. Aşama - Login Form
codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit');

    currentUserName = document.getElementById('user-name').value.trim();
    const code = document.getElementById('spin-code').value.trim();

    if (!currentUserName || !code) return;

    btnSubmit.innerHTML = 'Doğrulanıyor...';
    btnSubmit.disabled = true;
    errorMsg.innerText = '';

    const isValid = await window.validateCode(code);

    if (isValid) {
        validatedCode = code;
        loginSection.classList.add('hidden');
        loginSection.classList.remove('fade-in');

        wheelSection.classList.remove('hidden');
        wheelSection.classList.add('fade-in');
        // Canvas görünürken tekrar çizilmesi gerekebilir (boyutlar için)
        wheelInstance.drawWheel();
    } else {
        errorMsg.innerText = "Hatalı veya kullanılmış kod!";
        btnSubmit.innerHTML = 'Doğrula ve Çarkı Gör';
        btnSubmit.disabled = false;
    }
});

// Demo Spin Listener
const demoBtn = document.getElementById('btn-demo');
if (demoBtn) {
    demoBtn.addEventListener('click', () => {
        isDemoModeActive = true;
        validatedCode = 'DEMO';
        currentUserName = 'Demo User';

        loginSection.classList.add('hidden');
        loginSection.classList.remove('fade-in');

        wheelSection.classList.remove('hidden');
        wheelSection.classList.add('fade-in');
        wheelInstance.drawWheel();
    });
}

// 2. Aşama - Spin Wheel
const spinBtn = document.getElementById('spin-btn');
let isSpinning = false;

spinBtn.addEventListener('click', async () => {
    if (isSpinning || !validatedCode) return;
    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.innerText = 'Çevriliyor...';

    // Şansı Hesapla
    const totalWeight = prizes.reduce((acc, curr) => acc + curr.probability, 0);
    let randomNum = Math.random() * totalWeight;
    let winningIndex = 0;

    for (let i = 0; i < prizes.length; i++) {
        if (randomNum < prizes[i].probability) {
            winningIndex = i;
            break;
        }
        randomNum -= prizes[i].probability;
    }

    const wonPrize = prizes[winningIndex];

    // Supabase'e yaz ve kodu geçersiz kıl (Çevirme başladığında direk yazıyoruz ki sayfa yenilense bile hak yansın)
    if (!isDemoModeActive) {
        const deviceInfo = navigator.userAgent;
        await window.submitSpinResult(validatedCode, currentUserName, wonPrize.name, deviceInfo);
    }

    // Görsel Çevirme Animasyonu (CSS transform ile)
    const canvas = document.getElementById('wheelCanvas');
    const segmentDegree = 360 / prizes.length;
    // Pointers is at TOP (270 degrees in HTML Canvas or -90 basically). We adjust visual rotation.
    const targetDegree = - (winningIndex * segmentDegree) - (segmentDegree / 2);
    // Add extra spins (e.g. 5 full rounds)
    const totalRotation = (360 * 5) + targetDegree - 90;

    canvas.style.transform = `rotate(${totalRotation}deg)`;

    // Sound Ticking Simulation
    let startTime = null;
    let lastTickAngle = 0;
    function watchRotation(timestamp) {
        if(!startTime) startTime = timestamp;
        const progress = (timestamp - startTime) / 5000; // 5s transition
        if(progress < 1) {
            // Cubic bezier approximation
            const easeOut = 1 - Math.pow(1 - progress, 3.5); 
            const currentAngle = easeOut * totalRotation;
            
            const currentSegment = Math.floor(currentAngle / segmentDegree);
            if(currentSegment > lastTickAngle) {
                tickSound.currentTime = 0;
                tickSound.play().catch(e=>{});
                lastTickAngle = currentSegment;
            }
            requestAnimationFrame(watchRotation);
        }
    }
    requestAnimationFrame(watchRotation);

    // Animasyon Bitince
    setTimeout(() => {
        wheelSection.classList.add('hidden');
        wheelSection.classList.remove('fade-in');

        resultSection.classList.remove('hidden');
        const isJackpot = wonPrize.name.includes('★') || wonPrize.name.toLowerCase().includes('büyük');
        let resultTitle = wonPrize.name;
        const resultParagraph = document.querySelector('#result-section p');
        if (isDemoModeActive) {
            resultTitle += " (Deneme)";
            if (resultParagraph) resultParagraph.innerText = "Bu sadece gösterim amaçlı bir deneme çevirişiydi. Geçerliliği yoktur.";
        } else {
            if (resultParagraph) {
                if (isJackpot) {
                    resultParagraph.innerHTML = "<strong>🎰 İNANILMAZ DEĞİL Mİ! BÜYÜK ÖDÜL KAZANDINIZ! 🎰</strong><br>Lütfen hemen kasiyere gidiniz.";
                } else {
                    resultParagraph.innerText = "Lütfen bu ekranı kasiyere göstererek ödülünüzü teslim alınız.";
                }
            }
        }

        document.getElementById('prize-text').innerText = resultTitle;

        // --- Winner Share Card Logic ---
        const downloadBtn = document.createElement('button');
        downloadBtn.id = "download-card-btn";
        downloadBtn.className = "btn-primary";
        downloadBtn.style.marginTop = "1.5rem";
        downloadBtn.style.background = "rgba(255,255,255,0.1)";
        downloadBtn.style.border = "1px solid rgba(255,255,255,0.2)";
        downloadBtn.style.width = "auto";
        downloadBtn.style.padding = "0.8rem 1.5rem";
        downloadBtn.innerHTML = "📷 Kazanç Kartını İndir";
        
        // Remove old button if exists
        const oldBtn = document.getElementById('download-card-btn');
        if(oldBtn) oldBtn.remove();
        resultSection.querySelector('.card').appendChild(downloadBtn);

        downloadBtn.onclick = async () => {
            downloadBtn.innerText = "🔄 Hazırlanıyor...";
            downloadBtn.disabled = true;

            // Prepare Template with current user and prize
            document.getElementById('sc-name').innerText = userName;
            document.getElementById('sc-prize').innerText = wonPrize.name;

            // Generate QR for the card
            const qrContainer = document.getElementById('sc-qr');
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: window.location.href.split('?')[0],
                width: 180,
                height: 180,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            // Wait a bit for QR to render and images to be ready
            await new Promise(r => setTimeout(r, 300));

            try {
                const cardTemplate = document.getElementById('share-card-template');
                const canvas = await html2canvas(cardTemplate, {
                    scale: 1, 
                    useCORS: true,
                    backgroundColor: '#0f172a'
                });

                const link = document.createElement('a');
                link.download = `ercan_market_${userName.replace(/\s+/g, '_')}_tebrikler.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
                
                downloadBtn.innerHTML = "✅ İndirildi!";
            } catch (e) {
                console.error("Kart oluşturulamadı", e);
                downloadBtn.innerHTML = "❌ Hata Oluştu";
            } finally {
                setTimeout(() => {
                    downloadBtn.innerHTML = "📷 Kazanç Kartını İndir";
                    downloadBtn.disabled = false;
                }, 3000);
            }
        };

        if (isJackpot) {
            document.body.classList.add('jackpot-flash');
            document.getElementById('prize-text').classList.add('jackpot-text');
            wowSound.play().catch(e => { });

            // Continuous big confetti
            let duration = 8 * 1000;
            let animationEnd = Date.now() + duration;
            let defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
            function randomInRange(min, max) { return Math.random() * (max - min) + min; }
            let interval = setInterval(function () {
                let timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) { return clearInterval(interval); }
                let particleCount = 50 * (timeLeft / duration);
                confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
            }, 250);
        } else {
            winSound.play().catch(e => { });
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#eab308', '#fbbf24', '#ffffff']
            });
        }

    }, 5000); // 5 saniye animasyon süresi
});

// Start app
document.addEventListener('DOMContentLoaded', init);
