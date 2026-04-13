// admin.js

// DOM Elements
const loginForm = document.getElementById('admin-login-form');
const adminLoginSection = document.getElementById('admin-login');
const adminDashboard = document.getElementById('admin-dashboard');
const errorMsg = document.getElementById('admin-error');
const generateBtn = document.getElementById('generate-code-btn');
const lastGenDisplay = document.getElementById('last-generated-code');
const logoutBtn = document.getElementById('logout-btn');

const activeCodesTable = document.getElementById('active-codes-table').querySelector('tbody');
const logsTable = document.getElementById('logs-table').querySelector('tbody');

const addPrizeForm = document.getElementById('add-prize-form');
const prizesTable = document.getElementById('prizes-table').querySelector('tbody');
const prizeLogsTable = document.getElementById('prize-logs-table').querySelector('tbody');

// Simple Admin Auth Simulation
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = document.getElementById('admin-password').value;
    
    // Config üzerinden şifreyi doğrula (Fallback kaldırıldı)
    const validPassword = (window.CONFIG && window.CONFIG.ADMIN_PASSWORD) ? window.CONFIG.ADMIN_PASSWORD : null;
    
    if(validPassword && pw === validPassword) {
        adminLoginSection.classList.add('hidden');
        adminDashboard.classList.remove('hidden');
        sessionStorage.setItem('isAdmin', 'true');
        loadData();
    } else {
        errorMsg.innerText = "Hatalı şifre!";
    }
});

// Check Session on Load
document.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isAdmin') === 'true') {
        adminLoginSection.classList.add('hidden');
        adminDashboard.classList.remove('hidden');
        loadData();
    }

    // Range slider live update
    const probSlider = document.getElementById('new-prize-prob');
    const probDisplay = document.getElementById('prob-value-display');
    if (probSlider && probDisplay) {
        probSlider.addEventListener('input', () => {
            const val = probSlider.value;
            probDisplay.textContent = val;
            probSlider.style.background = `linear-gradient(to right, var(--primary-color) ${val}%, rgba(255,255,255,0.1) ${val}%)`;
        });
    }

    // Toggle switch animation
    const jackpotCheckbox = document.getElementById('is-jackpot');
    if (jackpotCheckbox) {
        jackpotCheckbox.addEventListener('change', () => {
            const track = jackpotCheckbox.parentElement.querySelector('.toggle-track');
            const thumb = jackpotCheckbox.parentElement.querySelector('.toggle-thumb');
            if (jackpotCheckbox.checked) {
                track.style.background = 'var(--primary-color)';
                thumb.style.transform = 'translateX(22px)';
                thumb.style.background = '#fff';
            } else {
                track.style.background = 'rgba(255,255,255,0.12)';
                thumb.style.transform = 'translateX(0)';
                thumb.style.background = '#555';
            }
        });
    }
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('isAdmin');
    window.location.reload();
});

// Load Dashboard Data
async function loadData() {
    await cleanupExpiredPrizes(); // Önce süresi dolanları temizle
    await fetchActiveCodes();
    await fetchLogs();
    await fetchAdminPrizes();
    await fetchPrizeEditLogs();
    await updateStats();
    generateSiteQR();
}

async function cleanupExpiredPrizes() {
    if (window.isMockMode) return;

    const now = new Date();
    // Bitiş tarihi geçmiş ve hala veritabanında olan ödülleri çek
    const { data: expiredPrizes } = await window.supabaseClient
        .from('prizes')
        .select('*')
        .lt('end_date', now.toISOString());

    if (expiredPrizes && expiredPrizes.length > 0) {
        for (const prize of expiredPrizes) {
            // Sil
            await window.supabaseClient.from('prizes').delete().eq('id', prize.id);
            
            // Logla
            await window.supabaseClient.from('prize_edit_logs').insert([{
                prize_id: prize.id,
                action: 'delete',
                old_name: prize.name + " (Süresi Bitti)",
                new_name: null,
                old_probability: prize.probability,
                new_probability: null
            }]);
        }
        console.log(`${expiredPrizes.length} adet süresi dolan ödül otomatik temizlendi.`);
    }
}

async function updateStats() {
    const stats = await window.fetchStats();
    document.getElementById('stats-today').innerText = stats.today;
    document.getElementById('stats-total').innerText = stats.total;
    document.getElementById('stats-loyal').innerText = stats.loyal;
    document.getElementById('stats-popular').innerText = stats.popular;
    
    const costEl = document.getElementById('stats-cost');
    if (costEl) costEl.innerText = `${stats.totalCost.toFixed(2)} TL`;
}

function generateSiteQR() {
    const url = window.location.origin;
    const container = document.getElementById('site-qr-container');
    container.innerHTML = '';
    new QRCode(container, {
        text: url,
        width: 128,
        height: 128,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

async function fetchActiveCodes() {
    activeCodesTable.innerHTML = '';
    let codes = [];
    
    if (window.isMockMode) {
        codes = window.mockData.codes.filter(c => !c.is_used).slice(0, 5);
    } else {
        const { data } = await window.supabaseClient.from('spin_codes').select('*').eq('is_used', false).order('created_at', { ascending: false }).limit(5);
        codes = data || [];
    }

    codes.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size: 1.2rem; letter-spacing: 2px;"><strong>${c.code}</strong></td>
            <td style="white-space:nowrap;"><span class="badge badge-success" style="font-size:0.75rem;">Kullanıma Hazır</span></td>
            <td><button class="delete-code-btn" data-id="${c.id}" data-code="${c.code}" style="background:var(--error); color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">Sil</button></td>
        `;
        activeCodesTable.appendChild(tr);
    });

    document.querySelectorAll('.delete-code-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            const code = e.target.getAttribute('data-code');
            if(confirm(`"${code}" kodunu silmek istediğinizden emin misiniz?`)) {
                if(!window.isMockMode) {
                    await window.supabaseClient.from('spin_codes').delete().eq('id', id);
                } else {
                    const idx = window.mockData.codes.findIndex(x => x.id == id);
                    if(idx > -1) window.mockData.codes.splice(idx, 1);
                }
                fetchActiveCodes();
            }
        });
    });
}

async function fetchLogs() {
    logsTable.innerHTML = '';
    let logs = [];
    
    if (window.isMockMode) {
        logs = window.mockData.logs.slice(0, 10);
    } else {
        const { data } = await window.supabaseClient.from('spin_logs').select('*').order('created_at', { ascending: false }).limit(10);
        logs = (data || []).map(d => ({
            date: new Date(d.created_at).toLocaleString(),
            name: d.customer_name,
            code: d.used_code,
            prize: d.won_prize
        }));
    }

    // Pre-calculate loyalty
    const nameCounts = {};
    logs.forEach(l => { nameCounts[l.name] = (nameCounts[l.name] || 0) + 1; });

    logs.forEach(l => {
        const isLoyal = nameCounts[l.name] > 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size:0.85rem; color:var(--text-muted);">${l.date}</td>
            <td>
                <strong>${l.name}</strong>
                ${isLoyal ? '<br><span style="font-size:0.65rem; background:#10b981; color:white; padding:1px 4px; border-radius:4px;">Sadık Müşteri</span>' : ''}
            </td>
            <td style="letter-spacing:1px;">${l.code}</td>
            <td style="color:var(--primary-color);">${l.prize}</td>
        `;
        logsTable.appendChild(tr);
    });
}

async function fetchAdminPrizes() {
    prizesTable.innerHTML = '';
    const prizes = await window.fetchPrizes();
    
    prizes.forEach(p => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-prize-id', p.id);
        const dateRange = (p.start_date || p.end_date) 
            ? `<span style="font-size:0.7rem; color:var(--text-muted);">${p.start_date || '...'} / ${p.end_date || '...'}</span>`
            : '<span style="color:var(--text-muted); font-size:0.7rem;">Süresiz</span>';

        tr.innerHTML = `
            <td><strong class="prize-name-display">${p.name}</strong></td>
            <td class="prize-prob-display">${p.probability}</td>
            <td class="prize-cost-display">${p.cost || '0'} TL</td>
            <td>${dateRange}</td>
            <td style="display:flex; gap:4px; flex-wrap:wrap;">
                <button class="edit-prize-btn" 
                    data-id="${p.id}" 
                    data-name="${p.name.replace(/"/g,'&quot;')}" 
                    data-prob="${p.probability}"
                    data-cost="${p.cost || '0'}"
                    data-start="${p.start_date || ''}"
                    data-end="${p.end_date || ''}"
                    style="background:#3b82f6; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Düzenle</button>
                <button class="delete-prize-btn" data-id="${p.id}" data-name="${p.name.replace(/"/g,'&quot;')}" data-prob="${p.probability}" style="background:var(--error); color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Sil</button>
            </td>
        `;
        prizesTable.appendChild(tr);
    });

    // DELETE handlers
    document.querySelectorAll('.delete-prize-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            const oldName = e.target.getAttribute('data-name');
            const oldProb = parseInt(e.target.getAttribute('data-prob'));
            if(confirm('Aman DİKKAT! Bu ödülü kalıcı olarak silmek istediğinizden emin misiniz?')) {
                if(!window.isMockMode) {
                    await window.supabaseClient.from('prizes').delete().eq('id', id);
                    // Log the deletion (Resilient)
                    try {
                        await window.supabaseClient.from('prize_edit_logs').insert([{
                            prize_id: parseInt(id), action: 'delete',
                            old_name: oldName, new_name: null,
                            old_probability: oldProb, new_probability: null
                        }]);
                    } catch (e) {
                        console.warn("Silme logu kaydedilemedi.");
                    }
                } else {
                    const idx = window.mockData.prizes.findIndex(x => x.id == id);
                    if(idx>-1) window.mockData.prizes.splice(idx, 1);
                }
                fetchAdminPrizes();
            }
        });
    });

    // EDIT handlers
    document.querySelectorAll('.edit-prize-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const oldProb = e.target.getAttribute('data-prob');
            const oldCost = e.target.getAttribute('data-cost');
            const oldStart = e.target.getAttribute('data-start');
            const oldEnd = e.target.getAttribute('data-end');
            const row = e.target.closest('tr');
            
            // Replace row content with inline edit form
            row.innerHTML = `
                <td><input type="text" class="edit-name-input" value="${oldName}" style="width:100%; padding:6px; border-radius:4px; border:1px solid var(--primary-color); background:rgba(0,0,0,0.3); color:var(--text-main); font-family:Outfit;"></td>
                <td><input type="number" class="edit-prob-input" value="${oldProb}" style="width:70px; padding:6px; border-radius:4px; border:1px solid var(--primary-color); background:rgba(0,0,0,0.3); color:var(--text-main); font-family:Outfit;"></td>
                <td><input type="number" class="edit-cost-input" value="${oldCost}" step="0.01" style="width:80px; padding:6px; border-radius:4px; border:1px solid var(--primary-color); background:rgba(0,0,0,0.3); color:var(--text-main); font-family:Outfit;"></td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <input type="date" class="edit-start-input" value="${oldStart ? oldStart.split('T')[0] : ''}" style="padding:4px; font-size:0.75rem; border-radius:4px; border:1px solid #444; background:black; color:white;">
                        <input type="date" class="edit-end-input" value="${oldEnd ? oldEnd.split('T')[0] : ''}" style="padding:4px; font-size:0.75rem; border-radius:4px; border:1px solid #444; background:black; color:white;">
                    </div>
                </td>
                <td style="display:flex; gap:4px; flex-wrap:wrap;">
                    <button class="save-edit-btn" 
                        data-id="${id}" 
                        data-old-name="${oldName}" 
                        data-old-prob="${oldProb}"
                        data-old-cost="${oldCost}"
                        data-old-start="${oldStart}"
                        data-old-end="${oldEnd}"
                        style="background:#10b981; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Kaydet</button>
                    <button class="cancel-edit-btn" style="background:rgba(255,255,255,0.15); color:var(--text-main); border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">İptal</button>
                </td>
            `;

            // Save handler
            row.querySelector('.save-edit-btn').addEventListener('click', async (btnEvt) => {
                const newName = row.querySelector('.edit-name-input').value.trim();
                const newProb = parseInt(row.querySelector('.edit-prob-input').value);
                const newCost = parseFloat(row.querySelector('.edit-cost-input').value) || 0;
                const newStart = row.querySelector('.edit-start-input').value || null;
                const newEnd = row.querySelector('.edit-end-input').value || null;
                
                const oldStart = btnEvt.target.getAttribute('data-old-start');
                const oldEnd = btnEvt.target.getAttribute('data-old-end');
                const oldCost = btnEvt.target.getAttribute('data-old-cost');

                if(!newName || isNaN(newProb)) { alert('Lütfen geçerli değerler girin.'); return; }

                if(!window.isMockMode) {
                    await window.supabaseClient.from('prizes').update({ 
                        name: newName, 
                        probability: newProb,
                        cost: newCost,
                        start_date: newStart,
                        end_date: newEnd
                    }).eq('id', id);
                    
                    // Log the edit (Resilient: try with dates, fallback if columns missing)
                    try {
                        const { error: logError } = await window.supabaseClient.from('prize_edit_logs').insert([{
                            prize_id: parseInt(id), action: 'edit',
                            old_name: oldName, new_name: newName,
                            old_probability: parseInt(oldProb), new_probability: newProb,
                            old_start_date: oldStart || null, new_start_date: newStart || null,
                            old_end_date: oldEnd || null, new_end_date: newEnd || null
                        }]);
                        
                        if (logError) {
                            // Fallback: Tarih sütunları henüz eklenmemiş olabilir
                            await window.supabaseClient.from('prize_edit_logs').insert([{
                                prize_id: parseInt(id), action: 'edit',
                                old_name: oldName, new_name: newName,
                                old_probability: parseInt(oldProb), new_probability: newProb
                            }]);
                        }
                    } catch (e) {
                        console.warn("Log kaydı tam detaylı yapılamadı, SQL sütunlarını kontrol edin.");
                    }
                } else {
                    const prize = window.mockData.prizes.find(x => x.id == id);
                    if(prize) { prize.name = newName; prize.probability = newProb; }
                }
                fetchAdminPrizes();
            });

            // Cancel handler
            row.querySelector('.cancel-edit-btn').addEventListener('click', () => {
                fetchAdminPrizes();
            });
        });
    });
}

// Add New Prize
addPrizeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = addPrizeForm.querySelector('button');
    btn.innerText = 'Ekleniyor...';
    btn.disabled = true;

    const name = document.getElementById('new-prize-name').value;
    const prob = parseInt(document.getElementById('new-prize-prob').value);
    const cost = parseFloat(document.getElementById('new-prize-cost').value) || 0;
    const isJackpot = document.getElementById('is-jackpot').checked;
    
    let finalName = name;
    if (isJackpot && !name.includes('★')) {
        finalName = '★ ' + name;
    }
    
    // Çark için özel mat/koyu ama çeşitli renk paleti
    const themeColors = ['#9A3412', '#1E3A8A', '#166534', '#701A75', '#854D0E', '#4C1D95', '#b45309', '#0f766e'];
    // We can infer background based on how many prizes exist
    // Or just pick a random one from the palette
    const color = themeColors[Math.floor(Math.random() * themeColors.length)];

    const startDate = document.getElementById('new-prize-start').value || null;
    const endDate = document.getElementById('new-prize-end').value || null;

    if(!window.isMockMode) {
        const { data: inserted } = await window.supabaseClient.from('prizes').insert([{ 
            name: finalName, 
            probability: prob, 
            cost: cost,
            color,
            start_date: startDate,
            end_date: endDate
        }]).select();
        // Log the addition (Resilient)
        if(inserted && inserted[0]) {
            try {
                await window.supabaseClient.from('prize_edit_logs').insert([{
                    prize_id: inserted[0].id, action: 'add',
                    old_name: null, new_name: name,
                    old_probability: null, new_probability: prob
                }]);
            } catch (e) {
                console.warn("Ekleme logu kaydedilemedi.");
            }
        }
    } else {
        window.mockData.prizes.push({ id: Date.now(), name, probability: prob, color });
    }
    
    document.getElementById('new-prize-name').value = '';
    document.getElementById('new-prize-start').value = '';
    document.getElementById('new-prize-end').value = '';
    const probSlider = document.getElementById('new-prize-prob');
    probSlider.value = 10;
    document.getElementById('prob-value-display').textContent = '10';
    probSlider.style.background = `linear-gradient(to right, var(--primary-color) 10%, rgba(255,255,255,0.1) 10%)`;
    const jackpotCb = document.getElementById('is-jackpot');
    jackpotCb.checked = false;
    const track = jackpotCb.parentElement.querySelector('.toggle-track');
    const thumb = jackpotCb.parentElement.querySelector('.toggle-thumb');
    if (track) { track.style.background = 'rgba(255,255,255,0.12)'; }
    if (thumb) { thumb.style.transform = 'translateX(0)'; thumb.style.background = '#555'; }
    btn.innerText = 'Ekle';
    btn.disabled = false;
    
    fetchAdminPrizes();
});

// Generate New Code
generateBtn.addEventListener('click', async () => {
    generateBtn.disabled = true;
    generateBtn.innerText = "Üretiliyor...";
    
    // 4 Haneli Rastgele Rakam
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    if (window.isMockMode) {
        window.mockData.codes.unshift({ code: newCode, is_used: false });
    } else {
        await window.supabaseClient.from('spin_codes').insert([{ code: newCode }]);
    }
    
    lastGenDisplay.innerText = newCode;
    
    // Generate Code QR
    const qrContainer = document.getElementById('code-qr-container');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: newCode,
        width: 100,
        height: 100,
        colorDark: "#ff5500",
        colorLight: "#000000",
        correctLevel: QRCode.CorrectLevel.M
    });

    generateBtn.disabled = false;
    generateBtn.innerText = "+ Yeni Kod Üret";
    
    // Refresh Tables
    fetchActiveCodes();
});

// Export CSV Logic
document.getElementById('export-csv-btn').addEventListener('click', async () => {
    const btn = document.getElementById('export-csv-btn');
    btn.innerText = "İndiriliyor...";
    
    let allLogs = [];
    if(window.isMockMode) {
        allLogs = window.mockData.logs;
    } else {
        const { data } = await window.supabaseClient.from('spin_logs').select('*').order('created_at', { ascending: false });
        allLogs = data || [];
    }
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFFTarih,Musteri,Kod,Kazanilan Odul\n";
    allLogs.forEach(row => {
        let date = row.date || new Date(row.created_at).toLocaleString();
        let name = row.name || row.customer_name;
        let code = row.code || row.used_code;
        let prize = row.prize || row.won_prize;
        csvContent += `"${date}","${name}","${code}","${prize}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ercan_market_odul_raporu.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    btn.innerText = "Excel / CSV İndir";
});

// Fetch Prize Edit Logs
async function fetchPrizeEditLogs() {
    prizeLogsTable.innerHTML = '';
    let logs = [];

    if (!window.isMockMode) {
        const { data } = await window.supabaseClient.from('prize_edit_logs').select('*').order('created_at', { ascending: false }).limit(20);
        logs = data || [];
    }

    const actionLabels = {
        'add': '➕ Eklendi',
        'edit': '✏️ Düzenlendi',
        'delete': '🗑️ Silindi'
    };
    const actionColors = {
        'add': '#10b981',
        'edit': '#3b82f6',
        'delete': '#ef4444'
    };

    logs.forEach(log => {
        const tr = document.createElement('tr');
        const date = new Date(log.created_at).toLocaleString('tr-TR');
        const label = actionLabels[log.action] || log.action;
        const color = actionColors[log.action] || 'inherit';

        let oldVal = '—';
        let newVal = '—';

        if (log.old_name) oldVal = `${log.old_name} (${log.old_probability ?? '?'})`;
        if (log.new_name) newVal = `${log.new_name} (${log.new_probability ?? '?'})`;

        // Tarih detaylarını ekle
        if (log.old_start_date || log.old_end_date) {
            oldVal += `<br><span style="font-size:0.7rem; color:#888;">📅 ${log.old_start_date?.split('T')[0] || '...'} / ${log.old_end_date?.split('T')[0] || '...'}</span>`;
        }
        if (log.new_start_date || log.new_end_date) {
            newVal += `<br><span style="font-size:0.7rem; color:#888;">📅 ${log.new_start_date?.split('T')[0] || '...'} / ${log.new_end_date?.split('T')[0] || '...'}</span>`;
        }

        tr.innerHTML = `
            <td style="font-size:0.82rem; color:var(--text-muted);">${date}</td>
            <td style="color:${color}; font-weight:600;">${label}</td>
            <td style="font-size:0.85rem;">${oldVal}</td>
            <td style="font-size:0.85rem;">${newVal}</td>
        `;
        prizeLogsTable.appendChild(tr);
    });

    if (logs.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="4" style="text-align:center; color:var(--text-muted);">Henüz kayıt yok.</td>';
        prizeLogsTable.appendChild(tr);
    }
}
