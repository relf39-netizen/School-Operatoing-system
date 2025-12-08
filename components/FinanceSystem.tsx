
import React, { useState, useEffect } from 'react';
import { Transaction, FinanceAccount, Teacher, FinanceAuditLog, SystemConfig } from '../types';
import { MOCK_TRANSACTIONS, MOCK_ACCOUNTS } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Plus, Wallet, FileText, ArrowRight, PlusCircle, LayoutGrid, List, ArrowLeft, Loader, Database, ServerOff, Edit2, Trash2, X, Save, ShieldAlert, Eye, Printer } from 'lucide-react';
import { db, isConfigured } from '../firebaseConfig';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, deleteDoc, updateDoc, getDoc, QuerySnapshot, DocumentData } from 'firebase/firestore';

// Thai Date Helper
const getThaiDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getThaiMonthYear = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
};

interface FinanceSystemProps {
    currentUser: Teacher;
    allTeachers: Teacher[];
}

const FinanceSystem: React.FC<FinanceSystemProps> = ({ currentUser, allTeachers }) => {
    // Permissions
    const isDirector = currentUser.roles.includes('DIRECTOR');
    const isBudgetOfficer = currentUser.roles.includes('FINANCE_BUDGET');
    const isNonBudgetOfficer = currentUser.roles.includes('FINANCE_NONBUDGET');

    // State
    const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [auditLogs, setAuditLogs] = useState<FinanceAuditLog[]>([]); // For Director
    const [isLoadingData, setIsLoadingData] = useState(true);
    
    // System Config for Reports
    const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);

    // Determine default active tab
    const [activeTab, setActiveTab] = useState<'Budget' | 'NonBudget'>(
        isBudgetOfficer ? 'Budget' : isNonBudgetOfficer ? 'NonBudget' : 'Budget'
    );
    
    // View State
    const [viewMode, setViewMode] = useState<'DASHBOARD' | 'DETAIL' | 'PRINT'>('DASHBOARD');

    // Drill-down State
    const [selectedAccount, setSelectedAccount] = useState<FinanceAccount | null>(null);

    // UI State
    const [showTransForm, setShowTransForm] = useState(false);
    const [showAccountForm, setShowAccountForm] = useState(false);
    
    // Edit Transaction State
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // Audit Log View State (Director Only)
    const [showAuditModal, setShowAuditModal] = useState(false);

    // Form Data
    const [newTrans, setNewTrans] = useState({ date: new Date().toISOString().split('T')[0], desc: '', amount: '', type: 'Income' });
    const [newAccount, setNewAccount] = useState({ name: '' });

    // --- Data Synchronization ---
    useEffect(() => {
        let unsubAccounts: () => void;
        let unsubTrans: () => void;
        let unsubLogs: () => void;
        let timeoutId: ReturnType<typeof setTimeout>;

        if (isConfigured && db) {
            // SAFETY TIMEOUT: Fallback if Firestore takes too long (3s)
            timeoutId = setTimeout(() => {
                if(isLoadingData) {
                    console.warn("Firestore Finance timeout. Switching to Mock Data.");
                    setAccounts(MOCK_ACCOUNTS);
                    setTransactions(MOCK_TRANSACTIONS);
                    setIsLoadingData(false);
                }
            }, 3000);

            // Sync Accounts
            const qAccounts = query(collection(db, "finance_accounts"), where("schoolId", "==", currentUser.schoolId));
            unsubAccounts = onSnapshot(qAccounts, (snapshot: QuerySnapshot<DocumentData>) => {
                const fetched: FinanceAccount[] = [];
                snapshot.forEach((doc) => {
                    fetched.push({ id: doc.id, ...doc.data() } as FinanceAccount);
                });
                setAccounts(fetched);
            });

            // Sync Transactions
            const qTransactions = query(collection(db, "finance_transactions"), where("schoolId", "==", currentUser.schoolId));
            unsubTrans = onSnapshot(qTransactions, (snapshot: QuerySnapshot<DocumentData>) => {
                clearTimeout(timeoutId);
                const fetched: Transaction[] = [];
                snapshot.forEach((doc) => {
                    fetched.push({ id: doc.id, ...doc.data() } as Transaction);
                });
                setTransactions(fetched);
                setIsLoadingData(false);
            }, (error) => {
                 clearTimeout(timeoutId);
                 console.error(error);
                 setAccounts(MOCK_ACCOUNTS);
                 setTransactions(MOCK_TRANSACTIONS);
                 setIsLoadingData(false);
            });

            // Sync Audit Logs (ONLY IF DIRECTOR)
            if (isDirector) {
                const qLogs = query(collection(db, "finance_audit_logs"), where("schoolId", "==", currentUser.schoolId), orderBy("timestamp", "desc"));
                unsubLogs = onSnapshot(qLogs, (snapshot: QuerySnapshot<DocumentData>) => {
                    const fetchedLogs: FinanceAuditLog[] = [];
                    snapshot.forEach((doc) => {
                        fetchedLogs.push({ id: doc.id, ...doc.data() } as FinanceAuditLog);
                    });
                    setAuditLogs(fetchedLogs);
                });
            }

            // Fetch Config
            const fetchConfig = async () => {
                try {
                    const docRef = doc(db, "system_config", "settings");
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setSysConfig(docSnap.data() as SystemConfig);
                    }
                } catch (e) {}
            };
            fetchConfig();

        } else {
            // Offline Mode
            setAccounts(MOCK_ACCOUNTS);
            setTransactions(MOCK_TRANSACTIONS);
            setIsLoadingData(false);
        }
        
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (unsubAccounts) unsubAccounts();
            if (unsubTrans) unsubTrans();
            if (unsubLogs) unsubLogs();
        };
    }, [currentUser.schoolId, isDirector]);

    // Update active tab logic based on permissions
    useEffect(() => {
        if (!isDirector) {
            if (activeTab === 'Budget' && !isBudgetOfficer && isNonBudgetOfficer) {
                setActiveTab('NonBudget');
            } else if (activeTab === 'NonBudget' && !isNonBudgetOfficer && isBudgetOfficer) {
                setActiveTab('Budget');
            }
        }
        
        // Auto-select "General Account" logic for NonBudget to bypass Account selection screen
        if (activeTab === 'NonBudget') {
            // We don't force select here, we handle it in rendering to show DetailView immediately
            setSelectedAccount(null); // Clear selected account so we can handle "All NonBudget" logic
            if (viewMode === 'DASHBOARD') setViewMode('DETAIL');
        } else {
             setSelectedAccount(null);
             if (viewMode === 'DETAIL') setViewMode('DASHBOARD');
        }

    }, [currentUser, isBudgetOfficer, isNonBudgetOfficer, isDirector, activeTab]);

    // --- Permissions Helpers ---
    // Strict visibility check: If teacher doesn't have role, don't show specific tabs
    const canSeeBudget = isDirector || isBudgetOfficer;
    const canSeeNonBudget = isDirector || isNonBudgetOfficer;
    
    // Officers can edit/delete in their respective tabs. Directors can view audits.
    const canEditBudget = isBudgetOfficer;
    const canEditNonBudget = isNonBudgetOfficer;

    // --- Logic ---

    const getAccountBalance = (accId: string) => {
        const accTrans = transactions.filter(t => t.accountId === accId);
        const income = accTrans.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
        const expense = accTrans.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
        return income - expense;
    };

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const created: any = { // ID generated by firestore
            schoolId: currentUser.schoolId,
            name: newAccount.name,
            type: activeTab
        };

        if (isConfigured && db) {
            try {
                await addDoc(collection(db, "finance_accounts"), created);
            } catch(e) {
                console.error(e);
                alert("บันทึกข้อมูลไม่สำเร็จ");
            }
        } else {
            setAccounts([...accounts, { ...created, id: `acc_${Date.now()}` }]);
        }

        setNewAccount({ name: '' });
        setShowAccountForm(false);
    };

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let targetAccountId = '';
        
        if (selectedAccount) {
            targetAccountId = selectedAccount.id;
        } else if (activeTab === 'NonBudget') {
            // Find existing NonBudget account or Create a default one
            const nbAcc = accounts.find(a => a.type === 'NonBudget');
            if (nbAcc) {
                targetAccountId = nbAcc.id;
            } else {
                // Auto-create a default account for NonBudget if none exists
                const defaultName = 'เงินรายได้สถานศึกษา (ทั่วไป)';
                const createdAcc: any = {
                    schoolId: currentUser.schoolId,
                    name: defaultName,
                    type: 'NonBudget'
                };
                
                if (isConfigured && db) {
                    try {
                        const docRef = await addDoc(collection(db, "finance_accounts"), createdAcc);
                        targetAccountId = docRef.id;
                    } catch(e) {
                         alert("ไม่สามารถสร้างบัญชีเริ่มต้นได้");
                         return;
                    }
                } else {
                     const newId = `acc_nb_${Date.now()}`;
                     setAccounts([...accounts, { ...createdAcc, id: newId }]);
                     targetAccountId = newId;
                }
            }
        }

        const created: any = {
            schoolId: currentUser.schoolId,
            accountId: targetAccountId,
            date: newTrans.date,
            description: newTrans.desc,
            amount: parseFloat(newTrans.amount),
            type: newTrans.type
        };

        if (isConfigured && db) {
            try {
                await addDoc(collection(db, "finance_transactions"), created);
            } catch(e) {
                console.error(e);
                alert("บันทึกข้อมูลไม่สำเร็จ");
            }
        } else {
            setTransactions([...transactions, { ...created, id: `trans_${Date.now()}` }]);
        }

        setNewTrans({ date: new Date().toISOString().split('T')[0], desc: '', amount: '', type: 'Income' });
        setShowTransForm(false);
    };
    
    // --- Edit / Delete Transaction ---
    const handleEditTransaction = (t: Transaction) => {
        if (!canEdit) return;
        setEditingTransaction(t);
        setShowEditModal(true);
    };

    const canEdit = (activeTab === 'Budget' && canEditBudget) || (activeTab === 'NonBudget' && canEditNonBudget);

    const handleUpdateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTransaction) return;

        // Log the change if configured
        if (isConfigured && db) {
            try {
                // 1. Log Audit
                const original = transactions.find(t => t.id === editingTransaction.id);
                if (original) {
                     const auditLog: any = {
                        schoolId: currentUser.schoolId,
                        timestamp: new Date().toISOString(),
                        actorName: currentUser.name,
                        actionType: 'EDIT',
                        transactionDescription: original.description,
                        details: `Changed amount from ${original.amount} to ${editingTransaction.amount}, desc: ${editingTransaction.description}`,
                        amountInvolved: original.amount
                    };
                    await addDoc(collection(db, "finance_audit_logs"), auditLog);
                }

                // 2. Update
                const docRef = doc(db, "finance_transactions", editingTransaction.id);
                await updateDoc(docRef, {
                    date: editingTransaction.date,
                    description: editingTransaction.description,
                    amount: editingTransaction.amount,
                    type: editingTransaction.type
                });
                
                setShowEditModal(false);
                setEditingTransaction(null);
            } catch(e) {
                alert("เกิดข้อผิดพลาดในการแก้ไข");
            }
        } else {
            // Mock Update
            setTransactions(transactions.map(t => t.id === editingTransaction.id ? editingTransaction : t));
            setShowEditModal(false);
            setEditingTransaction(null);
        }
    };

    const handleDeleteTransaction = async () => {
        if (!editingTransaction) return;
        if (!confirm("ยืนยันการลบรายการนี้? (การกระทำนี้จะถูกบันทึกใน Audit Log)")) return;

         if (isConfigured && db) {
            try {
                 // 1. Log Audit
                 const auditLog: any = {
                    schoolId: currentUser.schoolId,
                    timestamp: new Date().toISOString(),
                    actorName: currentUser.name,
                    actionType: 'DELETE',
                    transactionDescription: editingTransaction.description,
                    details: `Deleted transaction of ${editingTransaction.amount} baht`,
                    amountInvolved: editingTransaction.amount
                };
                await addDoc(collection(db, "finance_audit_logs"), auditLog);

                // 2. Delete
                await deleteDoc(doc(db, "finance_transactions", editingTransaction.id));
                setShowEditModal(false);
                setEditingTransaction(null);
            } catch(e) {
                alert("ลบข้อมูลไม่สำเร็จ");
            }
        } else {
             setTransactions(transactions.filter(t => t.id !== editingTransaction.id));
             setShowEditModal(false);
             setEditingTransaction(null);
        }
    };
    
    // Director Signature Logic
    const getDirectorName = () => {
        const director = allTeachers.find(t => t.roles.includes('DIRECTOR'));
        return director ? director.name : '...........................................................';
    };

    if (isLoadingData) {
        return (
             <div className="flex items-center justify-center h-64 text-slate-400 flex-col gap-2">
                <Loader className="animate-spin" size={32}/>
                <p>กำลังโหลดข้อมูลการเงิน...</p>
            </div>
        );
    }

    // Filter Transactions for Detail View
    let filteredTrans: Transaction[] = [];
    let currentBalance = 0;
    
    if (activeTab === 'Budget' && selectedAccount) {
        filteredTrans = transactions.filter(t => t.accountId === selectedAccount.id);
        currentBalance = getAccountBalance(selectedAccount.id);
    } else if (activeTab === 'NonBudget') {
        // For NonBudget, we aggregate all NonBudget accounts (usually just 1, but scalable)
        const nbAccountIds = accounts.filter(a => a.type === 'NonBudget').map(a => a.id);
        filteredTrans = transactions.filter(t => nbAccountIds.includes(t.accountId));
        currentBalance = nbAccountIds.reduce((sum, accId) => sum + getAccountBalance(accId), 0);
    }
    
    // Sort transactions by date desc
    filteredTrans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // --- VIEW 3: PRINT REPORT ---
    if (viewMode === 'PRINT') {
        return (
            <div className="bg-slate-100 min-h-screen animate-fade-in">
                <div className="bg-white p-4 shadow-sm mb-6 print:hidden">
                     <div className="max-w-4xl mx-auto flex justify-between items-center">
                        <button onClick={() => setViewMode('DETAIL')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
                            <ArrowLeft size={20}/> ย้อนกลับ
                        </button>
                        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                            <Printer size={18}/> พิมพ์รายงาน
                        </button>
                     </div>
                </div>

                <div className="bg-white shadow-lg p-10 mx-auto max-w-[800px] min-h-[1000px] font-sarabun text-slate-900 print:shadow-none print:border-none print:p-0 print:w-full">
                     <div className="text-center mb-8">
                         {sysConfig?.officialGarudaBase64 ? (
                            <img src={sysConfig.officialGarudaBase64} alt="Garuda" className="h-16 mx-auto mb-2" />
                         ) : (
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Emblem_of_the_Ministry_of_Education_of_Thailand.svg/1200px-Emblem_of_the_Ministry_of_Education_of_Thailand.svg.png" alt="Garuda" className="h-16 mx-auto mb-2 grayscale opacity-80" />
                         )}
                         <h2 className="text-xl font-bold">รายงาน{activeTab === 'Budget' ? 'เงินงบประมาณ' : 'เงินรายได้สถานศึกษา'}</h2>
                         <p className="text-base">{sysConfig?.schoolName || 'โรงเรียน.......................'}</p>
                         <p className="text-sm text-slate-600 mt-2">
                             บัญชี: {selectedAccount ? selectedAccount.name : 'เงินรายได้สถานศึกษา (ทั่วไป)'} <br/>
                             ข้อมูล ณ วันที่ {getThaiDate(new Date().toISOString().split('T')[0])}
                         </p>
                    </div>

                    <table className="w-full border-collapse border border-black mb-8 text-sm">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="border border-black p-2 text-center w-24">วัน/เดือน/ปี</th>
                                <th className="border border-black p-2 text-left">รายการ</th>
                                <th className="border border-black p-2 text-right w-24">รายรับ</th>
                                <th className="border border-black p-2 text-right w-24">รายจ่าย</th>
                                <th className="border border-black p-2 text-right w-24">คงเหลือ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                // Calculate running balance logic for print (Chronological Ascending)
                                const sortedForCalc = [...filteredTrans].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                let runningBal = 0;
                                const rowsWithBal = sortedForCalc.map(t => {
                                    if (t.type === 'Income') runningBal += t.amount;
                                    else runningBal -= t.amount;
                                    return { ...t, balance: runningBal };
                                });

                                return rowsWithBal.map((t, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-black p-2 text-center">{getThaiDate(t.date)}</td>
                                        <td className="border border-black p-2">{t.description}</td>
                                        <td className="border border-black p-2 text-right">{t.type === 'Income' ? t.amount.toLocaleString() : '-'}</td>
                                        <td className="border border-black p-2 text-right">{t.type === 'Expense' ? t.amount.toLocaleString() : '-'}</td>
                                        <td className="border border-black p-2 text-right font-bold">{t.balance.toLocaleString()}</td>
                                    </tr>
                                ));
                            })()}
                        </tbody>
                        <tfoot>
                             <tr className="bg-slate-100 font-bold">
                                <td className="border border-black p-2 text-center" colSpan={2}>รวมทั้งสิ้น</td>
                                <td className="border border-black p-2 text-right text-green-700">
                                    {filteredTrans.filter(t => t.type === 'Income').reduce((s,t) => s+t.amount, 0).toLocaleString()}
                                </td>
                                <td className="border border-black p-2 text-right text-red-700">
                                    {filteredTrans.filter(t => t.type === 'Expense').reduce((s,t) => s+t.amount, 0).toLocaleString()}
                                </td>
                                <td className="border border-black p-2 text-right">
                                    {currentBalance.toLocaleString()}
                                </td>
                             </tr>
                        </tfoot>
                    </table>

                    <div className="flex justify-between items-start mt-16 px-10 page-break-inside-avoid">
                        <div className="text-center">
                            <p className="mb-8">ลงชื่อ.......................................................เจ้าหน้าที่การเงิน</p>
                            <p>({currentUser.name})</p>
                            <p>ตำแหน่ง {currentUser.position}</p>
                        </div>
                        <div className="text-center">
                            <p className="mb-8">ลงชื่อ.......................................................ผู้อำนวยการ</p>
                            <p>({getDirectorName()})</p>
                            <p>ตำแหน่ง ผู้อำนวยการโรงเรียน</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- MAIN RENDER ---
    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                     <h2 className="text-2xl font-bold text-slate-800">ระบบบริหารการเงิน</h2>
                     <p className="text-slate-500 text-sm">ผู้ใช้งาน: {currentUser.name} ({currentUser.position})</p>
                </div>
                
                {/* Director Audit Log Button */}
                {isDirector && (
                    <button 
                        onClick={() => setShowAuditModal(true)}
                        className="text-xs bg-slate-800 text-white px-3 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2"
                    >
                        <ShieldAlert size={14}/> Audit Logs (ประวัติการแก้ไข)
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 mb-6">
                {canSeeBudget && (
                    <button 
                        onClick={() => { setActiveTab('Budget'); setViewMode('DASHBOARD'); }}
                        className={`px-6 py-3 font-bold text-sm transition-colors relative ${activeTab === 'Budget' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        เงินงบประมาณ
                        {activeTab === 'Budget' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
                    </button>
                )}
                {canSeeNonBudget && (
                    <button 
                        onClick={() => { setActiveTab('NonBudget'); setViewMode('DETAIL'); }} // NonBudget goes straight to detail usually
                        className={`px-6 py-3 font-bold text-sm transition-colors relative ${activeTab === 'NonBudget' ? 'text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        เงินรายได้สถานศึกษา (นอกงบ)
                        {activeTab === 'NonBudget' && <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-600 rounded-t-full"></div>}
                    </button>
                )}
            </div>

            {/* --- VIEW 1: DASHBOARD (BUDGET ACCOUNTS LIST) --- */}
            {viewMode === 'DASHBOARD' && activeTab === 'Budget' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
                    {/* Add Account Card */}
                    {canEditBudget && (
                        <button 
                            onClick={() => setShowAccountForm(true)}
                            className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all min-h-[200px]"
                        >
                            <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                                <Plus size={32}/>
                            </div>
                            <span className="font-bold">เพิ่มบัญชีงบประมาณ</span>
                        </button>
                    )}

                    {/* Account Cards */}
                    {accounts.filter(a => a.type === 'Budget').map(acc => {
                        const balance = getAccountBalance(acc.id);
                        return (
                            <div 
                                key={acc.id}
                                onClick={() => { setSelectedAccount(acc); setViewMode('DETAIL'); }}
                                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <Wallet size={24}/>
                                    </div>
                                    <ArrowRight className="text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all"/>
                                </div>
                                <h3 className="font-bold text-lg text-slate-800 mb-1">{acc.name}</h3>
                                <p className="text-slate-400 text-xs mb-4">อัปเดตล่าสุด: วันนี้</p>
                                <div className="text-2xl font-bold text-slate-800">฿{balance.toLocaleString()}</div>
                                <div className="text-xs text-slate-500 mt-1">คงเหลือสุทธิ</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- VIEW 2: DETAIL (TRANSACTIONS) --- */}
            {viewMode === 'DETAIL' && (
                <div className="animate-slide-up">
                    {/* Header Detail */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    {activeTab === 'Budget' ? selectedAccount?.name : 'เงินรายได้สถานศึกษา (ภาพรวม)'}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {activeTab === 'Budget' ? 'บัญชีงบประมาณ' : 'บัญชีเงินนอกงบประมาณ'}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-slate-500">ยอดคงเหลือสุทธิ</div>
                                <div className={`text-3xl font-bold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ฿{currentBalance.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Action Bar */}
                        <div className="flex gap-3 mt-6 pt-6 border-t border-slate-100">
                             {canEdit && (
                                <button 
                                    onClick={() => setShowTransForm(true)}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-sm flex items-center gap-2"
                                >
                                    <PlusCircle size={18}/> บันทึกรายรับ/รายจ่าย
                                </button>
                             )}
                             <button 
                                onClick={() => setViewMode('PRINT')}
                                className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 font-bold shadow-sm flex items-center gap-2"
                            >
                                <Printer size={18}/> รายงาน
                            </button>
                        </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">วันที่</th>
                                    <th className="px-6 py-4">รายการ</th>
                                    <th className="px-6 py-4 text-right">จำนวนเงิน</th>
                                    <th className="px-6 py-4 text-center">ประเภท</th>
                                    {canEdit && <th className="px-6 py-4 text-right">จัดการ</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTrans.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-8 text-slate-400">ยังไม่มีรายการเคลื่อนไหว</td></tr>
                                ) : (
                                    filteredTrans.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 text-slate-600 font-medium">
                                                {getThaiDate(t.date)}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-800">{t.description}</td>
                                            <td className={`px-6 py-4 text-right font-mono font-bold ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                                {t.type === 'Income' ? '+' : '-'}{t.amount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${t.type === 'Income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {t.type === 'Income' ? 'รายรับ' : 'รายจ่าย'}
                                                </span>
                                            </td>
                                            {canEdit && (
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => handleEditTransaction(t)}
                                                        className="text-slate-300 hover:text-blue-600 transition-colors p-1"
                                                    >
                                                        <Edit2 size={16}/>
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}
            
            {/* Create Account Modal */}
            {showAccountForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-up">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">เพิ่มบัญชีงบประมาณใหม่</h3>
                        <form onSubmit={handleAddAccount} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อบัญชี / โครงการ</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    required
                                    value={newAccount.name} 
                                    onChange={e => setNewAccount({...newAccount, name: e.target.value})} 
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="เช่น เงินอุดหนุนรายหัว, อาหารกลางวัน"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowAccountForm(false)} className="flex-1 py-2 text-slate-600 bg-slate-100 rounded-lg font-bold">ยกเลิก</button>
                                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-md">บันทึก</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Transaction Modal */}
            {showTransForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-up">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">บันทึกรายรับ / รายจ่าย</h3>
                        <form onSubmit={handleAddTransaction} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    type="button" 
                                    onClick={() => setNewTrans({...newTrans, type: 'Income'})}
                                    className={`py-2 rounded-lg font-bold border ${newTrans.type === 'Income' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                >
                                    รายรับ
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setNewTrans({...newTrans, type: 'Expense'})}
                                    className={`py-2 rounded-lg font-bold border ${newTrans.type === 'Expense' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                >
                                    รายจ่าย
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">วันที่</label>
                                <input 
                                    type="date" 
                                    required
                                    value={newTrans.date} 
                                    onChange={e => setNewTrans({...newTrans, date: e.target.value})} 
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">รายละเอียดรายการ</label>
                                <input 
                                    type="text" 
                                    required
                                    value={newTrans.desc} 
                                    onChange={e => setNewTrans({...newTrans, desc: e.target.value})} 
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="เช่น ได้รับจัดสรร, ค่าวัสดุอุปกรณ์"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">จำนวนเงิน (บาท)</label>
                                <input 
                                    type="number" 
                                    required
                                    step="0.01"
                                    value={newTrans.amount} 
                                    onChange={e => setNewTrans({...newTrans, amount: e.target.value})} 
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xl font-bold text-right"
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowTransForm(false)} className="flex-1 py-2 text-slate-600 bg-slate-100 rounded-lg font-bold">ยกเลิก</button>
                                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-md">บันทึก</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Transaction Modal */}
            {showEditModal && editingTransaction && (
                 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-up">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-lg font-bold text-slate-800">แก้ไขรายการ</h3>
                             <button type="button" onClick={handleDeleteTransaction} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg">
                                 <Trash2 size={18}/>
                             </button>
                        </div>
                       
                        <form onSubmit={handleUpdateTransaction} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingTransaction({...editingTransaction, type: 'Income'})}
                                    className={`py-2 rounded-lg font-bold border ${editingTransaction.type === 'Income' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                >
                                    รายรับ
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setEditingTransaction({...editingTransaction, type: 'Expense'})}
                                    className={`py-2 rounded-lg font-bold border ${editingTransaction.type === 'Expense' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                >
                                    รายจ่าย
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">วันที่</label>
                                <input 
                                    type="date" 
                                    required
                                    value={editingTransaction.date} 
                                    onChange={e => setEditingTransaction({...editingTransaction, date: e.target.value})} 
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">รายละเอียดรายการ</label>
                                <input 
                                    type="text" 
                                    required
                                    value={editingTransaction.description} 
                                    onChange={e => setEditingTransaction({...editingTransaction, description: e.target.value})} 
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">จำนวนเงิน (บาท)</label>
                                <input 
                                    type="number" 
                                    required
                                    step="0.01"
                                    value={editingTransaction.amount} 
                                    onChange={e => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value)})} 
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xl font-bold text-right"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => {setShowEditModal(false); setEditingTransaction(null);}} className="flex-1 py-2 text-slate-600 bg-slate-100 rounded-lg font-bold">ยกเลิก</button>
                                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-md">บันทึกการแก้ไข</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Audit Log Modal (Director Only) */}
            {showAuditModal && (
                 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col animate-scale-up">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <ShieldAlert size={24} className="text-slate-600"/> Audit Logs (ประวัติการแก้ไขข้อมูล)
                            </h3>
                            <button onClick={() => setShowAuditModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                <X size={24}/>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {auditLogs.length === 0 ? (
                                <div className="text-center text-slate-400 py-10">ไม่พบประวัติการแก้ไข</div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="px-4 py-2">เวลา</th>
                                            <th className="px-4 py-2">ผู้ทำรายการ</th>
                                            <th className="px-4 py-2">การกระทำ</th>
                                            <th className="px-4 py-2">รายการที่เกี่ยวข้อง</th>
                                            <th className="px-4 py-2">รายละเอียด</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {auditLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500">
                                                    {new Date(log.timestamp).toLocaleString('th-TH')}
                                                </td>
                                                <td className="px-4 py-2 font-bold text-slate-700">{log.actorName}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.actionType === 'DELETE' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                                        {log.actionType}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">{log.transactionDescription}</td>
                                                <td className="px-4 py-2 text-xs text-slate-500 max-w-xs truncate" title={log.details}>
                                                    {log.details}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default FinanceSystem;
 