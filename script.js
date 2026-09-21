// === KONFIGURASI SUPABASE ===
const SUPABASE_URL = 'https://qjbscpbgowzfnudqrrqa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nFuXLJrfDVrOP-8D_2QEdA_Zz7feBWa';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// === KONFIGURASI AREA RAHASIA ===
const SECRET_PASS = 'mra4321';
const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
const ATM_DENOM = 0; // kode khusus: baris penyimpanan saldo ATM di tabel cash_drawer
let cashSystemSaldo = 0;

let currentClass = '';
let allStudents = [];
let editingId = null;

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

// === SAPAAN ===
function setGreeting() {
    const h = new Date().getHours();
    let t;
    if (h >= 4 && h < 11) t = 'Selamat pagi ☀️';
    else if (h < 15) t = 'Selamat siang 🌤️';
    else if (h < 18) t = 'Selamat sore 🌇';
    else t = 'Selamat malam 🌙';
    document.getElementById('greeting').textContent = t;
}

// === JAM LIVE + TANGGAL MASEHI + HIJRIYAH ===
function updateDateTime() {
    const now = new Date();
    const p = n => String(n).padStart(2, '0');
    document.getElementById('liveClock').textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    document.getElementById('liveDate').textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    try {
        let hijri = new Intl.DateTimeFormat('id-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
        if (!/H$/.test(hijri.trim())) hijri = hijri.trim() + ' H';
        document.getElementById('hijriDate').textContent = hijri;
    } catch (e) {
        document.getElementById('hijriDate').textContent = '-';
    }
}
setInterval(updateDateTime, 1000);

// === NAVIGASI ===
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('.nav-btn, .bn-item').forEach(el => {
        el.classList.toggle('active', el.dataset.section === sectionId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if(sectionId === 'dashboard') loadDashboard();
    if(sectionId === 'datamurid') loadMurid();
    if(sectionId === 'setbiaya') loadFees();
    if(sectionId === 'kasrahasia') loadCash();
}

// === HELPER AMAN ===
const isTruthy = (val) => val === true || val === 1 || val === 'true' || val === '1';
function isFemale(g) {
    const s = (g || '').toString().toLowerCase();
    return s.includes('perempuan') || s.includes('wanita') || s.trim() === 'p';
}
function genderShort(g) { return !g ? '-' : (isFemale(g) ? 'P' : 'L'); }

// ============================================================
// AREA RAHASIA: PASSWORD (SELALU DIMINTA SETIAP KALI BUKA)
// ============================================================
function openSecretPrompt() {
    document.getElementById('passOverlay').classList.add('open');
    setTimeout(() => document.getElementById('secretPass').focus(), 60);
}
function closePassModal() {
    document.getElementById('passOverlay').classList.remove('open');
    document.getElementById('secretPass').value = '';
    document.querySelector('.modal-pass').classList.remove('shake');
}
function checkSecretPass() {
    const val = document.getElementById('secretPass').value;
    if (val === SECRET_PASS) {
        closePassModal();
        showSection('kasrahasia');
        showToast('Selamat datang di area rahasia 🔓', 'success');
    } else {
        const modal = document.querySelector('.modal-pass');
        modal.classList.remove('shake');
        void modal.offsetWidth;
        modal.classList.add('shake');
        showToast('Password salah!', 'error');
        document.getElementById('secretPass').value = '';
        document.getElementById('secretPass').focus();
    }
}

// ============================================================
// AREA RAHASIA: KAS TUNAI + ATM + SELISIH
// ============================================================
async function loadCash() {
    // 1. Saldo sistem (Pemasukan - Pengeluaran di tabel expenses)
    const { data: expenses } = await db.from('expenses').select('type, amount');
    let tin = 0, tout = 0;
    if (expenses) expenses.forEach(tr => {
        if (tr.type === 'Pemasukan') tin += tr.amount;
        if (tr.type === 'Pengeluaran') tout += tr.amount;
    });
    cashSystemSaldo = tin - tout;
    document.getElementById('cashSysSaldo').innerText = formatRp(cashSystemSaldo);

    // 2. Muat hitungan tersimpan (pecahan + ATM)
    const { data: rows } = await db.from('cash_drawer').select('*');
    if (rows) {
        DENOMS.forEach(d => {
            const r = rows.find(x => Number(x.denom) === d);
            document.getElementById('qty_' + d).value = r ? r.qty : 0;
        });
        const atmRow = rows.find(x => Number(x.denom) === ATM_DENOM);
        document.getElementById('atmAmount').value = atmRow ? Number(atmRow.qty).toLocaleString('id-ID') : '';
    }
    calcCash();
}

function calcCash() {
    // Total tunai dari pecahan
    let totalTunai = 0;
    DENOMS.forEach(d => {
        const q = parseInt(document.getElementById('qty_' + d).value) || 0;
        const sub = q * d;
        totalTunai += sub;
        document.getElementById('sub_' + d).innerText = formatRp(sub);
    });

    // Saldo ATM
    const atmStr = (document.getElementById('atmAmount').value || '').replace(/\./g, '');
    const atm = parseInt(atmStr) || 0;
    const total = totalTunai + atm;

    document.getElementById('cashTotalTunai').innerText = formatRp(totalTunai);
    document.getElementById('cashTotalAtm').innerText = formatRp(atm);
    document.getElementById('cashTotal').innerText = formatRp(total);

    // Selisih: Kas Nyata vs Sistem
    const diff = total - cashSystemSaldo;
    const el = document.getElementById('cashDiff');
    const note = document.getElementById('cashDiffNote');
    el.className = '';
    if (diff === 0) {
        el.innerText = 'Rp 0';
        el.classList.add('ok');
        note.innerText = '✅ Kas cocok dengan pencatatan';
    } else if (diff < 0) {
        el.innerText = '- ' + formatRp(Math.abs(diff));
        el.classList.add('minus');
        note.innerText = '🔴 Uang kurang — kemungkinan hilang / ada pengeluaran belum dicatat';
    } else {
        el.innerText = '+ ' + formatRp(diff);
        el.classList.add('plus');
        note.innerText = '🟡 Uang lebih — kemungkinan ada pemasukan belum dicatat';
    }
}

async function saveCash() {
    const atmStr = (document.getElementById('atmAmount').value || '').replace(/\./g, '');
    const atm = parseInt(atmStr) || 0;

    const rows = DENOMS.map(d => ({
        denom: d,
        qty: parseInt(document.getElementById('qty_' + d).value) || 0,
        updated_at: new Date().toISOString()
    }));
    rows.push({ denom: ATM_DENOM, qty: atm, updated_at: new Date().toISOString() });

    const { error } = await db.from('cash_drawer').upsert(rows, { onConflict: 'denom' });
    if (error) { console.error(error); return showToast('Gagal menyimpan hitungan!', 'error', true); }
    showToast('Hitungan kas tunai & ATM berhasil disimpan!', 'success');
}

async function resetCash() {
    if (!confirm('Kosongkan semua hitungan tunai & ATM? (Jangan lupa klik Simpan setelahnya)')) return;
    DENOMS.forEach(d => { document.getElementById('qty_' + d).value = 0; });
    document.getElementById('atmAmount').value = '';
    calcCash();
    showToast('Semua dikosongkan. Klik "Simpan Hitungan" untuk menyimpan.', 'warning');
}

// === DASHBOARD (SEKALIGUS UPDATE SALDO HEADER) ===
async function loadDashboard() {
    const { data: students } = await db.from('students').select('*');
    const { data: expenses, error: errExpense } = await db.from('expenses').select('*').order('created_at', { ascending: false });
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

    document.getElementById('saldoHeader').innerText = formatRp(totalIn - totalOut);
    document.getElementById('totalIn').innerText = formatRp(totalIn);
    document.getElementById('totalOut').innerText = formatRp(totalOut);

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
                <div class="h-info"><strong>${tr.description}</strong><span>${date}</span></div>
                <div class="h-amount ${isIn ? 'in' : 'out'}">${isIn ? '+' : '−'} ${formatRp(tr.amount)}</div>
            </div>`;
        });
    } else {
        historyList.innerHTML = `<div class="empty"><i class="fas fa-inbox"></i>Belum ada transaksi</div>`;
    }
}

// === BAYAR IMDA + SEARCH ===
async function loadStudents() {
    currentClass = document.getElementById('filterKelas').value;
    const currentGender = document.getElementById('filterGender').value;

    if(!currentClass) return showToast('Pilih Kelas terlebih dahulu!', 'warning');

    document.getElementById('imdaView').style.display = 'block';
    document.getElementById('searchBayar').value = '';
    let titleGenderText = currentGender ? ` (${currentGender})` : '';
    document.getElementById('imdaTitle').innerHTML = `<i class="fas fa-file-invoice-dollar" style="color:var(--green-dark)"></i> Kelas ${currentClass}${titleGenderText}`;

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
            if(currentGender && (wantFemale !== isFemale(st.gender))) return;
            let isPaid = isTruthy(st.imda_paid);
            tbody.innerHTML += `<tr data-name="${st.name}">
                <td><input type="checkbox" class="student-check" data-id="${st.id}" ${isPaid ? 'disabled checked' : ''}></td>
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

function filterBayarTable() {
    const q = (document.getElementById('searchBayar').value || '').toLowerCase();
    document.querySelectorAll('#studentTable tbody tr[data-name]').forEach(tr => {
        tr.style.display = tr.dataset.name.toLowerCase().includes(q) ? '' : 'none';
    });
}

function toggleAll(source) { let checkboxes = document.querySelectorAll('.student-check:not(:disabled)'); checkboxes.forEach(cb => cb.checked = source.checked); }

async function processPayment() {
    const checkboxes = document.querySelectorAll('.student-check:checked:not(:disabled)');
    if(checkboxes.length === 0) return showToast('Pilih murid yang akan dibayarkan!', 'warning');

    let updatePromises = [];
    checkboxes.forEach(cb => { updatePromises.push(db.from('students').update({ imda_paid: true }).eq('id', cb.dataset.id)); });
    await Promise.all(updatePromises);

    const { data: feeRows } = await db.from('imda_fees').select('*').eq('class', currentClass).limit(1);
    const feeData = (feeRows && feeRows.length > 0) ? feeRows[0] : null;
    if(feeData) {
        let totalAmount = checkboxes.length * feeData.amount;
        let desc = `Bayar IMDA Kelas ${currentClass} (${checkboxes.length} murid)`;
        const { error: expError } = await db.from('expenses').insert({ type: 'Pemasukan', description: desc, amount: totalAmount });
        if(expError) {
            console.error("GAGAL INPUT KE EXPENSES:", expError);
            showToast("Pembayaran dicatat, tapi GAGAL dicatat di Riwayat Keuangan!", "error", true);
        } else {
            showToast(`Pembayaran Berhasil! Total Masuk: ${formatRp(totalAmount)}`, 'success', true);
        }
    } else {
        showToast('Pembayaran diproses, tapi biaya IMDA belum diset!', 'warning', true);
    }

    loadStudents();
    loadDashboard();
}

// === DATA MURID ===
async function loadMurid() {
    const { data, error } = await db.from('students').select('*').order('class', { ascending: true }).order('name', { ascending: true });
    if(error) { console.error(error); return showToast('Gagal memuat data murid!', 'error'); }
    allStudents = data || [];
    renderMuridTable();
}

function renderMuridTable() {
    const q = (document.getElementById('muridSearch').value || '').toLowerCase();
    const kelas = document.getElementById('muridFilterKelas').value;
    const tbody = document.querySelector('#muridTable tbody');
    tbody.innerHTML = '';

    const filtered = allStudents.filter(s =>
        (!kelas || String(s.class) === kelas) &&
        (!q || s.name.toLowerCase().includes(q))
    );

    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted)">Data tidak ditemukan</td></tr>`;
    } else {
        filtered.forEach(s => {
            const paid = isTruthy(s.imda_paid);
            tbody.innerHTML += `<tr>
                <td><strong>${s.name}</strong></td>
                <td>Kelas ${s.class}</td>
                <td style="text-align:center;">${genderShort(s.gender)}</td>
                <td><span class="chip ${paid ? 'paid' : 'unpaid'}">${paid ? 'Lunas' : 'Belum'}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                    <button class="icon-btn edit" title="Edit" onclick="editStudent(${s.id})"><i class="fas fa-pen"></i></button>
                    <button class="icon-btn del" title="Hapus" onclick="deleteStudent(${s.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
    }
    document.getElementById('muridCount').innerText = `Menampilkan ${filtered.length} dari ${allStudents.length} murid`;
}

function openModal() { document.getElementById('modalOverlay').classList.add('open'); }
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

function openAddModal() {
    editingId = null;
    document.getElementById('modalTitle').innerText = 'Tambah Murid';
    document.getElementById('editName').value = '';
    document.getElementById('editClass').value = '1';
    document.getElementById('editGender').value = 'Laki-laki';
    document.getElementById('resetRow').style.display = 'none';
    openModal();
}

function editStudent(id) {
    const s = allStudents.find(x => x.id === id);
    if(!s) return;
    editingId = id;
    document.getElementById('modalTitle').innerText = 'Edit Data Murid';
    document.getElementById('editName').value = s.name;
    document.getElementById('editClass').value = s.class;
    document.getElementById('editGender').value = isFemale(s.gender) ? 'Perempuan' : 'Laki-laki';
    document.getElementById('editResetPaid').checked = false;
    document.getElementById('resetRow').style.display = 'flex';
    openModal();
}

async function saveStudentEdit() {
    const name = document.getElementById('editName').value.trim();
    const kelas = parseInt(document.getElementById('editClass').value);
    const gender = document.getElementById('editGender').value;

    if(!name) return showToast('Nama murid tidak boleh kosong!', 'warning');

    let error;
    if(editingId) {
        const payload = { name: name, class: kelas, gender: gender };
        if(document.getElementById('editResetPaid').checked) payload.imda_paid = false;
        ({ error } = await db.from('students').update(payload).eq('id', editingId));
    } else {
        ({ error } = await db.from('students').insert({ name: name, class: kelas, gender: gender, imda_paid: false }));
    }

    if(error) { console.error(error); return showToast('Gagal menyimpan data!', 'error', true); }

    showToast(editingId ? 'Data murid berhasil diperbarui!' : 'Murid baru berhasil ditambahkan!', 'success');
    closeModal();
    loadMurid();
    loadDashboard();
}

async function deleteStudent(id) {
    const s = allStudents.find(x => x.id === id);
    if(!confirm(`Hapus murid "${s ? s.name : ''}" secara permanen?`)) return;
    const { error } = await db.from('students').delete().eq('id', id);
    if(error) { console.error(error); return showToast('Gagal menghapus data!', 'error', true); }
    showToast('Data murid berhasil dihapus!', 'success');
    loadMurid();
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
        showToast("Gagal mencatat pengeluaran!", "error", true);
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentData), "Rekap Murid");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseData), "Riwayat Transaksi");
    XLSX.writeFile(wb, "Laporan_B10_Payment.xlsx");
    showToast('File Excel berhasil didownload!', 'success');
}

// Klik area gelap = tutup modal
document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if(e.target === this) closeModal();
});
document.getElementById('passOverlay').addEventListener('click', function(e) {
    if(e.target === this) closePassModal();
});

// === INIT ===
setGreeting();
updateDateTime();
loadDashboard();