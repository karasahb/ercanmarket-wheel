// feedback.js

const feedbackForm = document.getElementById('feedback-form');
const btnSubmit = document.getElementById('btn-submit');
const errorMsg = document.getElementById('error-message');
const formContainer = document.getElementById('feedback-form-container');
const successContainer = document.getElementById('success-container');

function showError(msg) {
    errorMsg.innerText = msg;
    errorMsg.style.display = 'block';
    setTimeout(() => { errorMsg.style.display = 'none'; }, 3000);
}

if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const type = document.getElementById('feedback-type').value;
        const message = document.getElementById('feedback-message').value.trim();

        if (!message) {
            showError("Lütfen bir mesaj yazınız.");
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerText = "Gönderiliyor...";

        if (window.isMockMode) {
            // Mock simulation
            console.log("Mock Mode - Geri Bildirim Kaydedildi:", { type, message });
            setTimeout(() => {
                formContainer.classList.add('hidden');
                successContainer.classList.remove('hidden');
            }, 800);
            return;
        }

        try {
            const { error } = await window.supabaseClient.from('feedbacks').insert([{
                type: type,
                message: message
            }]);

            if (error) throw error;

            // FormSubmit ile E-Posta Bildirimi Gönder
            if (window.CONFIG && window.CONFIG.ADMIN_EMAIL) {
                try {
                    await fetch(`https://formsubmit.co/ajax/${window.CONFIG.ADMIN_EMAIL}`, {
                        method: "POST",
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            _subject: `Ercan Market - Yeni ${type === 'şikayet' ? 'Şikayet' : 'Öneri'}`,
                            Kategori: type.toUpperCase(),
                            Mesaj: message,
                            Tarih: new Date().toLocaleString('tr-TR')
                        })
                    });
                } catch (emailError) {
                    console.warn("E-posta bildirimi gönderilemedi:", emailError);
                }
            }

            // Başarılı
            formContainer.classList.add('hidden');
            successContainer.classList.remove('hidden');

        } catch (e) {
            console.error("Gönderim hatası:", e);
            showError("Gönderim sırasında bir hata oluştu. Lütfen tekrar deneyin.");
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Gönder";
        }
    });
}
