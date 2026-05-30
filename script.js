// === KONFIGURASI SUPABASE ===
const SUPABASE_URL = 'https://qjbscpbgowzfnudqrrqa.supabase.co'; // GANTI INI
const SUPABASE_KEY = 'sb_publishable_nFuXLJrfDVrOP-8D_2QEdA_Zz7feBWa'; // GANTI INI
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentImdaType = '';
let currentClass = '';

// === FUNGSI TOAST NOTIFICATION ===
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-times-circle' : 'fa-exclamation-triangle');
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 500); }, 3000);
}

// === FORMAT RUPIAH & OTOMATIS TITIK ===
const formatRp = (angka) => 'Rp ' + Number(angka).toLocaleString('id-ID');

// Fungsi untuk mengubah input biasa jadi format ribuan saat diketik
function formatCurrencyInput(event) {
    let value = event.target.value;
    // Hapus semua titik dan huruf yang bukan angka
    value = value.replace(/[^0-9]/g, '');
    if (value === '') {
        event.target.value = '';
        return;
    }
    // Format jadi angka ribuan pakai titik (format Indonesia)
    event.target.value = parseInt(value, 10).toLocaleString('id-ID');
}

// Pasang event listener ke semua elemen dengan class currency-input
document.querySelectorAll('.currency-input').forEach(input => {
    input.addEventListener('input', formatCurrencyInput);
});

function openSidebar() { document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').style.display = 'block'; }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').style.display = 'none'; }

function showSection(sectionId, btn) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    btn.classList.add('active');
    closeSidebar();
    if(sectionId === 'dashboard') loadDashboard();
    if(sectionId === 'setbiaya') loadFees();
}

// === DASHBOARD ===
async function loadDashboard() {
    const { data: students } = await db.from('students').select('*');
    const { data: fees } = await db.from('imda_fees').select('*');
    const { data: expenses } = await db.from('expenses').select('*');
    
    let totalIn = 0;
    let classStats = {};
    for(let i=1; i<=6; i++) { classStats[i] = { paid: 0, unpaid: 0, total: 0 }; }

    if(students && fees) {
        students.forEach(st => {
            classStats[st.class].total++;
            let studentFullyPaid = true;
            ['imda_i', 'imda_ii', 'imda_iii'].forEach(type => {
                if(st[type]) {
                    let imdaType = type === 'imda_i' ? 'I' : (type === 'imda_ii' ? 'II' : 'III');
                    let fee = fees.find(f => f.class === st.class && f.imda_type === imdaType);
                    if(fee) totalIn += fee.amount;
                } else { studentFullyPaid = false; }
            });
            if(studentFullyPaid) classStats[st.class].paid++;
            else classStats[st.class].unpaid++;
        });
    }

    let totalOut = 0;
    if(expenses) { totalOut = expenses.reduce((acc, curr) => acc + curr.amount, 0); }
    
    document.getElementById('totalIn').innerText = formatRp(totalIn);
    document.getElementById('totalOut').innerText = formatRp(totalOut);
    document.getElementById('saldo').innerText = formatRp(totalIn - totalOut);

    let tbody = document.querySelector('#dashboardTable tbody');
    tbody.innerHTML = '';
    for(let i=1; i<=6; i++) {
        tbody.innerHTML += `<tr>
            <td><strong>Kelas ${i}</strong></td>
            <td><span style="color: var(--success); font-weight:600;">${classStats[i].paid} Orang <i class="fas fa-check-circle"></i></span></td>
            <td><span style="color: var(--danger); font-weight:600;">${classStats[i].unpaid} Orang <i class="fas fa-times-circle"></i></span></td>
            <td>${classStats[i].total} Orang</td>
        </tr>`;
    }
}

// === BAYAR IMDA ===
async function loadStudents() {
    currentClass = document.getElementById('filterKelas').value;
    currentImdaType = document.getElementById('filterImda').value;
    const currentGender = document.getElementById('filterGender').value;
    
    if(!currentClass || !currentImdaType) return showToast('Pilih Kelas dan IMDA terlebih dahulu!', 'warning');

    document.getElementById('imdaView').style.display = 'block';
    let titleGenderText = currentGender ? ` (${currentGender})` : '';
    document.getElementById('imdaTitle').innerHTML = `<i class="fas fa-file-invoice-dollar"></i> Kelas ${currentClass}${titleGenderText} - IMDA ${currentImdaType}`;

    const { data: feeData } = await db.from('imda_fees').select('*').eq('class', currentClass).eq('imda_type', currentImdaType).single();
    document.getElementById('imdaNominal').innerText = feeData ? `Biaya: ${formatRp(feeData.amount)}` : 'Biaya belum diset';

    const { data: students } = await db.from('students').select('*').eq('class', currentClass);
    let tbody = document.querySelector('#studentTable tbody');
    tbody.innerHTML = '';

    const colName = currentImdaType === 'I' ? 'imda_i' : (currentImdaType === 'II' ? 'imda_ii' : 'imda_iii');

    if(students) {
        students.forEach(st => {
            if(currentGender && st.gender !== currentGender) return;
            let isPaid = st[colName];
            let genderShort = st.gender === 'Laki-laki' ? 'L' : (st.gender === 'Perempuan' ? 'P' : '-');
            tbody.innerHTML += `<tr>
                <td><input type="checkbox" class="student-check" data-id="${st.id}" ${isPaid ? 'disabled checked' : ''}></td>
                <td>${st.name}</td>
                <td style="text-align: center; font-weight: 500;">${genderShort}</td>
                <td style="color: ${isPaid ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">${isPaid ? 'Lunas' : 'Belum Bayar'}</td>
            </tr>`;
        });
    }
}

function toggleAll(source) { let checkboxes = document.querySelectorAll('.student-check:not(:disabled)'); checkboxes.forEach(cb => cb.checked = source.checked); }

async function processPayment() {
    const checkboxes = document.querySelectorAll('.student-check:checked:not(:disabled)');
    if(checkboxes.length === 0) return showToast('Pilih murid yang akan dibayarkan!', 'warning');

    const colName = currentImdaType === 'I' ? 'imda_i' : (currentImdaType === 'II' ? 'imda_ii' : 'imda_iii');
    const updateObj = {}; updateObj[colName] = true;
    let updates = [];
    checkboxes.forEach(cb => { updates.push(db.from('students').update(updateObj).eq('id', cb.dataset.id)); });
    await Promise.all(updates);
    showToast('Pembayaran berhasil diproses!', 'success');
    loadStudents(); loadDashboard(); 
}

// === SET BIAYA ===
async function loadFees() {
    const { data: fees } = await db.from('imda_fees').select('*');
    if(fees) {
        fees.forEach(fee => {
            const inputId = `fee_${fee.class}_${fee.imda_type}`;
            const inputEl = document.getElementById(inputId);
            // Saat load dari database, format dulu jadi 10.000
            if(inputEl) inputEl.value = fee.amount.toLocaleString('id-ID');
        });
    }
}

async function saveAllFees() {
    const imdaTypes = ['I', 'II', 'III']; let updatePromises = [];
    for(let kelas = 1; kelas <= 6; kelas++) {
        for(let i = 0; i < imdaTypes.length; i++) {
            const imda = imdaTypes[i]; const inputId = `fee_${kelas}_${imda}`;
            const inputEl = document.getElementById(inputId);
            
            // Hapus titik dulu sebelum disimpan ke database (10.000 jadi 10000)
            const amountStr = inputEl.value.replace(/\./g, ''); 
            const amount = parseInt(amountStr);

            if(amountStr !== "" && !isNaN(amount)) {
                const { data: existing } = await db.from('imda_fees').select('*').eq('class', kelas).eq('imda_type', imda).single();
                if(existing) { updatePromises.push(db.from('imda_fees').update({ amount: amount }).eq('id', existing.id)); }
                else { updatePromises.push(db.from('imda_fees').insert({ class: kelas, imda_type: imda, amount: amount })); }
            }
        }
    }
    await Promise.all(updatePromises);
    showToast('Semua biaya berhasil disimpan!', 'success');
    loadDashboard();
}

// === BELANJA ===
async function addExpense() {
    const desc = document.getElementById('expenseDesc').value;
    const amountStr = document.getElementById('expenseAmount').value.replace(/\./g, ''); // Hapus titik dulu
    const amount = parseInt(amountStr);
    
    if(!desc || isNaN(amount) || amount <= 0) return showToast('Isi keterangan dan nominal dengan benar!', 'warning');
    await db.from('expenses').insert({ description: desc, amount: amount });
    showToast('Pengeluaran berhasil dicatat!', 'success');
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
    loadDashboard();
}

loadDashboard();