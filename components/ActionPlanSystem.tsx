
import React, { useState, useEffect } from 'react';
import { PlanDepartment, Project, Teacher, ProjectStatus } from '../types';
import { MOCK_PLAN_DATA } from '../constants';
import { Briefcase, CheckCircle, Clock, Lock, Plus, ArrowRight, ArrowLeft, Edit2, Trash2, Loader, Database, ServerOff, PieChart, Wallet, BookOpen, Settings, X, Save, CalendarRange, ChevronDown, CheckSquare, Coins } from 'lucide-react';
import { db, isConfigured } from '../firebaseConfig';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';

interface ActionPlanSystemProps {
    currentUser: Teacher;
}

const ActionPlanSystem: React.FC<ActionPlanSystemProps> = ({ currentUser }) => {
    // State
    const [departments, setDepartments] = useState<PlanDepartment[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [selectedDept, setSelectedDept] = useState<PlanDepartment | null>(null);
    const [viewMode, setViewMode] = useState<'OVERVIEW' | 'DETAIL'>('OVERVIEW');

    // Fiscal Year Logic
    const currentThaiYear = (new Date().getFullYear() + 543).toString();
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(currentThaiYear);
    
    // Budget Limits (School Wide - Per Fiscal Year)
    const [totalSubsidyBudget, setTotalSubsidyBudget] = useState(0); 
    const [totalLearnerDevBudget, setTotalLearnerDevBudget] = useState(0); 

    // Budget Settings Modal State
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [tempBudgetConfig, setTempBudgetConfig] = useState({ subsidy: 0, learner: 0 });
    const [isSaving, setIsSaving] = useState(false);

    // Project Settlement Modal State (Actual Expense)
    const [showSettlementModal, setShowSettlementModal] = useState(false);
    const [settleProjectData, setSettleProjectData] = useState<{deptId: string, project: Project} | null>(null);
    const [actualAmountInput, setActualAmountInput] = useState('');

    // Permissions
    const isDirector = currentUser.roles.includes('DIRECTOR');
    const isPlanOfficer = currentUser.roles.includes('PLAN_OFFICER');

    // Edit States (Project Form)
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectAmount, setNewProjectAmount] = useState('');
    const [budgetSource, setBudgetSource] = useState<'Subsidy' | 'LearnerDev'>('Subsidy'); // Exclusive selection

    // Standard Department Names
    const STANDARD_DEPTS = [
        'กลุ่มบริหารงานวิชาการ',
        'กลุ่มบริหารงานงบประมาณ',
        'กลุ่มบริหารงานบุคคล',
        'กลุ่มบริหารงานทั่วไป',
        'งบกลาง / สาธารณูปโภค'
    ];

    // Generate selectable fiscal years (Current - 1 to Current + 2)
    const getFiscalYearOptions = () => {
        const curr = parseInt(currentThaiYear);
        return [curr - 1, curr, curr + 1, curr + 2].map(y => y.toString());
    };

    // --- Load Data (Realtime from Firebase) ---
    useEffect(() => {
        let unsubProjects: (() => void) | undefined;
        let unsubBudget: (() => void) | undefined;

        const loadData = async () => {
            setIsLoadingData(true);
            
            // Initial Structure
            let currentDepts = STANDARD_DEPTS.map(name => ({
                id: `dept_${name}`, // Fixed ID based on name for grouping
                schoolId: currentUser.schoolId,
                name: name,
                projects: []
            } as PlanDepartment));

            if (isConfigured && db) {
                // 1. Subscribe to Projects for Selected Year
                const qProjects = query(
                    collection(db, "plan_projects"),
                    where("schoolId", "==", currentUser.schoolId),
                    where("fiscalYear", "==", selectedFiscalYear)
                );

                unsubProjects = onSnapshot(qProjects, (snapshot) => {
                    const fetchedProjects = snapshot.docs.map(doc => doc.data() as Project & { departmentName: string });
                    
                    // Distribute projects to departments
                    const updatedDepts = currentDepts.map(dept => ({
                        ...dept,
                        projects: fetchedProjects.filter(p => p.departmentName === dept.name)
                    }));

                    setDepartments(updatedDepts);
                    
                    // Update selectedDept if active
                    if (selectedDept) {
                        const found = updatedDepts.find(d => d.name === selectedDept.name);
                        if (found) setSelectedDept(found);
                    }
                    setIsLoadingData(false);
                }, (err) => {
                    console.error("Projects Sync Error", err);
                    setIsLoadingData(false);
                });

                // 2. Subscribe to Budget Settings
                const budgetId = `budget_${currentUser.schoolId}_${selectedFiscalYear}`;
                const budgetRef = doc(db, "budget_settings", budgetId);
                
                unsubBudget = onSnapshot(budgetRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setTotalSubsidyBudget(data.subsidy || 0);
                        setTotalLearnerDevBudget(data.learner || 0);
                    } else {
                        setTotalSubsidyBudget(0);
                        setTotalLearnerDevBudget(0);
                    }
                });

            } else {
                // Fallback: Local / Mock
                const mergedDepts = STANDARD_DEPTS.map(name => {
                    const existing = MOCK_PLAN_DATA.find(d => d.name === name);
                    if (existing) {
                        // Filter mock data by fiscal year (simulate)
                        const filteredProjs = existing.projects.filter(p => (p.fiscalYear || currentThaiYear) === selectedFiscalYear);
                        return { ...existing, projects: filteredProjs };
                    }
                    return {
                        id: `d_${Date.now()}_${Math.random()}`,
                        schoolId: currentUser.schoolId,
                        name: name,
                        projects: []
                    } as PlanDepartment;
                });
                setDepartments(mergedDepts);

                // Load Budget from LocalStorage
                const savedSubsidy = localStorage.getItem(`schoolos_budget_subsidy_${selectedFiscalYear}`);
                const savedLearner = localStorage.getItem(`schoolos_budget_learner_${selectedFiscalYear}`);
                setTotalSubsidyBudget(savedSubsidy ? parseFloat(savedSubsidy) : 0);
                setTotalLearnerDevBudget(savedLearner ? parseFloat(savedLearner) : 0);
                
                setIsLoadingData(false);
            }
        };

        loadData();

        return () => {
            if (unsubProjects) unsubProjects();
            if (unsubBudget) unsubBudget();
        };
    }, [currentUser.schoolId, selectedFiscalYear]);


    // --- Logic Calculations ---

    const getAllProjects = () => {
        return departments.flatMap(d => d.projects);
    };

    const getStats = () => {
        const all = getAllProjects();
        
        let usedSubsidy = 0;
        let usedLearnerDev = 0;

        all.forEach(p => {
            // Priority: If actualExpense exists (Completed), use it. 
            // Otherwise use Planned Budget.
            const hasActual = p.actualExpense !== undefined && p.status === 'Completed';
            
            if (p.subsidyBudget > 0) {
                usedSubsidy += hasActual ? (p.actualExpense || 0) : p.subsidyBudget;
            } else if (p.learnerDevBudget > 0) {
                usedLearnerDev += hasActual ? (p.actualExpense || 0) : p.learnerDevBudget;
            }
        });

        return {
            usedSubsidy,
            usedLearnerDev,
            remainingSubsidy: totalSubsidyBudget - usedSubsidy,
            remainingLearnerDev: totalLearnerDevBudget - usedLearnerDev
        };
    };

    // --- Actions ---

    // Open Budget Settings Modal
    const openBudgetModal = () => {
        setTempBudgetConfig({
            subsidy: totalSubsidyBudget,
            learner: totalLearnerDevBudget
        });
        setShowBudgetModal(true);
    };

    // Save Budget Settings
    const handleSaveBudgetConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        if (isConfigured && db) {
            try {
                const budgetId = `budget_${currentUser.schoolId}_${selectedFiscalYear}`;
                await setDoc(doc(db, "budget_settings", budgetId), {
                    schoolId: currentUser.schoolId,
                    fiscalYear: selectedFiscalYear,
                    subsidy: tempBudgetConfig.subsidy,
                    learner: tempBudgetConfig.learner
                });
            } catch (e) {
                console.error("Budget Save Error", e);
                alert("เกิดข้อผิดพลาดในการบันทึกงบประมาณ");
            }
        } else {
            setTotalSubsidyBudget(tempBudgetConfig.subsidy);
            setTotalLearnerDevBudget(tempBudgetConfig.learner);
            localStorage.setItem(`schoolos_budget_subsidy_${selectedFiscalYear}`, tempBudgetConfig.subsidy.toString());
            localStorage.setItem(`schoolos_budget_learner_${selectedFiscalYear}`, tempBudgetConfig.learner.toString());
        }
        
        setIsSaving(false);
        setShowBudgetModal(false);
    };

    const handleAddProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDept || !newProjectName || !newProjectAmount) return;
        
        const amount = parseFloat(newProjectAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("กรุณาระบุจำนวนเงินที่ถูกต้อง");
            return;
        }

        const stats = getStats();
        
        // Validation & Assignment based on Source
        let subsidyAmount = 0;
        let learnerDevAmount = 0;

        if (budgetSource === 'Subsidy') {
            if (amount > stats.remainingSubsidy) {
                if (!confirm(`งบเงินอุดหนุนปี ${selectedFiscalYear} คงเหลือไม่เพียงพอ! คุณต้องการดำเนินการต่อหรือไม่?`)) return;
            }
            subsidyAmount = amount;
        } else {
            if (amount > stats.remainingLearnerDev) {
                if (!confirm(`งบกิจกรรมพัฒนาผู้เรียนปี ${selectedFiscalYear} คงเหลือไม่เพียงพอ! คุณต้องการดำเนินการต่อหรือไม่?`)) return;
            }
            learnerDevAmount = amount;
        }

        const newId = `p_${Date.now()}`;
        const projectData: any = {
            id: newId,
            schoolId: currentUser.schoolId,
            departmentName: selectedDept.name, // Store dept name to query back
            name: newProjectName,
            subsidyBudget: subsidyAmount,
            learnerDevBudget: learnerDevAmount,
            status: 'Draft',
            fiscalYear: selectedFiscalYear
        };

        if (isConfigured && db) {
            try {
                await setDoc(doc(db, "plan_projects", newId), projectData);
            } catch (e) {
                console.error("Add Project Error", e);
                alert("บันทึกโครงการไม่สำเร็จ");
                return;
            }
        } else {
            // Offline Mode Update
            const updatedProjects = [...selectedDept.projects, projectData];
            const updatedDepts = departments.map(d => {
                if (d.name === selectedDept.name) return { ...d, projects: updatedProjects };
                return d;
            });
            setDepartments(updatedDepts);
            setSelectedDept(updatedDepts.find(d => d.name === selectedDept.name) || null);
        }
        
        // Reset Form
        setNewProjectName('');
        setNewProjectAmount('');
    };

    const handleStatusChange = async (deptId: string, projectId: string, newStatus: ProjectStatus) => {
        if (isConfigured && db) {
            try {
                const projectRef = doc(db, "plan_projects", projectId);
                await updateDoc(projectRef, { status: newStatus });
            } catch(e) { console.error(e); }
        } else {
            // Offline
            const updatedDepts = departments.map(d => {
                if (d.id === deptId) {
                    return { 
                        ...d, 
                        projects: d.projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p) 
                    };
                }
                return d;
            });
            setDepartments(updatedDepts);
            if (selectedDept) setSelectedDept(updatedDepts.find(d => d.id === selectedDept.id) || null);
        }
    };

    // Open Settlement Modal
    const handleInitiateSettlement = (deptId: string, project: Project) => {
        setSettleProjectData({ deptId, project });
        const planned = project.subsidyBudget > 0 ? project.subsidyBudget : project.learnerDevBudget;
        setActualAmountInput((project.actualExpense ?? planned).toString());
        setShowSettlementModal(true);
    };

    const handleSaveSettlement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settleProjectData) return;

        const amount = parseFloat(actualAmountInput);
        if (isNaN(amount) || amount < 0) {
            alert("ยอดเงินไม่ถูกต้อง");
            return;
        }

        const { project } = settleProjectData;

        if (isConfigured && db) {
            try {
                const projectRef = doc(db, "plan_projects", project.id);
                await updateDoc(projectRef, { 
                    status: 'Completed',
                    actualExpense: amount
                });
            } catch(e) { console.error(e); }
        } else {
            // Offline
            const updatedDepts = departments.map(d => {
                return {
                    ...d,
                    projects: d.projects.map(p => p.id === project.id ? { ...p, status: 'Completed' as ProjectStatus, actualExpense: amount } : p)
                };
            });
            setDepartments(updatedDepts);
            if (selectedDept) setSelectedDept(updatedDepts.find(d => d.name === selectedDept.name) || null);
        }

        setShowSettlementModal(false);
        setSettleProjectData(null);
    };

    const handleDeleteProject = async (deptId: string, projectId: string) => {
        if(!confirm('ต้องการลบโครงการนี้ใช่หรือไม่?')) return;
        
        if (isConfigured && db) {
            try {
                await deleteDoc(doc(db, "plan_projects", projectId));
            } catch(e) { console.error(e); }
        } else {
            const updatedDepts = departments.map(d => {
                if (d.id === deptId) {
                    return { ...d, projects: d.projects.filter(p => p.id !== projectId) };
                }
                return d;
            });
            setDepartments(updatedDepts);
            if (selectedDept) setSelectedDept(updatedDepts.find(d => d.id === selectedDept.id) || null);
        }
    }

    if (isLoadingData) {
        return (
             <div className="flex items-center justify-center h-64 text-slate-400 flex-col gap-2">
                <Loader className="animate-spin" size={32}/>
                <p>กำลังเชื่อมต่อข้อมูลแผนงาน (Firebase)...</p>
            </div>
        );
    }

    // --- Renderers ---

    const getStatusBadge = (status: ProjectStatus) => {
        switch(status) {
            case 'Completed': return <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold"><CheckCircle size={12}/> เบิกจ่ายแล้ว</span>;
            case 'Approved': return <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-[10px] font-bold"><CheckCircle size={12}/> อนุมัติแล้ว</span>;
            default: return <span className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-[10px] font-bold"><Clock size={12}/> ร่างโครงการ</span>;
        }
    };

    // --- VIEW: OVERVIEW ---
    const renderOverview = () => {
        const stats = getStats();
        // Prevent div by zero
        const subsidyPercent = totalSubsidyBudget > 0 ? (stats.usedSubsidy / totalSubsidyBudget) * 100 : 0;
        const learnerPercent = totalLearnerDevBudget > 0 ? (stats.usedLearnerDev / totalLearnerDevBudget) * 100 : 0;

        return (
            <div className="space-y-8 animate-fade-in pb-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                         <h2 className="text-2xl font-bold text-slate-800">ระบบแผนปฏิบัติการ (Action Plan)</h2>
                         <p className="text-slate-500 text-sm">บริหารจัดการโครงการและงบประมาณสถานศึกษา {isConfigured ? '(Online)' : '(Offline)'}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* Fiscal Year Selector */}
                        <div className="relative">
                            <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                            <select 
                                value={selectedFiscalYear}
                                onChange={(e) => setSelectedFiscalYear(e.target.value)}
                                className="pl-10 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer shadow-sm"
                            >
                                {getFiscalYearOptions().map(year => (
                                    <option key={year} value={year}>ปีงบประมาณ {year}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16}/>
                        </div>

                        {isPlanOfficer && (
                            <button 
                                onClick={openBudgetModal} 
                                className="text-sm bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm"
                            >
                                <Settings size={18} className="text-slate-500"/> ตั้งค่ายอด
                            </button>
                        )}
                    </div>
                </div>

                {/* Top Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Subsidy Card */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-orange-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Wallet size={100} className="text-orange-600"/>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-orange-800 font-bold flex items-center gap-2 mb-2">
                                <div className="bg-orange-200 p-1.5 rounded-lg"><Wallet size={18} className="text-orange-700"/></div>
                                เงินอุดหนุน (Subsidy) - ปี {selectedFiscalYear}
                            </h3>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm text-orange-600 font-medium">คงเหลือสุทธิ</span>
                                <span className="text-3xl font-bold text-orange-700">฿{stats.remainingSubsidy.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-white/50 h-3 rounded-full overflow-hidden mb-2 border border-orange-100">
                                <div className="bg-orange-500 h-full rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(249,115,22,0.5)]" style={{ width: `${Math.min(subsidyPercent, 100)}%` }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-orange-700 font-bold bg-white/40 p-2 rounded-lg">
                                <span>ใช้จริง/แผน: {stats.usedSubsidy.toLocaleString()}</span>
                                <span>ตั้งต้น: {totalSubsidyBudget.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Learner Dev Card */}
                    <div className="bg-gradient-to-br from-sky-50 to-blue-50 p-6 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <BookOpen size={100} className="text-blue-600"/>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-blue-800 font-bold flex items-center gap-2 mb-2">
                                <div className="bg-blue-200 p-1.5 rounded-lg"><BookOpen size={18} className="text-blue-700"/></div>
                                เงินกิจกรรมพัฒนาผู้เรียน - ปี {selectedFiscalYear}
                            </h3>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm text-blue-600 font-medium">คงเหลือสุทธิ</span>
                                <span className="text-3xl font-bold text-blue-700">฿{stats.remainingLearnerDev.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-white/50 h-3 rounded-full overflow-hidden mb-2 border border-blue-100">
                                <div className="bg-blue-500 h-full rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${Math.min(learnerPercent, 100)}%` }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-blue-700 font-bold bg-white/40 p-2 rounded-lg">
                                <span>ใช้จริง/แผน: {stats.usedLearnerDev.toLocaleString()}</span>
                                <span>ตั้งต้น: {totalLearnerDevBudget.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Departments Grid */}
                <div>
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <PieChart size={20}/> เลือกกลุ่มงานเพื่อบริหารโครงการ (ปี {selectedFiscalYear})
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {departments.map(dept => {
                            // Filter projects for stats in card
                            const deptSubsidy = dept.projects.reduce((acc, p) => acc + p.subsidyBudget, 0);
                            const deptDev = dept.projects.reduce((acc, p) => acc + p.learnerDevBudget, 0);
                            const projectCount = dept.projects.length;
                            
                            return (
                                <div 
                                    key={dept.name} 
                                    onClick={() => { setSelectedDept(dept); setViewMode('DETAIL'); }}
                                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <Briefcase size={24}/>
                                        </div>
                                        <div className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full group-hover:bg-white group-hover:text-blue-600 transition-colors shadow-sm">
                                            {projectCount} โครงการ
                                        </div>
                                    </div>
                                    
                                    <h4 className="font-bold text-lg text-slate-800 mb-4 h-12 line-clamp-2">{dept.name}</h4>
                                    
                                    <div className="space-y-2 border-t border-slate-100 pt-3">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400"></div> เงินอุดหนุน</span>
                                            <span className="font-bold text-slate-700">฿{deptSubsidy.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400"></div> กิจกรรมพัฒนาฯ</span>
                                            <span className="font-bold text-slate-700">฿{deptDev.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // --- VIEW: DETAIL ---
    const renderDetail = () => {
        if (!selectedDept) return null;
        
        // Departments are already filtered in state
        const projectsInYear = selectedDept.projects;
        const deptSubsidy = projectsInYear.reduce((acc, p) => acc + p.subsidyBudget, 0);
        const deptDev = projectsInYear.reduce((acc, p) => acc + p.learnerDevBudget, 0);

        return (
            <div className="space-y-6 animate-slide-up pb-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => setViewMode('OVERVIEW')} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                        <ArrowLeft size={24}/>
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold text-slate-800">{selectedDept.name}</h2>
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-lg border">ปี {selectedFiscalYear}</span>
                        </div>
                        <div className="flex gap-4 text-sm mt-1">
                            <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-100">แผนอุดหนุน: ฿{deptSubsidy.toLocaleString()}</span>
                            <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">แผนกิจกรรมฯ: ฿{deptDev.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Projects Section */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700">รายการโครงการ ปีงบประมาณ {selectedFiscalYear}</h3>
                    </div>
                    
                    {/* Add Project Form (Plan Officer Only) */}
                    {isPlanOfficer && (
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <form onSubmit={handleAddProject} className="flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row gap-4 items-start">
                                    {/* Name Input */}
                                    <div className="flex-1 w-full">
                                        <label className="text-xs text-slate-500 mb-1 block font-bold">ชื่อโครงการ</label>
                                        <input 
                                            required 
                                            type="text" 
                                            placeholder="ระบุชื่อโครงการ..." 
                                            value={newProjectName}
                                            onChange={e => setNewProjectName(e.target.value)}
                                            className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
                                        />
                                    </div>

                                    {/* Budget Selection (Toggle Switch) */}
                                    <div className="w-full md:w-auto flex flex-col">
                                        <label className="text-xs text-slate-500 mb-1 block font-bold">เลือกประเภทงบประมาณ</label>
                                        <div className="flex bg-slate-200 p-1 rounded-xl">
                                            <button
                                                type="button"
                                                onClick={() => setBudgetSource('Subsidy')}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                                                    budgetSource === 'Subsidy' 
                                                        ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-200' 
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${budgetSource === 'Subsidy' ? 'bg-orange-500' : 'bg-slate-400'}`}></div>
                                                เงินอุดหนุน
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setBudgetSource('LearnerDev')}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                                                    budgetSource === 'LearnerDev' 
                                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-200' 
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${budgetSource === 'LearnerDev' ? 'bg-blue-500' : 'bg-slate-400'}`}></div>
                                                กิจกรรมพัฒนาผู้เรียน
                                            </button>
                                        </div>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="w-full md:w-48">
                                        <label className={`text-xs mb-1 block font-bold transition-colors ${budgetSource === 'Subsidy' ? 'text-orange-600' : 'text-blue-600'}`}>
                                            จำนวนเงิน ({budgetSource === 'Subsidy' ? 'อุดหนุน' : 'กิจกรรมฯ'})
                                        </label>
                                        <input 
                                            type="number" 
                                            required
                                            placeholder="0.00" 
                                            value={newProjectAmount}
                                            onChange={e => setNewProjectAmount(e.target.value)}
                                            className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-right font-bold bg-white shadow-sm transition-all ${
                                                budgetSource === 'Subsidy' 
                                                    ? 'border-orange-200 focus:ring-orange-500 text-orange-700' 
                                                    : 'border-blue-200 focus:ring-blue-500 text-blue-700'
                                            }`}
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <div className="w-full md:w-auto pt-5">
                                        <button type="submit" className="w-full bg-slate-800 text-white px-6 py-2.5 rounded-xl hover:bg-slate-900 font-bold shadow-md flex items-center justify-center gap-2 transition-transform hover:scale-105">
                                            <Plus size={18}/> เพิ่มโครงการ
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 w-1/4">ชื่อโครงการ</th>
                                    <th className="px-4 py-3 text-right text-orange-600 w-24">เงินอุดหนุน</th>
                                    <th className="px-4 py-3 text-right text-blue-600 w-24">กิจกรรมฯ</th>
                                    <th className="px-4 py-3 text-right text-slate-800 w-24">รวมแผน</th>
                                    <th className="px-4 py-3 text-center bg-green-50 text-green-800 font-bold border-x border-green-100">ใช้จริง (Actual)</th>
                                    <th className="px-4 py-3 text-center">สถานะ</th>
                                    <th className="px-4 py-3 text-center">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {projectsInYear.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-slate-400">ยังไม่มีโครงการในกลุ่มงานนี้ สำหรับปี {selectedFiscalYear}</td></tr>
                                ) : (
                                    projectsInYear.map(p => {
                                        const plannedTotal = p.subsidyBudget + p.learnerDevBudget;
                                        
                                        return (
                                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-700">{p.name}</td>
                                                <td className="px-4 py-3 text-right font-mono text-orange-700">{p.subsidyBudget > 0 ? p.subsidyBudget.toLocaleString() : '-'}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-700">{p.learnerDevBudget > 0 ? p.learnerDevBudget.toLocaleString() : '-'}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-800">{plannedTotal.toLocaleString()}</td>
                                                
                                                {/* Actual Expense Column */}
                                                <td className="px-4 py-3 text-center font-mono border-x border-slate-100 bg-slate-50/50">
                                                    {p.status === 'Completed' ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className={`font-bold ${p.actualExpense! > plannedTotal ? 'text-red-600' : 'text-green-600'}`}>
                                                                {p.actualExpense?.toLocaleString()}
                                                            </span>
                                                            {isPlanOfficer && (
                                                                <button 
                                                                    onClick={() => handleInitiateSettlement(selectedDept.id, p)}
                                                                    className="text-[10px] text-slate-400 underline hover:text-blue-500"
                                                                >
                                                                    แก้ไข
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 text-center">{getStatusBadge(p.status)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {/* Director Actions */}
                                                        {isDirector && p.status === 'Draft' && (
                                                            <button 
                                                                onClick={() => handleStatusChange(selectedDept.id, p.id, 'Approved')}
                                                                className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] hover:bg-blue-700 shadow-sm"
                                                            >
                                                                อนุมัติ
                                                            </button>
                                                        )}
                                                        
                                                        {/* Plan Officer Actions */}
                                                        {isPlanOfficer && (
                                                            <>
                                                                {p.status === 'Approved' && (
                                                                    <button 
                                                                        onClick={() => handleInitiateSettlement(selectedDept.id, p)}
                                                                        className="bg-green-600 text-white px-2 py-1 rounded text-[10px] hover:bg-green-700 shadow-sm flex items-center gap-1"
                                                                    >
                                                                        <CheckSquare size={10}/> สรุปยอด
                                                                    </button>
                                                                )}
                                                                {p.status !== 'Completed' && (
                                                                    <button 
                                                                        onClick={() => handleDeleteProject(selectedDept.id, p.id)}
                                                                        className="text-red-400 hover:text-red-600 p-1 bg-red-50 rounded hover:bg-red-100 transition-colors"
                                                                    >
                                                                        <Trash2 size={16}/>
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}

                                                        {!isDirector && !isPlanOfficer && <span className="text-slate-300">-</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto">
            {viewMode === 'OVERVIEW' ? renderOverview() : renderDetail()}

            {/* Budget Settings Modal */}
            {showBudgetModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Settings className="text-slate-600"/> ตั้งค่ายอดงบประมาณรวม
                            </h3>
                            <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1 rounded-full">
                                <X size={20}/>
                            </button>
                        </div>
                        
                        <div className="bg-blue-50 px-6 py-2 border-b border-blue-100 text-sm text-blue-800 font-bold">
                            สำหรับปีงบประมาณ {selectedFiscalYear}
                        </div>
                        
                        <form onSubmit={handleSaveBudgetConfig} className="p-6 space-y-6">
                            <div className="space-y-4">
                                {/* Subsidy Input */}
                                <div>
                                    <label className="block text-sm font-bold text-orange-700 mb-1 flex items-center gap-2">
                                        <Wallet size={16}/> เงินอุดหนุน (Subsidy)
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            required
                                            value={tempBudgetConfig.subsidy}
                                            onChange={(e) => setTempBudgetConfig({...tempBudgetConfig, subsidy: parseFloat(e.target.value)})}
                                            className="w-full pl-4 pr-4 py-3 border-2 border-orange-100 rounded-xl focus:border-orange-400 focus:ring-4 focus:ring-orange-100 outline-none text-lg font-bold text-slate-800 transition-all"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">บาท</span>
                                    </div>
                                </div>

                                {/* Learner Dev Input */}
                                <div>
                                    <label className="block text-sm font-bold text-blue-700 mb-1 flex items-center gap-2">
                                        <BookOpen size={16}/> เงินกิจกรรมพัฒนาผู้เรียน
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            required
                                            value={tempBudgetConfig.learner}
                                            onChange={(e) => setTempBudgetConfig({...tempBudgetConfig, learner: parseFloat(e.target.value)})}
                                            className="w-full pl-4 pr-4 py-3 border-2 border-blue-100 rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none text-lg font-bold text-slate-800 transition-all"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">บาท</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setShowBudgetModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 shadow-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader className="animate-spin" size={18}/> : <Save size={18}/>} บันทึกการตั้งค่า
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Settlement Modal (Actual Expense) */}
            {showSettlementModal && settleProjectData && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
                        <div className="p-6 border-b border-slate-100 bg-green-50">
                            <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                                <Coins size={24}/> สรุปยอดใช้จ่ายจริง
                            </h3>
                            <p className="text-xs text-green-600 mt-1 truncate">{settleProjectData.project.name}</p>
                        </div>
                        
                        <form onSubmit={handleSaveSettlement} className="p-6 space-y-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="text-slate-500">งบประมาณที่ตั้งไว้:</span>
                                    <span className="font-bold">{(settleProjectData.project.subsidyBudget + settleProjectData.project.learnerDevBudget).toLocaleString()} บาท</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">ระบุยอดใช้จ่ายจริง (บาท)</label>
                                <input 
                                    type="number" 
                                    required
                                    autoFocus
                                    placeholder="0.00"
                                    value={actualAmountInput}
                                    onChange={(e) => setActualAmountInput(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-green-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none text-xl font-bold text-center text-slate-800"
                                />
                                <p className="text-xs text-slate-400 mt-2 text-center">
                                    ระบุยอดเงินตามใบเสร็จรับเงิน เพื่อคำนวณงบคงเหลือจริง
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setShowSettlementModal(false)}
                                    className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200"
                                >
                                    ยกเลิก
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md"
                                >
                                    ยืนยัน/ปิดโครงการ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActionPlanSystem;
