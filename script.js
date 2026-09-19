// === KONFIGURASI SUPABASE ===
const SUPABASE_URL = 'https://qjbscpbgowzfnudqrrqa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nFuXLJrfDVrOP-8D_2QEdA_Zz7feBWa';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentClass = '';

// === TOAST ===
function showToast(message, type = 'success', sticky = false) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-times-circle' : 'fa-exclamation-triangle');
    let closeBtnHtml = sticky ? `<button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>` : '';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span style="flex:1; padding-right: 15px;">${message}</span> ${closeBtnHtml}`;
    container.appendChild(toast);
    if(!sticky) setTimeout(() => { toast.remove(); }, 3000);
}

// === FORMAT RUPIAH ===
const formatRp = (angka) => 'Rp ' + Number(angka).toLocaleString('id-ID');

function formatCurrencyInput(event) {
    let value = event.target.value.replace(/[^0-9]/g, '');
    if (value === '') { event.target.value = ''; return; }
    event.target.value = parseInt(value, 10).toLocaleString('id-ID');
}
document.querySelectorAll('.currency-input').forEach(input => { input.addEventListener('input', formatCurrencyInput); });

// === SAPAAN SESUAI WAKTU ===
function setGreeting() {
    const h = new Date().getHours();
    let t;
    if (h >= 4 && h < 11) t = 'Selamat pagi ☀️';
    else if (h < 15) t = 'Selamat siang 🌤️';
    else if (h < 18) t = 'Selamat sore 🌇';
    else t = 'Selamat malam 🌙';
    document.getElementById('greeting').textContent = t;
}

// === NAVIGASI (SINKRON SIDEBAR + BOTTOM NAV) ===
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('.nav-btn, .bn-item').forEach(el => {
        el.classList.toggle('active', el.dataset.section === sectionId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if(sectionId === 'dashboard') loadDashboard();
    if(sectionId === 'setbiaya') loadFees();
}

// === HELPER AMAN ===
const isTruthy = (val) => val === true || val === 1 || val === 'true' || val === '1';
function isFemale(g) {
    const s = (g || '').toString().toLowerCase();
    return s.includes('perempuan') || s.includes('wanita') || s.trim() === 'p';
}
function genderShort(g) { return !g ? '-' : (isFemale(g) ? 'P' : 'L'); }

// === DASHBOARD ===
async function loadDashboard() {
    const { data: students, error: errStudent } = await db.from('students').select('*');
    const { data: expenses, error: errExpense } = await db.from('expenses').select('*').order('created_at', { ascending: false });
    
    if(errStudent) console.error("Error Fetch Students:", errStudent);
    if(errExpense) console.error("Error Fetch Expenses:", errExpense);

    let totalIn = 0, totalOut = 0;
    let classStats = {};
    for(let i=1; i<=6; i++) { classStats[i] = { lPaid: 0, lUnpaid: 0, pPaid: 0, pUnpaid: 0, total: 0 }; }

    if(expenses) {
        expenses.forEach(tr => {
            if(tr.type === 'Pemasukan') totalIn += tr.amount;
            if(tr.type === 'Pengeluaran') totalOut += tr.amount;
        });
    }

    if(students) {
        students.forEach(st => {
            if(st.class >= 1 && st.class <= 6) {
                classStats[st.class].total++;
                let isPaid = isTruthy(st.imda_paid);
                if(isFemale(st.gender)) {
                    isPaid ? classStats[st.class].pPaid++ : classStats[st.class].pUnpaid++;
                } else {
                    isPaid ? classStats[st.class].lPaid++ : classStats[st.class].lUnpaid++;
                }
            }
        });
    }
    
    document.getElementById('totalIn').innerText = formatRp(totalIn);
    document.getElementById('totalOut').innerText = formatRp(totalOut);
    document.getElementById('saldo').innerText = formatRp(totalIn - totalOut);

    let tbodyRecap = document.querySelector('#dashboardTable tbody');
    tbodyRecap.innerHTML = '';
    for(let i=1; i<=6; i++) {
        tbodyRecap.innerHTML += `<tr>
            <td><strong>Kelas ${i}</strong></td>
            <td><span class="text-green">${classStats[i].lPaid}</span> / <span class="text-red">${classStats[i].lUnpaid}</span></td>
            <td><span class="text-green">${classStats[i].pPaid}</span> / <span class="text-red">${classStats[i].pUnpaid}</span></td>
            <td>${classStats[i].total} orang</td>
        </tr>`;
    }

    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    if(expenses && expenses.length > 0) {
        expenses.forEach(tr => {
            const isIn = tr.type === 'Pemasukan';
            const date = new Date(tr.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            historyList.innerHTML += `
            <div class="history-item">
                <div class="h-icon ${isIn ? 'in' : 'out'}"><i class="fas fa-${isIn ? 'plus' : 'minus'}"></i></div>
                <div class="h-info">
                    <strong>${tr.description}</strong>
                    <span>${date}</span>
                </div>
                <div class="h-amount ${isIn ? 'in' : 'out'}">${isIn ? '+' : '−'} ${formatRp(tr.amount)}</div>
            </div>`;
        });
    } else {
        historyList.innerHTML = `<div class="empty"><i class="fas fa-inbox"></i>Belum ada transaksi</div>`;
    }
}

// === BAYAR IMDA ===
async function loadStudents() {
    currentClass = document.getElementById('filterKelas').value;
    const currentGender = document.getElementById('filterGender').value;
    
    if(!currentClass) return showToast('Pilih Kelas terlebih dahulu!', 'warning');

    document.getElementById('imdaView').style.display = 'block';
    let titleGenderText = currentGender ? ` (${currentGender})` : '';
    document.getElementById('imdaTitle').innerHTML = `<i class="fas fa-file-invoice-dollar" style="color:var(--primary)"></i> Kelas ${currentClass}${titleGenderText}`;

    const { data: feeRows } = await db.from('imda_fees').select('*').eq('class', currentClass).limit(1);
    const feeData = (feeRows && feeRows.length > 0) ? feeRows[0] : null;
    document.getElementById('imdaNominal').innerText = feeData ? `Biaya: ${formatRp(feeData.amount)}` : 'Biaya belum diset';

    const { data: students } = await db.from('students').select('*').eq('class', currentClass);
    let tbody = document.querySelector('#studentTable tbody');
    tbody.innerHTML = '';

    if(students) {
        const wantFemale = currentGender ? currentGender.toLowerCase().includes('perempuan') : null;

        students.sort((a, b) => {
            const aPaid = isTruthy(a.imda_paid);
            const bPaid = isTruthy(b.imda_paid);
            if (aPaid !== bPaid) return aPaid ? 1 : -1; 
            return a.name.localeCompare(b.name); 
        });

        students.forEach(st => {
            if(currentGender) {
                if(wantFemale !== isFemale(st.gender)) return;
            }
            let isPaid = isTruthy(st.imda_paid);
            tbody.innerHTML += `<tr>
                <td><input type="checkbox" class="student-check" data-id="${st.id}" data-name="${st.name}" ${isPaid ? 'disabled checked' : ''}></td>
                <td><strong>${st.name}</strong></td>
                <td style="text-align: center;">${genderShort(st.gender)}</td>
                <td><span class="chip ${isPaid ? 'paid' : 'unpaid'}">${isPaid ? '<i class="fas fa-check"></i> Lunas' : 'Belum Bayar'}</span></td>
            </tr>`;
        });

        if(tbody.innerHTML === '') {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted)">Tidak ada murid yang cocok dengan filter</td></tr>`;
        }
    }
}

function toggleAll(source) { let checkboxes = document.querySelectorAll('.student-check:not(:disabled)'); checkboxes.forEach(cb => cb.checked = source.checked); }

async function processPayment() {
    const checkboxes = document.querySelectorAll('.student-check:checked:not(:disabled)');
    if(checkboxes.length === 0) return showToast('Pilih murid yang akan dibayarkan!', 'warning');

    const updateObj = { imda_paid: true };
    let updatePromises = [];
    checkboxes.forEach(cb => { updatePromises.push(db.from('students').update(updateObj).eq('id', cb.dataset.id)); });
    await Promise.all(updatePromises);

    const { data: feeRows } = await db.from('imda_fees').select('*').eq('class', currentClass).limit(1);
    const feeData = (feeRows && feeRows.length > 0) ? feeRows[0] : null;
    if(feeData) {
        let totalAmount = checkboxes.length * feeData.amount;
        let desc = `Bayar IMDA Kelas ${currentClass} (${checkboxes.length} murid)`;
        
        const { error: expError } = await db.from('expenses').insert({ type: 'Pemasukan', description: desc, amount: totalAmount });
        
        if(expError) {
            console.error("GAGAL INPUT KE EXPENSES:", expError);
            showToast("Pembayaran dicatat di murid, tapi GAGAL dicatat di Riwayat Keuangan!", "error", true);
        } else {
            showToast(`Pembayaran Berhasil! Total Masuk: ${formatRp(totalAmount)}`, 'success', true);
        }
    } else {
        showToast('Pembayaran diproses, tapi biaya IMDA belum diset!', 'warning', true);
    }

    loadStudents(); 
    loadDashboard(); 
}

// === SET BIAYA ===
async function loadFees() {
    const { data: fees } = await db.from('imda_fees').select('*');
    if(fees) { 
        fees.forEach(fee => { 
            const inputEl = document.getElementById(`fee_${fee.class}`); 
            if(inputEl) inputEl.value = fee.amount.toLocaleString('id-ID'); 
        }); 
    }
}

async function saveAllFees() {
    let updatePromises = [];
    for(let kelas = 1; kelas <= 6; kelas++) {
        const inputEl = document.getElementById(`fee_${kelas}`);
        const amountStr = inputEl.value.replace(/\./g, ''); 
        const amount = parseInt(amountStr);
        if(amountStr !== "" && !isNaN(amount)) {
            const { data: existingRows } = await db.from('imda_fees').select('*').eq('class', kelas).limit(1);
            if(existingRows && existingRows.length > 0) { 
                updatePromises.push(db.from('imda_fees').update({ amount: amount }).eq('id', existingRows[0].id)); 
            } else { 
                updatePromises.push(db.from('imda_fees').insert({ class: kelas, amount: amount })); 
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
    const amountStr = document.getElementById('expenseAmount').value.replace(/\./g, ''); 
    const amount = parseInt(amountStr);
    
    if(!desc || isNaN(amount) || amount <= 0) return showToast('Isi keterangan dan nominal dengan benar!', 'warning');
    
    const { error: expError } = await db.from('expenses').insert({ type: 'Pengeluaran', description: desc, amount: amount });
    
    if(expError) {
         console.error("GAGAL CATAT PENGELUARAN:", expError);
         showToast("Gagal mencatat pengeluaran. Cek kolom 'type' di tabel expenses!", "error", true);
    } else {
         showToast('Pengeluaran berhasil dicatat!', 'success');
         document.getElementById('expenseDesc').value = '';
         document.getElementById('expenseAmount').value = '';
         loadDashboard();
    }
}

// === EXPORT EXCEL ===
async function exportToExcel() {
    showToast('Menyiapkan file Excel...', 'warning');
    
    const { data: students } = await db.from('students').select('*');
    const { data: expenses } = await db.from('expenses').select('*').order('created_at', { ascending: false });

    const studentData = students.map(st => ({
        "Nama Murid": st.name,
        "Kelas": `Kelas ${st.class}`,
        "L/P": genderShort(st.gender),
        "IMDA": isTruthy(st.imda_paid) ? 'Lunas' : 'Belum'
    }));

    const expenseData = expenses.map(ex => ({
        "Tanggal": new Date(ex.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        "Tipe": ex.type,
        "Keterangan": ex.description,
        "Nominal (Rp)": ex.amount
    }));

    const wb = XLSX.utils.book_new();
    const wsStudents = XLSX.utils.json_to_sheet(studentData);
    XLSX.utils.book_append_sheet(wb, wsStudents, "Rekap Murid");
    const wsExpenses = XLSX.utils.json_to_sheet(expenseData);
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Riwayat Transaksi");
    XLSX.writeFile(wb, "Laporan_Keuangan_IMDA.xlsx");
    
    showToast('File Excel berhasil didownload!', 'success');
}

// === INIT ===
setGreeting();
loadDashboard();