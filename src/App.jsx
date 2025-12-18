import { useState, useEffect } from "react";
// 引入 ArrowRight 用於顯示轉帳方向
import {
  Trash2,
  Edit2,
  Plus,
  Users,
  Save,
  X,
  Wallet,
  Receipt,
  Calendar,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import "./App.css";

const DEFAULT_MEMBERS = ["我", "朋友A"];

// 📅 輔助函式：取得今天的 YYYY-MM-DD
const getTodayDate = () => new Date().toISOString().split("T")[0];

function App() {
  // --- 狀態管理 ---
  const [members, setMembers] = useState(() => {
    const saved = localStorage.getItem("split_members");
    return saved ? JSON.parse(saved) : DEFAULT_MEMBERS;
  });

  const [records, setRecords] = useState(() => {
    const saved = localStorage.getItem("split_records");
    return saved ? JSON.parse(saved) : [];
  });

  const [inputTitle, setInputTitle] = useState("");
  const [inputAmount, setInputAmount] = useState("");
  const [inputDate, setInputDate] = useState(getTodayDate());
  const [payer, setPayer] = useState("");
  const [involved, setInvolved] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [newMemberName, setNewMemberName] = useState("");
  const [showMemberModal, setShowMemberModal] = useState(false);

  // 初始化
  useEffect(() => {
    if (members.length > 0 && !payer) {
      setPayer(members[0]);
      setInvolved(members);
    }
  }, [members, payer]);

  // 存檔
  useEffect(() => {
    localStorage.setItem("split_records", JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem("split_members", JSON.stringify(members));
  }, [members]);

  // --- 邏輯功能 ---
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputTitle || !inputAmount || involved.length === 0 || !inputDate)
      return alert("請填寫完整資訊");

    const newRecord = {
      id: editingId || Date.now(),
      title: inputTitle,
      amount: parseFloat(inputAmount),
      payer,
      involved,
      date: inputDate,
    };

    if (editingId) {
      setRecords(records.map((r) => (r.id === editingId ? newRecord : r)));
      setEditingId(null);
    } else {
      const newRecords = [newRecord, ...records];
      newRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecords(newRecords);
    }

    setInputTitle("");
    setInputAmount("");
    setInputDate(getTodayDate());
    setInvolved(members);
    setPayer(members[0]);
  };

  const handleDelete = (id) => {
    if (window.confirm("確認刪除此紀錄？")) {
      setRecords(records.filter((r) => r.id !== id));
    }
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    setInputTitle(record.title);
    setInputAmount(record.amount);
    setInputDate(record.date);
    setPayer(record.payer);
    setInvolved(record.involved);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setInputTitle("");
    setInputAmount("");
    setInputDate(getTodayDate());
    setInvolved(members);
  };

  const handleAddMember = () => {
    if (newMemberName && !members.includes(newMemberName)) {
      const newMembers = [...members, newMemberName];
      setMembers(newMembers);
      setInvolved([...involved, newMemberName]);
      setNewMemberName("");
    }
  };

  const handleRemoveMember = (memberToRemove) => {
    if (members.length <= 1) return alert("需保留至少一位成員");
    const isRelated = records.some(
      (record) =>
        record.payer === memberToRemove ||
        record.involved.includes(memberToRemove)
    );
    if (isRelated)
      return alert(`無法移除「${memberToRemove}」，該成員有關聯的消費紀錄。`);

    if (window.confirm(`確認移除成員「${memberToRemove}」？`)) {
      const newMembers = members.filter((m) => m !== memberToRemove);
      setMembers(newMembers);
      if (payer === memberToRemove) setPayer(newMembers[0]);
      setInvolved(involved.filter((m) => m !== memberToRemove));
    }
  };

  const toggleInvolved = (member) => {
    if (involved.includes(member)) {
      setInvolved(involved.filter((m) => m !== member));
    } else {
      setInvolved([...involved, member]);
    }
  };

  // 1. 計算每個人總共該收/該付多少 (Balance)
  const calculateBalance = () => {
    let balances = {};
    members.forEach((m) => (balances[m] = 0));
    records.forEach((record) => {
      if (!record.involved || record.involved.length === 0) return;
      const splitAmount = record.amount / record.involved.length;
      if (balances[record.payer] !== undefined)
        balances[record.payer] += record.amount;
      record.involved.forEach((person) => {
        if (balances[person] !== undefined) balances[person] -= splitAmount;
      });
    });
    return balances;
  };

  const balances = calculateBalance();

  // 🔥 2. 核心演算法：計算「誰該給誰多少錢」 (Settlement Plan)
  const calculateSettlements = (balancesObj) => {
    let debtors = [];
    let creditors = [];

    // 分類
    Object.keys(balancesObj).forEach((member) => {
      const amount = balancesObj[member];
      if (amount < -0.01) debtors.push({ member, amount }); // 欠錢的
      else if (amount > 0.01) creditors.push({ member, amount }); // 收錢的
    });

    // 排序 (金額大到小，減少轉帳次數)
    debtors.sort((a, b) => a.amount - b.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let settlements = [];
    let i = 0;
    let j = 0;

    // 配對
    while (i < debtors.length && j < creditors.length) {
      let debtor = debtors[i];
      let creditor = creditors[j];

      // 取兩者絕對值的最小值作為這次轉帳金額
      let amount = Math.min(Math.abs(debtor.amount), creditor.amount);

      settlements.push({
        from: debtor.member,
        to: creditor.member,
        amount: amount.toFixed(0), // 取整數顯示
      });

      debtor.amount += amount;
      creditor.amount -= amount;

      if (Math.abs(debtor.amount) < 0.01) i++;
      if (Math.abs(creditor.amount) < 0.01) j++;
    }

    return settlements;
  };

  const settlements = calculateSettlements(balances);

  const handleReset = () => {
    // 防呆確認：這是危險操作，一定要問使用者
    if (
      window.confirm(
        "確定要清除所有消費紀錄，重新開始嗎？\n(成員名單會保留，但帳務會歸零)"
      )
    ) {
      setRecords([]); // 把紀錄陣列變回空陣列 []

      // 也可以順便重置表單，避免使用者剛打一半
      setInputTitle("");
      setInputAmount("");
    }
  };

  return (
    <div className="app-layout">
      <div className="app-container">
        {/* Header */}
        <header className="header">
          <div className="brand">
            <div className="brand-icon">
              <Receipt size={20} />
            </div>
            <h1>Split Bill</h1>
          </div>

          <div className="header-actions">
            {/* 新增：重置按鈕 (Danger Style) */}
            <button
              className="btn-icon-danger"
              onClick={handleReset}
              title="重新開始 (清除紀錄)"
            >
              <RotateCcw size={18} />
            </button>

            <button
              className="btn-outlined"
              onClick={() => setShowMemberModal(true)}
            >
              <Users size={16} />
              <span>Manage</span>
            </button>
          </div>
        </header>

        {/* Overview (Balances) */}
        <section className="section-header">
          <h2>Overview</h2>
          <span className="badge-count">{members.length} Members</span>
        </section>

        <div className="balance-grid">
          {members.map((member) => {
            const val = balances[member] || 0;
            const isPositive = val >= 0;
            return (
              <div key={member} className="balance-card">
                <div className="balance-top">
                  <span className="member-name">{member}</span>
                  {val !== 0 && (
                    <span
                      className={`status-dot ${
                        isPositive ? "dot-green" : "dot-red"
                      }`}
                    ></span>
                  )}
                </div>
                <div className="balance-bottom">
                  <span className="currency-symbol">$</span>
                  <span
                    className={`amount ${
                      isPositive ? "text-green" : "text-red"
                    }`}
                  >
                    {Math.abs(val).toFixed(0)}
                  </span>
                  <span className="status-label">
                    {isPositive ? "RECEIVE" : "PAY"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 🔥 新增：Settlement Plan (結算建議) */}
        {settlements.length > 0 && (
          <div className="settlement-panel fade-in">
            <div className="panel-title">
              <CheckCircle2 size={16} className="text-accent" />
              <h3>Suggested Transfers</h3>
            </div>
            <div className="transfer-list">
              {settlements.map((item, index) => (
                <div key={index} className="transfer-row">
                  <div className="transfer-person from">
                    <span className="avatar-xs">{item.from[0]}</span>
                    <span>{item.from}</span>
                  </div>

                  <div className="transfer-arrow">
                    <span className="transfer-amount">${item.amount}</span>
                    <ArrowRight size={14} className="icon-arrow" />
                  </div>

                  <div className="transfer-person to">
                    <span className="avatar-xs">{item.to[0]}</span>
                    <span>{item.to}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="form-panel">
          <div className="panel-header">
            <h3>{editingId ? "Edit Transaction" : "New Transaction"}</h3>
            {editingId && (
              <button className="btn-close" onClick={cancelEdit}>
                <X size={18} />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <div className="field-wrapper flex-grow">
                <label>Title</label>
                <input
                  type="text"
                  placeholder="e.g. Dinner"
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <div className="field-wrapper flex-grow">
                <label>Amount</label>
                <input
                  type="number"
                  placeholder="0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field-wrapper w-40">
                <label>Date</label>
                <div className="date-input-wrapper">
                  <input
                    type="date"
                    value={inputDate}
                    onChange={(e) => setInputDate(e.target.value)}
                    required
                    className="input-date"
                    // 🔥 強制開啟日曆的修復
                    onClick={(e) =>
                      e.target.showPicker && e.target.showPicker()
                    }
                    style={{ cursor: "pointer" }}
                  />
                </div>
              </div>
            </div>

            <div className="field-wrapper">
              <label>Paid By</label>
              <div className="selector-scroll">
                {members.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`select-btn ${payer === m ? "active" : ""}`}
                    onClick={() => setPayer(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-wrapper">
              <label>Split Amongst</label>
              <div className="selector-wrap">
                {members.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`choice-chip ${
                      involved.includes(m) ? "checked" : ""
                    }`}
                    onClick={() => toggleInvolved(m)}
                  >
                    {involved.includes(m) && (
                      <span className="check-mark">✓</span>
                    )}
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary">
              {editingId ? <Save size={18} /> : <Plus size={18} />}
              <span>{editingId ? "Save Changes" : "Add Transaction"}</span>
            </button>
          </form>
        </div>

        {/* List */}
        <section className="section-header mt-large">
          <h2>Recent Activity</h2>
        </section>

        <div className="record-list">
          {records.length === 0 ? (
            <div className="empty-state">
              <Wallet size={48} opacity={0.2} />
              <p>No transactions yet</p>
            </div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="record-row">
                <div className="record-icon">
                  <span className="icon-date">{record.date.slice(8)}</span>
                </div>
                <div className="record-details">
                  <span className="rec-title">{record.title}</span>
                  <span className="rec-meta">
                    {record.date} • {record.payer} paid
                  </span>
                </div>
                <div className="record-right">
                  <span className="rec-amount">${record.amount}</span>
                  <div className="rec-actions">
                    <button
                      onClick={() => handleEdit(record)}
                      className="action-btn edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="action-btn delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal */}
        {showMemberModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowMemberModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-top">
                <h3>Manage Members</h3>
                <button
                  onClick={() => setShowMemberModal(false)}
                  className="btn-icon-only"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="member-list">
                {members.map((m) => (
                  <div key={m} className="member-row">
                    <div className="member-info">
                      <div className="avatar-placeholder">{m[0]}</div>
                      <span>{m}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(m)}
                      className="btn-delete-member"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="add-member-bar">
                <input
                  type="text"
                  placeholder="New member name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  // 👇 修改這裡：加入 !e.nativeEvent.isComposing 的判斷
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      handleAddMember();
                    }
                  }}
                />
                <button onClick={handleAddMember} className="btn-small-primary">
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
