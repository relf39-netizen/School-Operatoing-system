
import React, { useState, useEffect } from 'react';
import { Teacher, EnrollmentData, TestScoreData, TestType } from '../types';
import { MOCK_ENROLLMENTS, MOCK_TEST_SCORES, CURRENT_SCHOOL_YEAR } from '../constants';
import { 
    GraduationCap, Users, LineChart, BarChart as BarChartIcon, 
    Plus, Save, Edit2, ChevronLeft, ChevronRight, LayoutGrid, 
    BookOpen, Award, Database, ServerOff, Loader, CheckCircle
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    LineChart as RechartsLineChart, Line, LabelList 
} from 'recharts';
import { db, isConfigured } from '../firebaseConfig';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';

interface AcademicSystemProps {
    currentUser: Teacher;
}

const AcademicSystem: React.FC<AcademicSystemProps> = ({ currentUser }) => {
    // View State
    const [viewMode, setViewMode] = useState<'DASHBOARD' | 'ENROLLMENT' | 'TEST_SCORES'>('DASHBOARD');
    
    // Data State
    const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
    const [testScores, setTestScores] = useState<TestScoreData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form State (Enrollment)
    const [selectedYear, setSelectedYear] = useState<string>(CURRENT_SCHOOL_YEAR);
    const [tempEnrollment, setTempEnrollment] = useState<EnrollmentData | null>(null);

    // Form State (Test Scores)
    const [selectedTestType, setSelectedTestType] = useState<TestType>('ONET');
    const [tempScore, setTempScore] = useState<TestScoreData | null>(null);

    // Initial Load
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            if (isConfigured && db) {
                try {
                    // Fetch Enrollments
                    const enrollQ = query(collection(db, "academic_enrollments"), where("schoolId", "==", currentUser.schoolId));
                    const enrollSnap = await getDocs(enrollQ);
                    const fetchedEnrollments = enrollSnap.docs.map(doc => doc.data() as EnrollmentData);
                    
                    // Fetch Scores
                    const scoreQ = query(collection(db, "academic_test_scores"), where("schoolId", "==", currentUser.schoolId));
                    const scoreSnap = await getDocs(scoreQ);
                    const fetchedScores = scoreSnap.docs.map(doc => doc.data() as TestScoreData);

                    if (fetchedEnrollments.length > 0 || fetchedScores.length > 0) {
                        setEnrollments(fetchedEnrollments);
                        setTestScores(fetchedScores);
                    } else {
                        // Fallback
                        setEnrollments(MOCK_ENROLLMENTS);
                        setTestScores(MOCK_TEST_SCORES);
                    }
                } catch (e) {
                    console.error("Firebase Academic Fetch Error", e);
                    setEnrollments(MOCK_ENROLLMENTS);
                    setTestScores(MOCK_TEST_SCORES);
                }
            } else {
                // Mock
                setEnrollments(MOCK_ENROLLMENTS);
                setTestScores(MOCK_TEST_SCORES);
            }
            setIsLoading(false);
        };
        loadData();
    }, [currentUser.schoolId]);

    // --- Logic & Helpers ---

    const LEVELS = [
        { id: 'Anuban1', label: 'อนุบาล 1' },
        { id: 'Anuban2', label: 'อนุบาล 2' },
        { id: 'Anuban3', label: 'อนุบาล 3' },
        { id: 'Prathom1', label: 'ประถมศึกษาปีที่ 1' },
        { id: 'Prathom2', label: 'ประถมศึกษาปีที่ 2' },
        { id: 'Prathom3', label: 'ประถมศึกษาปีที่ 3' },
        { id: 'Prathom4', label: 'ประถมศึกษาปีที่ 4' },
        { id: 'Prathom5', label: 'ประถมศึกษาปีที่ 5' },
        { id: 'Prathom6', label: 'ประถมศึกษาปีที่ 6' },
    ];

    const getTestSubjects = (type: TestType) => {
        switch(type) {
            case 'RT': return ['Reading', 'Understanding']; // การอ่านออกเสียง, การอ่านรู้เรื่อง
            case 'NT': return ['Math', 'Thai']; // คณิตศาสตร์, ภาษาไทย
            case 'ONET': return ['Thai', 'Math', 'Science', 'English']; // ไทย, คณิต, วิทย์, อังกฤษ
            default: return [];
        }
    };

    const getTestSubjectLabel = (key: string) => {
        const map: any = {
            'Reading': 'การอ่านออกเสียง', 'Understanding': 'การอ่านรู้เรื่อง',
            'Math': 'คณิตศาสตร์', 'Thai': 'ภาษาไทย', 'Science': 'วิทยาศาสตร์', 'English': 'ภาษาอังกฤษ'
        };
        return map[key] || key;
    };

    const handleSaveEnrollment = async () => {
        if (!tempEnrollment) return;
        setIsSaving(true);
        
        let newEnrollments = [...enrollments];
        const existingIndex = newEnrollments.findIndex(e => e.year === tempEnrollment.year);
        
        if (existingIndex >= 0) {
            newEnrollments[existingIndex] = tempEnrollment;
        } else {
            newEnrollments.push(tempEnrollment);
        }

        if (isConfigured && db) {
            try {
                // Use a unique ID combination: schoolId + year
                const docId = tempEnrollment.id.includes(currentUser.schoolId) 
                    ? tempEnrollment.id 
                    : `enroll_${currentUser.schoolId}_${tempEnrollment.year}`;
                
                // Ensure the ID in the data matches the doc ID
                const dataToSave = { ...tempEnrollment, id: docId };
                
                await setDoc(doc(db, "academic_enrollments", docId), dataToSave);
                
                // Update local state with the correct ID
                if (existingIndex >= 0) {
                    newEnrollments[existingIndex] = dataToSave;
                } else {
                    newEnrollments[newEnrollments.length - 1] = dataToSave;
                }
            } catch (e) {
                console.error("Save Enrollment Error", e);
                alert("บันทึกออนไลน์ไม่สำเร็จ (แต่บันทึกในหน้าจอแล้ว)");
            }
        } else {
            // Simulate delay
            await new Promise(r => setTimeout(r, 500));
        }

        setEnrollments(newEnrollments);
        setIsSaving(false);
        alert("บันทึกข้อมูลจำนวนนักเรียนเรียบร้อยแล้ว");
    };

    const handleSaveScore = async () => {
        if (!tempScore) return;
        setIsSaving(true);

        let newScores = [...testScores];
        const existingIndex = newScores.findIndex(s => s.year === tempScore.year && s.testType === tempScore.testType);

        if (existingIndex >= 0) {
            newScores[existingIndex] = tempScore;
        } else {
            newScores.push(tempScore);
        }

        if (isConfigured && db) {
            try {
                // Use a unique ID combination: schoolId + type + year
                const docId = tempScore.id.includes(currentUser.schoolId) 
                    ? tempScore.id 
                    : `score_${currentUser.schoolId}_${tempScore.testType.toLowerCase()}_${tempScore.year}`;

                const dataToSave = { ...tempScore, id: docId };

                await setDoc(doc(db, "academic_test_scores", docId), dataToSave);

                // Update local state
                if (existingIndex >= 0) {
                    newScores[existingIndex] = dataToSave;
                } else {
                    newScores[newScores.length - 1] = dataToSave;
                }
            } catch (e) {
                console.error("Save Score Error", e);
                alert("บันทึกออนไลน์ไม่สำเร็จ (แต่บันทึกในหน้าจอแล้ว)");
            }
        } else {
            await new Promise(r => setTimeout(r, 500));
        }

        setTestScores(newScores);
        setIsSaving(false);
        alert("บันทึกคะแนนสอบเรียบร้อยแล้ว");
    };

    const initEnrollmentForm = (year: string) => {
        const existing = enrollments.find(e => e.year === year);
        if (existing) {
            setTempEnrollment({ ...existing }); // Clone
        } else {
            const emptyLevels: any = {};
            LEVELS.forEach(l => emptyLevels[l.id] = { m: 0, f: 0 });
            setTempEnrollment({
                id: `enroll_${currentUser.schoolId}_${year}`, // Generate ID with SchoolID
                schoolId: currentUser.schoolId,
                year: year,
                levels: emptyLevels
            });
        }
    };

    const initScoreForm = (year: string, type: TestType) => {
        const existing = testScores.find(s => s.year === year && s.testType === type);
        if (existing) {
            setTempScore({ ...existing });
        } else {
            const subjects = getTestSubjects(type);
            const emptyResults: any = {};
            subjects.forEach(sub => emptyResults[sub] = 0);
            setTempScore({
                id: `score_${currentUser.schoolId}_${type.toLowerCase()}_${year}`, // Generate ID with SchoolID
                schoolId: currentUser.schoolId,
                year: year,
                testType: type,
                results: emptyResults
            });
        }
    };

    // --- Renderers ---

    const renderDashboard = () => {
        // Chart 1: Total Students per Year (Aggregated)
        const enrollmentChartData = enrollments
            .sort((a, b) => parseInt(a.year) - parseInt(b.year))
            .map(e => {
                let totalM = 0;
                let totalF = 0;
                Object.values(e.levels).forEach((val: any) => {
                    totalM += val.m || 0;
                    totalF += val.f || 0;
                });
                return {
                    year: `ปี ${e.year}`,
                    Total: totalM + totalF, // Use Total for bar
                    Male: totalM, // Keep for tooltip
                    Female: totalF // Keep for tooltip
                };
            });

        // Chart 2: Compare Scores (Latest available type)
        // Group by Test Type then by Subject
        const prepareScoreData = (type: TestType) => {
            const filtered = testScores.filter(s => s.testType === type).sort((a,b) => parseInt(a.year) - parseInt(b.year));
            // Transform for Recharts: array of { year, subject1, subject2... }
            return filtered.map(s => {
                const item: any = { year: `ปี ${s.year}` };
                Object.keys(s.results).forEach(subj => {
                    item[getTestSubjectLabel(subj)] = s.results[subj];
                });
                return item;
            });
        };

        const rtData = prepareScoreData('RT');
        const ntData = prepareScoreData('NT');
        const onetData = prepareScoreData('ONET');

        const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c'];

        return (
            <div className="space-y-8 pb-20 animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-6 rounded-2xl shadow-lg flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <GraduationCap size={32}/> งานบริหารวิชาการ
                        </h2>
                        <p className="text-indigo-100 mt-1">สถิตินักเรียนและผลสัมฤทธิ์ทางการเรียน</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => { setViewMode('ENROLLMENT'); initEnrollmentForm(selectedYear); }} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-bold backdrop-blur-sm flex items-center gap-2 transition-all">
                            <Users size={18}/> ข้อมูลนักเรียน
                        </button>
                        <button onClick={() => { setViewMode('TEST_SCORES'); initScoreForm(selectedYear, selectedTestType); }} className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-all">
                            <Award size={18}/> ผลสอบ O-NET/NT/RT
                        </button>
                    </div>
                </div>

                {/* Enrollment Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <BarChartIcon className="text-indigo-500"/> เปรียบเทียบจำนวนนักเรียนรวมแต่ละปีการศึกษา
                    </h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={enrollmentChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="year" />
                                <YAxis />
                                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Legend />
                                {/* Single Bar for Total with Label on Top */}
                                <Bar dataKey="Total" name="จำนวนนักเรียนทั้งหมด" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={60}>
                                    <LabelList dataKey="Total" position="top" fill="#1e293b" fontSize={12} fontWeight="bold" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Test Score Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* O-NET */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <LineChart className="text-orange-500"/> ผลสอบ O-NET (ป.6) ย้อนหลัง
                        </h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={onetData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="year" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="ภาษาไทย" stroke={COLORS[0]} strokeWidth={2} activeDot={{ r: 8 }}>
                                        <LabelList position="top" offset={10} fontSize={10} formatter={(val: number) => Number(val).toFixed(2)} fill={COLORS[0]}/>
                                    </Line>
                                    <Line type="monotone" dataKey="คณิตศาสตร์" stroke={COLORS[1]} strokeWidth={2} activeDot={{ r: 8 }}>
                                        <LabelList position="top" offset={10} fontSize={10} formatter={(val: number) => Number(val).toFixed(2)} fill={COLORS[1]}/>
                                    </Line>
                                    <Line type="monotone" dataKey="วิทยาศาสตร์" stroke={COLORS[2]} strokeWidth={2} activeDot={{ r: 8 }}>
                                        <LabelList position="top" offset={10} fontSize={10} formatter={(val: number) => Number(val).toFixed(2)} fill={COLORS[2]}/>
                                    </Line>
                                    <Line type="monotone" dataKey="ภาษาอังกฤษ" stroke={COLORS[3]} strokeWidth={2} activeDot={{ r: 8 }}>
                                        <LabelList position="top" offset={10} fontSize={10} formatter={(val: number) => Number(val).toFixed(2)} fill={COLORS[3]}/>
                                    </Line>
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* NT */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <LineChart className="text-green-500"/> ผลสอบ NT (ป.3) ย้อนหลัง
                        </h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={ntData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="year" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="คณิตศาสตร์" stroke={COLORS[1]} strokeWidth={2} activeDot={{ r: 8 }}>
                                        <LabelList position="top" offset={10} fontSize={10} formatter={(val: number) => Number(val).toFixed(2)} fill={COLORS[1]}/>
                                    </Line>
                                    <Line type="monotone" dataKey="ภาษาไทย" stroke={COLORS[0]} strokeWidth={2} activeDot={{ r: 8 }}>
                                        <LabelList position="top" offset={10} fontSize={10} formatter={(val: number) => Number(val).toFixed(2)} fill={COLORS[0]}/>
                                    </Line>
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* RT */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <LineChart className="text-blue-500"/> ผลสอบ RT (ป.1) ย้อนหลัง
                        </h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={rtData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="year" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="การอ่านออกเสียง" stroke={COLORS[0]} strokeWidth={2} activeDot={{ r: 8 }}>
                                        <LabelList position="top" offset={10} fontSize={10} formatter={(val: number) => Number(val).toFixed(2)} fill={COLORS[0]}/>
                                    </Line>
                                    <Line type="monotone" dataKey="การอ่านรู้เรื่อง" stroke={COLORS[4]} strokeWidth={2} activeDot={{ r: 8 }}>
                                        <LabelList position="top" offset={10} fontSize={10} formatter={(val: number) => Number(val).toFixed(2)} fill={COLORS[4]}/>
                                    </Line>
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderEnrollmentForm = () => {
        if (!tempEnrollment) return null;

        // Calculate Totals for Preview
        let totalM = 0;
        let totalF = 0;
        Object.values(tempEnrollment.levels).forEach((v: any) => {
            totalM += parseInt(v.m || 0);
            totalF += parseInt(v.f || 0);
        });

        return (
            <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-slide-up">
                <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => setViewMode('DASHBOARD')} className="p-2 hover:bg-slate-200 rounded-full text-slate-600">
                        <ChevronLeft size={24}/>
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800">บันทึกข้อมูลนักเรียน</h2>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="flex items-center gap-2">
                            <label className="font-bold text-slate-700">ปีการศึกษา:</label>
                            <select 
                                value={tempEnrollment.year} 
                                onChange={(e) => initEnrollmentForm(e.target.value)}
                                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {[...Array(7)].map((_, i) => {
                                    const y = parseInt(CURRENT_SCHOOL_YEAR) - 3 + i;
                                    return <option key={y} value={y}>{y}</option>
                                })}
                            </select>
                        </div>
                        <div className="flex gap-4 text-sm font-bold bg-slate-50 px-4 py-2 rounded-lg border">
                            <span className="text-blue-600">ชาย: {totalM}</span>
                            <span className="text-pink-600">หญิง: {totalF}</span>
                            <span className="text-slate-800">รวม: {totalM + totalF}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-indigo-50 text-indigo-900 uppercase">
                                <tr>
                                    <th className="px-6 py-3 rounded-l-lg">ระดับชั้น</th>
                                    <th className="px-6 py-3 text-center">นักเรียนชาย</th>
                                    <th className="px-6 py-3 text-center rounded-r-lg">นักเรียนหญิง</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {LEVELS.map((level) => (
                                    <tr key={level.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 font-bold text-slate-700">{level.label}</td>
                                        <td className="px-6 py-3">
                                            <input 
                                                type="number" min="0" 
                                                className="w-full text-center border rounded-lg py-1.5 focus:ring-2 focus:ring-blue-400 outline-none text-blue-700 font-bold bg-blue-50/30"
                                                value={tempEnrollment.levels[level.id]?.m || 0}
                                                onChange={(e) => setTempEnrollment({
                                                    ...tempEnrollment,
                                                    levels: {
                                                        ...tempEnrollment.levels,
                                                        [level.id]: { ...tempEnrollment.levels[level.id], m: parseInt(e.target.value) || 0 }
                                                    }
                                                })}
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <input 
                                                type="number" min="0" 
                                                className="w-full text-center border rounded-lg py-1.5 focus:ring-2 focus:ring-pink-400 outline-none text-pink-700 font-bold bg-pink-50/30"
                                                value={tempEnrollment.levels[level.id]?.f || 0}
                                                onChange={(e) => setTempEnrollment({
                                                    ...tempEnrollment,
                                                    levels: {
                                                        ...tempEnrollment.levels,
                                                        [level.id]: { ...tempEnrollment.levels[level.id], f: parseInt(e.target.value) || 0 }
                                                    }
                                                })}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button 
                            onClick={handleSaveEnrollment} 
                            disabled={isSaving}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
                        >
                            {isSaving ? <Loader className="animate-spin" size={20}/> : <Save size={20}/>} 
                            {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderTestScoreForm = () => {
        if (!tempScore) return null;

        const subjects = getTestSubjects(tempScore.testType);

        return (
            <div className="max-w-3xl mx-auto space-y-6 pb-20 animate-slide-up">
                <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => setViewMode('DASHBOARD')} className="p-2 hover:bg-slate-200 rounded-full text-slate-600">
                        <ChevronLeft size={24}/>
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800">บันทึกคะแนนสอบระดับชาติ</h2>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    
                    {/* Controls */}
                    <div className="flex flex-col md:flex-row gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1">ประเภทการสอบ</label>
                            <div className="flex bg-white rounded-lg p-1 border shadow-sm">
                                {['RT', 'NT', 'ONET'].map((t) => (
                                    <button 
                                        key={t}
                                        onClick={() => { setSelectedTestType(t as TestType); initScoreForm(tempScore.year, t as TestType); }}
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${tempScore.testType === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1">ปีการศึกษา</label>
                            <select 
                                value={tempScore.year} 
                                onChange={(e) => initScoreForm(e.target.value, tempScore.testType)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 h-[36px]"
                            >
                                {[...Array(7)].map((_, i) => {
                                    const y = parseInt(CURRENT_SCHOOL_YEAR) - 3 + i;
                                    return <option key={y} value={y}>{y}</option>
                                })}
                            </select>
                        </div>
                    </div>

                    <h3 className="text-center font-bold text-xl text-indigo-800 mb-6">
                        บันทึกคะแนนเฉลี่ย {tempScore.testType} ปีการศึกษา {tempScore.year}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                        {subjects.map(subj => (
                            <div key={subj} className="relative">
                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                    {getTestSubjectLabel(subj)} (คะแนนเฉลี่ย)
                                </label>
                                <input 
                                    type="number" step="0.01" min="0" max="100"
                                    value={tempScore.results[subj] || ''}
                                    onChange={(e) => setTempScore({
                                        ...tempScore,
                                        results: { ...tempScore.results, [subj]: parseFloat(e.target.value) || 0 }
                                    })}
                                    className="w-full px-4 py-3 border-2 border-indigo-100 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-xl font-bold text-center text-indigo-700"
                                    placeholder="0.00"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex justify-center">
                        <button 
                            onClick={handleSaveScore} 
                            disabled={isSaving}
                            className="bg-green-600 hover:bg-green-700 text-white px-10 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
                        >
                            {isSaving ? <Loader className="animate-spin" size={20}/> : <Save size={20}/>} 
                            {isSaving ? 'กำลังบันทึก...' : 'บันทึกคะแนน'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400 flex-col gap-2">
               <Loader className="animate-spin" size={32}/>
               <p>กำลังโหลดข้อมูลวิชาการ...</p>
           </div>
       );
    }

    return (
        <div className="max-w-7xl mx-auto">
            {viewMode === 'DASHBOARD' && renderDashboard()}
            {viewMode === 'ENROLLMENT' && renderEnrollmentForm()}
            {viewMode === 'TEST_SCORES' && renderTestScoreForm()}
        </div>
    );
};

export default AcademicSystem;
