// wheel.js
window.SpinWheel = class SpinWheel {
    constructor(canvasId, prizes) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.prizes = prizes;
        this.numSegments = prizes.length;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.radius = this.centerX - 10;
        
        this.currentRotation = 0; // in radians
        
        this.drawWheel();
    }

    drawWheel() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const arcSize = (2 * Math.PI) / this.numSegments;

        for (let i = 0; i < this.numSegments; i++) {
            const angle = this.currentRotation + i * arcSize;
            
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, this.radius, angle, angle + arcSize, false);
            this.ctx.lineTo(this.centerX, this.centerY);
            this.ctx.closePath();

            this.ctx.fillStyle = this.prizes[i].color;
            this.ctx.fill();
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = '#fff';
            this.ctx.stroke();

            // Draw text
            this.ctx.save();
            this.ctx.translate(this.centerX, this.centerY);
            this.ctx.rotate(angle + arcSize / 2);
            
            this.ctx.textAlign = 'right';
            this.ctx.font = 'bold 15px Outfit, sans-serif';
            
            const textX = this.radius - 20;
            
            let text = this.prizes[i].name;
            const words = text.split(' ');
            let line1 = text;
            let line2 = '';
            
            // Eğer çok uzunsa kelime bazlı ikiye böl
            if (words.length > 2 && text.length > 14) {
               const mid = Math.ceil(words.length / 2);
               line1 = words.slice(0, mid).join(' ');
               line2 = words.slice(mid).join(' ');
            } else if (text.length > 20) {
               line1 = text.substring(0, 18) + '...';
            }
            
            // Renk cümbüşünde okunsun diye siyah kalın stroke (çerçeve) ekleme
            this.ctx.lineWidth = 3;
            this.ctx.strokeStyle = '#000000';
            this.ctx.fillStyle = '#ffffff';

            if (line2) {
                // Çift satır çizimi
                if(line1.length > 18) line1 = line1.substring(0, 16) + '..';
                if(line2.length > 18) line2 = line2.substring(0, 16) + '..';
                
                this.ctx.strokeText(line1, textX, -6);
                this.ctx.fillText(line1, textX, -6);
                
                this.ctx.strokeText(line2, textX, 10);
                this.ctx.fillText(line2, textX, 10);
            } else {
                // Tek satır çizimi
                this.ctx.strokeText(line1, textX, 5);
                this.ctx.fillText(line1, textX, 5);
            }
            
            this.ctx.restore();
        }
        
        // Merkez daire (Glow)
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 30, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#1e1e1e';
        this.ctx.fill();
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#ea580c';
        this.ctx.stroke();
    }

    spin(winningIndex, callback) {
        // Hedef açıyı hesapla
        const arcSize = (2 * Math.PI) / this.numSegments;
        
        // Spin hedefimiz: Toplam 360 derecelik 5 tur atalım, sonra kazananın dilimi yukarıda (-90 derece veya 270 derece) duracak şekilde hesapla.
        const spinRounds = 5 * 2 * Math.PI; 
        
        // Canvas rotasyonu ile CSS transform rotasyonu farklı çalışır. CSS transform ile kolayca yapacağız.
        // O yüzden wheel.js sadece görseli çizip 'currentRotation' ı statik tutuyor. Dönüşü app.js'te CSS transition ile yapacağız.
        
        // Bu sınıf sadece çizimi yönetir, dönmeyi DOM üzerinden halledeceğiz (css transition çok daha akıcıdır).
        this.drawWheel();
    }
}
