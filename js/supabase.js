// supabase.js

// CONFIGURATION: js/config.js dosyasından (Build time'da oluşturulur) verileri oku
const config = window.CONFIG || { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };

const SUPABASE_URL = config.SUPABASE_URL;
const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;

// Geçici (Mock) modül - Kullanıcının hemen test edebilmesi için
window.isMockMode = (!SUPABASE_URL || SUPABASE_URL.includes('XXXXX'));

window.supabaseClient = null;

if (!window.isMockMode) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Global olarak Mock Veriler (Test Amaçlı)
window.mockData = {
    prizes: [
        { id: 1, name: 'Çeyrek Altın', color: '#fbcb39', probability: 2 },
        { id: 2, name: '1 Koli Cola', color: '#e63946', probability: 5 },
        { id: 3, name: '2.5L Ayran', color: '#457b9d', probability: 15 },
        { id: 4, name: 'Ülker Çikolatalı Gofret', color: '#2a9d8f', probability: 30 },
        { id: 5, name: '%10 İndirim Çeki', color: '#e76f51', probability: 28 },
        { id: 6, name: 'Bedava Ekmek', color: '#f4a261', probability: 20 },
    ],
    codes: [
        { code: '1234', is_used: false },
        { code: '9999', is_used: false }
    ],
    logs: []
};

// Yardımcı Servis Fonksiyonları (Supabase veya Mock Çalıştırır)

window.fetchPrizes = async function() {
    if (window.isMockMode) return window.mockData.prizes;
    
    const now = new Date().toISOString();
    // Gerçek Supabase Çağrısı (Tarih filtrelemeli)
    let query = window.supabaseClient.from('prizes').select('*');
    
    // Eğer index.html veya app.js çağırıyorsa filtrele, admin çağırıyorsa hepsini getir
    if (!window.location.pathname.includes('admin.html')) {
        // Start date null (başlamış) veya geçmişte, End date null (süresiz) veya gelecekte
        query = query.or(`start_date.is.null,start_date.lte.${now}`)
                     .or(`end_date.is.null,end_date.gte.${now}`);
    }

    const { data, error } = await query.order('id', { ascending: true });
    return data || [];
}

window.fetchStats = async function() {
    if (window.isMockMode) return { today: 12, total: 154, loyal: 8, popular: 'Bedava Ekmek', totalCost: 450.50 };

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    
    // Fetch prize costs for aggregate calculation
    const { data: prizes } = await window.supabaseClient.from('prizes').select('name, cost');
    const costsMap = {};
    prizes?.forEach(p => { costsMap[p.name] = parseFloat(p.cost) || 0; });

    const { count: totalCount } = await window.supabaseClient.from('spin_logs').select('*', { count: 'exact', head: true });
    const { count: todayCount } = await window.supabaseClient.from('spin_logs').select('*', { count: 'exact', head: true }).gt('created_at', todayStart.toISOString());
    
    // Most popular prize and Total Cost
    const { data: logs } = await window.supabaseClient.from('spin_logs').select('won_prize, customer_name');
    const prizeCounts = {};
    let popularPrize = "-";
    let max = 0;
    let totalCost = 0;
    
    logs?.forEach(l => {
        prizeCounts[l.won_prize] = (prizeCounts[l.won_prize] || 0) + 1;
        if(prizeCounts[l.won_prize] > max) {
            max = prizeCounts[l.won_prize];
            popularPrize = l.won_prize;
        }
        // Add to total cost
        totalCost += costsMap[l.won_prize] || 0;
    });

    // Loyalty: Count customers with > 1 spin
    const customerCounts = {};
    logs?.forEach(l => {
        customerCounts[l.customer_name] = (customerCounts[l.customer_name] || 0) + 1;
    });
    const loyalCount = Object.values(customerCounts).filter(c => c > 1).length;

    return { 
        today: todayCount || 0, 
        total: totalCount || 0, 
        loyal: loyalCount, 
        popular: popularPrize,
        totalCost: totalCost
    };
}

window.validateCode = async function(code) {
    console.log(window.isMockMode);
    if (window.isMockMode) {
        const found = window.mockData.codes.find(c => c.code === code && !c.is_used);
        return found ? true : false;
    }

    // Gerçek Supabase Çağrısı
    const { data, error } = await window.supabaseClient
        .from('spin_codes')
        .select('*')
        .eq('code', code)
        .eq('is_used', false)
        .limit(1); // Birden fazla varsa ilkini al
    
    console.log(data);
    console.log(error);
        
    return data && data.length > 0; // Data varsa geçerlidir
}

window.submitSpinResult = async function(code, userName, prizeName, deviceInfo) {
    if (window.isMockMode) {
        const codeIndex = window.mockData.codes.findIndex(c => c.code === code);
        if (codeIndex > -1) window.mockData.codes[codeIndex].is_used = true;
        window.mockData.logs.unshift({ date: new Date().toLocaleString(), name: userName, code: code, prize: prizeName });
        return true;
    }

    // Gerçek İşlem (Kodu kullanıldı yap ve log ekle)
    await window.supabaseClient.from('spin_codes').update({ is_used: true }).eq('code', code);
    
    await window.supabaseClient.from('spin_logs').insert([
        { 
            customer_name: userName, 
            used_code: code, 
            won_prize: prizeName,
            device_info: deviceInfo
        }
    ]);
    
    return true;
}
