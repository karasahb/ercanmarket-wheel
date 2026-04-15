const spotlight = document.getElementById('spotlight');
const spotlightName = document.getElementById('spotlight-name');
const spotlightPrize = document.getElementById('spotlight-prize');
const winnerHistory = document.getElementById('winner-history');

let currentView = 'live'; // 'live' or 'hof'

async function fetchTVWinners() {
    if (currentView !== 'live') return;
    
    let logs = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayISO = today.toISOString();
    
    if (window.isMockMode) {
        logs = window.mockData.logs.slice(0, 4).map((l, i) => ({ id: Date.now() - i, customer_name: l.name, won_prize: l.prize }));
    } else {
        try {
            const { data, error } = await window.supabaseClient
                .from('spin_logs')
                .select('id, customer_name, won_prize, created_at')
                .gte('created_at', todayISO)
                .order('created_at', { ascending: false })
                .limit(4); 
                
            if (error) throw error;
            logs = data || [];
        } catch (e) {
            return;
        }
    }

    renderTV(logs);
}

async function fetchHallOfFame() {
    let logs = [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    if (window.isMockMode) {
        logs = [
            { customer_name: 'Ercan Bey', won_prize: '★ iPhone 15' },
            { customer_name: 'Ayşe Hanım', won_prize: '★ Çeyrek Altın' },
            { customer_name: 'Mehmet Ali', won_prize: '500 TL Hediye Çeki' }
        ];
    } else {
        const { data } = await window.supabaseClient
            .from('spin_logs')
            .select('customer_name, won_prize, created_at')
            .gte('created_at', oneWeekAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(10);
        logs = data || [];
    }

    const hofList = document.getElementById('hof-list');
    hofList.innerHTML = '';
    logs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'recent-item';
        div.style.background = "rgba(255,255,255,0.08)";
        div.style.borderLeft = "6px solid gold";
        div.innerHTML = `
            <span class="recent-name" style="color: gold;">🏆 ${log.customer_name}</span>
            <span class="recent-prize">${log.won_prize}</span>
        `;
        hofList.appendChild(div);
    });
}

function renderTV(logs) {
    if (logs.length === 0) {
        spotlightName.innerText = "Henüz Kazanan Yok";
        spotlightPrize.innerText = "Bugün şanslı gününüz olabilir!";
        winnerHistory.innerHTML = '';
        lastSeenId = null;
        return;
    }

    const latest = logs[0];
    const previousOnes = logs.slice(1, 4);
    
    // Spotlight update logic
    if (lastSeenId !== null && latest.id !== lastSeenId) {
        flashSpotlight();
    }
    lastSeenId = latest.id;
    
    updateSpotlight(latest);
    renderWinnerHistory(previousOnes);
}

// TOGGLE VIEW LOGIC
const viewBtn = document.getElementById('view-switcher');
if (viewBtn) {
    viewBtn.onclick = () => {
        const liveViewElements = [spotlight, document.getElementById('history-label'), winnerHistory];
        const hofView = document.getElementById('hof-view');

        if (currentView === 'live') {
            currentView = 'hof';
            liveViewElements.forEach(el => el.classList.add('hidden'));
            hofView.classList.remove('hidden');
            fetchHallOfFame();
        } else {
            currentView = 'live';
            liveViewElements.forEach(el => el.classList.remove('hidden'));
            hofView.classList.add('hidden');
            fetchTVWinners();
        }
    };
}

function updateSpotlight(winner) {
    spotlightName.innerText = winner.customer_name;
    spotlightPrize.innerText = winner.won_prize;
}

function renderWinnerHistory(logs) {
    winnerHistory.innerHTML = '';
    logs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'recent-item';
        div.style.width = "100%";
        div.style.opacity = "0.7";
        div.innerHTML = `
            <span class="recent-name" style="font-size:1.1rem;">${log.customer_name}</span>
            <span class="recent-prize" style="font-size:1rem;">${log.won_prize}</span>
        `;
        winnerHistory.appendChild(div);
    });
}

function flashSpotlight() {
    spotlight.style.animation = 'none';
    void spotlight.offsetWidth; // trigger reflow
    spotlight.style.animation = 'pulse 1s 2';
    // Visual flash
    spotlight.style.borderColor = "#fff";
    spotlight.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
    
    // Confetti Explosion
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff5500', '#ffffff', '#ffaa00']
    });

    setTimeout(() => { 
        spotlight.style.borderColor = "var(--primary-color)"; 
        spotlight.style.backgroundColor = "rgba(255, 85, 0, 0.1)";
    }, 800);
}

// Initial fetch
fetchTVWinners();

// Fast Polling (5 saniye)
setInterval(fetchTVWinners, 5000);
