
import { DocumentItem, LeaveRequest, Transaction, Teacher, FinanceAccount, AttendanceRecord, PlanDepartment, School, DirectorEvent, EnrollmentData, TestScoreData } from './types';

// Configuration
// Default location if school setting is missing
export const DEFAULT_LOCATION = {
    lat: 13.736717, 
    lng: 100.523186,
    allowedRadiusMeters: 500
};

// Calculate Current Thai Year Dynamically (YYYY + 543)
export const CURRENT_SCHOOL_YEAR = String(new Date().getFullYear() + 543);

// Positions List (Updated as requested)
export const ACADEMIC_POSITIONS = [
    "เจ้าหน้าที่ธุรการ",
    "นักการภารโรง",
    "พนักงานราชการ",
    "ครูผู้ช่วย",
    "ครู",
    "ครูชำนาญการ",
    "ครูชำนาญการพิเศษ",
    "ครูเชี่ยวชาญ",
    "ครูเชี่ยวชาญพิเศษ",
    "รองผู้อำนวยการโรงเรียน",
    "ผู้อำนวยการโรงเรียน"
];

// Mock Schools
export const MOCK_SCHOOLS: School[] = [
    { 
        id: '31030019', 
        name: 'โรงเรียนบ้านโคกหลวงพ่อ', 
        district: 'เมือง', 
        province: 'กรุงเทพฯ',
        lat: 13.736717,
        lng: 100.523186,
        radius: 500
    },
    { 
        id: '10000001', 
        name: 'โรงเรียนตัวอย่างวิทยา', 
        district: 'เมือง', 
        province: 'เชียงใหม่',
        lat: 18.7883,
        lng: 98.9853,
        radius: 300
    }
];

// Mock Teachers (Updated with schoolId and password)
// Password '123456'
export const MOCK_TEACHERS: Teacher[] = [
    { 
        id: '1111111111111', 
        schoolId: '31030019',
        name: 'ครูสมชาย ใจดี', 
        position: 'ครูชำนาญการ',
        roles: ['TEACHER', 'SYSTEM_ADMIN'],
        password: 'password', // Already changed
        isFirstLogin: false
    },
    { 
        id: 'dir_001', 
        schoolId: '31030019',
        name: 'นายอำนวย การดี', 
        position: 'ผู้อำนวยการโรงเรียน',
        roles: ['DIRECTOR'],
        password: 'password',
        isFirstLogin: false
    },
    { 
        id: 'admin_001', 
        schoolId: '99999999', // Super Admin ID
        name: 'Super Admin', 
        position: 'System Administrator',
        roles: ['SYSTEM_ADMIN'],
        password: 'admin',
        isFirstLogin: false
    },
];

export const MOCK_DOCUMENTS: DocumentItem[] = [
    { 
        id: '1', 
        schoolId: '31030019',
        bookNumber: '045/2567',
        title: 'แจ้งกำหนดการประชุมครูประจำเดือน', 
        description: 'ขอเรียนเชิญคณะครูเข้าร่วมประชุมเพื่อเตรียมความพร้อม...', 
        from: 'สพฐ.', 
        date: '2023-10-25', 
        timestamp: '09:30',
        priority: 'Normal',
        attachments: [
            { id: 'a1', name: 'กำหนดการประชุม.pdf', type: 'FILE', url: '', fileType: 'application/pdf' }
        ],
        status: 'PendingDirector',
        targetTeachers: [],
        acknowledgedBy: []
    },
    { 
        id: '2', 
        schoolId: '31030019',
        bookNumber: '046/2567',
        title: 'มาตรการป้องกันโรคระบาดในโรงเรียน', 
        description: 'แนวทางปฏิบัติสำหรับครูและนักเรียนในช่วงระบาด...', 
        from: 'กระทรวงสาธารณสุข', 
        date: '2023-10-24', 
        timestamp: '10:15',
        priority: 'Critical',
        attachments: [
             { id: 'a2', name: 'คู่มือแนวทางปฏิบัติ.pdf', type: 'FILE', url: '', fileType: 'application/pdf' },
             { id: 'a3', name: 'โปสเตอร์ประชาสัมพันธ์.jpg', type: 'FILE', url: 'https://via.placeholder.com/800x1100.png?text=Cover+Image+Example', fileType: 'image/jpeg' }
        ],
        status: 'Distributed',
        directorCommand: 'ทราบ แจ้งครูทุกท่านปฏิบัติตามอย่างเคร่งครัด',
        directorSignatureDate: '2023-10-24 10:30',
        targetTeachers: ['1111111111111', 't2', 't_plan'],
        acknowledgedBy: ['t2'] 
    },
];

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
    { 
        id: '1', 
        schoolId: '31030019',
        teacherId: '1111111111111',
        teacherName: 'ครูสมชาย ใจดี',
        type: 'Sick', 
        startDate: '2023-09-15', 
        endDate: '2023-09-16', 
        reason: 'ไข้หวัดใหญ่', 
        status: 'Approved',
        teacherSignature: 'สมชาย ใจดี',
        directorSignature: 'นายอำนวย การดี',
        approvedDate: '2023-09-15'
    }
];

// Finance Mocks
export const MOCK_ACCOUNTS: FinanceAccount[] = [
    { id: 'acc_1', schoolId: '31030019', name: 'เงินอุดหนุนรายหัว', type: 'Budget' },
    { id: 'acc_2', schoolId: '31030019', name: 'เงินอาหารกลางวัน', type: 'Budget' },
    { id: 'acc_non_1', schoolId: '31030019', name: 'เงินรายได้สถานศึกษา (ทั่วไป)', type: 'NonBudget' },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
    // Budget
    { id: '1', schoolId: '31030019', accountId: 'acc_1', date: '2023-10-01', description: 'รับจัดสรรงบประมาณ งวดที่ 1', amount: 500000, type: 'Income' },
    { id: '2', schoolId: '31030019', accountId: 'acc_2', date: '2023-10-02', description: 'รับเงินค่าอาหารกลางวัน', amount: 150000, type: 'Income' },
];

export const MOCK_ATTENDANCE_HISTORY: AttendanceRecord[] = [
    { id: 'a1', schoolId: '31030019', teacherId: '1111111111111', teacherName: 'ครูสมชาย ใจดี', date: '2023-10-24', checkInTime: '07:45', checkOutTime: '16:40', status: 'OnTime' },
];

// Plan Mocks
export const MOCK_PLAN_DATA: PlanDepartment[] = [
    {
        id: 'dept_1',
        schoolId: '31030019',
        name: 'กลุ่มบริหารงานวิชาการ',
        projects: [
            { id: 'p1', name: 'โครงการพัฒนาหลักสูตรสถานศึกษา', subsidyBudget: 50000, learnerDevBudget: 0, status: 'Approved' }
        ]
    },
    {
        id: 'dept_2',
        schoolId: '31030019',
        name: 'กลุ่มบริหารงานงบประมาณ',
        projects: []
    },
    {
        id: 'dept_3',
        schoolId: '31030019',
        name: 'กลุ่มบริหารงานบุคคล',
        projects: []
    },
    {
        id: 'dept_4',
        schoolId: '31030019',
        name: 'กลุ่มบริหารงานทั่วไป',
        projects: [
             // Completed project with actual expense (Over budget example)
             { id: 'p2', name: 'โครงการทัศนศึกษา', subsidyBudget: 0, learnerDevBudget: 120000, actualExpense: 125000, status: 'Completed' }
        ]
    },
    {
        id: 'dept_5',
        schoolId: '31030019',
        name: 'งบกลาง / สาธารณูปโภค',
        projects: []
    }
];

// Director Calendar Mocks
export const MOCK_DIRECTOR_EVENTS: DirectorEvent[] = [
    {
        id: 'evt_1',
        schoolId: '31030019',
        title: 'ประชุมผู้บริหาร สพฐ.',
        date: new Date().toISOString().split('T')[0], // Today
        startTime: '09:00',
        endTime: '12:00',
        location: 'สำนักงานเขตพื้นที่การศึกษา',
        description: 'ประชุมวาระพิเศษเรื่องนโยบายการศึกษาใหม่',
        createdBy: 'admin_doc'
    },
    {
        id: 'evt_2',
        schoolId: '31030019',
        title: 'เป็นประธานเปิดงานกีฬาสี',
        date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0], // Tomorrow
        startTime: '08:00',
        location: 'สนามฟุตบอลโรงเรียน',
        createdBy: 'admin_doc'
    }
];

// Academic Enrollments Mock
export const MOCK_ENROLLMENTS: EnrollmentData[] = [
    {
        id: 'enroll_2565',
        schoolId: '31030019',
        year: '2565',
        levels: {
            'Anuban1': { m: 10, f: 12 }, 'Anuban2': { m: 12, f: 10 }, 'Anuban3': { m: 11, f: 11 },
            'Prathom1': { m: 15, f: 14 }, 'Prathom2': { m: 14, f: 16 }, 'Prathom3': { m: 16, f: 15 },
            'Prathom4': { m: 13, f: 14 }, 'Prathom5': { m: 12, f: 13 }, 'Prathom6': { m: 18, f: 16 },
        }
    },
    {
        id: 'enroll_2566',
        schoolId: '31030019',
        year: '2566',
        levels: {
            'Anuban1': { m: 12, f: 11 }, 'Anuban2': { m: 10, f: 12 }, 'Anuban3': { m: 12, f: 10 },
            'Prathom1': { m: 11, f: 11 }, 'Prathom2': { m: 15, f: 14 }, 'Prathom3': { m: 14, f: 16 },
            'Prathom4': { m: 16, f: 15 }, 'Prathom5': { m: 13, f: 14 }, 'Prathom6': { m: 12, f: 13 },
        }
    },
    {
        id: 'enroll_2567',
        schoolId: '31030019',
        year: '2567',
        levels: {
            'Anuban1': { m: 14, f: 13 }, 'Anuban2': { m: 12, f: 11 }, 'Anuban3': { m: 10, f: 12 },
            'Prathom1': { m: 12, f: 10 }, 'Prathom2': { m: 11, f: 11 }, 'Prathom3': { m: 15, f: 14 },
            'Prathom4': { m: 14, f: 16 }, 'Prathom5': { m: 16, f: 15 }, 'Prathom6': { m: 13, f: 14 },
        }
    }
];

// Academic Test Scores Mock
export const MOCK_TEST_SCORES: TestScoreData[] = [
    // RT
    { id: 'rt_2565', schoolId: '31030019', year: '2565', testType: 'RT', results: { 'Reading': 75.5, 'Understanding': 78.2 } },
    { id: 'rt_2566', schoolId: '31030019', year: '2566', testType: 'RT', results: { 'Reading': 78.0, 'Understanding': 80.5 } },
    { id: 'rt_2567', schoolId: '31030019', year: '2567', testType: 'RT', results: { 'Reading': 82.5, 'Understanding': 81.0 } },
    
    // NT
    { id: 'nt_2565', schoolId: '31030019', year: '2565', testType: 'NT', results: { 'Math': 45.2, 'Thai': 55.4 } },
    { id: 'nt_2566', schoolId: '31030019', year: '2566', testType: 'NT', results: { 'Math': 48.5, 'Thai': 58.0 } },
    { id: 'nt_2567', schoolId: '31030019', year: '2567', testType: 'NT', results: { 'Math': 52.1, 'Thai': 60.5 } },

    // O-NET
    { id: 'onet_2565', schoolId: '31030019', year: '2565', testType: 'ONET', results: { 'Thai': 50.2, 'Math': 35.5, 'Science': 40.1, 'English': 30.5 } },
    { id: 'onet_2566', schoolId: '31030019', year: '2566', testType: 'ONET', results: { 'Thai': 52.8, 'Math': 38.0, 'Science': 42.5, 'English': 32.0 } },
    { id: 'onet_2567', schoolId: '31030019', year: '2567', testType: 'ONET', results: { 'Thai': 55.0, 'Math': 42.2, 'Science': 45.0, 'English': 35.5 } },
];
