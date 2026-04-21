<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JML LOAN MANAGEMENT PRO</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="light-mode">

    <div id="login-overlay" class="modal">
        <div class="modal-content auth-card">
            <h1>JML LIMITED</h1>
            <input type="email" id="login-email" placeholder="Email">
            <input type="password" id="login-password" placeholder="Password">
            <button onclick="handleLogin()" class="btn-post">Login</button>
        </div>
    </div>

    <div class="app-container hidden" id="main-app">
        <nav class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <span>JML SYSTEM</span>
                <i class="fas fa-times toggle-icon" onclick="toggleSidebar()"></i>
            </div>
            <div class="nav-item active" onclick="showSection('list-sec')">1. Clients</div>
            <div class="nav-item" onclick="showSection('add-sec')">2. Enroll Client</div>
            <div class="nav-item" onclick="showSection('finance-sec')">3. Financials</div>
            <div class="nav-item" onclick="showSection('loan-sec')">4. Loans</div>
            <div class="nav-item" onclick="showSection('settled-sec')">5. Settled Loans</div>
            <div class="nav-item" onclick="showSection('debt-sec')">6. Debts</div>
            <div class="nav-item" onclick="showSection('settings-sec')">7. Settings</div>
            <div class="nav-item" onclick="toggleTheme()">8. Themes</div>
            <div class="nav-item" onclick="showSection('report-sec')">9. Reports</div>
            <div class="nav-item logout" onclick="handleLogout()">Logout</div>
        </nav>

        <main class="main-content">
            <header class="top-bar">
                <i class="fas fa-bars menu-btn" onclick="toggleSidebar()"></i>
                <div class="search-box">
                    <input type="text" id="globalSearch" placeholder="Search Name or ID..." onkeyup="doSearch()">
                </div>
            </header>

            <section id="list-sec" class="content-section">
                <h2 class="sec-title">Clients Details</h2>
                <div class="table-container card">
                    <table class="styled-table">
                        <thead>
                            <tr><th>#</th><th>Full Name</th><th>ID Number</th><th>Phone</th><th>Total Paid</th><th>Total Balance</th><th>Action</th></tr>
                        </thead>
                        <tbody id="clientTableBody"></tbody>
                    </table>
                </div>
            </section>

            <section id="add-sec" class="content-section hidden">
                <h2 class="sec-title">Enrollment Form</h2>
                <div class="card form-grid">
                    <div class="field-wrap"><label>Full Name</label><input type="text" id="e-name"></div>
                    <div class="field-wrap"><label>Phone</label><input type="text" id="e-phone"></div>
                    <div class="field-wrap"><label>ID Number</label><input type="text" id="e-id"></div>
                    <div class="field-wrap"><label>Location</label><input type="text" id="e-loc"></div>
                    <div class="field-wrap"><label>Occupation</label><input type="text" id="e-occ"></div>
                    <div class="field-wrap"><label>Referral</label><input type="text" id="e-ref"></div>
                    <div class="field-wrap"><label>Principal (KSH)</label><input type="number" id="e-princ"></div>
                    <div class="field-wrap"><label>Start Date</label><input type="date" id="e-start"></div>
                    <div class="field-wrap"><label>End Date</label><input type="date" id="e-end"></div>
                    <button class="btn-post btn-full" onclick="enrollClient()">Save Client Profile</button>
                </div>
            </section>

            <section id="finance-sec" class="content-section hidden">
                <h2 class="sec-title">Financials</h2>
                <div class="stats-grid">
                    <div class="card"><h4>Grand Total Out</h4><h2 id="fin-out">KSH 0</h2></div>
                    <div class="card"><h4>Paid Today</h4><h2 id="fin-today">KSH 0</h2></div>
                    <div class="card">
                        <h4>Monthly Paid</h4>
                        <input type="month" id="fin-month-select" onchange="calculateFinancials()">
                        <h2 id="fin-month-val">KSH 0</h2>
                    </div>
                    <div class="card">
                        <h4>Yearly Total</h4>
                        <select id="fin-year-select" onchange="calculateFinancials()"><option value="2026">2026</option></select>
                        <h2 id="fin-year-val">KSH 0</h2>
                    </div>
                    <div class="card"><h4>Profit (Month)</h4><h2 id="fin-profit" style="color:green">KSH 0</h2></div>
                    <div class="card"><h4>Losses (Month)</h4><h2 id="fin-loss" style="color:red">KSH 0</h2></div>
                </div>
                <div class="card" style="margin-top:20px">
                    <h3>Grand Total in Account</h3>
                    <input type="number" id="manual-acc" placeholder="Enter total handled">
                    <button onclick="updateAccount()">Update Account</button>
                    <p>Current: <b id="display-acc">KSH 0</b></p>
                </div>
            </section>

            <section id="loan-sec" class="content-section hidden">
                <h2 class="sec-title">Loans Issued</h2>
                <div class="card">
                    <input type="month" id="loan-month-filter" onchange="renderLoans()">
                    <select id="loan-week-filter" onchange="renderLoans()">
                        <option value="1">Week 1</option><option value="2">Week 2</option><option value="3">Week 3</option><option value="4">Week 4</option>
                    </select>
                </div>
                <div class="table-container card">
                    <table class="styled-table">
                        <thead><tr><th>Name</th><th>ID</th><th>Phone</th><th>Amount</th><th>Date</th></tr></thead>
                        <tbody id="loanTableBody"></tbody>
                    </table>
                </div>
            </section>

            <section id="settled-sec" class="content-section hidden">
                <h2 class="sec-title">Settled Loans</h2>
                <input type="month" id="settle-month" onchange="renderSettled()">
                <div class="table-container card">
                    <table class="styled-table">
                        <thead><tr><th>Name</th><th>ID</th><th>Total Paid</th><th>Cleared Date</th></tr></thead>
                        <tbody id="settledTableBody"></tbody>
                    </table>
                </div>
            </section>

            <section id="debt-sec" class="content-section hidden">
                <h2 class="sec-title">Debts</h2>
                <div class="table-container card">
                    <table class="styled-table">
                        <thead><tr><th>Name</th><th>ID</th><th>Principal</th><th>Balance</th><th>Action</th></tr></thead>
                        <tbody id="debtTableBody"></tbody>
                    </table>
                </div>
            </section>
        </main>
    </div>

    <div id="view-modal" class="modal hidden">
        <div class="dashboard-container">
            <header class="dash-header">
                <div><h1 id="v-name-title">---</h1><p>ID: <span id="v-id-title"></span> | Last Updated: <span id="v-updated"></span></p></div>
                <div class="header-right"><span id="v-status-badge" class="badge">Active</span> <button onclick="closeView()" class="close-btn">&times;</button></div>
            </header>
            <div id="v-content" class="dash-body">
                </div>
        </div>
    </div>

    <script type="module" src="script.js"></script>
</body>
</html>
