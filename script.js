// Database Integration
const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jml-loans-560d8"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const app = {
    clients: [],
    activeKey: null,

    init() {
        db.ref('jml_final_db').on('value', snap => {
            const val = snap.val();
            this.clients = val ? Object.keys(val).map(k => ({ key: k, ...val[k] })) : [];
            this.renderMasterList();
            this.calcFinance();
        });
    },

    // 1. MODULE SWITCHING (SPA LOGIC)
    switchTab(id, el) {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        if(el) {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            el.classList.add('active');
        }
    },

    // 2. ENROLLMENT (1.25x Interest & Auto-Redirect)
    enrollClient() {
        const id = document.getElementById('en-id').value;
        const princ = parseFloat(document.getElementById('en-princ').value);
        if(!id || !princ) return alert("Please fill ID and Principal.");

        const data = {
            name: document.getElementById('en-name').value,
            idNo: id, phone: document.getElementById('en-phone').value,
            location: document.getElementById('en-loc').value,
            occupation: document.getElementById('en-occ').value,
            referral: document.getElementById('en-ref').value,
            principal: princ, balance: princ * 1.25, totalPaid: 0,
            start: document.getElementById('en-start').value,
            end: document.getElementById('en-end').value,
            status: 'Active', updated: new Date().toLocaleString(),
            history: [], notes: "", officer: ""
        };

        db.ref('jml_final_db/' + id).set(data).then(() => {
            alert("Enrollment Successful.");
            document.querySelectorAll('#enroll-sec input').forEach(i => i.value = '');
            this.switchTab('list-sec', document.querySelector('.nav-item'));
        });
    },

    // 3. DOSSIER LOGIC (SKIPPED DAYS & 6PM HIGHLIGHTING)
    openDossier(key) {
        this.activeKey = key;
        const c = this.clients.find(x => x.key === key);
        this.switchTab('view-sec');
        
        document.getElementById('v-title-name').innerText = c.name;
        document.getElementById('v-title-id').innerText = c.idNo;
        document.getElementById('v-p').innerText = c.principal;
        document.getElementById('v-tp').innerText = c.totalPaid;
        document.getElementById('v-bal').innerText = c.balance;
        document.getElementById('v-last-up').innerText = c.updated;
        document.getElementById('v-notes').value = c.notes || "";
        
        document.getElementById('v-info-box').innerHTML = `
            <p><strong>Location:</strong> ${c.location}</p>
            <p><strong>Occupation:</strong> ${c.occupation}</p>
            <p><strong>Referral:</strong> ${c.referral}</p>
            <p><strong>Phone:</strong> ${c.phone}</p>
        `;

        this.renderHistory(c.history);
    },

    renderHistory(history) {
        const body = document.getElementById('v-history-body');
        if(!history) { body.innerHTML = ""; return; }
        
        const hArr = Object.values(history).sort((a,b) => new Date(b.date) - new Date(a.date));
        body.innerHTML = hArr.map((h, i) => {
            // 6PM Late Rule
            const isLate = h.time > "18:00" ? 'late-row' : '';
            // Skipped Day Rule
            let isSkipped = '';
            if(i < hArr.length - 1) {
                const diff = (new Date(h.date) - new Date(hArr[i+1].date)) / (1000*3600*24);
                if(diff > 1) isSkipped = 'skipped-day';
            }
            const isNew = h.activity === 'New Loan' ? 'new-cycle-row' : '';

            return `<tr class="${isLate} ${isSkipped} ${isNew}">
                <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td>
                <td>${h.time}</td><td>Admin</td>
            </tr>`;
        }).join('');
    },

    // 4. SATURDAY LOAN WEEKLY SORTING
    renderWeeklyLoans() {
        const m = parseInt(document.getElementById('loan-month-sel').value);
        const w = parseInt(document.getElementById('loan-week-sel').value);
        const body = document.getElementById('loanSortBody');
        
        const filtered = this.clients.filter(c => {
            const d = new Date(c.start);
            if(d.getMonth() !== m) return false;
            const day = d.getDate();
            let week = 1;
            if(day > 7) week = 2; if(day > 14) week = 3; if(day > 21) week = 4;
            return week === w;
        });

        body.innerHTML = filtered.map((c, i) => `
            <tr><td>${i+1}</td><td>${c.name}</td><td>${c.idNo}</td><td>${c.phone}</td><td>${c.principal}</td><td>${c.start}</td></tr>
        `).join('');
    },

    // 5. SECURE OPERATIONS
    op(type) {
        if(!confirm("Are you sure?")) return;
        const c = this.clients.find(x => x.key === this.activeKey);
        const amt = parseFloat(document.getElementById('act-amt').value);
        const time = document.getElementById('act-time').value;

        if(type === 'pay') {
            const newP = c.totalPaid + amt;
            const newB = c.balance - amt;
            db.ref(`jml_final_db/${this.activeKey}`).update({
                totalPaid: newP, balance: newB, updated: new Date().toLocaleString()
            });
            db.ref(`jml_final_db/${this.activeKey}/history`).push({
                date: new Date().toLocaleDateString(), activity: 'Payment',
                details: document.getElementById('act-det').value, time: time
            });
        }
        if(type === 'del') {
            db.ref(`jml_final_db/${this.activeKey}`).remove().then(() => this.switchTab('list-sec'));
        }
    }
};

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }
function toggleTheme() { document.body.classList.toggle('dark-mode'); }

app.init();
