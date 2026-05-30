// === KONFIGURASI SUPABASE ===
const SUPABASE_URL = 'https://qjbscpbgowzfnudqrrqa.supabase.co'; // GANTI INI
const SUPABASE_KEY = 'sb_publishable_nFuXLJrfDVrOP-8D_2QEdA_Zz7feBWa'; // GANTI INI
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentImdaType = '';
let currentClass = '';

// === FUNGSI TOAST (PERSISTEN) ===
function showToast(message, type = 'success', sticky = false) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-times-circle' : 'fa-exclamation-triangle');
    
    let closeBtnHtml = sticky ? `<button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>` : '';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span style="flex:1; padding-right: 15px;">${message}</span> ${closeBtnHtml}`;
    container.appendChild(toast);
    
    if(!sticky) {
        setTimeout(() => { toast.remove(); }, 3000);
    }
}

// === FORMAT RUPIAH & OTOMATIS TITIK ===
const formatRp = (angka) => 'Rp ' + Number(angka).toLocaleString('id-ID');

function formatCurrencyInput(event) {
    let value = event.target.value.replace(/[^0-9]/g, '');
    if (value === '') { event.target.value = ''; return; }
    event.target.value = parseInt(value, 10).toLocaleString('id-ID');
}
document.querySelectorAll('.currency-input').forEach(input => { input.addEventListener('input', formatCurrencyInput); });

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

// === FUNGSI PENGECEKAN BOOLEAN YANG SANGAT AMAN ===
// Supabase bisa mereturn true, 1, atau "true". Fungsi ini menangani semuanya.
const isTruthy = (val) => {
    return val === true || val === 1 || val === 'true' || val === '1';
};

// === DASHBOARD (REKAP SUPER AMAN) ===
async function loadDashboard() {
    const { data: students, error: errStudent } = await db.from('students').select('*');
    const { data: expenses, error: errExpense } = await db.from('expenses').select('*').order('created_at', { ascending: false });
    
    // Jika ada error koneksi database, tampilkan di console
    if(errStudent) console.error("Error Fetch Students:", errStudent);
    if(errExpense) console.error("Error Fetch Expenses:", errExpense);

    const recapImda = document.getElementById('recapFilterImda').value;
    
    let totalIn = 0;
    let totalOut = 0;
    let classStats = {};

    for(let i=1; i<=6; i++) { 
        classStats[i] = { lPaid: 0, lUnpaid: 0, pPaid: 0, pUnpaid: 0, total: 0 }; 
    }

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
                
                // Pengecekan bayar menggunakan fungsi isTruthy yang aman
                let isPaid = false;
                if (recapImda === 'ALL') {
                    isPaid = isTruthy(st.imda_i) || isTruthy(st.imda_ii) || isTruthy(st.imda_iii);
                } else if (recapImda === 'I') {
                    isPaid = isTruthy(st.imda_i);
                } else if (recapImda === 'II') {
                    isPaid = isTruthy(st.imda_ii);
                } else if (recapImda === 'III') {
                    isPaid = isTruthy(st.imda_iii);
                }
                
                if(st.gender === 'LAKI - LAKI') {
                    isPaid ? classStats[st.class].lPaid++ : classStats[st.class].lUnpaid++;
                } else if(st.gender === 'PEREMPUAN') {
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
            <td><span class="text-green">${classStats[i].lPaid} Lunas</span> / <span class="text-red">${classStats[i].lUnpaid} Belum</span></td>
            <td><span class="text-green">${classStats[i].pPaid} Lunas</span> / <span class="text-red">${classStats[i].pUnpaid} Belum</span></td>
            <td>${classStats[i].total} Orang</td>
        </tr>`;
    }

    let tbodyHistory = document.querySelector('#historyTable tbody');
    tbodyHistory.innerHTML = '';
    if(expenses && expenses.length > 0) {
        expenses.forEach(tr => {
            let date = new Date(tr.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            let nominalClass = tr.type === 'Pemasukan' ? 'text-green' : 'text-red';
            let prefix = tr.type === 'Pemasukan' ? '+ ' : '- ';
            tbodyHistory.innerHTML += `<tr>
                <td>${date}</td>
                <td>${tr.description}</td>
                <td style="text-align: right;" class="${nominalClass}">${prefix}${formatRp(tr.amount)}</td>
            </tr>`;
        });
    } else {
        tbodyHistory.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted)">Belum ada transaksi</td></tr>`;
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
        students.sort((a, b) => {
            const aPaid = isTruthy(a[colName]);
            const bPaid = isTruthy(b[colName]);
            if (aPaid !== bPaid) return aPaid ? 1 : -1; 
            return a.name.localeCompare(b.name); 
        });

        students.forEach(st => {
            if(currentGender && st.gender !== currentGender) return;
            let isPaid = isTruthy(st[colName]); // Menggunakan fungsi aman
            let genderShort = st.gender === 'LAKI - LAKI' ? 'L' : (st.gender === 'PEREMPUAN' ? 'P' : '-');
            tbody.innerHTML += `<tr>
                <td><input type="checkbox" class="student-check" data-id="${st.id}" data-name="${st.name}" ${isPaid ? 'disabled checked' : ''}></td>
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
    const updateObj = {}; updateObj[colName] = true; // Set true ke database
    
    let updatePromises = [];
    checkboxes.forEach(cb => { updatePromises.push(db.from('students').update(updateObj).eq('id', cb.dataset.id)); });
    await Promise.all(updatePromises);

    const { data: feeData } = await db.from('imda_fees').select('*').eq('class', currentClass).eq('imda_type', currentImdaType).single();
    if(feeData) {
        let totalAmount = checkboxes.length * feeData.amount;
        let desc = `Bayar IMDA ${currentImdaType} Kelas ${currentClass} (${checkboxes.length} murid)`;
        
        // Insert ke tabel expenses, dan tangkap error-nya kalau gagal
        const { error: expError } = await db.from('expenses').insert({ type: 'Pemasukan', description: desc, amount: totalAmount });
        
        if(expError) {
            console.error("GAGAL INPUT KE EXPENSES:", expError);
            showToast("Pembayaran dicatat di murid, tapi GAGAL dicatat di Riwayat Keuangan. Cek apakah kolom 'type' sudah ditambahkan di tabel expenses!", "error", true);
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
    if(fees) { fees.forEach(fee => { const inputId = `fee_${fee.class}_${fee.imda_type}`; const inputEl = document.getElementById(inputId); if(inputEl) inputEl.value = fee.amount.toLocaleString('id-ID'); }); }
}

async function saveAllFees() {
    const imdaTypes = ['I', 'II', 'III']; let updatePromises = [];
    for(let kelas = 1; kelas <= 6; kelas++) {
        for(let i = 0; i < imdaTypes.length; i++) {
            const imda = imdaTypes[i]; const inputId = `fee_${kelas}_${imda}`;
            const inputEl = document.getElementById(inputId);
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
    const amountStr = document.getElementById('expenseAmount').value.replace(/\./g, ''); 
    const amount = parseInt(amountStr);
    
    if(!desc || isNaN(amount) || amount <= 0) return showToast('Isi keterangan dan nominal dengan benar!', 'warning');
    
    const { error: expError } = await db.from('expenses').insert({ type: 'Pengeluaran', description: desc, amount: amount });
    
    if(expError) {
         console.error("GAGAL CATAT PENGELUARAN:", expError);
         showToast("Gagal mencatat pengeluaran. Cek apakah kolom 'type' sudah ditambahkan di tabel expenses!", "error", true);
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
        "L/P": st.gender === 'LAKI - LAKI' ? 'L' : (st.gender === 'PEREMPUAN' ? 'P' : '-'),
        "IMDA I": isTruthy(st.imda_i) ? 'Lunas' : 'Belum',
        "IMDA II": isTruthy(st.imda_ii) ? 'Lunas' : 'Belum',
        "IMDA III": isTruthy(st.imda_iii) ? 'Lunas' : 'Belum'
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

loadDashboard();
