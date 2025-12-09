
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// --- Helpers ---

// Convert Base64 DataURI to Uint8Array
export const dataURItoUint8Array = (dataURI: string) => {
    try {
        if (!dataURI) return new Uint8Array(0);
        const split = dataURI.split(',');
        const base64 = split.length > 1 ? split[1] : dataURI;
        const byteString = atob(base64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return ia;
    } catch (e) {
        console.error("Error converting Base64", e);
        return new Uint8Array(0);
    }
};

// Fetch Thai Font
const fetchThaiFont = async () => {
    try {
        const fontUrl = "https://script-app.github.io/font/THSarabunNew.ttf";
        const response = await fetch(fontUrl);
        const fontBuffer = await response.arrayBuffer();
        return fontBuffer;
    } catch (e) {
        console.error("Failed to load Thai font", e);
        throw new Error("ไม่สามารถโหลดฟอนต์ภาษาไทยได้");
    }
};

// Split text for word wrapping
const splitTextIntoLines = (text: string, maxWidth: number, fontSize: number, font: any) => {
    if (!text) return [];
    const words = text.split(''); // Thai characters don't have spaces like English
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = font.widthOfTextAtSize(currentLine + word, fontSize);
        if (width < maxWidth) {
            currentLine += word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
};

// Format Date to Thai
const formatDateThai = (dateValue: Date) => {
    const months = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const day = dateValue.getDate();
    const month = months[dateValue.getMonth()];
    const year = dateValue.getFullYear() + 543;
    return `${day} ${month} ${year}`;
};

const formatDateThaiStr = (dateStr: string) => {
    if (!dateStr) return "....................";
    return formatDateThai(new Date(dateStr));
};

// --- STAMP: RECEIVE NUMBER (TOP RIGHT) ---
interface ReceiveStampOptions {
    fileBase64: string;
    bookNumber: string;
    date: string;
    time: string;
    schoolName?: string;
    schoolLogoBase64?: string;
}

export const stampReceiveNumber = async ({ fileBase64, bookNumber, date, time, schoolName, schoolLogoBase64 }: ReceiveStampOptions): Promise<string> => {
    const existingPdfBytes = dataURItoUint8Array(fileBase64);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    pdfDoc.registerFontkit(fontkit as any);
    const fontBytes = await fetchThaiFont();
    const thaiFont = await pdfDoc.embedFont(fontBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    const fontSize = 14; 
    const lineHeight = 18; // Increased from 14 for better spacing
    const boxWidth = 160; 
    const boxHeight = 85; // Increased from 75 to fit taller lines
    const margin = 20;
    
    const x = width - boxWidth - margin;
    const y = height - boxHeight - margin;

    firstPage.drawRectangle({
        x, y,
        width: boxWidth,
        height: boxHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.8, 0.2, 0.2),
        borderWidth: 1.5,
    });

    const stampColor = rgb(0.8, 0.2, 0.2);
    const textX = x + 6;
    const paddingTop = 12; 
    let currentY = y + boxHeight - paddingTop;

    const school = schoolName || 'โรงเรียน...................';
    
    if (schoolLogoBase64) {
        try {
            const logoBytes = dataURItoUint8Array(schoolLogoBase64);
            let logoImage;
            if(schoolLogoBase64.includes('png')) logoImage = await pdfDoc.embedPng(logoBytes);
            else logoImage = await pdfDoc.embedJpg(logoBytes);
            
            const logoDim = logoImage.scaleToFit(20, 20);
            
            firstPage.drawImage(logoImage, {
                x: textX,
                y: currentY - 2,
                width: logoDim.width,
                height: logoDim.height
            });
            
            firstPage.drawText(school, {
                x: textX + 24,
                y: currentY,
                size: fontSize,
                font: thaiFont,
                color: stampColor,
            });
        } catch(e) {
             firstPage.drawText(school, {
                x: textX,
                y: currentY,
                size: fontSize,
                font: thaiFont,
                color: stampColor,
            });
        }
    } else {
        firstPage.drawText(school, {
            x: textX,
            y: currentY,
            size: fontSize,
            font: thaiFont,
            color: stampColor,
        });
    }

    currentY -= lineHeight;
    firstPage.drawText(`เลขรับที่: ${bookNumber}`, { x: textX, y: currentY, size: fontSize, font: thaiFont, color: stampColor });
    currentY -= lineHeight;
    firstPage.drawText(`วันที่: ${date}`, { x: textX, y: currentY, size: fontSize, font: thaiFont, color: stampColor });
    currentY -= lineHeight;
    firstPage.drawText(`เวลา: ${time}`, { x: textX, y: currentY, size: fontSize, font: thaiFont, color: stampColor });

    return await pdfDoc.saveAsBase64({ dataUri: true });
};

// --- STAMP: DIRECTOR COMMAND (BOTTOM RIGHT) ---
interface StampOptions {
    fileUrl: string;       
    fileType: string;      
    notifyToText: string;  
    commandText: string;   
    directorName: string;  
    directorPosition: string;
    signatureImageBase64?: string;
    schoolName?: string;
    schoolLogoBase64?: string;
    targetPage?: number;
    onStatusChange: (status: string) => void; 
    signatureScale?: number;
    signatureYOffset?: number;
}

export const stampPdfDocument = async ({ 
    fileUrl, fileType, commandText, directorName, signatureImageBase64, schoolName, schoolLogoBase64, targetPage = 1, onStatusChange, signatureScale = 1, signatureYOffset = 0
}: StampOptions): Promise<string> => {
    
    onStatusChange('กำลังโหลดฟอนต์และเตรียมเอกสาร...');

    let pdfDoc;
    const isNewSheet = fileType === 'new' || !fileUrl;

    if (!isNewSheet && fileType && fileType.includes('pdf')) {
            const existingPdfBytes = dataURItoUint8Array(fileUrl);
            pdfDoc = await PDFDocument.load(existingPdfBytes);
    } else if (!isNewSheet) {
        pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const imageBytes = dataURItoUint8Array(fileUrl);
        let embeddedImage;
        if (fileType?.includes('png')) embeddedImage = await pdfDoc.embedPng(imageBytes);
        else embeddedImage = await pdfDoc.embedJpg(imageBytes);
        const { width, height } = embeddedImage.scaleToFit(page.getWidth(), page.getHeight());
        page.drawImage(embeddedImage, { x: (page.getWidth() - width) / 2, y: page.getHeight() - height, width, height });
    } else {
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([595.28, 841.89]);
    }

    pdfDoc.registerFontkit(fontkit as any);
    const fontBytes = await fetchThaiFont();
    const thaiFont = await pdfDoc.embedFont(fontBytes);

    const pages = pdfDoc.getPages();
    let pageIndex = (targetPage || 1) - 1;
    if (pageIndex < 0) pageIndex = 0;
    if (pageIndex >= pages.length) pageIndex = pages.length - 1; 
    
    const targetPdfPage = pages[pageIndex];
    const pageWidth = targetPdfPage.getWidth();
    
    const cmToPoints = 28.35;
    const bottomMargin = 0.5 * cmToPoints;
    const rightMargin = 0.5 * cmToPoints;
    const boxWidth = 260; 
    const boxX = pageWidth - boxWidth - rightMargin;
    const fontSize = 14; 
    const lineHeight = fontSize * 1.05; 
    const maxWidth = boxWidth - 10;

    onStatusChange('กำลังเขียนคำสั่งการ...');
    
    let commandLines: string[] = [];
    commandText.split('\n').forEach(line => {
        commandLines = [...commandLines, ...splitTextIntoLines(line, maxWidth, fontSize, thaiFont)];
    });

    const textBlockHeight = (commandLines.length) * lineHeight;
    const signatureBlockHeight = 85; 
    const paddingHeight = 15;
    const baseBoxHeight = 3 * cmToPoints;
    const newBoxHeight = Math.max(baseBoxHeight, textBlockHeight + signatureBlockHeight + paddingHeight);
    const newBoxY = bottomMargin;

    targetPdfPage.drawRectangle({
        x: boxX, y: newBoxY, width: boxWidth, height: newBoxHeight,
        color: rgb(0.97, 0.97, 0.97), borderColor: rgb(0, 0, 0.5), borderWidth: 1,
    });

    let currentY = newBoxY + newBoxHeight - 20; 
    commandLines.forEach((line) => {
        targetPdfPage.drawText(line, { x: boxX + 8, y: currentY, size: fontSize, color: rgb(0, 0, 0), font: thaiFont });
        currentY -= lineHeight;
    });

    let footerY = newBoxY + 10; 
    const centerX = boxX + (boxWidth / 2);

    const dateText = formatDateThai(new Date());
    const dateWidth = thaiFont.widthOfTextAtSize(dateText, fontSize);
    targetPdfPage.drawText(dateText, { x: centerX - (dateWidth / 2), y: footerY, size: fontSize, font: thaiFont, color: rgb(0, 0, 0) });
    footerY += lineHeight;

    const schoolText = schoolName || 'โรงเรียน...................';
    const schoolWidth = thaiFont.widthOfTextAtSize(schoolText, fontSize);
    targetPdfPage.drawText(schoolText, { x: centerX - (schoolWidth / 2), y: footerY, size: fontSize, font: thaiFont, color: rgb(0, 0, 0) });
    
    // REMOVED LOGO DRAWING FROM DIRECTOR COMMAND AS REQUESTED
    footerY += lineHeight;

    const nameText = `( ${directorName} )`;
    const nameWidth = thaiFont.widthOfTextAtSize(nameText, fontSize);
    targetPdfPage.drawText(nameText, { x: centerX - (nameWidth / 2), y: footerY, size: fontSize, font: thaiFont, color: rgb(0, 0, 0) });
    footerY += (lineHeight + 5);

    onStatusChange('กำลังประทับลายเซ็น...');
    if (signatureImageBase64) {
        try {
            const sigBytes = dataURItoUint8Array(signatureImageBase64);
            const sigImage = await pdfDoc.embedPng(sigBytes);
            const maxSigWidth = 80 * (signatureScale || 1);
            const maxSigHeight = 40 * (signatureScale || 1);
            const sigDims = sigImage.scaleToFit(maxSigWidth, maxSigHeight);
            const finalSigY = footerY + (signatureYOffset || 0);
            targetPdfPage.drawImage(sigImage, { x: centerX - (sigDims.width / 2), y: finalSigY, width: sigDims.width, height: sigDims.height });
        } catch (e) { console.warn("Could not embed signature", e); }
    }

    return await pdfDoc.saveAsBase64({ dataUri: true });
};


// --- GENERATE OFFICIAL LEAVE FORM (FULL PAGE) ---

interface LeavePdfOptions {
    req: any;
    stats: any;
    teacher: any;
    schoolName: string;
    directorName: string;
    directorSignatureBase64?: string;
    teacherSignatureBase64?: string;
    officialGarudaBase64?: string; // New: Custom Garuda
    directorSignatureScale?: number;
    directorSignatureYOffset?: number;
}

export const generateOfficialLeavePdf = async (options: LeavePdfOptions): Promise<string> => {
    const { req, stats, teacher, schoolName, directorName, directorSignatureBase64, teacherSignatureBase64, officialGarudaBase64 } = options;
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    
    pdfDoc.registerFontkit(fontkit as any);
    const fontBytes = await fetchThaiFont();
    const thaiFont = await pdfDoc.embedFont(fontBytes);

    const fontSize = 16;
    const lineHeight = 18; // Reduced spacing to match header
    const margin = 50;
    const contentWidth = width - (2 * margin);
    const indent = 60; // Standard Thai indent

    // --- Helper to draw centered text ---
    const drawCentered = (text: string, y: number, size: number = 16) => {
        const textWidth = thaiFont.widthOfTextAtSize(text, size);
        page.drawText(text, { x: (width - textWidth) / 2, y, size, font: thaiFont });
    };

    // --- Helper to draw Paragraph ---
    // hasIndent: true = 1st line indented, wrapped lines flush left
    // hasIndent: false = All lines flush left (used for continuous blocks that shouldn't re-indent)
    const drawParagraphContinuous = (text: string, startY: number, hasIndent: boolean = true) => {
        let curY = startY;
        let remainingText = text;
        
        // 1. First Line
        let availableWidth = contentWidth - (hasIndent ? indent : 0);
        let words = remainingText.split('');
        let line = "";
        
        // Consume words for first line
        while(words.length > 0) {
            const w = words[0];
            const testLine = line + w;
            const testWidth = thaiFont.widthOfTextAtSize(testLine, fontSize);
            if(testWidth < availableWidth) {
                line += w;
                words.shift();
            } else {
                break;
            }
        }
        
        // Draw first line
        page.drawText(line, { x: hasIndent ? margin + indent : margin, y: curY, size: fontSize, font: thaiFont });
        curY -= lineHeight;
        remainingText = words.join('');
        
        // 2. Subsequent Lines (Aligned to Margin)
        if (remainingText.length > 0) {
            const subsequentLines = splitTextIntoLines(remainingText, contentWidth, fontSize, thaiFont);
            subsequentLines.forEach(l => {
                page.drawText(l, { x: margin, y: curY, size: fontSize, font: thaiFont });
                curY -= lineHeight;
            });
        }
        
        return curY;
    };

    // --- 1. Garuda ---
    try {
        let garudaImage;
        if (officialGarudaBase64) {
             const gBytes = dataURItoUint8Array(officialGarudaBase64);
             if (officialGarudaBase64.includes('png')) garudaImage = await pdfDoc.embedPng(gBytes);
             else garudaImage = await pdfDoc.embedJpg(gBytes);
        } else {
             // Fallback
             const garudaUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Emblem_of_the_Ministry_of_Education_of_Thailand.svg/1200px-Emblem_of_the_Ministry_of_Education_of_Thailand.svg.png";
             const resp = await fetch(garudaUrl);
             const garudaBuffer = await resp.arrayBuffer();
             garudaImage = await pdfDoc.embedPng(garudaBuffer);
        }

        const garudaDim = garudaImage.scaleToFit(60, 60);
        page.drawImage(garudaImage, {
            x: (width - garudaDim.width) / 2,
            y: height - margin - 60,
            width: garudaDim.width,
            height: garudaDim.height
        });
    } catch (e) { console.warn("Garuda load failed", e); }

    let currentY = height - margin - 80;

    // --- 2. Title ---
    let formTitle = "แบบใบลาป่วย ลาคลอดบุตร ลากิจส่วนตัว";
    if (req.type === 'Late') formTitle = "แบบขออนุญาตเข้าสาย";
    if (req.type === 'OffCampus') formTitle = "แบบขออนุญาตออกนอกบริเวณโรงเรียน";
    drawCentered(formTitle, currentY, 20);
    currentY -= 30;

    // --- 3. Location & Date ---
    const writeAt = `เขียนที่ ${schoolName}`;
    const dateStr = `วันที่ ${new Date().getDate()} เดือน ${new Date().toLocaleString('th-TH', { month: 'long' })} พ.ศ. ${new Date().getFullYear() + 543}`;
    
    // Right align
    const writeAtWidth = thaiFont.widthOfTextAtSize(writeAt, fontSize);
    page.drawText(writeAt, { x: width - margin - writeAtWidth - 20, y: currentY, size: fontSize, font: thaiFont });
    currentY -= lineHeight;
    
    const dateStrWidth = thaiFont.widthOfTextAtSize(dateStr, fontSize);
    page.drawText(dateStr, { x: width - margin - dateStrWidth - 20, y: currentY, size: fontSize, font: thaiFont });
    currentY -= (lineHeight * 2);

    // --- 4. Subject & Dear (Adjusted Spacing) ---
    const getLeaveTypeName = (type: string) => {
        const map: any = { 'Sick': 'ป่วย', 'Personal': 'กิจส่วนตัว', 'OffCampus': 'ออกนอกบริเวณ', 'Late': 'เข้าสาย', 'Maternity': 'คลอดบุตร' };
        return map[type] || type;
    };
    
    // Subject Line
    page.drawText(`เรื่อง  ขออนุญาต${getLeaveTypeName(req.type)}`, { x: margin, y: currentY, size: fontSize, font: thaiFont });
    currentY -= lineHeight;
    
    // 1 Line Gap between Subject and Dear
    currentY -= lineHeight;

    // Dear Line
    page.drawText(`เรียน  ผู้อำนวยการ${schoolName}`, { x: margin, y: currentY, size: fontSize, font: thaiFont });
    currentY -= (lineHeight * 2);

    // --- 5. Body Paragraphs (2 Paragraphs Total) ---

    // === Paragraph 1 (Combined Block) ===
    
    // Part 1: Identity (Indented start)
    const p1_identity = `ข้าพเจ้า ${teacher.name} ตำแหน่ง ${teacher.position} สังกัด ${schoolName}`;
    currentY = drawParagraphContinuous(p1_identity, currentY, true);

    // Part 2: Request (Flush Left - No Indent - Continuous Block)
    let p1_request = "";
    const startDate = formatDateThaiStr(req.startDate);
    const endDate = formatDateThaiStr(req.endDate);
    let timeText = "";
    if (req.startTime) timeText += ` เวลา ${req.startTime} น.`;
    if (req.endTime) timeText += ` ถึงเวลา ${req.endTime} น.`;

    if (req.type === 'Late' || req.type === 'OffCampus') {
        p1_request = `มีความประสงค์ขอ${getLeaveTypeName(req.type)} เนื่องจาก ${req.reason} ตั้งแต่วันที่ ${startDate} ${timeText} ถึงวันที่ ${endDate}`;
    } else {
        const count = stats.currentDays || 0;
        const reasonText = req.type === 'Maternity' ? `เนื่องจาก ${req.reason}` : `เนื่องจาก ${req.reason}`;
        p1_request = `ขอลา${getLeaveTypeName(req.type)} ${reasonText} ตั้งแต่วันที่ ${startDate} ถึงวันที่ ${endDate} มีกำหนด ${count} วัน`;
    }
    // Draw flush left as requested "เสมอกับเรื่อง"
    currentY = drawParagraphContinuous(p1_request, currentY, false); 

    // Part 3: History (Flush Left - No Indent - Continuous Block)
    const lastStart = stats.lastLeave ? formatDateThaiStr(stats.lastLeave.startDate) : "....................";
    const lastEnd = stats.lastLeave ? formatDateThaiStr(stats.lastLeave.endDate) : "....................";
    const lastDays = stats.lastLeave ? stats.lastLeaveDays : "..."; 
    
    const p1_history = `ข้าพเจ้าได้ลาครั้งสุดท้ายตั้งแต่วันที่ ${lastStart} ถึงวันที่ ${lastEnd} มีกำหนด ${lastDays} วัน`;
    // Draw flush left as requested "ให้คิดขอบ"
    currentY = drawParagraphContinuous(p1_history, currentY, false);

    // Gap before Paragraph 2
    currentY -= (lineHeight * 0.5);

    // === Paragraph 2: Contact ===
    const p2_contact = `ในระหว่างลาติดต่อข้าพเจ้าได้ที่ ${req.contactInfo || '-'} เบอร์โทรศัพท์ ${req.mobilePhone || '-'}`;
    currentY = drawParagraphContinuous(p2_contact, currentY, true); // Indented

    // Closing
    const p5 = "จึงเรียนมาเพื่อโปรดพิจารณา";
    // Usually starts aligned with the paragraph indent
    page.drawText(p5, { x: margin + indent, y: currentY - lineHeight, size: fontSize, font: thaiFont });
    currentY -= (lineHeight * 3);

    // === Signature Block (Centered Relative to "Sincerely") ===
    
    // Define reference center X for the signature block
    // Positioned towards the right side
    const blockCenterX = width - 120; 

    const closingLabel = "ขอแสดงความนับถือ";
    const closingLabelWidth = thaiFont.widthOfTextAtSize(closingLabel, fontSize);
    
    // Draw "Sincerely" centered at blockCenterX
    page.drawText(closingLabel, { x: blockCenterX - (closingLabelWidth / 2), y: currentY, size: fontSize, font: thaiFont });
    currentY -= 40; // Space for sig image

    if (teacherSignatureBase64) {
        try {
            const tSigBytes = dataURItoUint8Array(teacherSignatureBase64);
            const tSigImage = await pdfDoc.embedPng(tSigBytes);
            const tSigDim = tSigImage.scaleToFit(100, 40);
            // Center image at blockCenterX
            page.drawImage(tSigImage, { x: blockCenterX - (tSigDim.width / 2), y: currentY, width: tSigDim.width, height: tSigDim.height });
        } catch(e) {}
    } else {
        const dotLine = "(.......................................................)";
        const dotWidth = thaiFont.widthOfTextAtSize(dotLine, fontSize);
        page.drawText(dotLine, { x: blockCenterX - (dotWidth / 2), y: currentY + 10, size: fontSize, font: thaiFont });
    }
    
    currentY -= 20;

    // Draw Name (Centered)
    const teacherNameLine = `( ${teacher.name} )`;
    const tNameWidth = thaiFont.widthOfTextAtSize(teacherNameLine, fontSize);
    page.drawText(teacherNameLine, { x: blockCenterX - (tNameWidth / 2), y: currentY, size: fontSize, font: thaiFont });
    currentY -= lineHeight;
    
    // Draw Position (Centered)
    const tPosLine = `ตำแหน่ง ${teacher.position}`;
    const tPosWidth = thaiFont.widthOfTextAtSize(tPosLine, fontSize);
    page.drawText(tPosLine, { x: blockCenterX - (tPosWidth / 2), y: currentY, size: fontSize, font: thaiFont });
    
    currentY -= (lineHeight * 2);

    // --- 6. Stats Table & Director Section ---
    const tableTop = currentY;
    
    // Draw Table (Left Side)
    const col1 = margin;
    const col2 = col1 + 60;
    const col3 = col2 + 60;
    const col4 = col3 + 60;
    
    // Headers
    const rowHeight = 20;
    const drawCell = (text: string, x: number, y: number, w: number) => {
        page.drawRectangle({ x, y: y - rowHeight + 5, width: w, height: rowHeight, borderColor: rgb(0,0,0), borderWidth: 0.5 });
        page.drawText(text, { x: x + 5, y: y - rowHeight + 10, size: 12, font: thaiFont });
    };

    page.drawText("สถิติการลาในปีงบประมาณนี้", { x: col1, y: tableTop + 10, size: 14, font: thaiFont });

    let rowY = tableTop - 10;
    drawCell("ประเภท", col1, rowY, 60);
    drawCell("ลามาแล้ว", col2, rowY, 60);
    drawCell("ลาครั้งนี้", col3, rowY, 60);
    drawCell("รวมเป็น", col4, rowY, 60);
    rowY -= rowHeight;

    const rows = [
        { name: "ป่วย", prev: stats.prevSick, curr: req.type === 'Sick' ? stats.currentDays : 0 },
        { name: "กิจส่วนตัว", prev: stats.prevPersonal, curr: req.type === 'Personal' ? stats.currentDays : 0 },
        { name: "คลอดบุตร", prev: stats.prevMaternity, curr: req.type === 'Maternity' ? stats.currentDays : 0 },
    ];
    
    if (req.type === 'Late' || req.type === 'OffCampus') {
         const isLate = req.type === 'Late';
         drawCell(isLate ? "สาย" : "ออกนอก", col1, rowY, 60);
         drawCell(`${isLate ? stats.prevLate : stats.prevOffCampus}`, col2, rowY, 60);
         drawCell("1", col3, rowY, 60);
         drawCell(`${(isLate ? stats.prevLate : stats.prevOffCampus) + 1}`, col4, rowY, 60);
    } else {
        rows.forEach(r => {
            drawCell(r.name, col1, rowY, 60);
            drawCell(`${r.prev}`, col2, rowY, 60);
            drawCell(`${r.curr > 0 ? r.curr : '-'}`, col3, rowY, 60);
            drawCell(`${r.prev + r.curr}`, col4, rowY, 60);
            rowY -= rowHeight;
        });
    }

    // --- Director Section (Right Side) ---
    const dirX = width / 2 + 20;
    const dirBoxHeight = 160; 
    const dirBoxY = tableTop - dirBoxHeight + 20; 

    page.drawRectangle({ x: dirX, y: dirBoxY, width: 220, height: dirBoxHeight, borderColor: rgb(0,0,0), borderWidth: 0.5 });
    
    let dirTextY = dirBoxY + dirBoxHeight - 25; 
    
    // Header
    const commentHeader = "ความเห็น / คำสั่ง";
    const commentW = thaiFont.widthOfTextAtSize(commentHeader, 14);
    page.drawText(commentHeader, { x: dirX + (220 - commentW)/2, y: dirTextY, size: 14, font: thaiFont, color: rgb(0,0,0) });
    dirTextY -= 25;

    const isApproved = req.status === 'Approved';
    page.drawText(isApproved ? "[ / ] อนุญาต" : "[   ] อนุญาต", { x: dirX + 20, y: dirTextY, size: 14, font: thaiFont });
    dirTextY -= 20;
    page.drawText(!isApproved && req.status === 'Rejected' ? "[ / ] ไม่อนุมัติ" : "[   ] ไม่อนุมัติ", { x: dirX + 20, y: dirTextY, size: 14, font: thaiFont });
    dirTextY -= 30; // Space for sig

    // Signature
    if (isApproved && directorSignatureBase64) {
        try {
            const dSigBytes = dataURItoUint8Array(directorSignatureBase64);
            const dSigImage = await pdfDoc.embedPng(dSigBytes);
            const scale = options.directorSignatureScale || 1;
            const dSigDim = dSigImage.scaleToFit(80 * scale, 40 * scale);
            const yOffset = options.directorSignatureYOffset || 0;
            
            // Center signature
            page.drawImage(dSigImage, { x: dirX + (220 - dSigDim.width)/2, y: dirTextY + yOffset, width: dSigDim.width, height: dSigDim.height });
        } catch(e) {}
    } 
    
    dirTextY -= 20;
    // Director Name (Inside box)
    const dirNameLine = `( ${directorName} )`;
    const dNameWidth = thaiFont.widthOfTextAtSize(dirNameLine, 14);
    page.drawText(dirNameLine, { x: dirX + (220 - dNameWidth)/2, y: dirTextY, size: 14, font: thaiFont });
    dirTextY -= 15;
    
    // Position (Inside box)
    const dPosLine = "ตำแหน่ง ผู้อำนวยการโรงเรียน";
    const dPosWidth = thaiFont.widthOfTextAtSize(dPosLine, 14);
    page.drawText(dPosLine, { x: dirX + (220 - dPosWidth)/2, y: dirTextY, size: 14, font: thaiFont });
    dirTextY -= 15;
    
    // Date (Inside box)
    const approveDate = req.approvedDate ? formatDateThaiStr(req.approvedDate) : ".....................................";
    const dDateLine = `วันที่ ${approveDate}`;
    const dDateWidth = thaiFont.widthOfTextAtSize(dDateLine, 14);
    page.drawText(dDateLine, { x: dirX + (220 - dDateWidth)/2, y: dirTextY, size: 14, font: thaiFont });

    return await pdfDoc.saveAsBase64({ dataUri: true });
};
