<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JML LIMITED | Enterprise Loan System</title>
    <script src="https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.10/firebase-database-compat.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body id="app-body" class="light-mode">

    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <h2 id="logo-text">JML LIMITED</h2>
            <button class="toggle-btn" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button>
        </div>
        <nav class="nav-menu">
            <div class="nav-item active" onclick="showSec('list-sec', this)"><i class="fas fa-users"></i><span>1. Clients</span></div>
            <div class="nav-item" onclick="showSec('add-sec', this)"><i class="fas fa-user-plus"></i><span>2. Enroll Client</span></div>
            <div class="nav-item" onclick="showSec('finance-sec', this)"><i class="fas fa-chart-line"></i><span>3. Financials</span></div>
            <div class="nav-item" onclick="showSec('loan-sec', this)"><i class="fas fa-hand-holding-usd"></i><span>4. Loans</span></div>
            <div class="nav-item" onclick="showSec('settled-sec', this)"><i class="fas fa-check-circle"></i><span>5. Settled loans</span></div>
            <div class="nav-item" onclick="showSec('debt-sec', this)"><i class="fas fa-exclamation-triangle"></i><span>6. Debts</span></div>
            <div class="nav-item" onclick="showSec('settings-sec', this)"><i class="fas fa-cog"></i><span>7. Settings</span></div>
            <div class="nav-item" onclick="toggleTheme()"><i class="fas fa-adjust"></i><span>8. Themes</span></div>
            <div class="nav-item" onclick="showSec('report-sec', this)"><i class="fas fa-file-alt"></i><span>9. Reports</span></div>
        </nav>
    </aside>

    <main class="main-content" id="main-content">
        <header class="top-bar">
            <div class="search-box">
                <i class="fas fa-search"></i>
                <input type="text" id="globalSearch" placeholder="Search by Name or ID Number..." onkeyup="filterClients()">
            </div>
            <div class="admin-profile">Admin Dashboard</div>
        </header>

        <section id="list-sec" class="panel active">
            <h2 class="sec-title">Clients Details</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>#</th><th>Full Name</th><th>ID Number</th><th>Phone</th><th>Total Paid</th><th>Total Balance</th><th>Action</th></tr>
                    </thead>
                    <tbody id="clientsTableBody"></tbody>
                </table>
            </div>
        </section>

        <section id="add-sec" class="panel">
            <div class="box form-container">
                <h2>Enroll New Client</h2>
                <div class="form-grid">
                    <input type="text" id="e-name" placeholder="Full Name">
                    <input type="text" id="e-phone" placeholder="Phone Number">
                    <input type="text" id="e-id" placeholder="ID Number">
                    <input type="text" id="e-loc" placeholder="Location">
                    <input type="text" id="e-occ" placeholder="Occupation">
                    <input type="text" id="e-ref" placeholder="Referral">
                    <input type="number" id="e-princ" placeholder="Principal (KSH)">
                    <div class="date-group"><label>Start Date</label><input type="date" id="e-start"></div>
                    <div class="date-group"><label>End Date</label><input type="date" id="e-end"></div>
                </div>
                <button class="btn btn-main" onclick="enrollClient()">SAVE CLIENT</button>
            </div>
        </section>

        <section id="finance-sec" class="panel">
            <h2>Financial Overview</h2>
            <div class="stats-grid">
                <div class="card"><h4>Grand Total Out</h4><p id="f-total-out">KSH 0</p></div>
                <div class="card"><h4>Paid Today</h4><p id="f-paid-today">KSH 0</p></div>
                <div class="card">
                    <h4>Monthly Total</h4>
                    <select id="f-month-sel" onchange="runCalculations()"></select>
                    <p id="f-paid-monthly">KSH 0</p>
                </div>
                <div class="card">
                    <h4>Yearly Total</h4>
                    <select id="f-year-sel" onchange="runCalculations()"><option>2026</option></select>
                    <p id="f-paid-yearly">KSH 0</p>
                </div>
            </div>
            <div class="stats-grid" style="margin-top:20px;">
                <div class="card"><h4>Monthly Profit</h4><p id="f-profit" style="color:green;">KSH 0</p></div>
                <div class="card"><h4>Monthly Losses</h4><p id="f-loss" style="color:red;">KSH 0</p></div>
                <div class="card">
                    <h4>Grand Total in Account</h4>
                    <input type="number" id="manual-acc" placeholder="Enter physical total...">
                    <button class="btn btn-main" onclick="saveAccountTotal()">Update</button>
                </div>
            </div>
        </section>

        <section id="loan-sec" class="panel">
            <h2>Loan Issuance (Saturdays Only)</h2>
            <div class="filter-row">
                <select id="loan-month" onchange="renderSaturdayLoans()"></select>
                <select id="loan-week" onchange="renderSaturdayLoans()">
                    <option value="1">Week 1</option><option value="2">Week 2</option>
                    <option value="3">Week 3</option><option value="4">Week 4</option>
                </select>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th>Full Name</th><th>ID</th><th>Phone</th><th>Amount</th><th>Date Issued</th></tr></thead>
                    <tbody id="saturday-body"></tbody>
                </table>
            </div>
        </section>

        <section id="settled-sec" class="panel">
            <h2>Settled Loans</h2>
            <select id="settle-month" onchange="renderSettled()"></select>
            <div class="table-container">
                <table>
                    <thead><tr><th>Name</th><th>ID Number</th><th>Total Paid</th><th>Cleared Date</th></tr></thead>
                    <tbody id="settled-body"></tbody>
                </table>
            </div>
        </section>

        <section id="debt-sec" class="panel">
            <h2>Debt Tracking</h2>
            <div class="table-container">
                <table>
                    <thead><tr><th>Name</th><th>ID Number</th><th>Principal</th><th>Balance</th><th>Action</th></tr></thead>
                    <tbody id="debt-body"></tbody>
                </table>
            </div>
        </section>
    </main>

    <div id="view-panel" class="view-panel">
        <div class="v-header">
            <div class="v-header-left">
                <h1 id="v-title-name">--</h1>
                <p>ID: <span id="v-title-id">--</span> | Last Updated: <span id="v-last-up">--</span></p>
            </div>
            <div class="v-header-right">
                <div class="edit-pill">
                    Status: <select id="v-status"><option>Active</option><option>Inactive</option></select>
                    Officer: <input type="text" id="v-officer" placeholder="Officer Name">
                </div>
                <button onclick="closeView()" class="close-view">&times;</button>
            </div>
        </div>

        <div class="v-body">
            <div class="box">
                <h3>CLIENT INFORMATION</h3>
                <div class="info-grid">
                    <p><strong>Name:</strong> <span id="v-info-name"></span></p>
                    <p><strong>ID:</strong> <span id="v-info-id"></span></p>
                    <p><strong>Phone:</strong> <span id="v-info-phone"></span></p>
                    <p><strong>Location:</strong> <span id="v-info-loc"></span></p>
                    <p><strong>Occupation:</strong> <span id="v-info-occ"></span></p>
                    <p><strong>Referral:</strong> <span id="v-info-ref"></span></p>
                    <p><strong>Start Date:</strong> <input type="date" id="v-start"></p>
                    <p><strong>End Date:</strong> <input type="date" id="v-end"></p>
                </div>
            </div>

            <div class="box">
                <h3>CURRENT LOANS</h3>
                <div class="loan-stats">
                    <div class="l-card">Principal<div class="val" id="v-princ"></div></div>
                    <div class="l-card">Total Paid<div class="val" id="v-paid"></div></div>
                    <div class="l-card">Balance<div class="val" id="v-bal" style="color:red;"></div></div>
                    <div class="l-card">Next Payment<div class="val" id="v-next"></div></div>
                </div>
            </div>

            <div class="box">
                <h3>NOTES & REMINDERS</h3>
                <textarea id="v-note-text" placeholder="Enter notes..."></textarea>
                <button class="btn btn-main" onclick="saveNote()">SAVE NOTE</button>
                <div id="v-notes-list"></div>
            </div>

            <div class="box">
                <h3>PAYMENT HISTORY</h3>
                <table class="history-table">
                    <thead><tr><th>Date</th><th>Activity</th><th>Details</th><th>Time</th><th>Handled By</th></tr></thead>
                    <tbody id="v-history-body"></tbody>
                </table>
            </div>

            <div class="box">
                <h3>ARCHIVED LOANS</h3>
                <table class="history-table">
                    <thead><tr><th>Loan Amount</th><th>Date Cleared</th></tr></thead>
                    <tbody id="v-archive-body"></tbody>
                </table>
            </div>

            <div class="box action-footer">
                <h3>ACTIONS</h3>
                <div class="action-row">
                    <input type="number" id="act-amt" placeholder="Amount (KSH)">
                    <input type="time" id="act-time">
                    <input type="text" id="act-next" placeholder="Next Due (e.g. Jan 20)">
                </div>
                <div class="action-btns">
                    <button class="btn btn-p" onclick="process('Payment')">Post Payment</button>
                    <button class="btn btn-s" onclick="process('Settle')">Settle Loan</button>
                    <button class="btn btn-n" onclick="process('New')">New Loan</button>
                    <button class="btn btn-main" onclick="saveAll()">Save Changes</button>
                    <button class="btn btn-red" onclick="process('Delete')">Delete Profile</button>
                </div>
            </div>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
