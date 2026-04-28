import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    projectId: "jml-loans-560d8",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app", 
};

const appInstance = initializeApp(firebaseConfig);
const db = getDatabase(appInstance);
const auth = getAuth(appInstance);

let clients = [];
let currentIndex = null;
let currentUserData = { role: 'employee' };

// --- CORE SYSTEM LOGIC ---
const app = {
    init() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                document.getElementById('login-overlay').classList.add('hidden');
                this.loadData();
                this.checkRole(user);
            } else {
                document.getElementById('login-overlay').classList.remove('hidden');
            }
        });
    },

    checkRole(user) {
        // Admin logic: if email is admin@jml.com, show restricted tabs
        const isAdmin = user.email.includes('admin');
        currentUserData.role = isAdmin ? 'admin' : 'employee';
        document.getElementById('role-display').innerText = isAdmin ? 'ADMIN PORTAL' : 'EMPLOYEE PORTAL';
    },

    loadData() {
        onValue(ref(db, 'jml_v3/'), (snap) => {
            clients = snap.val() ? Object.values(snap.val()) : [];
            this.renderTable();
            this.updateFinancials();
            if(currentIndex !== null) this.openDashboard(currentIndex);
        });
    },

    // 💰 FINANCIAL CALCULATIONS (1.25x Profit Logic)
    updateFinancials() {
        let tOut = 0, tToday = 0, tProfit = 0;
        const today = new Date().toLocaleDateString('en-GB');
        
        clients.forEach(c => {
            tOut += (c.balance || 0);
            (c.history || []).forEach(h => {
                if(h.date === today && h.act === "Payment") tToday += (h.amt || 0);
                // Profit is the interest portion of any payment (0.25 of the total 1.25 cycle)
                if(h.act === "Payment") tProfit += (h.amt * 0.2); 
            });
        });

        document.getElementById('total-out').innerText = `KSh ${tOut.toLocaleString()}`;
        document.getElementById('total-today').innerText = `KSh ${tToday.toLocaleString()}`;
        document.getElementById('monthly-profit').innerText = `KSh ${tProfit.toLocaleString()}`;
    },

    // 🔍 DOSSIER SYSTEM
    openDashboard(idNum) {
        const c = clients.find(x => x.idNo === idNum);
        if(!c) return;
        currentIndex = idNum;
        
        document.getElementById('d-name').innerText = c.name;
        document.getElementById('d-id-val').innerText = c.idNo;
        document.getElementById('d-phone-val').innerText = c.phone || '--';
        document.getElementById('d-loc-val').innerText = c.location || '--';
        document.getElementById('d-occ-val').innerText = c.occupation || '--';
        document.getElementById('d-ref-val').innerText = c.referral || '--';
        document.getElementById('d-principal').innerText = c.loan.toLocaleString();
        document.getElementById('d-total').innerText = (c.loan * 1.25).toLocaleString();
        document.getElementById('d-balance').innerText = c.balance.toLocaleString();
        document.getElementById('d-updated').innerText = c.updatedAt || 'New';
        document.getElementById('d-notes').value = c.notes || "";

        // 📊 HISTORY WITH SMART HIGHLIGHTING
        const histBody = document.getElementById('historyBody');
        histBody.innerHTML = (c.history || []).slice().reverse().map((h, i, arr) => {
            // Rule 1: Late Entry (> 18:00)
            const isLate = h.time > '18:00' ? 'style="color:red; font-weight:bold"' : '';
            // Rule 2: New Loan highlight
            const rowClass = h.act === "Initial" ? 'new-loan-row' : '';
            // Rule 3: Skipped Day Detection
            let skippedClass = '';
            if(i < arr.length - 1) {
                const diff = (new Date(h.date) - new Date(arr[i+1].date)) / (1000*3600*24);
                if(diff > 1) skippedClass = 'skipped-day-alert';
            }

            return `<tr class="${rowClass} ${skippedClass}">
                <td>${h.date}</td>
                <td>${h.act}</td>
                <td>${h.det}</td>
                <td ${isLate}>${h.time}</td>
                <td>${h.by}</td>
            </tr>`;
        }).join('');
        
        document.getElementById('detailWindow').classList.remove('hidden');
    },

    processAction(type) {
        const amt = parseFloat(document.getElementById('payAmt').value);
        const time = document.getElementById('payTime').value;
        const det = document.getElementById('payDet').value;
        const staff = auth.currentUser.email.split('@')[0];
        
        if(!confirm(`Confirm ${type} action?`)) return;

        const cRef = ref(db, `jml_v3/${currentIndex}`);
        const c = clients.find(x => x.idNo === currentIndex);

        if(type === 'pay') {
            const newBal = c.balance - amt;
            update(cRef, {
                balance: newBal,
                updatedAt: new Date().toLocaleString(),
                history: [...(c.history || []), {
                    date: new Date().toLocaleDateString('en-GB'),
                    time: time, act: "Payment", amt: amt, det: det, by: staff
                }]
            });
        }
        
        if(type === 'settle') {
            update(cRef, {
                balance: 0,
                status: 'Settled',
                history: [...(c.history || []), {
                    date: new Date().toLocaleDateString('en-GB'),
                    time: time || '12:00', act: "Settled", det: "Loan Cleared", by: staff
                }]
            });
        }
    },

    searchClients() {
        const term = document.getElementById('globalSearch').value.toLowerCase();
        const filtered = clients.filter(c => c.name.toLowerCase().includes(term) || c.idNo.includes(term));
        this.renderTable(filtered);
    },

    renderTable(data = clients) {
        const tbody = document.getElementById('clientTableBody');
        tbody.innerHTML = data.map((c, i) => `
            <tr>
                <td>${i+1}</td>
                <td><strong>${c.name}</strong></td>
                <td>${c.idNo}</td>
                <td>${c.phone}</td>
                <td>KSh ${((c.loan * 1.25) - c.balance).toLocaleString()}</td>
                <td style="color:var(--danger); font-weight:bold">KSh ${c.balance.toLocaleString()}</td>
                <td><button class="view-btn" onclick="app.openDashboard('${c.idNo}')">Open</button></td>
            </tr>
        `).join('');
    }
};

// --- GLOBAL UI HANDLERS ---
window.app = app;
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(() => alert("Access Denied"));
};
window.handleLogout = () => signOut(auth);
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('minimized');
window.toggleDarkMode = () => document.body.classList.toggle('dark-mode');
window.closeDetails = () => { currentIndex = null; document.getElementById('detailWindow').classList.add('hidden'); };

window.showSection = (id, el) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    if(window.innerWidth < 768) toggleSidebar();
};

document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const idNo = document.getElementById('f-id').value;
    const p = parseFloat(document.getElementById('f-loan').value);
    const staff = auth.currentUser.email.split('@')[0];
    
    set(ref(db, `jml_v3/${idNo}`), {
        name: document.getElementById('f-name').value,
        idNo: idNo,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-loc').value,
        occupation: document.getElementById('f-occ').value,
        referral: document.getElementById('f-ref').value,
        loan: p, 
        balance: p * 1.25, // THE 1.25 RULE
        startDate: document.getElementById('f-start').value,
        endDate: document.getElementById('f-end').value,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: '08:00', act: "Initial", det: "Loan Issued", by: staff
        }],
        updatedAt: new Date().toLocaleString()
    });
    
    e.target.reset();
    window.showSection('list-sec', document.querySelector('.nav-item'));
});

app.init();
