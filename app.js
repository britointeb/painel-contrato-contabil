const { useState, useEffect, useMemo, useRef } = React;

if (window.ChartDataLabels) {
    Chart.register(ChartDataLabels);
    Chart.defaults.set('plugins.datalabels', { display: false });
}

// Plugin: Linha Tracejada Vermelha para os 50% do Gráfico de 100%
const fiftyPercentLinePlugin = {
    id: 'fiftyPercentLinePlugin',
    afterDatasetsDraw: (chart) => {
        if (chart.config.options.plugins.fiftyPercentLinePlugin?.display) {
            const ctx = chart.ctx; const yAxis = chart.scales.y; const xAxis = chart.scales.x;
            if (!yAxis || !xAxis) return;
            const y50 = yAxis.getPixelForValue(50);
            ctx.save(); ctx.beginPath(); ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; 
            ctx.moveTo(xAxis.left, y50); ctx.lineTo(xAxis.right, y50); ctx.stroke(); ctx.restore();
        }
    }
};
Chart.register(fiftyPercentLinePlugin);

const tagColorsMap = {
    'ATIVO INEXEC': { css: 'bg-purple-700 text-white', hex: '#7e22ce' },
    'ATIVO EM EXEC': { css: 'bg-cyan-500 text-slate-900', hex: '#06b6d4' },
    'ATIVO EXEC TOT': { css: 'bg-blue-800 text-white', hex: '#1e40af' },
    'ATIVO EXEC PARC': { css: 'bg-sky-400 text-slate-900', hex: '#38bdf8' },
    'VENC INEXEC TOT': { css: 'bg-rose-900 text-white', hex: '#881337' },
    'VENC EXEC TOT': { css: 'bg-green-600 text-white', hex: '#16a34a' },
    'VENC EXEC PARC': { css: 'bg-yellow-500 text-slate-900', hex: '#eab308' },
    'CAN': { css: 'bg-red-600 text-white', hex: '#dc2626' },
    'BLOQ': { css: 'bg-orange-500 text-white', hex: '#f97316' },
    'SÓ EM GERAL': { css: 'bg-amber-900 text-white', hex: '#78350f' },
    'SÓ EM CONTÁBIL': { css: 'bg-orange-900 text-white', hex: '#7c2d12' }
};

const _decode = (str) => {
    if (!str) return "";
    if (/^[01\s]+$/.test(str.trim())) {
        try { return str.trim().split(' ').map(b => String.fromCharCode(parseInt(b, 2))).join(''); } 
        catch(e) { return str; }
    }
    return str; 
};

const SPREADSHEET_ID_CONTABIL = "1rRup03vk20FWxhbkClXBLVZ2X1N8AZpFyjevbkzP4-w"; 
const RANGE_CONTABIL = "CONTROLE_EXEC_CONTR_DOC!A:K"; 
const SPREADSHEET_ID_GERAL = "1Fuhb3HMRzg2kEozkuREFNKYSXtqUCLhZWFFuWM-f3v4"; 
const RANGE_GERAL = "CONTROLE_EXEC_CONTR!A1:BR2000"; 
const API_KEY = _decode("01000001 01001001 01111010 01100001 01010011 01111001 01000011 01001011 01110010 01110110 01100001 01101011 01101011 01000010 01001000 00111001 01101100 00110100 01010111 01100010 01010001 01001011 01001110 01110111 01101010 01010000 00110010 01010011 01010000 01001101 01001001 01101110 01110011 01101110 01110100 01000001 01101010 01100011 01000001");
const API_URL_CONTABIL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID_CONTABIL}/values/${RANGE_CONTABIL}?key=${API_KEY}`;
const API_URL_GERAL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID_GERAL}/values/${RANGE_GERAL}?key=${API_KEY}`;

const cSupItemsList = ["SGLS-CLASSE I", "SGLFE-CLASSE II", "SGLC-CLASSE III", "SGLME-CLASSE V (MUN)"];
const getTodayStr = () => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const normalizeStr = (str) => str ? str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
const parseValue = (val) => {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === 'number') return val;
    let str = String(val).replace(/[R$\s\u00A0\u202F]/g, '').trim();
    let isNegative = false;
    if (str.startsWith('(') && str.endsWith(')')) { isNegative = true; str = str.slice(1, -1); } 
    else if (str.startsWith('-')) { isNegative = true; str = str.slice(1); }
    if (str.includes(',')) { str = str.replace(/\./g, '').replace(',', '.'); } 
    else {
        const dotCount = (str.match(/\./g) || []).length;
        if (dotCount > 1) str = str.replace(/\./g, '');
        else if (dotCount === 1) { const parts = str.split('.'); if (parts[1].length === 3) str = str.replace('.', ''); }
    }
    let num = parseFloat(str);
    return isNaN(num) ? 0 : (isNegative ? -num : num);
};

const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(v || 0);
const formatPercentBR = (v) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const shortenNumber = (num) => {
    if (!num) return "0";
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace('.', ',') + ' Bi';
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace('.', ',') + ' Mi';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace('.', ',') + ' Mil';
    return num.toString();
};
const parseDateBR = (dStr) => {
    if (!dStr || dStr === "-") return null;
    if (dStr.includes('-')) return new Date(dStr + "T00:00:00");
    const parts = dStr.split('/');
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    return new Date(dStr);
};
const formatLabelMultiLine = (text, maxLength = 18) => {
    if (!text) return [""];
    let cleanText = text.replace(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s*-\s*/, '');
    if (cleanText.length <= maxLength) return [cleanText];
    const words = cleanText.split(' ');
    let lines = []; let currentLine = '';
    words.forEach(word => {
        if ((currentLine + word).length > maxLength) { if (currentLine) lines.push(currentLine.trim()); currentLine = word + ' '; } 
        else { currentLine += word + ' '; }
    });
    if (currentLine) lines.push(currentLine.trim());
    if (lines.length > 2) return [lines[0], lines[1].substring(0, maxLength - 3) + '...'];
    return lines;
};

const startResize = (e) => {
    const th = e.target.closest('th');
    if (!th) return;
    const startX = e.pageX; const startWidth = th.getBoundingClientRect().width;
    const onMouseMove = (moveEvent) => { th.style.width = `${Math.max(40, startWidth + moveEvent.pageX - startX)}px`; };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
};

const exportTable = {
    toExcel: (data, filename, columns) => {
        if (!window.XLSX) { alert("Biblioteca Excel não encontrada."); return; }
        const wsData = data.map(row => {
            let obj = {};
            columns.forEach(c => {
                let val = row[c.key];
                if (c.key === 'situacao') val = row.situacao;
                else if (c.isCurrency) val = formatBRL(val);
                else if (c.isPercent) val = formatPercentBR(val);
                obj[c.header] = val;
            });
            return obj;
        });
        const ws = XLSX.utils.json_to_sheet(wsData); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados"); XLSX.writeFile(wb, `${filename}.xlsx`);
    },
    toCSV: (data, filename, columns) => {
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += columns.map(c => c.header).join(";") + "\n";
        data.forEach(row => {
            let r = columns.map(c => {
                let val = c.key === 'situacao' ? row.situacao : row[c.key];
                if (val === null || val === undefined) val = "-";
                else if (c.isPercent) val = formatPercentBR(val);
                else if (typeof val === 'number') return val.toString().replace('.', ',');
                return `"${(val || '').toString().replace(/"/g, '""')}"`;
            });
            csvContent += r.join(";") + "\n";
        });
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${filename}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
    },
    toPDF: (data, filename, columns, title) => {
        if (!window.jspdf || !window.jspdf.jsPDF) { alert("Biblioteca PDF não encontrada."); return; }
        const { jsPDF } = window.jspdf; const doc = new jsPDF('l', 'pt', 'a4'); 
        doc.setFontSize(14); doc.text(title, 40, 30);
        const tableHead = [columns.map(c => c.header)];
        const tableBody = data.map(row => columns.map(c => {
            let val = c.key === 'situacao' ? row.situacao : row[c.key];
            if (val === null || val === undefined) return "-";
            if (c.isCurrency) return formatBRL(val);
            if (c.isPercent) return formatPercentBR(val);
            return val.toString();
        }));
        doc.autoTable({ head: tableHead, body: tableBody, startY: 40, styles: { fontSize: 5, cellPadding: 2, overflow: 'linebreak' }, headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] }, margin: { top: 20, left: 10, right: 10 } });
        doc.save(`${filename}.pdf`);
    }
};

// =========================================================
// COMPONENTES UI
// =========================================================

const FormatNegativeValue = ({ val }) => {
    if (val === null || val === undefined) return <span>-</span>;
    const isNegative = val < -0.001; 
    return (
        <span className={isNegative ? "underline decoration-red-500 decoration-[2px] underline-offset-2" : ""}>
            {formatBRL(val)}
        </span>
    );
};

function CollapsibleSection({ title, children, defaultOpen = false }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="max-w-[1600px] mx-auto mb-8">
            <div 
                className="bg-slate-800 text-white px-6 py-4 rounded-xl cursor-pointer flex justify-between items-center shadow-lg hover:bg-slate-700 transition border border-slate-700"
                onClick={() => setIsOpen(!isOpen)}
            >
                <h2 className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    {title}
                </h2>
                <span className="font-bold text-lg text-slate-300">{isOpen ? '▼' : '►'}</span>
            </div>
            {isOpen && <div className="mt-6">{children}</div>}
        </div>
    );
}

function AutoFitText({ text, className }) {
    const containerRef = useRef(null); const textRef = useRef(null);
    useEffect(() => {
        const resize = () => {
            if (containerRef.current && textRef.current) {
                textRef.current.style.transform = 'none'; 
                const containerWidth = containerRef.current.clientWidth;
                const textWidth = textRef.current.scrollWidth;
                if (textWidth > containerWidth && containerWidth > 0) {
                    const scale = containerWidth / textWidth;
                    textRef.current.style.transform = `scale(${scale})`;
                }
            }
        };
        resize(); setTimeout(resize, 50); window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [text]);
    return (<div ref={containerRef} className="w-full overflow-hidden flex items-center"><div ref={textRef} className={`${className} origin-left whitespace-nowrap inline-block`}>{text}</div></div>);
}

const ChartComponent = ({ type, data, options, id }) => {
    const canvasRef = useRef(null); const chartInstance = useRef(null);
    useEffect(() => {
        if (!canvasRef.current) return;
        if (chartInstance.current) chartInstance.current.destroy();
        chartInstance.current = new Chart(canvasRef.current.getContext('2d'), { type, data, options });
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [data, options, type]);
    return <canvas ref={canvasRef} id={id}></canvas>;
};

function FunnelChart({ data }) {
    const max = data.length > 0 && data[0].value > 0 ? data[0].value : 1;
    return (
        <div className="w-full h-full flex flex-col-reverse items-center justify-center gap-2 py-2">
            {data.map((item, i) => {
                const pct = data[0].value > 0 ? (item.value / max) * 100 : 0;
                const w = Math.max(pct, 15); 
                return (
                    <div key={i} className="w-full flex flex-col items-center justify-center flex-1">
                        <span className="text-[9px] font-black text-slate-500 uppercase mb-1">{item.label}</span>
                        <div className={`${item.color} rounded shadow-sm transition-all duration-500 flex items-center justify-center relative hover:opacity-80 cursor-help`} style={{ width: `${w}%`, minHeight: '28px' }} title={`${item.label}: ${formatBRL(item.value)}`}>
                            <span className="text-white font-black text-[10px] drop-shadow-md px-2 text-center whitespace-nowrap">{shortenNumber(item.value)} ({pct.toFixed(1).replace('.', ',')}%)</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function LatestDocCard({ title, docs, metricField, colorClass, showEmitente }) {
    const latestDateStr = docs && docs.length > 0 ? docs[0].dia : '';
    const latestTimestamp = docs && docs.length > 0 ? docs[0].diaVal : null;
    const totalValue = useMemo(() => docs.reduce((acc, curr) => acc + (curr[metricField] || 0), 0), [docs, metricField]);
    const daysText = useMemo(() => {
        if (!latestTimestamp) return '';
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const docDate = new Date(latestTimestamp); docDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - docDate) / 86400000);
        return `(${diffDays} dia${diffDays === 1 ? '' : 's'})`;
    }, [latestTimestamp]);

    if (!docs || docs.length === 0) return (
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 opacity-60 flex flex-col justify-center h-full">
            <h4 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">{title} (0)</h4>
            <p className="text-xs font-bold text-slate-400">Nenhum documento encontrado.</p>
        </div>
    );
    return (
        <div className={`p-4 rounded-2xl shadow-sm border border-t-4 bg-white flex flex-col h-full max-h-[300px] hover:shadow-md transition ${colorClass.split(' ')[0]}`}>
            <div className="flex justify-between items-start mb-3 shrink-0 gap-2">
                <h4 className={`text-[10px] font-black uppercase tracking-widest ${colorClass.split(' ')[1]}`}>{title} ({docs.length})</h4>
                <div className="text-[8.5px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-right whitespace-nowrap">Data: {latestDateStr} {daysText}</div>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1 custom-scrollbar mb-2">
                {docs.map((doc, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0 shrink-0">
                        <div className="flex flex-col w-2/3 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{doc.dia}</span>
                                <span className="text-[11px] font-black text-slate-700 truncate" title={`${doc.documento} | Contrato: ${doc.contrato}`}>
                                    {doc.documento} <span className="text-[9px] text-slate-400 font-bold ml-1">({doc.contrato})</span>
                                </span>
                            </div>
                            {showEmitente && <span className="text-[9px] font-bold text-slate-500 truncate mt-0.5" title={doc.ug}>{doc.ug}</span>}
                        </div>
                        <span className={`text-[11px] font-black truncate w-1/3 text-right ${colorClass.split(' ')[1]}`} title={formatBRL(doc[metricField])}>
                            <FormatNegativeValue val={doc[metricField]} />
                        </span>
                    </div>
                ))}
            </div>
            <div className={`pt-2 border-t border-slate-200 flex justify-between items-center shrink-0 ${colorClass.split(' ')[1]}`}>
                <span className="text-[9px] font-black uppercase">Total Movimentado:</span>
                <span className="text-[12px] font-black"><FormatNegativeValue val={totalValue} /></span>
            </div>
        </div>
    );
}

function TextHeader({ label, field, current, onSort, align="left", searchVal, onSearchChange, widthClass }) {
    const isSorted = current.key === field;
    return (
        <th className={`p-2 transition text-${align} bg-slate-50 relative group ${widthClass || 'w-auto'}`}>
            <div onMouseDown={startResize} className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize bg-transparent hover:bg-blue-400 z-20"></div>
            <div className={`flex items-center gap-1 cursor-pointer hover:text-blue-500 justify-${align === 'right' ? 'end' : align === 'center' ? 'center' : 'start'}`} onClick={() => onSort(field)}>
                {label} <span className="text-[8px] text-slate-400">{isSorted ? (current.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
            </div>
            {onSearchChange !== undefined && <input type="text" placeholder="Buscar..." value={searchVal} onChange={(e) => onSearchChange(e.target.value)} onClick={(e) => e.stopPropagation()} className="mt-2 w-full px-1 py-1 text-slate-800 text-[9px] font-normal rounded border border-slate-300 outline-none focus:border-blue-500 shadow-inner" />}
        </th>
    );
}

function NumericHeader({ label, field, current, onSort, numFilters, setNumFilters, align="left", widthClass }) {
    const isSorted = current.key === field;
    const handleMin = (e) => setNumFilters(p => ({ ...p, [field]: { ...p[field], min: e.target.value } }));
    const handleMax = (e) => setNumFilters(p => ({ ...p, [field]: { ...p[field], max: e.target.value } }));
    return (
        <th className={`p-2 transition text-${align} bg-slate-50 relative group ${widthClass || 'w-auto'}`}>
            <div onMouseDown={startResize} className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize bg-transparent hover:bg-blue-400 z-20"></div>
            <div className={`flex items-center gap-1 cursor-pointer hover:text-blue-500 justify-${align === 'right' ? 'end' : align === 'center' ? 'center' : 'start'}`} onClick={() => onSort(field)}>
                {label} <span className="text-[8px] text-slate-400">{isSorted ? (current.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
            </div>
            <div className="flex flex-col gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                <input type="number" placeholder="< Max" value={numFilters[field] ? numFilters[field].max : ''} onChange={handleMax} className="w-full px-1 py-1 text-slate-800 text-[8px] font-normal rounded border border-slate-300 outline-none focus:border-blue-500 shadow-inner" />
                <input type="number" placeholder="> Min" value={numFilters[field] ? numFilters[field].min : ''} onChange={handleMin} className="w-full px-1 py-1 text-slate-800 text-[8px] font-normal rounded border border-slate-300 outline-none focus:border-blue-500 shadow-inner" />
            </div>
        </th>
    );
}

function DateFilterHeader({ label, field, current, onSort, dateFilters, setDateFilters, align="left", widthClass }) {
    const isSorted = current.key === field;
    const handleMin = (e) => setDateFilters(p => ({ ...p, [field]: { ...p[field], min: e.target.value } }));
    const handleMax = (e) => setDateFilters(p => ({ ...p, [field]: { ...p[field], max: e.target.value } }));
    return (
        <th className={`p-2 transition text-${align} bg-slate-50 relative group ${widthClass || 'w-auto'}`}>
            <div onMouseDown={startResize} className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize bg-transparent hover:bg-blue-400 z-20"></div>
            <div className={`flex items-center gap-1 cursor-pointer hover:text-blue-500 justify-${align === 'right' ? 'end' : align === 'center' ? 'center' : 'start'}`} onClick={() => onSort(field)}>
                {label} <span className="text-[8px] text-slate-400">{isSorted ? (current.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
            </div>
            <div className="flex flex-col gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                <input type="date" title="A partir de (Mínimo)" value={dateFilters[field] ? dateFilters[field].min : ''} onChange={handleMin} className="w-full px-1 py-1 text-slate-800 text-[8px] font-normal rounded border border-slate-300 outline-none focus:border-blue-500 shadow-inner" />
                <input type="date" title="Até (Máximo)" value={dateFilters[field] ? dateFilters[field].max : ''} onChange={handleMax} className="w-full px-1 py-1 text-slate-800 text-[8px] font-normal rounded border border-slate-300 outline-none focus:border-blue-500 shadow-inner" />
            </div>
        </th>
    );
}

function MultiSelect({ label, options, selected, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef();

    useEffect(() => {
        const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (opt) => {
        if (selected.includes(opt)) onChange(selected.filter(item => item !== opt));
        else onChange([...selected, opt]);
    };

    const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
    const markAllVisible = () => { onChange(Array.from(new Set([...selected, ...filteredOptions]))); };

    return (
        <div className="relative" ref={ref}>
            <label className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-widest">{label}</label>
            <div className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold text-slate-700 cursor-pointer flex justify-between items-center shadow-sm" onClick={() => setIsOpen(!isOpen)}>
                <span className="truncate">{selected.length === 0 ? "TODOS OS REGISTROS" : `${selected.length} selecionado(s)`}</span><span className="text-[10px]">▼</span>
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl max-h-72 flex flex-col">
                    <div className="p-2 border-b bg-slate-50 flex flex-col gap-2">
                        <input type="text" placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500" />
                        <div className="flex gap-2">
                            <button onClick={markAllVisible} className="text-[9px] font-bold bg-slate-200 text-slate-800 px-2 py-1 rounded w-full hover:bg-slate-300">Marcar Visíveis</button>
                            <button onClick={() => onChange([])} className="text-[9px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded w-full hover:bg-red-200">Limpar</button>
                        </div>
                    </div>
                    <div className="overflow-y-auto p-1">
                        {filteredOptions.length === 0 && <p className="text-[10px] text-center text-slate-400 p-2">Sem resultados.</p>}
                        {filteredOptions.map((o, i) => (
                            <label key={i} className="flex items-center px-2 py-2 hover:bg-blue-50 cursor-pointer text-[10px] font-bold text-slate-700 border-b border-slate-100 last:border-0">
                                <input type="checkbox" checked={selected.includes(o)} onChange={() => toggleOption(o)} className="mr-2 cursor-pointer" />
                                <span className="truncate leading-tight">{o}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function DateInput({ label, value, onChange }) {
    return (
        <div>
            <label className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-widest">{label}</label>
            <input type="date" value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm cursor-pointer" />
        </div>
    );
}

function KPICard({ title, value, subValue, diffText, percSuffix, color, isCurrency, extraText }) {
    const colors = {
        slate: "border-slate-800 text-slate-800", blue: "border-blue-500 text-blue-700", violet: "border-violet-500 text-violet-700",
        amber: "border-amber-500 text-amber-600", emerald: "border-emerald-500 text-emerald-600", red: "border-red-500 text-red-600",
        orange: "border-orange-500 text-orange-600"
    };
    const mainText = isCurrency ? formatBRL(value) : value.toLocaleString('pt-BR');
    const subText = subValue !== undefined ? `${formatPercentBR(subValue)}${percSuffix || ''}` : '';
    
    return (
        <div className={`bg-white p-3 sm:p-5 rounded-2xl border-t-8 shadow-md flex flex-col justify-center overflow-hidden min-w-0 ${colors[color]}`}>
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1 truncate" title={title}>{title}</h3>
            <div className="flex flex-col w-full min-w-0">
                <AutoFitText text={mainText} className="font-black text-2xl tracking-tight" />
                {diffText && <div className="text-[10px] font-bold text-slate-500 mt-1 truncate">{diffText}</div>}
                {subValue !== undefined && <div className="text-[10px] font-bold opacity-70 mt-1 truncate">{subText}</div>}
                {extraText && (
                    <div className="text-[9.5px] font-bold text-slate-500 mt-2 leading-[1.1] border-t border-slate-100 pt-1">
                        {extraText.split('\n').map((line, idx) => <div key={idx}>{line}</div>)}
                    </div>
                )}
            </div>
        </div>
    );
}

function DocStatCard({ title, count, date, timestamp }) {
    const daysText = useMemo(() => {
        if (!timestamp) return '';
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const docDate = new Date(timestamp); docDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - docDate) / 86400000);
        return ` (${diffDays} dia${diffDays === 1 ? '' : 's'} até hoje)`;
    }, [timestamp]);

    return (
        <div className="bg-white p-3 sm:p-4 rounded-2xl border-t-4 border-slate-400 shadow-md flex flex-col justify-center overflow-hidden min-w-0">
            <h3 className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1 truncate" title={title}>{title}</h3>
            <div className="font-black text-xl sm:text-2xl tracking-tight text-slate-800">{count.toLocaleString('pt-BR')}</div>
            <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase">Último: {date || '-'}{daysText}</div>
        </div>
    );
}

function SubTable({ title, data, metricField, metricLabel, headerColor, rowBgColor, textColor, showDiasAss = false }) {
    const [limit, setLimit] = useState(100);
    const [sortConfig, setSortConfig] = useState({ key: 'diaVal', direction: 'desc' });
    
    const [searchContrato, setSearchContrato] = useState(""); 
    const [searchSituacao, setSearchSituacao] = useState("");
    const [searchExistencia, setSearchExistencia] = useState("");
    const [searchMovimento, setSearchMovimento] = useState("");
    const [searchUgNome, setSearchUgNome] = useState(""); 
    const [searchEmpenho, setSearchEmpenho] = useState("");
    const [searchDocumento, setSearchDocumento] = useState("");
    const [searchObs, setSearchObs] = useState("");
    const [searchEmitente, setSearchEmitente] = useState("");
    
    const [numFilters, setNumFilters] = useState({ [metricField]: {min:'', max:''}, perc_tempo: {min:'', max:''}, diasAss: {min:'', max:''} });
    const [dateFilters, setDateFilters] = useState({ dia: {min:'', max:''}, data_inic: {min:'', max:''}, data_fim: {min:'', max:''} });

    const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));

    const tableData = useMemo(() => {
        const hasField = metricField.replace('v_', 'has_');
        let filtered = data.filter(row => row[hasField]);

        filtered = filtered.filter(item => {
            const matchContrato = !searchContrato || item.contrato.includes(searchContrato.toUpperCase());
            const matchSit = !searchSituacao || item.situacao.includes(searchSituacao.toUpperCase());
            const matchExistencia = !searchExistencia || item.existencia.includes(searchExistencia.toUpperCase());
            const matchMovimento = !searchMovimento || item.movimentoStr.includes(searchMovimento.toUpperCase());
            const matchEmitente = !searchEmitente || item.ug.includes(searchEmitente.toUpperCase());
            const matchUgNome = !searchUgNome || item.favorecido.includes(searchUgNome.toUpperCase());
            const matchEmpenho = !searchEmpenho || item.empenho.includes(searchEmpenho.toUpperCase());
            const matchDocumento = !searchDocumento || item.documento.includes(searchDocumento.toUpperCase());
            const matchObs = !searchObs || item.obs.includes(searchObs.toUpperCase());

            let matchNum = true;
            for (const key in numFilters) {
                if (numFilters[key] && (numFilters[key].min !== '' || numFilters[key].max !== '')) {
                    let val = item[key];
                    if (val === null || val === undefined) { matchNum = false; break; }
                    if (key.startsWith('p_')) val = val * 100;
                    if (numFilters[key].min !== '' && val < parseFloat(numFilters[key].min)) { matchNum = false; break; }
                    if (numFilters[key].max !== '' && val > parseFloat(numFilters[key].max)) { matchNum = false; break; }
                }
            }

            let matchDateCol = true;
            if (dateFilters.dia) {
                if (dateFilters.dia.min && item.diaVal !== 0 && item.diaVal < new Date(dateFilters.dia.min + "T00:00:00").getTime()) matchDateCol = false;
                if (dateFilters.dia.max && item.diaVal !== 0 && item.diaVal > new Date(dateFilters.dia.max + "T23:59:59").getTime()) matchDateCol = false;
            }
            if (dateFilters.data_inic) {
                if (dateFilters.data_inic.min && item.dtInicVal && item.dtInicVal < new Date(dateFilters.data_inic.min + "T00:00:00").getTime()) matchDateCol = false;
                if (dateFilters.data_inic.max && item.dtInicVal && item.dtInicVal > new Date(dateFilters.data_inic.max + "T23:59:59").getTime()) matchDateCol = false;
            }
            if (dateFilters.data_fim) {
                if (dateFilters.data_fim.min && item.dtFimVal && item.dtFimVal < new Date(dateFilters.data_fim.min + "T00:00:00").getTime()) matchDateCol = false;
                if (dateFilters.data_fim.max && item.dtFimVal && item.dtFimVal > new Date(dateFilters.data_fim.max + "T23:59:59").getTime()) matchDateCol = false;
            }

            return matchContrato && matchSit && matchExistencia && matchMovimento && matchEmitente && matchUgNome && matchEmpenho && matchDocumento && matchObs && matchNum && matchDateCol;
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let valA = a[sortConfig.key], valB = b[sortConfig.key];
                if (sortConfig.key === 'data_inic') { valA = a.dtInicVal; valB = b.dtInicVal; }
                else if (sortConfig.key === 'data_fim') { valA = a.dtFimVal; valB = b.dtFimVal; }
                if (valA === null) valA = -Number.MAX_VALUE; if (valB === null) valB = -Number.MAX_VALUE;
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [data, metricField, searchContrato, searchSituacao, searchExistencia, searchMovimento, searchEmitente, searchUgNome, searchEmpenho, searchDocumento, searchObs, numFilters, dateFilters, sortConfig]);
    
    useEffect(() => { setLimit(100); }, [data, searchContrato, searchSituacao, searchExistencia, searchMovimento, searchEmitente, searchUgNome, searchEmpenho, searchDocumento, searchObs, numFilters, dateFilters, sortConfig]);

    const totalMetric = useMemo(() => tableData.reduce((acc, curr) => acc + curr[metricField], 0), [tableData, metricField]);

    const exportColumns = [
        { header: "DIA", key: "dia" }, { header: "CONTRATO", key: "contrato" }, { header: "SITUAÇÃO", key: "situacao" }, { header: "MOVIMENTO", key: "movimentoStr" },
        ...(showDiasAss ? [{ header: "DIAS ATÉ ASS. (RO)", key: "diasAss" }] : []),
        { header: "VIG. INIC", key: "data_inic" }, { header: "VIG. FIM", key: "data_fim" },
        { header: "EMITENTE", key: "ug" }, { header: "FAVORECIDO", key: "favorecido" },
        { header: "EMPENHO", key: "empenho" }, { header: "DOCUMENTO", key: "documento" },
        { header: "OBS", key: "obs" }, { header: metricLabel, key: metricField, isCurrency: true }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
            <div className={`${headerColor} px-4 py-3 flex justify-between items-center flex-wrap gap-2`}>
                <h3 className="text-white text-xs font-black tracking-widest uppercase">{title} ({tableData.length})</h3>
                <div className="flex gap-2">
                    <button onClick={() => exportTable.toExcel(tableData, title, exportColumns)} className="bg-green-600 hover:bg-green-500 text-white text-[9px] font-black px-2 py-1 rounded shadow transition">EXCEL</button>
                    <button onClick={() => exportTable.toCSV(tableData, title, exportColumns)} className="bg-slate-600 hover:bg-slate-500 text-white text-[9px] font-black px-2 py-1 rounded shadow transition">CSV</button>
                    <button onClick={() => exportTable.toPDF(tableData, title, exportColumns, title.toUpperCase())} className="bg-red-600 hover:bg-red-500 text-white text-[9px] font-black px-2 py-1 rounded shadow transition">PDF</button>
                </div>
            </div>
            <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="text-left text-[9px] border-collapse relative" style={{ tableLayout: 'fixed', width: '100%', minWidth: showDiasAss ? '1800px' : '1700px' }}>
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                        <tr className="text-slate-600 uppercase font-black tracking-tighter align-top">
                            <DateFilterHeader widthClass="w-[6%]" label="DIA" field="dia" current={sortConfig} onSort={handleSort} dateFilters={dateFilters} setDateFilters={setDateFilters} />
                            <TextHeader widthClass="w-[7%]" label="CONTRATO" field="contrato" current={sortConfig} onSort={handleSort} searchVal={searchContrato} onSearchChange={setSearchContrato} />
                            <TextHeader widthClass="w-[6%]" label="SITUAÇÃO" field="situacao" current={sortConfig} onSort={handleSort} searchVal={searchSituacao} onSearchChange={setSearchSituacao} />
                            <TextHeader widthClass="w-[6%]" label="MOVIMENTO" field="movimentoStr" current={sortConfig} onSort={handleSort} searchVal={searchMovimento} onSearchChange={setSearchMovimento} />
                            {showDiasAss && <NumericHeader widthClass="w-[5%]" label="DIAS ASS (RO)" field="diasAss" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                            <DateFilterHeader widthClass="w-[6%]" label="VIGÊNCIA" field="data_inic" current={sortConfig} onSort={handleSort} dateFilters={dateFilters} setDateFilters={setDateFilters} align="center" />
                            <NumericHeader widthClass="w-[7%]" label="% TEMPO" field="perc_tempo" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />
                            <TextHeader widthClass="w-[6%]" label="EMITENTE" field="ug" current={sortConfig} onSort={handleSort} searchVal={searchEmitente} onSearchChange={setSearchEmitente} />
                            <TextHeader widthClass="w-[12%]" label="FAVORECIDO" field="favorecido" current={sortConfig} onSort={handleSort} searchVal={searchUgNome} onSearchChange={setSearchUgNome} />
                            <TextHeader widthClass="w-[8%]" label="EMPENHO" field="empenho" current={sortConfig} onSort={handleSort} searchVal={searchEmpenho} onSearchChange={setSearchEmpenho} />
                            <TextHeader widthClass="w-[8%]" label="DOCUMENTO" field="documento" current={sortConfig} onSort={handleSort} searchVal={searchDocumento} onSearchChange={setSearchDocumento} />
                            <TextHeader widthClass="w-[15%]" label="OBS" field="obs" current={sortConfig} onSort={handleSort} searchVal={searchObs} onSearchChange={setSearchObs} />
                            <NumericHeader widthClass="w-[10%]" label={metricLabel} field={metricField} current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tableData.slice(0, limit).map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="p-2 text-slate-500 font-bold whitespace-normal break-words">{row.dia || "-"}</td>
                                <td className="p-2 text-slate-800 font-black whitespace-normal break-words">{row.contrato}</td>
                                <td className="p-2 align-middle text-center">
                                    <div className="flex flex-wrap items-center justify-center gap-1">
                                        {row.situacaoFlags && row.situacaoFlags.map((f, idx) => (
                                            <span key={idx} className={`text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${f.color}`}>{f.label}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-2 align-middle text-center">
                                    <div className="flex flex-wrap items-center justify-center gap-1">
                                        {row.movimentoFlags && row.movimentoFlags.map((f, idx) => (
                                            <span key={idx} className={`text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${f.color}`}>{f.label}</span>
                                        ))}
                                    </div>
                                </td>
                                {showDiasAss && (
                                    <td className="p-2 align-middle text-center font-bold text-slate-600">
                                        {row.diasAss !== null ? (
                                            <span className={`px-1.5 py-0.5 rounded ${row.diasAss >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                {row.diasAss} d
                                            </span>
                                        ) : "-"}
                                    </td>
                                )}
                                <td className="p-2 text-slate-500 font-bold whitespace-normal break-words text-center">
                                    <div className="text-[9px] text-slate-400">Iní: {row.data_inic || "-"}</div>
                                    <div className="text-[9px] mt-1 text-slate-600">Fim: {row.data_fim || "-"}</div>
                                </td>
                                <td className="p-2 align-middle">
                                    {row.perc_tempo !== null ? (
                                        <div className="flex flex-col gap-1">
                                            <div className="text-[8px] font-bold text-slate-500 text-center">{row.dias_passaram} d decorridos</div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-full bg-slate-200 rounded-full h-1.5 flex-1 overflow-hidden">
                                                    <div className={`h-1.5 rounded-full ${row.perc_tempo >= 1 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(Math.max(row.perc_tempo * 100, 0), 100)}%` }}></div>
                                                </div>
                                                <span className="text-[8px] font-bold text-slate-600 min-w-[30px] text-right">{formatPercentBR(row.perc_tempo)}</span>
                                            </div>
                                            <div className="text-[8px] font-bold text-center mt-0.5"><span className={row.encerrando_dias < 0 ? 'text-red-500' : 'text-emerald-600'}>{row.encerrando_dias} d restantes</span></div>
                                        </div>
                                    ) : "-"}
                                </td>
                                <td className="p-2 font-bold text-slate-700 whitespace-normal break-words">{row.ug}</td>
                                <td className="p-2 text-slate-600 font-bold whitespace-normal break-words leading-tight">{row.favorecido}</td>
                                <td className="p-2 text-slate-600 font-bold whitespace-normal break-words">{row.empenho}</td>
                                <td className="p-2 text-slate-600 font-bold whitespace-normal break-words">{row.documento}</td>
                                <td className="p-2 text-slate-500 whitespace-normal break-words leading-tight">{row.obs}</td>
                                <td className={`p-2 text-right font-black whitespace-normal break-words ${textColor} ${rowBgColor}`}>
                                    <FormatNegativeValue val={row[metricField]} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-200 sticky bottom-0 border-t-2 border-slate-300 shadow-md z-10">
                        <tr className="text-slate-700 uppercase font-black">
                            <td colSpan={showDiasAss ? 13 : 12} className="p-2 text-right">TOTAL DA MÉTRICA:</td>
                            <td className={`p-2 text-right ${textColor}`}><FormatNegativeValue val={totalMetric} /></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {limit < tableData.length && (
                <div className="p-2 bg-slate-50 border-t flex justify-center">
                    <button onClick={() => setLimit(prev => prev + 100)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[10px] px-4 py-1 rounded transition">Ver mais (+100)</button>
                </div>
            )}
        </div>
    );
}

function Dashboard() {
    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("A processar conexão...");
    const [sortConfig, setSortConfig] = useState({ key: 'diaVal', direction: 'desc' });
    const currentUser = localStorage.getItem('user_Contabil') || 'Usuário';

    const [top20Sort, setTop20Sort] = useState('emp_desc');
    const [top20ViewMode, setTop20ViewMode] = useState('favorecido');
    const [top20100Sort, setTop20100Sort] = useState('emp_desc');
    const [top20100ViewMode, setTop20100ViewMode] = useState('favorecido');

    const [fSituacaoTags, setFSituacaoTags] = useState([]);
    const [fExistencia, setFExistencia] = useState([]);
    const [fMovimento, setFMovimento] = useState([]);
    const [fUg, setFUg] = useState([]);
    const [fFavorecido, setFFavorecido] = useState([]);
    const [fEmpenho, setFEmpenho] = useState([]);
    const [fDocumento, setFDocumento] = useState([]);
    const [fContrato, setFContrato] = useState([]);
    const [fFiscal, setFFiscal] = useState([]);
    const [fGestor, setFGestor] = useState([]);
    const [fFiscalSub, setFFiscalSub] = useState([]);
    const [fGestorSub, setFGestorSub] = useState([]);
    const [fSecLog, setFSecLog] = useState(cSupItemsList);
    const [fCompra, setFCompra] = useState([]);
    const [fModalidade, setFModalidade] = useState([]);

    const [dDiaDe, setDDiaDe] = useState("");
    const [dDiaAte, setDDiaAte] = useState("");
    const [dInicDe, setDInicDe] = useState("");
    const [dInicAte, setDInicAte] = useState("");
    const [dFimDe, setDFimDe] = useState(getTodayStr());
    const [dFimAte, setDFimAte] = useState("");

    const [searchContratoTabela, setSearchContratoTabela] = useState("");
    const [searchSituacaoTabela, setSearchSituacaoTabela] = useState("");
    const [searchExistenciaTabela, setSearchExistenciaTabela] = useState("");
    const [searchMovimentoTabela, setSearchMovimentoTabela] = useState("");
    const [searchEmitenteTabela, setSearchEmitenteTabela] = useState("");
    const [searchUgNome, setSearchUgNome] = useState(""); 
    const [searchEmpenho, setSearchEmpenho] = useState("");
    const [searchDocumento, setSearchDocumento] = useState("");
    const [searchObs, setSearchObs] = useState("");
    const [searchObjeto, setSearchObjeto] = useState("");
    const [searchGestorTabela, setSearchGestorTabela] = useState("");
    const [searchModalidadeTabela, setSearchModalidadeTabela] = useState("");
    const [searchSecLogTabela, setSearchSecLogTabela] = useState("");

    const [fOnlyBloqueado, setFOnlyBloqueado] = useState(false);
    const [fOnlyCancelado, setFOnlyCancelado] = useState(false);
    const [visibleRows, setVisibleRows] = useState(100);
    
    const [areaAggLevel, setAreaAggLevel] = useState('mes');
    const [barAggLevel, setBarAggLevel] = useState('mes');

    const [matrixGroupBy, setMatrixGroupBy] = useState('contrato_empenho');
    const [matrixSort, setMatrixSort] = useState({ key: 'sortVal', direction: 'asc' });

    const initialNumFilters = {
        v_empenhado: {min:'', max:''}, v_recebido: {min:'', max:''}, 
        v_liquidado: {min:'', max:''}, v_pago: {min:'', max:''},
        v_cancelado: {min:'', max:''}, v_bloqueado: {min:'', max:''},
        perc_tempo: {min:'', max:''}, diasAss: {min:'', max:''}
    };
    const [numFilters, setNumFilters] = useState(initialNumFilters);
    const [dateFilters, setDateFilters] = useState({ dia: {min:'', max:''}, data_inic: {min:'', max:''}, data_fim: {min:'', max:''} });

    const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
    const handleMatrixSort = (key) => setMatrixSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

    const toggleSituacaoTag = (lbl) => { setFSituacaoTags(prev => prev.includes(lbl) ? prev.filter(x => x !== lbl) : [...prev, lbl]); };
    const toggleExistencia = (val) => { setFExistencia(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]); };
    const toggleMovimento = (val) => { setFMovimento(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]); };

    const isCSupActive = fSecLog.length === 4 && cSupItemsList.every(i => fSecLog.includes(i));
    const toggleCSup = () => { if (isCSupActive) setFSecLog([]); else setFSecLog(cSupItemsList); };

    const todayD = new Date();
    const ts = `${todayD.getFullYear()}-${String(todayD.getMonth()+1).padStart(2,'0')}-${String(todayD.getDate()).padStart(2,'0')}`;
    
    const p7Doc = new Date(); p7Doc.setDate(todayD.getDate() - 7);
    const ps7Doc = `${p7Doc.getFullYear()}-${String(p7Doc.getMonth()+1).padStart(2,'0')}-${String(p7Doc.getDate()).padStart(2,'0')}`;
    
    const p30Doc = new Date(); p30Doc.setDate(todayD.getDate() - 30);
    const ps30Doc = `${p30Doc.getFullYear()}-${String(p30Doc.getMonth()+1).padStart(2,'0')}-${String(p30Doc.getDate()).padStart(2,'0')}`;

    const isDoc7DiasActive = dDiaDe === ps7Doc && dDiaAte === ts;
    const isDoc30DiasActive = dDiaDe === ps30Doc && dDiaAte === ts;

    const isContratosVigentesActive = dFimDe === ts && dFimAte === "";
    const isContr7DiasActive = dFimDe === ps7Doc && dFimAte === ts;
    const isContr30DiasActive = dFimDe === ps30Doc && dFimAte === ts;

    const toggleDoc7Dias = () => { if (isDoc7DiasActive) { setDDiaDe(""); setDDiaAte(""); } else { setDDiaDe(ps7Doc); setDDiaAte(ts); } };
    const toggleDoc30Dias = () => { if (isDoc30DiasActive) { setDDiaDe(""); setDDiaAte(""); } else { setDDiaDe(ps30Doc); setDDiaAte(ts); } };
    const toggleContratosVigentes = () => { if (isContratosVigentesActive) { setDFimDe(""); setDFimAte(""); } else { setDFimDe(ts); setDFimAte(""); } };
    const toggleContr7Dias = () => { if (isContr7DiasActive) { setDFimDe(""); setDFimAte(""); } else { setDFimDe(ps7Doc); setDFimAte(ts); } };
    const toggleContr30Dias = () => { if (isContr30DiasActive) { setDFimDe(""); setDFimAte(""); } else { setDFimDe(ps30Doc); setDFimAte(ts); } };

    useEffect(() => { setVisibleRows(100); }, [fExistencia, fMovimento, fUg, fFavorecido, fEmpenho, fDocumento, fContrato, fFiscal, fGestor, fFiscalSub, fGestorSub, fSecLog, fCompra, fModalidade, dDiaDe, dDiaAte, dInicDe, dInicAte, dFimDe, dFimAte, fSituacaoTags, searchContratoTabela, searchSituacaoTabela, searchExistenciaTabela, searchMovimentoTabela, searchEmitenteTabela, searchUgNome, searchEmpenho, searchDocumento, searchObs, searchObjeto, searchGestorTabela, searchModalidadeTabela, searchSecLogTabela, numFilters, dateFilters, sortConfig]);

    const clearAllFilters = () => {
        setFUg([]); setFFavorecido([]); setFEmpenho([]); setFDocumento([]); setFContrato([]);
        setFFiscal([]); setFGestor([]); setFFiscalSub([]); setFGestorSub([]); setFSecLog([]); setFCompra([]); setFModalidade([]);
        setFSituacaoTags([]); setFExistencia([]); setFMovimento([]);
        setDDiaDe(""); setDDiaAte(""); setDInicDe(""); setDInicAte(""); setDFimDe(""); setDFimAte("");
        setSearchContratoTabela(""); setSearchSituacaoTabela(""); setSearchExistenciaTabela(""); setSearchMovimentoTabela(""); setSearchEmitenteTabela(""); setSearchUgNome(""); setSearchEmpenho(""); setSearchDocumento(""); setSearchObs(""); setSearchObjeto(""); setSearchGestorTabela(""); setSearchModalidadeTabela(""); setSearchSecLogTabela("");
        setNumFilters(initialNumFilters);
        setDateFilters({ dia: {min:'', max:''}, data_inic: {min:'', max:''}, data_fim: {min:'', max:''} });
        setFOnlyBloqueado(false); setFOnlyCancelado(false);
    };

    const maxDateInfo = useMemo(() => {
        if (!rawData || rawData.length === 0) return { val: null, str: "", iso: "" };
        let maxVal = -1; let maxStr = ""; let maxIso = "";
        rawData.forEach(item => {
            if (item.diaVal > maxVal) {
                maxVal = item.diaVal; maxStr = item.dia; 
                const d = new Date(item.diaVal);
                maxIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        });
        return { val: maxVal, str: maxStr, iso: maxIso };
    }, [rawData]);

    const applyFilterUltimoDia = () => { if (maxDateInfo.iso) { setDDiaDe(maxDateInfo.iso); setDDiaAte(maxDateInfo.iso); } };
    const logout = () => { try { localStorage.removeItem('isAuth_Contabil'); localStorage.removeItem('user_Contabil'); } catch(e){} window.location.reload(); };

    const processMergedData = (contabilRows, geralRows = []) => {
        if (!contabilRows || contabilRows.length < 2) { setStatus("Planilha Contábil vazia ou sem dados válidos."); setLoading(false); return; }
        setStatus("A estruturar matriz de relacionamento de dados...");
        const hoje = new Date(); hoje.setHours(0,0,0,0);

        const geralDict = {};
        if (geralRows && geralRows.length > 1) {
            const hGeral = geralRows[0];
            const mapG = {}; hGeral.forEach((h, i) => { if(h) mapG[normalizeStr(h)] = i; });
            const getVG = (names, kws, row) => {
                for (let name of names) { let n = normalizeStr(name); if (mapG[n] !== undefined) { let v = row[mapG[n]]; return (v !== undefined && v !== null) ? v.toString().trim() : ""; } }
                for (let kw of kws) { let nKw = normalizeStr(kw); let foundKey = Object.keys(mapG).find(k => k.includes(nKw)); if (foundKey) { let v = row[mapG[foundKey]]; return (v !== undefined && v !== null) ? v.toString().trim() : ""; } }
                return "";
            };

            for(let i=1; i<geralRows.length; i++) {
                const row = geralRows[i];
                if(!row || !row.length) continue;
                const contrato = getVG(["Número Contrato", "numero_contrato"], ["contrato"], row).toUpperCase();
                if(!contrato || contrato === "-") continue;
                
                const v_empenhado_g = parseValue(getVG(["TOTAL EMPENHADO"], [], row));
                const v_liquidado_g = parseValue(getVG(["TOTAL LIQUIDADO"], [], row));
                const v_pago_g = parseValue(getVG(["TOTAL PAGO"], [], row));
                const v_executado_g = parseValue(getVG(["TOTAL EXECUTADO"], [], row));
                const v_bloqueado_g = parseValue(getVG(["TOTAL BLOQUEADO"], [], row));
                const v_cancelado_g = parseValue(getVG(["TOTAL CANCELADO"], [], row));

                const dtInicParsed = parseDateBR(getVG(["Vig. Início", "Vigencia Inicio"], [], row));
                const dtFimParsed = parseDateBR(getVG(["Vig. Fim", "Vigencia Fim"], [], row));

                let diasRestantes = null, diasPassaram = null, percTempo = null;
                if (dtFimParsed) diasRestantes = Math.ceil((dtFimParsed - hoje) / 86400000);
                if (dtInicParsed) diasPassaram = Math.ceil((hoje - dtInicParsed) / 86400000);
                if (dtInicParsed && dtFimParsed) {
                    const totalDias = Math.ceil((dtFimParsed - dtInicParsed) / 86400000);
                    percTempo = totalDias > 0 ? diasPassaram / totalDias : 0;
                }

                let flags = []; let sitText = "";
                if (v_cancelado_g > 0) { flags.push({ label: 'CAN', color: tagColorsMap['CAN'].css, hex: tagColorsMap['CAN'].hex }); sitText += "CAN "; }
                if (v_bloqueado_g > 0) { flags.push({ label: 'BLOQ', color: tagColorsMap['BLOQ'].css, hex: tagColorsMap['BLOQ'].hex }); sitText += "BLOQ "; }

                if (diasRestantes !== null) {
                    const isAtivo = diasRestantes >= 0;
                    const isLiquidadoZero = v_liquidado_g <= 0.01;
                    const isPagoZero = v_pago_g <= 0.01;
                    const isPagoIgualEmpenhado = v_pago_g >= (v_empenhado_g - 0.01) && v_empenhado_g > 0;
                    const isExecutadoIgualEmpenhado = v_executado_g >= (v_empenhado_g - 0.01) && v_empenhado_g > 0;
                    const isPagoMenorEmpenhado = v_pago_g < (v_empenhado_g - 0.01);
                    const isExecutadoMenorEmpenhado = v_executado_g < (v_empenhado_g - 0.01);

                    let tagKey = null;
                    if (isAtivo) {
                        if (isLiquidadoZero) tagKey = 'ATIVO INEXEC';
                        else if (isExecutadoMenorEmpenhado) tagKey = 'ATIVO EM EXEC';
                        else if (isPagoIgualEmpenhado) tagKey = 'ATIVO EXEC TOT';
                        else if (isPagoMenorEmpenhado && isExecutadoIgualEmpenhado) tagKey = 'ATIVO EXEC PARC';
                    } else {
                        if (isPagoZero) tagKey = 'VENC INEXEC TOT';
                        else if (isPagoIgualEmpenhado) tagKey = 'VENC EXEC TOT';
                        else if (isPagoMenorEmpenhado && isExecutadoIgualEmpenhado) tagKey = 'VENC EXEC PARC';
                    }
                    if(tagKey) { flags.push({ label: tagKey, color: tagColorsMap[tagKey].css, hex: tagColorsMap[tagKey].hex }); sitText += `${tagKey} `; }
                }

                geralDict[contrato] = {
                    fornecedor: getVG(["Fornecedor"], [], row).toUpperCase() || "N/I",
                    fiscal: getVG(["FISCAL_TITULAR", "Fiscal Titular"], ["fiscal"], row).toUpperCase() || "N/I",
                    gestor: getVG(["GESTOR_TITULAR", "Gestor Titular"], ["gestor"], row).toUpperCase() || "N/I",
                    fiscal_sub: getVG(["FISCAL_SUBSTITUTO", "Fiscal Substituto"], ["fiscal sub"], row).toUpperCase() || "N/I",
                    gestor_sub: getVG(["GESTOR_SUBSTITUTO", "Gestor Substituto"], ["gestor sub"], row).toUpperCase() || "N/I",
                    sec_log: getVG(["SEC_LOG"], ["sec log"], row).toUpperCase() || "N/I",
                    modalidade: getVG(["Modalidade da Compra", "Modalidade"], ["modalidade"], row).toUpperCase() || "N/I",
                    compra: getVG(["Número da Compra", "Numero da Compra", "Número Compra", "Numero Compra"], ["compra"], row).toUpperCase() || "N/I",
                    objeto: getVG(["Objeto"], [], row).toUpperCase() || "-",
                    data_inic: getVG(["Vig. Início", "Vigencia Inicio"], [], row),
                    data_fim: getVG(["Vig. Fim", "Vigencia Fim"], [], row),
                    dtInicVal: dtInicParsed ? dtInicParsed.getTime() : null,
                    dtFimVal: dtFimParsed ? dtFimParsed.getTime() : null,
                    dias_passaram: diasPassaram,
                    perc_tempo: percTempo,
                    encerrando_dias: diasRestantes,
                    situacaoFlags: flags,
                    situacao: sitText.trim() || 'N/I'
                };
            }
        }

        const headersContabil = contabilRows[0];
        const hMapC = {}; headersContabil.forEach((h, i) => { if(h) hMapC[normalizeStr(h)] = i; });
        const getVC = (exactNames, fallbackKeywords, row) => {
            for (let name of exactNames) { let n = normalizeStr(name); if (hMapC[n] !== undefined) { let v = row[hMapC[n]]; return (v !== undefined && v !== null) ? v.toString().trim() : ""; } }
            for (let kw of fallbackKeywords) { let nKw = normalizeStr(kw); let foundKey = Object.keys(hMapC).find(k => k.includes(nKw)); if (foundKey) { let v = row[hMapC[foundKey]]; return (v !== undefined && v !== null) ? v.toString().trim() : ""; } }
            return "";
        };

        const grouped = {};
        const contratosEncontrados = new Set();
        const minRoDict = {};

        for (let i = 1; i < contabilRows.length; i++) {
            const row = contabilRows[i];
            if (!row || row.length === 0) continue;
            
            const dia = getVC(["Emissão - Dia Data Completa", "Emissao"], ["emissao", "dia", "data"], row);
            const ug = getVC(["Emitente - UG Código", "UG Codigo"], ["ug codigo", "emitente"], row).toUpperCase();
            const fav = getVC(["Favorecido Doc. Nome", "Favorecido"], ["favorecido", "doc. nome"], row).toUpperCase();
            const empenho = getVC(["Documento CCor Número"], ["ccor", "empenho"], row).toUpperCase();
            const doc = getVC(["Documento Número"], ["documento numero", "doc numero"], row).toUpperCase();
            const obs = getVC(["Doc - Observação Texto", "Observação"], ["observacao", "obs"], row).toUpperCase();
            const contrato = getVC(["COL_NR_CONTR_BASE", "Contrato"], ["contr_base", "contrato"], row).toUpperCase();
            if (contrato && contrato !== "-") contratosEncontrados.add(contrato);
            
            let info = getVC(["ITEM_INFORMACAO", "INTEN_INFORMACAO", "Informacao"], ["informacao", "item_in", "inten_in"], row).toUpperCase();
            let valStr = getVC(["Valor Item (R$)", "Valor (R$)", "Valor"], ["valor", "vlr", "r$", "montante", "saldo"], row);
            
            if (!info) {
                const rowStr = row.join(" ").toUpperCase();
                if (rowStr.includes("EMPENHADO")) info = "EMPENHADO";
                else if (rowStr.includes("RECEBIDO")) info = "RECEBIDO";
                else if (rowStr.includes("LIQUIDADO")) info = "LIQUIDADO";
                else if (rowStr.includes("PAGO")) info = "PAGO";
                else if (rowStr.includes("CANCELADO")) info = "CANCELADO";
                else if (rowStr.includes("BLOQUEADO")) info = "BLOQUEADO";
            }

            if (!valStr && row.length > 0) { for(let c = row.length - 1; c >= 0; c--) { let t = parseValue(row[c]); if (t !== 0) { valStr = row[c]; break; } } }

            const valor = parseValue(valStr);
            const diaVal = parseDateBR(dia) ? parseDateBR(dia).getTime() : 0;
            const key = `${dia}|${ug}|${fav}|${empenho}|${doc}|${contrato}`;

            if (doc.includes("RO") && diaVal > 0 && contrato !== "-") {
                const keyRE = `${contrato}|${empenho}`;
                if (!minRoDict[keyRE] || diaVal < minRoDict[keyRE]) minRoDict[keyRE] = diaVal;
            }

            if (!grouped[key]) {
                const metadadosContrato = geralDict[contrato];
                
                grouped[key] = {
                    dia, diaVal,
                    ug, favorecido: fav, empenho, documento: doc, obs, contrato,
                    fiscal: metadadosContrato ? metadadosContrato.fiscal : 'N/I', 
                    gestor: metadadosContrato ? metadadosContrato.gestor : 'N/I', 
                    fiscal_sub: metadadosContrato ? metadadosContrato.fiscal_sub : 'N/I', 
                    gestor_sub: metadadosContrato ? metadadosContrato.gestor_sub : 'N/I',
                    sec_log: metadadosContrato ? metadadosContrato.sec_log : 'N/I', 
                    modalidade: metadadosContrato ? metadadosContrato.modalidade : 'N/I', 
                    compra: metadadosContrato ? metadadosContrato.compra : 'N/I',
                    situacaoFlags: metadadosContrato ? metadadosContrato.situacaoFlags : [], 
                    situacao: metadadosContrato ? metadadosContrato.situacao : 'N/I',
                    existencia: metadadosContrato ? 'AMBAS' : 'CONTÁBIL',
                    data_inic: metadadosContrato ? metadadosContrato.data_inic : null, 
                    data_fim: metadadosContrato ? metadadosContrato.data_fim : null,
                    dtInicVal: metadadosContrato ? metadadosContrato.dtInicVal : null, 
                    dtFimVal: metadadosContrato ? metadadosContrato.dtFimVal : null,
                    dias_passaram: metadadosContrato ? metadadosContrato.dias_passaram : null, 
                    perc_tempo: metadadosContrato ? metadadosContrato.perc_tempo : null,
                    encerrando_dias: metadadosContrato ? metadadosContrato.encerrando_dias : null, 
                    objeto: metadadosContrato ? metadadosContrato.objeto : '-',
                    diasAss: null, 
                    v_empenhado: 0, v_recebido: 0, v_liquidado: 0, v_pago: 0, v_cancelado: 0, v_bloqueado: 0,
                    has_empenhado: false, has_recebido: false, has_liquidado: false, has_pago: false, has_cancelado: false, has_bloqueado: false,
                    movimentoFlags: [], movimentoStr: ""
                };
            }

            if (info.includes("EMPENHADO")) { grouped[key].v_empenhado += valor; grouped[key].has_empenhado = true; }
            else if (info.includes("RECEBIDO")) { grouped[key].v_recebido += valor; grouped[key].has_recebido = true; }
            else if (info.includes("LIQUIDADO")) { grouped[key].v_liquidado += valor; grouped[key].has_liquidado = true; }
            else if (info.includes("PAGO")) { grouped[key].v_pago += valor; grouped[key].has_pago = true; }
            else if (info.includes("CANCELADO")) { grouped[key].v_cancelado += valor; grouped[key].has_cancelado = true; }
            else if (info.includes("BLOQUEADO")) { grouped[key].v_bloqueado += valor; grouped[key].has_bloqueado = true; }
        }

        Object.keys(geralDict).forEach(contratoGeral => {
            if (!contratosEncontrados.has(contratoGeral)) {
                const meta = geralDict[contratoGeral];
                grouped[`DUMMY|${contratoGeral}`] = {
                    dia: "-", diaVal: 0,
                    ug: "-", favorecido: meta.fornecedor, empenho: "-", documento: "-", obs: "SEM LANÇAMENTOS CONTÁBEIS", contrato: contratoGeral,
                    fiscal: meta.fiscal, gestor: meta.gestor, fiscal_sub: meta.fiscal_sub, gestor_sub: meta.gestor_sub,
                    sec_log: meta.sec_log, modalidade: meta.modalidade, compra: meta.compra, objeto: meta.objeto,
                    situacaoFlags: meta.situacaoFlags, situacao: meta.situacao,
                    existencia: 'GERAL',
                    data_inic: meta.data_inic, data_fim: meta.data_fim, dtInicVal: meta.dtInicVal, dtFimVal: meta.dtFimVal,
                    dias_passaram: meta.dias_passaram, perc_tempo: meta.perc_tempo, encerrando_dias: meta.encerrando_dias,
                    diasAss: null, 
                    v_empenhado: 0, v_recebido: 0, v_liquidado: 0, v_pago: 0, v_cancelado: 0, v_bloqueado: 0,
                    has_empenhado: false, has_recebido: false, has_liquidado: false, has_pago: false, has_cancelado: false, has_bloqueado: false,
                    movimentoFlags: [], movimentoStr: ""
                };
            }
        });

        Object.values(grouped).forEach(g => {
            if (g.existencia !== 'GERAL' && g.contrato !== '-' && g.empenho !== '-') {
                const minRo = minRoDict[`${g.contrato}|${g.empenho}`];
                if (minRo && g.dtInicVal) { g.diasAss = Math.floor((g.dtInicVal - minRo) / 86400000); } 
                else { g.diasAss = null; }
            } else {
                g.diasAss = null;
            }

            let movStr = "";
            if (g.has_empenhado) { g.movimentoFlags.push({label:'EMP', color:'bg-blue-100 text-blue-800 border border-blue-200'}); movStr += "EMP "; }
            if (g.has_recebido) { g.movimentoFlags.push({label:'RCB', color:'bg-violet-100 text-violet-800 border border-violet-200'}); movStr += "RCB "; }
            if (g.has_liquidado) { g.movimentoFlags.push({label:'LIQ', color:'bg-amber-100 text-amber-800 border border-amber-200'}); movStr += "LIQ "; }
            if (g.has_pago) { g.movimentoFlags.push({label:'PAG', color:'bg-emerald-100 text-emerald-800 border border-emerald-200'}); movStr += "PAG "; }
            if (g.has_bloqueado) { g.movimentoFlags.push({label:'BLOQ', color:'bg-orange-100 text-orange-800 border border-orange-200'}); movStr += "BLOQ "; }
            if (g.has_cancelado) { g.movimentoFlags.push({label:'CAN', color:'bg-red-100 text-red-800 border border-red-200'}); movStr += "CAN "; }
            g.movimentoStr = movStr.trim();
        });
        
        setRawData(Object.values(grouped));
        setLoading(false);
    };

    const loadData = async (manualFileContent = null) => {
        setLoading(true);
        if (manualFileContent) {
            setStatus("A processar ficheiro manual (Módulo Contábil)...");
            Papa.parse(manualFileContent, { header: false, skipEmptyLines: true, complete: (res) => { processMergedData(res.data, []); setStatus("Offline - Dados Carregados Manualmente"); } });
            return;
        }
        try {
            setStatus("A transferir dados de Múltiplas APIs...");
            const [respContabil, respGeral] = await Promise.all([
                fetch(API_URL_CONTABIL),
                fetch(API_URL_GERAL).catch(() => null) 
            ]);
            if (!respContabil.ok) throw new Error("Falha na API Contábil.");
            const jsonContabil = await respContabil.json();
            const jsonGeral = respGeral && respGeral.ok ? await respGeral.json() : { values: [] };

            processMergedData(jsonContabil.values, jsonGeral.values);
            setStatus("Online - APIs Integradas com Sucesso");
        } catch (error) { 
            setStatus("Falha de Comunicação. Utilize a Carga Manual (CSV)."); 
            setLoading(false); 
        }
    };

    useEffect(() => { loadData(); }, []);

    const filteredData = useMemo(() => {
        let filtered = rawData.filter(item => {
            const matchExistencia = fExistencia.length === 0 || fExistencia.includes(item.existencia);
            const matchUg = fUg.length === 0 || fUg.includes(item.ug);
            const matchFav = fFavorecido.length === 0 || fFavorecido.includes(item.favorecido);
            const matchEmpenho = fEmpenho.length === 0 || fEmpenho.includes(item.empenho);
            const matchDoc = fDocumento.length === 0 || fDocumento.includes(item.documento);
            const matchContrato = fContrato.length === 0 || fContrato.includes(item.contrato);
            
            const matchFiscal = fFiscal.length === 0 || fFiscal.includes(item.fiscal);
            const matchGestor = fGestor.length === 0 || fGestor.includes(item.gestor);
            const matchFiscalSub = fFiscalSub.length === 0 || fFiscalSub.includes(item.fiscal_sub);
            const matchGestorSub = fGestorSub.length === 0 || fGestorSub.includes(item.gestor_sub);
            const matchSecLog = fSecLog.length === 0 || fSecLog.includes(item.sec_log);
            const matchCompra = fCompra.length === 0 || fCompra.includes(item.compra);
            const matchModalidade = fModalidade.length === 0 || fModalidade.includes(item.modalidade);

            const matchDiaDe = !dDiaDe || (item.diaVal !== 0 && item.diaVal >= new Date(dDiaDe+"T00:00:00").getTime());
            const matchDiaAte = !dDiaAte || (item.diaVal !== 0 && item.diaVal <= new Date(dDiaAte+"T23:59:59").getTime());
            
            const matchInicDe = !dInicDe || (item.dtInicVal && item.dtInicVal >= new Date(dInicDe+"T00:00:00").getTime());
            const matchInicAte = !dInicAte || (item.dtInicVal && item.dtInicVal <= new Date(dInicAte+"T23:59:59").getTime());
            const matchFDe = !dFimDe || (item.dtFimVal && item.dtFimVal >= new Date(dFimDe+"T00:00:00").getTime());
            const matchFAte = !dFimAte || (item.dtFimVal && item.dtFimVal <= new Date(dFimAte+"T23:59:59").getTime());

            const matchSitTag = fSituacaoTags.length === 0 || (item.situacaoFlags && item.situacaoFlags.some(f => fSituacaoTags.includes(f.label)));

            const matchMovimentoTag = fMovimento.length === 0 || fMovimento.some(m => {
                if (m === 'EMP') return item.has_empenhado;
                if (m === 'RCB') return item.has_recebido;
                if (m === 'LIQ') return item.has_liquidado;
                if (m === 'PAG') return item.has_pago;
                if (m === 'BLOQ') return item.has_bloqueado;
                if (m === 'CAN') return item.has_cancelado;
                return false;
            });

            const searchContratoTabelaMatch = !searchContratoTabela || item.contrato.includes(searchContratoTabela.toUpperCase());
            const searchSituacaoMatch = !searchSituacaoTabela || item.situacao.includes(searchSituacaoTabela.toUpperCase());
            const searchExistenciaMatch = !searchExistenciaTabela || item.existencia.includes(searchExistenciaTabela.toUpperCase());
            const searchMovimentoMatch = !searchMovimentoTabela || item.movimentoStr.includes(searchMovimentoTabela.toUpperCase());
            const searchEmitenteMatch = !searchEmitenteTabela || item.ug.includes(searchEmitenteTabela.toUpperCase());
            const searchUgNomeMatch = !searchUgNome || item.favorecido.includes(searchUgNome.toUpperCase());
            const searchEmpenhoMatch = !searchEmpenho || item.empenho.includes(searchEmpenho.toUpperCase());
            const searchDocumentoMatch = !searchDocumento || item.documento.includes(searchDocumento.toUpperCase());
            const searchObsMatch = !searchObs || item.obs.includes(searchObs.toUpperCase());
            const searchObjetoMatch = !searchObjeto || item.objeto.includes(searchObjeto.toUpperCase());
            const searchGestorTMatch = !searchGestorTabela || item.gestor.includes(searchGestorTabela.toUpperCase()) || item.fiscal.includes(searchGestorTabela.toUpperCase());
            const searchModalidadeMatch = !searchModalidadeTabela || item.modalidade.includes(searchModalidadeTabela.toUpperCase()) || item.compra.includes(searchModalidadeTabela.toUpperCase());
            const searchSecLogMatch = !searchSecLogTabela || item.sec_log.includes(searchSecLogTabela.toUpperCase());

            let matchNum = true;
            for (const key in numFilters) {
                if (numFilters[key] && (numFilters[key].min !== '' || numFilters[key].max !== '')) {
                    let val = item[key];
                    if (val === null || val === undefined) { matchNum = false; break; }
                    if (key.startsWith('p_')) val = val * 100;
                    if (numFilters[key].min !== '' && val < parseFloat(numFilters[key].min)) { matchNum = false; break; }
                    if (numFilters[key].max !== '' && val > parseFloat(numFilters[key].max)) { matchNum = false; break; }
                }
            }

            let matchDateCol = true;
            if (dateFilters.dia) {
                if (dateFilters.dia.min && item.diaVal !== 0 && item.diaVal < new Date(dateFilters.dia.min + "T00:00:00").getTime()) matchDateCol = false;
                if (dateFilters.dia.max && item.diaVal !== 0 && item.diaVal > new Date(dateFilters.dia.max + "T23:59:59").getTime()) matchDateCol = false;
            }
            if (dateFilters.data_inic) {
                if (dateFilters.data_inic.min && item.dtInicVal && item.dtInicVal < new Date(dateFilters.data_inic.min + "T00:00:00").getTime()) matchDateCol = false;
                if (dateFilters.data_inic.max && item.dtInicVal && item.dtInicVal > new Date(dateFilters.data_inic.max + "T23:59:59").getTime()) matchDateCol = false;
            }
            if (dateFilters.data_fim) {
                if (dateFilters.data_fim.min && item.dtFimVal && item.dtFimVal < new Date(dateFilters.data_fim.min + "T00:00:00").getTime()) matchDateCol = false;
                if (dateFilters.data_fim.max && item.dtFimVal && item.dtFimVal > new Date(dateFilters.data_fim.max + "T23:59:59").getTime()) matchDateCol = false;
            }

            const matchBloqueado = !fOnlyBloqueado || item.has_bloqueado;
            const matchCancelado = !fOnlyCancelado || item.has_cancelado;

            return matchExistencia && matchUg && matchFav && matchEmpenho && matchDoc && matchContrato && matchMovimentoTag &&
                   matchFiscal && matchGestor && matchFiscalSub && matchGestorSub && matchSecLog && matchCompra && matchModalidade &&
                   matchDiaDe && matchDiaAte && matchInicDe && matchInicAte && matchFDe && matchFAte && matchSitTag && 
                   searchContratoTabelaMatch && searchSituacaoMatch && searchExistenciaMatch && searchMovimentoMatch && searchEmitenteMatch && searchUgNomeMatch && searchEmpenhoMatch && 
                   searchDocumentoMatch && searchObsMatch && searchObjetoMatch && searchGestorTMatch && searchModalidadeMatch && searchSecLogMatch &&
                   matchNum && matchDateCol && matchBloqueado && matchCancelado;
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let valA = a[sortConfig.key], valB = b[sortConfig.key];
                if (sortConfig.key === 'data_inic') { valA = a.dtInicVal; valB = b.dtInicVal; }
                else if (sortConfig.key === 'data_fim') { valA = a.dtFimVal; valB = b.dtFimVal; }
                if (valA === null) valA = -Number.MAX_VALUE; if (valB === null) valB = -Number.MAX_VALUE;
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [rawData, fExistencia, fMovimento, fUg, fFavorecido, fEmpenho, fDocumento, fContrato, fFiscal, fGestor, fFiscalSub, fGestorSub, fSecLog, fCompra, fModalidade, dDiaDe, dDiaAte, dInicDe, dInicAte, dFimDe, dFimAte, fSituacaoTags, searchContratoTabela, searchSituacaoTabela, searchExistenciaTabela, searchMovimentoTabela, searchEmitenteTabela, searchUgNome, searchEmpenho, searchDocumento, searchObs, searchObjeto, searchGestorTabela, searchModalidadeTabela, searchSecLogTabela, numFilters, dateFilters, fOnlyBloqueado, fOnlyCancelado, sortConfig]);

    const totalsMaster = useMemo(() => {
        let emp = 0, rec = 0, liq = 0, pag = 0, can = 0, blo = 0;
        filteredData.forEach(r => { emp += r.v_empenhado; rec += r.v_recebido; liq += r.v_liquidado; pag += r.v_pago; can += r.v_cancelado; blo += r.v_bloqueado; });
        return { emp, rec, liq, pag, can, blo };
    }, [filteredData]);

    const countSoGeral = useMemo(() => {
        const unique = new Set();
        filteredData.forEach(d => { if(d.existencia === 'GERAL' && d.contrato !== '-') unique.add(d.contrato); });
        return unique.size;
    }, [filteredData]);

    const countSoContabil = useMemo(() => {
        const unique = new Set();
        filteredData.forEach(d => { if(d.existencia === 'CONTÁBIL' && d.contrato !== '-') unique.add(d.contrato); });
        return unique.size;
    }, [filteredData]);

    const docCounts = useMemo(() => {
        const uniqueDocs = (field) => new Set(filteredData.filter(d => d[field.replace('v_', 'has_')]).map(d => d.documento)).size;
        return { empenhado: uniqueDocs('v_empenhado'), recebido: uniqueDocs('v_recebido'), liquidado: uniqueDocs('v_liquidado'), pago: uniqueDocs('v_pago') };
    }, [filteredData]);

    const totalUniqueDocs = useMemo(() => new Set(filteredData.filter(d => d.documento && d.documento !== "-").map(d => d.documento)).size, [filteredData]);

    const docStats = useMemo(() => {
        const stats = { rone: { latestDate: null, latestVal: 0, set: new Set() }, nsnl_rec: { latestDate: null, latestVal: 0, set: new Set() }, nsnl_liq: { latestDate: null, latestVal: 0, set: new Set() }, ob: { latestDate: null, latestVal: 0, set: new Set() }, df: { latestDate: null, latestVal: 0, set: new Set() } };
        filteredData.forEach(item => {
            if (!item.documento || item.documento === "-") return;
            const doc = item.documento.toUpperCase();
            const updateStat = (target) => { target.set.add(doc); if (!target.latestVal || item.diaVal > target.latestVal) { target.latestVal = item.diaVal; target.latestDate = item.dia; } };
            if (doc.includes('RO') || doc.includes('NE')) updateStat(stats.rone);
            if (doc.includes('NS') || doc.includes('NL')) { if (item.has_recebido) updateStat(stats.nsnl_rec); if (item.has_liquidado) updateStat(stats.nsnl_liq); }
            if (doc.includes('OB')) updateStat(stats.ob);
            if (doc.includes('DF')) updateStat(stats.df);
        });
        return {
            rone: { count: stats.rone.set.size, latestDate: stats.rone.latestDate, latestVal: stats.rone.latestVal },
            nsnl_rec: { count: stats.nsnl_rec.set.size, latestDate: stats.nsnl_rec.latestDate, latestVal: stats.nsnl_rec.latestVal },
            nsnl_liq: { count: stats.nsnl_liq.set.size, latestDate: stats.nsnl_liq.latestDate, latestVal: stats.nsnl_liq.latestVal },
            ob: { count: stats.ob.set.size, latestDate: stats.ob.latestDate, latestVal: stats.ob.latestVal },
            df: { count: stats.df.set.size, latestDate: stats.df.latestDate, latestVal: stats.df.latestVal }
        };
    }, [filteredData]);

    const kpis = useMemo(() => {
        const uniqueContratos = new Set();
        let qtdAtivos = 0, qtdAtivosInexec = 0, qtdAtivosEmExec = 0, qtdAtivosExecTot = 0, qtdAtivosExecParc = 0;
        let qtdVencidos = 0, qtdVencInexecTot = 0, qtdVencidosTot = 0, qtdVencidosParc = 0;
        let qtdBloqueados = 0, qtdCancelados = 0;

        filteredData.forEach(item => {
            if (item.contrato && item.contrato.trim() !== "" && item.contrato !== "-") {
                if (!uniqueContratos.has(item.contrato.trim())) {
                    uniqueContratos.add(item.contrato.trim());
                    if (item.situacaoFlags && item.situacaoFlags.some(f => f.label === 'CAN')) qtdCancelados++;
                    if (item.situacaoFlags && item.situacaoFlags.some(f => f.label === 'BLOQ')) qtdBloqueados++;
                    
                    if (item.situacaoFlags && item.situacaoFlags.some(f => f.label.startsWith('ATIVO'))) {
                        qtdAtivos++;
                        if (item.situacaoFlags.some(f => f.label === 'ATIVO INEXEC')) qtdAtivosInexec++;
                        else if (item.situacaoFlags.some(f => f.label === 'ATIVO EM EXEC')) qtdAtivosEmExec++;
                        else if (item.situacaoFlags.some(f => f.label === 'ATIVO EXEC TOT')) qtdAtivosExecTot++;
                        else if (item.situacaoFlags.some(f => f.label === 'ATIVO EXEC PARC')) qtdAtivosExecParc++;
                    } else if (item.situacaoFlags && item.situacaoFlags.some(f => f.label.startsWith('VENC'))) {
                        qtdVencidos++;
                        if (item.situacaoFlags.some(f => f.label === 'VENC INEXEC TOT')) qtdVencInexecTot++;
                        else if (item.situacaoFlags.some(f => f.label === 'VENC EXEC TOT')) qtdVencidosTot++;
                        else if (item.situacaoFlags.some(f => f.label === 'VENC EXEC PARC')) qtdVencidosParc++;
                    }
                }
            }
        });
        return {
            qtdContratos: uniqueContratos.size,
            qtdGestores: new Set(filteredData.map(d => d.gestor)).size,
            qtdFiscais: new Set(filteredData.map(d => d.fiscal)).size,
            qtdFornecedores: new Set(filteredData.map(d => d.favorecido)).size,
            qtdAtivos, qtdAtivosInexec, qtdAtivosEmExec, qtdAtivosExecTot, qtdAtivosExecParc,
            qtdVencidos, qtdVencInexecTot, qtdVencidosTot, qtdVencidosParc, qtdBloqueados, qtdCancelados,
            totalEmpenhado: totalsMaster.emp,
            totalRecebido: totalsMaster.rec, percRecebido: totalsMaster.emp ? (totalsMaster.rec / totalsMaster.emp) : 0,
            totalLiquidado: totalsMaster.liq, percLiquidado: totalsMaster.emp ? (totalsMaster.liq / totalsMaster.emp) : 0,
            totalPago: totalsMaster.pag, percPago: totalsMaster.emp ? (totalsMaster.pag / totalsMaster.emp) : 0,
            totalCancelado: totalsMaster.can, percCancelado: totalsMaster.emp ? (totalsMaster.can / totalsMaster.emp) : 0,
            totalBloqueado: totalsMaster.blo, percBloqueado: totalsMaster.emp ? (totalsMaster.blo / totalsMaster.emp) : 0
        };
    }, [filteredData, totalsMaster]);

    const contratoAnoOrigem = useMemo(() => {
        const map = {};
        filteredData.forEach(item => {
            if (!item.diaVal || !item.contrato || item.contrato === "-") return;
            const doc = item.documento ? item.documento.toUpperCase() : "";
            if (doc.includes("NE") || doc.includes("RO")) {
                if (!map[item.contrato] || item.diaVal < map[item.contrato].minDate) {
                    map[item.contrato] = { minDate: item.diaVal, ano: new Date(item.diaVal).getFullYear() };
                }
            }
        });
        return map;
    }, [filteredData]);

    const processTop20Data = (viewMode, sortMode) => {
        const map = {};
        filteredData.forEach(item => {
            if (!item.contrato || item.contrato === "-") return;
            let key = '';
            if (viewMode === 'contrato') key = item.contrato;
            else if (viewMode === 'favorecido') key = item.favorecido;
            else if (viewMode === 'empenho') key = item.empenho;
            else if (viewMode === 'ano') { const origem = contratoAnoOrigem[item.contrato]; key = origem ? origem.ano.toString() : 'N/I'; }
            else if (viewMode === 'sec_log') key = item.sec_log;

            if (!map[key]) {
                map[key] = { label: key, contratos: new Set(), empenhado: 0, recebido: 0, liquidado: 0, pago: 0, bloqueado: 0, cancelado: 0, favorecido: item.favorecido, contrato: item.contrato };
            }
            
            map[key].contratos.add(item.contrato);
            map[key].empenhado += item.v_empenhado;
            map[key].recebido += item.v_recebido;
            map[key].liquidado += item.v_liquidado;
            map[key].pago += item.v_pago;
            map[key].bloqueado += item.v_bloqueado;
            map[key].cancelado += item.v_cancelado;
        });

        let arr = Object.values(map).map(d => ({ ...d, count: d.contratos.size }));

        if (sortMode === 'emp_desc') arr.sort((a, b) => b.empenhado - a.empenhado);
        else if (sortMode === 'rec_desc') arr.sort((a, b) => b.recebido - a.recebido);
        else if (sortMode === 'liq_desc') arr.sort((a, b) => b.liquidado - a.liquidado);
        else if (sortMode === 'pag_desc') arr.sort((a, b) => b.pago - a.pago);
        else if (sortMode === 'can_desc') arr.sort((a, b) => b.cancelado - a.cancelado);
        else if (sortMode === 'bloq_desc') arr.sort((a, b) => b.bloqueado - a.bloqueado);
        else if (sortMode === 'qtd_desc') arr.sort((a, b) => b.count - a.count);
        else if (sortMode === 'nome_asc') arr.sort((a, b) => a.label.localeCompare(b.label));
        else arr.sort((a, b) => b.empenhado - a.empenhado);

        return arr.slice(0, 20);
    };

    const top20DataProcessed = useMemo(() => processTop20Data(top20ViewMode, top20Sort), [filteredData, top20ViewMode, top20Sort, contratoAnoOrigem]);
    const top20100DataProcessed = useMemo(() => processTop20Data(top20100ViewMode, top20100Sort), [filteredData, top20100ViewMode, top20100Sort, contratoAnoOrigem]);

    const calculateAggregatedData = (aggLevel) => {
        const sortedData = [...filteredData].sort((a, b) => a.diaVal - b.diaVal);
        const buckets = {}; const keys = []; let max_val = 1;

        sortedData.forEach(item => {
            if (!item.diaVal) return;
            const d = new Date(item.diaVal);
            let key = '', label = '';
            
            if (aggLevel === 'dia') {
                key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                label = item.dia;
            } else if (aggLevel === 'mes') {
                key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                label = `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
            } else {
                key = `${d.getFullYear()}`; label = `${d.getFullYear()}`;
            }

            if (!buckets[key]) {
                buckets[key] = { label, inc_emp: 0, inc_rec: 0, inc_liq: 0, inc_pag: 0, inc_can: 0, inc_blo: 0, docs_emp: [], docs_rec: [], docs_liq: [], docs_pag: [], docs_can: [], docs_blo: [] };
                keys.push(key);
            }
            buckets[key].inc_emp += item.v_empenhado; buckets[key].inc_rec += item.v_recebido; buckets[key].inc_liq += item.v_liquidado;
            buckets[key].inc_pag += item.v_pago; buckets[key].inc_can += item.v_cancelado; buckets[key].inc_blo += item.v_bloqueado;

            if (item.v_empenhado !== 0 && buckets[key].docs_emp.length < 15) buckets[key].docs_emp.push(`C: ${item.contrato} | Doc: ${item.documento} (${formatBRL(item.v_empenhado)})`);
            if (item.v_recebido !== 0 && buckets[key].docs_rec.length < 15) buckets[key].docs_rec.push(`C: ${item.contrato} | Doc: ${item.documento} (${formatBRL(item.v_recebido)})`);
            if (item.v_liquidado !== 0 && buckets[key].docs_liq.length < 15) buckets[key].docs_liq.push(`C: ${item.contrato} | Doc: ${item.documento} (${formatBRL(item.v_liquidado)})`);
            if (item.v_pago !== 0 && buckets[key].docs_pag.length < 15) buckets[key].docs_pag.push(`C: ${item.contrato} | Doc: ${item.documento} (${formatBRL(item.v_pago)})`);
            if (item.v_cancelado !== 0 && buckets[key].docs_can.length < 15) buckets[key].docs_can.push(`C: ${item.contrato} | Doc: ${item.documento} (${formatBRL(item.v_cancelado)})`);
            if (item.v_bloqueado !== 0 && buckets[key].docs_blo.length < 15) buckets[key].docs_blo.push(`C: ${item.contrato} | Doc: ${item.documento} (${formatBRL(item.v_bloqueado)})`);
        });

        const labels = [], d_emp = [], d_rec = [], d_liq = [], d_pag = [], d_can = [], d_blo = [];
        const tooltips = [[], [], [], [], [], []];

        keys.forEach(k => {
            const b = buckets[k];
            labels.push(b.label); d_emp.push(b.inc_emp); d_rec.push(b.inc_rec); d_liq.push(b.inc_liq); d_pag.push(b.inc_pag); d_can.push(b.inc_can); d_blo.push(b.inc_blo);
            tooltips[0].push(b.docs_emp); tooltips[1].push(b.docs_rec); tooltips[2].push(b.docs_liq); tooltips[3].push(b.docs_pag); tooltips[4].push(b.docs_can); tooltips[5].push(b.docs_blo);
            const localMax = Math.max(b.inc_emp, b.inc_rec, b.inc_liq, b.inc_pag, b.inc_can, b.inc_blo);
            if (localMax > max_val) max_val = localMax;
        });

        return { labels, d_emp, d_rec, d_liq, d_pag, d_can, d_blo, tooltips, max_val, keys, buckets };
    };

    const areaChartData = useMemo(() => {
        const agg = calculateAggregatedData(areaAggLevel);
        let cum_emp = 0, cum_rec = 0, cum_liq = 0, cum_pag = 0, cum_can = 0, cum_blo = 0;
        const d_emp_cum = [], d_rec_cum = [], d_liq_cum = [], d_pag_cum = [], d_can_cum = [], d_blo_cum = [];
        agg.keys.forEach(k => {
            const b = agg.buckets[k];
            cum_emp += b.inc_emp; cum_rec += b.inc_rec; cum_liq += b.inc_liq; cum_pag += b.inc_pag; cum_can += b.inc_can; cum_blo += b.inc_blo;
            d_emp_cum.push(cum_emp); d_rec_cum.push(cum_rec); d_liq_cum.push(cum_liq); d_pag_cum.push(cum_pag); d_can_cum.push(cum_can); d_blo_cum.push(cum_blo);
        });
        return { labels: agg.labels, d_emp: d_emp_cum, d_rec: d_rec_cum, d_liq: d_liq_cum, d_pag: d_pag_cum, d_can: d_can_cum, d_blo: d_blo_cum, tooltips: agg.tooltips };
    }, [filteredData, areaAggLevel]);

    const barChartData = useMemo(() => calculateAggregatedData(barAggLevel), [filteredData, barAggLevel]);

    const latestDocs = useMemo(() => {
        const getLatestList = (field) => {
            const hasField = field.replace('v_', 'has_');
            const validDocs = filteredData.filter(d => d[hasField] && d.diaVal !== 0);
            if (validDocs.length === 0) return [];
            const maxVal = Math.max(...validDocs.map(d => d.diaVal));
            return validDocs.filter(d => d.diaVal === maxVal).sort((a, b) => b[field] - a[field]).slice(0, 10);
        };
        return { empenhado: getLatestList('v_empenhado'), recebido: getLatestList('v_recebido'), liquidado: getLatestList('v_liquidado'), pago: getLatestList('v_pago') };
    }, [filteredData]);

    const primeirosDocs = useMemo(() => {
        const getFirstList = (field) => {
            const hasField = field.replace('v_', 'has_');
            const validDocs = filteredData.filter(d => d[hasField] && d.diaVal !== 0);
            if (validDocs.length === 0) return [];
            const minVal = Math.min(...validDocs.map(d => d.diaVal));
            return validDocs.filter(d => d.diaVal === minVal).sort((a, b) => b[field] - a[field]).slice(0, 10);
        };
        return { empenhado: getFirstList('v_empenhado'), recebido: getFirstList('v_recebido'), liquidado: getFirstList('v_liquidado'), pago: getFirstList('v_pago') };
    }, [filteredData]);

    const matrixData = useMemo(() => {
        const map = {};
        filteredData.forEach(item => {
            if(!item.contrato || item.contrato === "-") return;
            const key = matrixGroupBy === 'contrato' ? item.contrato : `${item.contrato}|${item.empenho}`;
            if(!map[key]) {
                map[key] = {
                    contrato: item.contrato, empenho: matrixGroupBy === 'contrato' ? "VÁRIOS" : item.empenho, dtInicVal: item.dtInicVal, min_ro_val: Infinity,
                    docs_emp: new Set(), docs_rec: new Set(), docs_liq: new Set(), docs_pag: new Set(), docs_bloq: new Set(), docs_can: new Set(),
                    v_emp: 0, v_rec: 0, v_liq: 0, v_pag: 0, v_bloq: 0, v_can: 0
                };
            }
            const m = map[key];
            if (item.documento.includes("RO") && item.diaVal > 0) { if (item.diaVal < m.min_ro_val) m.min_ro_val = item.diaVal; }
            if (item.has_empenhado) m.docs_emp.add(item.documento);
            if (item.has_recebido) m.docs_rec.add(item.documento);
            if (item.has_liquidado) m.docs_liq.add(item.documento);
            if (item.has_pago) m.docs_pag.add(item.documento);
            if (item.has_bloqueado) m.docs_bloq.add(item.documento);
            if (item.has_cancelado) m.docs_can.add(item.documento);
            
            m.v_emp += item.v_empenhado;
            m.v_rec += item.v_recebido;
            m.v_liq += item.v_liquidado;
            m.v_pag += item.v_pago;
            m.v_bloq += item.v_bloqueado;
            m.v_can += item.v_cancelado;
        });

        let arr = Object.values(map).map(m => {
            let diasAss = null;
            if (m.min_ro_val !== Infinity && m.dtInicVal) { diasAss = Math.floor((m.dtInicVal - m.min_ro_val) / 86400000); }
            return {
                contrato: m.contrato, empenho: m.empenho, diasAss: diasAss,
                qtd_emp: m.docs_emp.size, qtd_rec: m.docs_rec.size, qtd_liq: m.docs_liq.size, qtd_pag: m.docs_pag.size, qtd_bloq: m.docs_bloq.size, qtd_can: m.docs_can.size,
                v_emp: m.v_emp, v_rec: m.v_rec, v_liq: m.v_liq, v_pag: m.v_pag, v_bloq: m.v_bloq, v_can: m.v_can,
                sortVal: m.min_ro_val !== Infinity ? m.min_ro_val : Number.MAX_SAFE_INTEGER
            };
        });

        arr.sort((a, b) => {
            let valA = a[matrixSort.key], valB = b[matrixSort.key];
            if (matrixSort.key === 'diasAss') {
                valA = valA !== null ? valA : (matrixSort.direction === 'asc' ? Infinity : -Infinity);
                valB = valB !== null ? valB : (matrixSort.direction === 'asc' ? Infinity : -Infinity);
            }
            if (valA < valB) return matrixSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return matrixSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return arr.slice(0, 50);
    }, [filteredData, matrixSort, matrixGroupBy]);

    const matrixTotals = useMemo(() => {
        let sumQtdEmp = 0, sumQtdRec = 0, sumQtdLiq = 0, sumQtdPag = 0, sumQtdBloq = 0, sumQtdCan = 0;
        let sumVEmp = 0, sumVRec = 0, sumVLiq = 0, sumVPag = 0, sumVBloq = 0, sumVCan = 0;
        let sumDias = 0, countDias = 0;
        matrixData.forEach(row => {
            sumQtdEmp += row.qtd_emp; sumQtdRec += row.qtd_rec; sumQtdLiq += row.qtd_liq; sumQtdPag += row.qtd_pag;
            sumQtdBloq += row.qtd_bloq; sumQtdCan += row.qtd_can;
            sumVEmp += row.v_emp; sumVRec += row.v_rec; sumVLiq += row.v_liq; sumVPag += row.v_pag;
            sumVBloq += row.v_bloq; sumVCan += row.v_can;
            if (row.diasAss !== null && row.diasAss >= 0) { sumDias += row.diasAss; countDias++; }
        });
        const mediaDias = countDias > 0 ? (sumDias / countDias).toFixed(1) : '-';
        return { sumQtdEmp, sumQtdRec, sumQtdLiq, sumQtdPag, sumQtdBloq, sumQtdCan, sumVEmp, sumVRec, sumVLiq, sumVPag, sumVBloq, sumVCan, mediaDias };
    }, [matrixData]);

    const renderMatrixHeader = (label, key, extraClass = "") => {
        const isSorted = matrixSort.key === key;
        return (
            <th className={`p-3 whitespace-nowrap cursor-pointer hover:bg-slate-200 transition ${extraClass}`} onClick={() => handleMatrixSort(key)}>
                <div className="flex items-center gap-1 justify-center">
                    {label}
                    <span className="text-[8px] text-slate-400">{isSorted ? (matrixSort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                </div>
            </th>
        );
    };

    const exportMasterColumns = [
        { header: "DIA", key: "dia" }, { header: "CONTRATO", key: "contrato" }, { header: "SITUAÇÃO", key: "situacao" }, { header: "MOVIMENTO", key: "movimentoStr" },
        { header: "DIAS ATÉ ASS. (RO)", key: "diasAss" }, { header: "VIG. INIC", key: "data_inic" }, { header: "VIG. FIM", key: "data_fim" },
        { header: "EMITENTE", key: "ug" }, { header: "FAVORECIDO", key: "favorecido" }, { header: "OBJETO", key: "objeto" },
        { header: "FISCAL", key: "fiscal" }, { header: "GESTOR", key: "gestor" }, { header: "AQUISIÇÃO", key: "modalidade" }, { header: "COMPRA", key: "compra" },
        { header: "EXISTÊNCIA", key: "existencia" }, { header: "SEC LOG", key: "sec_log" },
        { header: "EMPENHO", key: "empenho" }, { header: "DOCUMENTO", key: "documento" }, { header: "OBS", key: "obs" },
        { header: "EMPENHADO", key: "v_empenhado", isCurrency: true }, { header: "RECEBIDO", key: "v_recebido", isCurrency: true }, { header: "LIQUIDADO", key: "v_liquidado", isCurrency: true },
        { header: "PAGO", key: "v_pago", isCurrency: true }, { header: "CANCELADO", key: "v_cancelado", isCurrency: true }, { header: "BLOQUEADO", key: "v_bloqueado", isCurrency: true }
    ];

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center font-black text-slate-400 gap-4">
            <div className="w-12 h-12 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
            <p className="tracking-widest uppercase text-[10px] font-bold">Iniciando protocolo de integração de bases de dados...</p>
        </div>
    );

    return (
        <div className="p-4 md:p-8 relative bg-slate-100 min-h-screen">
            <header className="max-w-[1600px] mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800">PAINEL DE DOCUMENTOS CONTÁBEIS</h1>
                    <p className={`text-[11px] font-bold mt-1 ${status.includes("Erro") || status.includes("falhou") || status.includes("ausente") || status.includes("Carga Manual") ? "text-red-600" : "text-emerald-600"}`}>● {status}</p>
                    <p className="text-[11px] italic text-blue-600 mt-0.5">Produzido por Cel Brito.</p>
                </div>
                <div className="flex gap-2 items-center bg-white px-4 py-2 rounded-lg border shadow-sm flex-wrap justify-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Carga Manual:</span>
                    <input type="file" accept=".csv" onChange={(e) => { const r = new FileReader(); r.onload = (ev) => loadData(ev.target.result); r.readAsText(e.target.files[0]); }} className="text-[9px] cursor-pointer text-blue-600 font-bold w-[160px]" />
                    <div className="w-[1px] h-6 bg-slate-300 mx-1 hidden sm:block"></div>
                    <button onClick={() => loadData()} className="text-[10px] font-black text-white bg-blue-600 px-3 py-2 rounded shadow hover:bg-blue-700 transition">SINCRONIZAR APIs</button>
                    <span className="text-[10px] font-black text-slate-500 uppercase ml-2">Logado como: <span className="text-blue-600">{currentUser}</span></span>
                    <button onClick={logout} className="text-[10px] font-black text-white bg-red-600 px-3 py-2 rounded shadow hover:bg-red-700 transition ml-2">SAIR</button>
                </div>
            </header>

            <div className="max-w-[1600px] mx-auto mb-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xs font-black uppercase tracking-widest text-[#99bbd4] mb-4">Filtros Dinâmicos (Integrados)</h2>
                
                <div className="mb-4 pb-4 border-b border-slate-100 flex flex-col gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações Rápidas (Tempo e Status):</span>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={toggleCSup} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isCSupActive ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>C SUP</button>
                        <button onClick={toggleContratosVigentes} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isContratosVigentesActive ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>CONTRATOS VIGENTES</button>
                        <button onClick={toggleContr7Dias} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isContr7DiasActive ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>CONTR 7 DIAS ATRÁS</button>
                        <button onClick={toggleContr30Dias} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isContr30DiasActive ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>CONTR 30 DIAS ATRÁS</button>
                        <button onClick={toggleDoc7Dias} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isDoc7DiasActive ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>DOC 7 DIAS ATRÁS</button>
                        <button onClick={toggleDoc30Dias} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isDoc30DiasActive ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>DOC 30 DIAS ATRÁS</button>
                        <button onClick={applyFilterUltimoDia} className="text-[9px] font-bold uppercase bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-700 border border-emerald-600 shadow-sm transition">DIA ÚLTIMO DOC</button>
                        <button onClick={clearAllFilters} className="text-[9px] font-bold uppercase bg-slate-800 text-white px-3 py-1.5 rounded border border-slate-800 hover:bg-slate-700 shadow-sm transition">Limpar Filtros</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        {['EMP', 'RCB', 'LIQ', 'PAG', 'BLOQ', 'CAN'].map(mov => {
                            const isActive = fMovimento.includes(mov);
                            let activeClass = '';
                            if (mov === 'EMP') activeClass = 'bg-blue-600 text-white border-transparent ring-2 ring-blue-400 ring-offset-1';
                            else if (mov === 'RCB') activeClass = 'bg-violet-600 text-white border-transparent ring-2 ring-violet-400 ring-offset-1';
                            else if (mov === 'LIQ') activeClass = 'bg-amber-600 text-white border-transparent ring-2 ring-amber-400 ring-offset-1';
                            else if (mov === 'PAG') activeClass = 'bg-emerald-600 text-white border-transparent ring-2 ring-emerald-400 ring-offset-1';
                            else if (mov === 'BLOQ') activeClass = 'bg-orange-600 text-white border-transparent ring-2 ring-orange-400 ring-offset-1';
                            else if (mov === 'CAN') activeClass = 'bg-red-600 text-white border-transparent ring-2 ring-red-400 ring-offset-1';
                            return (
                                <button key={mov} onClick={() => toggleMovimento(mov)} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isActive ? activeClass : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                    {mov}
                                </button>
                            );
                        })}
                        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                        {['ATIVO INEXEC', 'ATIVO EM EXEC', 'ATIVO EXEC TOT', 'ATIVO EXEC PARC', 'VENC INEXEC TOT', 'VENC EXEC TOT', 'VENC EXEC PARC'].map((label) => {
                            const isActive = fSituacaoTags.includes(label);
                            return (
                                <button key={label} onClick={() => toggleSituacaoTag(label)}
                                    className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isActive ? tagColorsMap[label].css + ' border-transparent shadow-inner ring-2 ring-blue-400 ring-offset-1' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                                    {label}
                                </button>
                            );
                        })}
                        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                        <button onClick={() => toggleExistencia('GERAL')} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${fExistencia.includes('GERAL') ? tagColorsMap['SÓ EM GERAL'].css + ' border-transparent shadow-inner ring-2 ring-amber-400 ring-offset-1' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>SÓ GERAL</button>
                        <button onClick={() => toggleExistencia('CONTÁBIL')} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${fExistencia.includes('CONTÁBIL') ? tagColorsMap['SÓ EM CONTÁBIL'].css + ' border-transparent shadow-inner ring-2 ring-orange-400 ring-offset-1' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>SÓ CONTÁBIL</button>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                    <MultiSelect label="EMITENTE" options={[...new Set(rawData.map(r => r.ug))].sort()} selected={fUg} onChange={setFUg} />
                    <MultiSelect label="FAVORECIDO" options={[...new Set(rawData.map(r => r.favorecido))].sort()} selected={fFavorecido} onChange={setFFavorecido} />
                    <MultiSelect label="CONTRATO" options={[...new Set(rawData.map(r => r.contrato))].sort()} selected={fContrato} onChange={setFContrato} />
                    <MultiSelect label="EMPENHO" options={[...new Set(rawData.map(r => r.empenho))].sort()} selected={fEmpenho} onChange={setFEmpenho} />
                    <MultiSelect label="DOCUMENTO" options={[...new Set(rawData.map(r => r.documento))].sort()} selected={fDocumento} onChange={setFDocumento} />
                    <MultiSelect label="MODALIDADE" options={[...new Set(rawData.map(r => r.modalidade))].sort()} selected={fModalidade} onChange={setFModalidade} />
                    <MultiSelect label="Nº COMPRA" options={[...new Set(rawData.map(r => r.compra))].sort()} selected={fCompra} onChange={setFCompra} />
                    <MultiSelect label="GESTOR TITULAR" options={[...new Set(rawData.map(r => r.gestor))].sort()} selected={fGestor} onChange={setFGestor} />
                    <MultiSelect label="FISCAL TITULAR" options={[...new Set(rawData.map(r => r.fiscal))].sort()} selected={fFiscal} onChange={setFFiscal} />
                    <MultiSelect label="G. SUBSTITUTO" options={[...new Set(rawData.map(r => r.gestor_sub))].sort()} selected={fGestorSub} onChange={setFGestorSub} />
                    <MultiSelect label="F. SUBSTITUTO" options={[...new Set(rawData.map(r => r.fiscal_sub))].sort()} selected={fFiscalSub} onChange={setFFiscalSub} />
                    <MultiSelect label="SEC LOG" options={[...new Set(rawData.map(r => r.sec_log))].sort()} selected={fSecLog} onChange={setFSecLog} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
                    <DateInput label="DIA DOC (DE)" value={dDiaDe} onChange={setDDiaDe} />
                    <DateInput label="DIA DOC (ATÉ)" value={dDiaAte} onChange={setDDiaAte} />
                    <DateInput label="VIG INI (DE)" value={dInicDe} onChange={setDInicDe} />
                    <DateInput label="VIG INI (ATÉ)" value={dInicAte} onChange={setDInicAte} />
                    <DateInput label="VIG FIN (DE)" value={dFimDe} onChange={setDFimDe} />
                    <DateInput label="VIG FIN (ATÉ)" value={dFimAte} onChange={setDFimAte} />
                    <MultiSelect label="EXISTÊNCIA" options={[...new Set(rawData.map(r => r.existencia))].sort()} selected={fExistencia} onChange={setFExistencia} />
                </div>
            </div>

            <CollapsibleSection title="INDICADORES DE DESEMPENHO (KPIs)" defaultOpen={false}>
                <div className="max-w-[1600px] mx-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-4">
                    <KPICard title="QTD Contratos" value={kpis.qtdContratos} extraText={`SÓ GERAL: ${countSoGeral}\nSÓ CONTÁBIL: ${countSoContabil}`} color="slate" isCurrency={false} />
                    <KPICard title="QTD Ativos" value={kpis.qtdAtivos} extraText={`Inexec: ${kpis.qtdAtivosInexec}\nEm Exec: ${kpis.qtdAtivosEmExec}\nExec Tot: ${kpis.qtdAtivosExecTot}\nExec Parc: ${kpis.qtdAtivosExecParc}`} color="blue" isCurrency={false} />
                    <KPICard title="QTD Vencidos" value={kpis.qtdVencidos} extraText={`Inexec Tot: ${kpis.qtdVencInexecTot}\nExec Tot: ${kpis.qtdVencidosTot}\nExec Parc: ${kpis.qtdVencidosParc}`} color="slate" isCurrency={false} />
                    <KPICard title="QTD Bloqueados" value={kpis.qtdBloqueados} color="orange" isCurrency={false} />
                    <KPICard title="QTD Cancelados" value={kpis.qtdCancelados} color="red" isCurrency={false} />
                    <KPICard title="QTD Gestores" value={kpis.qtdGestores} color="amber" isCurrency={false} />
                    <KPICard title="QTD Fiscais" value={kpis.qtdFiscais} color="emerald" isCurrency={false} />
                    <KPICard title="QTD Fornecedores" value={kpis.qtdFornecedores} color="violet" isCurrency={false} />
                </div>

                <div className="max-w-[1600px] mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                    <KPICard title="Empenhado" value={kpis.totalEmpenhado} color="blue" isCurrency={true} />
                    <KPICard title="Recebido" value={kpis.totalRecebido} diffText={`Dif: ${formatBRL(kpis.totalEmpenhado - kpis.totalRecebido)}`} subValue={kpis.percRecebido} percSuffix=" do Emp." color="violet" isCurrency={true} />
                    <KPICard title="Liquidado" value={kpis.totalLiquidado} diffText={`Dif: ${formatBRL(kpis.totalRecebido - kpis.totalLiquidado)}`} subValue={kpis.percLiquidado} percSuffix=" do Emp." color="amber" isCurrency={true} />
                    <KPICard title="Pago" value={kpis.totalPago} diffText={`Dif: ${formatBRL(kpis.totalLiquidado - kpis.totalPago)}`} subValue={kpis.percPago} percSuffix=" do Emp." color="emerald" isCurrency={true} />
                    <KPICard title="Cancelado" value={kpis.totalCancelado} subValue={kpis.percCancelado} percSuffix=" do Emp." color="red" isCurrency={true} />
                    <KPICard title="Bloqueado" value={kpis.totalBloqueado} subValue={kpis.percBloqueado} percSuffix=" do Emp." color="orange" isCurrency={true} />
                </div>

                <div className="max-w-[1600px] mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                    <DocStatCard title="Docs RO ou NE" count={docStats.rone.count} date={docStats.rone.latestDate} timestamp={docStats.rone.latestVal} />
                    <DocStatCard title="Docs NS ou NL (Rec)" count={docStats.nsnl_rec.count} date={docStats.nsnl_rec.latestDate} timestamp={docStats.nsnl_rec.latestVal} />
                    <DocStatCard title="Docs NS ou NL (Liq)" count={docStats.nsnl_liq.count} date={docStats.nsnl_liq.latestDate} timestamp={docStats.nsnl_liq.latestVal} />
                    <DocStatCard title="Docs OB" count={docStats.ob.count} date={docStats.ob.latestDate} timestamp={docStats.ob.latestVal} />
                    <DocStatCard title="Docs DF" count={docStats.df.count} date={docStats.df.latestDate} timestamp={docStats.df.latestVal} />
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="PANORAMA GERAL DOS DOCUMENTOS" defaultOpen={false}>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2 flex-wrap gap-2">
                        <h3 className="text-xs font-black text-slate-800 uppercase">Últimos Lançamentos Contábeis (Até 10 docs)</h3>
                        {latestDocs.empenhado.length > 0 && (
                            <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded shadow-sm flex items-center gap-1 shrink-0">
                                <span className="uppercase">Último Dia de Lançamento:</span>
                                <span className="text-[11px]">{latestDocs.empenhado[0].dia || ''}</span>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-[300px]">
                        <LatestDocCard title="EMPENHADO" docs={latestDocs.empenhado} metricField="v_empenhado" colorClass="border-blue-500 text-blue-700" />
                        <LatestDocCard title="RECEBIDO" docs={latestDocs.recebido} metricField="v_recebido" colorClass="border-violet-500 text-violet-700" showEmitente={true} />
                        <LatestDocCard title="LIQUIDADO" docs={latestDocs.liquidado} metricField="v_liquidado" colorClass="border-amber-500 text-amber-600" />
                        <LatestDocCard title="PAGO" docs={latestDocs.pago} metricField="v_pago" colorClass="border-emerald-500 text-emerald-600" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-10">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2 flex-wrap gap-2">
                        <h3 className="text-xs font-black text-slate-800 uppercase">Os Primeiros Lançamentos Contábeis (Até 10 docs)</h3>
                        {primeirosDocs.empenhado.length > 0 && (
                            <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded shadow-sm flex items-center gap-1 shrink-0">
                                <span className="uppercase">Primeiro Dia de Lançamento:</span>
                                <span className="text-[11px]">{primeirosDocs.empenhado[0].dia || ''}</span>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-[300px]">
                        <LatestDocCard title="EMPENHADO" docs={primeirosDocs.empenhado} metricField="v_empenhado" colorClass="border-blue-500 text-blue-700" />
                        <LatestDocCard title="RECEBIDO" docs={primeirosDocs.recebido} metricField="v_recebido" colorClass="border-violet-500 text-violet-700" showEmitente={true} />
                        <LatestDocCard title="LIQUIDADO" docs={primeirosDocs.liquidado} metricField="v_liquidado" colorClass="border-amber-500 text-amber-600" />
                        <LatestDocCard title="PAGO" docs={primeirosDocs.pago} metricField="v_pago" colorClass="border-emerald-500 text-emerald-600" />
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
                    <div className="xl:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-xs font-black text-slate-800 uppercase mb-4">Composição de Documentos</h3>
                        <div className="flex flex-col gap-6 h-full justify-between pb-4">
                            <div className="relative h-[200px]">
                                <h4 className="text-[10px] font-bold text-slate-500 text-center mb-1 absolute w-full top-[-20px]">QTD DE DOCUMENTOS ÚNICOS</h4>
                                <ChartComponent id="doughnutQtd" type="doughnut" data={{ labels: ['Empenhado', 'Recebido', 'Liquidado', 'Pago'], datasets: [{ data: [docCounts.empenhado, docCounts.recebido, docCounts.liquidado, docCounts.pago], backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'] }] }} options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { tooltip: { callbacks: { label: function(ctx) { return ` Qtd Documentos: ${ctx.raw}`; } } }, datalabels: { color: '#ffffff', font: { weight: 'bold', size: 10 }, formatter: (value, ctx) => { let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0); if (sum === 0 || value === 0) return null; return (value * 100 / sum).toFixed(1) + '%'; }, textStrokeColor: 'rgba(0,0,0,0.6)', textStrokeWidth: 2 }, legend: { display: false } } }} />
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
                                    <span className="text-2xl font-black text-slate-700 leading-none">{totalUniqueDocs.toLocaleString('pt-BR')}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Total Docs</span>
                                </div>
                            </div>
                            <div className="h-[280px] pt-4">
                                <h4 className="text-[10px] font-bold text-slate-500 text-center mb-1">VOLUME FINANCEIRO TOTAL (R$)</h4>
                                <FunnelChart data={[{ label: 'EMPENHADO', value: kpis.totalEmpenhado, color: 'bg-blue-500' }, { label: 'RECEBIDO', value: kpis.totalRecebido, color: 'bg-violet-500' }, { label: 'LIQUIDADO', value: kpis.totalLiquidado, color: 'bg-amber-500' }, { label: 'PAGO', value: kpis.totalPago, color: 'bg-emerald-500' }]} />
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                            <h3 className="text-xs font-black text-slate-800 uppercase">MATRIZ QTD DE DOCUMENTOS POR EMPENHO</h3>
                            <select value={matrixGroupBy} onChange={(e) => setMatrixGroupBy(e.target.value)} className="text-[10px] font-bold border border-slate-300 rounded px-2 py-1 outline-none shadow-sm text-slate-700 bg-slate-50">
                                <option value="contrato_empenho">Por Contrato e Empenho</option>
                                <option value="contrato">Apenas por Contrato</option>
                            </select>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar" style={{ maxHeight: '550px' }}>
                            <table className="w-full text-left text-[9px] border-collapse relative" style={{ minWidth: '1500px' }}>
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                                    <tr className="text-slate-600 uppercase font-black tracking-tighter">
                                        {renderMatrixHeader('CONTRATO', 'contrato', 'text-left')}
                                        {matrixGroupBy === 'contrato_empenho' && renderMatrixHeader('EMPENHO', 'empenho')}
                                        <th className="p-3 whitespace-nowrap text-center cursor-pointer hover:bg-slate-200 transition" title="Dias do RO mais antigo até Vigência Incial" onClick={() => handleMatrixSort('diasAss')}>
                                            <div className="flex items-center gap-1 justify-center">
                                                DIAS ATÉ ASS. (RO) <span className="text-[8px] text-slate-400">{matrixSort.key === 'diasAss' ? (matrixSort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                                            </div>
                                        </th>
                                        {renderMatrixHeader('QTD DOC EMP', 'qtd_emp', 'text-blue-700')}
                                        {renderMatrixHeader('R$ EMPENHADO', 'v_emp', 'text-blue-700 text-right')}
                                        {renderMatrixHeader('QTD DOC REC', 'qtd_rec', 'text-violet-700')}
                                        {renderMatrixHeader('R$ RECEBIDO', 'v_rec', 'text-violet-700 text-right')}
                                        {renderMatrixHeader('QTD DOC LIQ', 'qtd_liq', 'text-amber-700')}
                                        {renderMatrixHeader('R$ LIQUIDADO', 'v_liq', 'text-amber-700 text-right')}
                                        {renderMatrixHeader('QTD DOC PAG', 'qtd_pag', 'text-emerald-700')}
                                        {renderMatrixHeader('R$ PAGO', 'v_pag', 'text-emerald-700 text-right')}
                                        {renderMatrixHeader('QTD DOC BLOQ', 'qtd_bloq', 'text-orange-700')}
                                        {renderMatrixHeader('R$ BLOQUEADO', 'v_bloq', 'text-orange-700 text-right')}
                                        {renderMatrixHeader('QTD DOC CAN', 'qtd_can', 'text-red-700')}
                                        {renderMatrixHeader('R$ CANCELADO', 'v_can', 'text-red-700 text-right')}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {matrixData.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 font-black text-slate-800 break-words max-w-[150px]">{row.contrato}</td>
                                            {matrixGroupBy === 'contrato_empenho' && <td className="p-3 font-bold text-slate-600 break-words text-center">{row.empenho}</td>}
                                            <td className="p-3 text-center align-middle">
                                                {row.diasAss !== null ? (
                                                    <span className={`px-2 py-1 rounded font-bold text-[9px] ${row.diasAss >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                        {row.diasAss} d
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-3 text-center font-bold text-blue-600 bg-blue-50/30">{row.qtd_emp}</td>
                                            <td className="p-3 text-right font-black text-blue-700 bg-blue-50/30"><FormatNegativeValue val={row.v_emp} /></td>
                                            <td className="p-3 text-center font-bold text-violet-600 bg-violet-50/30">{row.qtd_rec}</td>
                                            <td className="p-3 text-right font-black text-violet-700 bg-violet-50/30"><FormatNegativeValue val={row.v_rec} /></td>
                                            <td className="p-3 text-center font-bold text-amber-600 bg-amber-50/30">{row.qtd_liq}</td>
                                            <td className="p-3 text-right font-black text-amber-700 bg-amber-50/30"><FormatNegativeValue val={row.v_liq} /></td>
                                            <td className="p-3 text-center font-bold text-emerald-600 bg-emerald-50/30">{row.qtd_pag}</td>
                                            <td className="p-3 text-right font-black text-emerald-700 bg-emerald-50/30"><FormatNegativeValue val={row.v_pag} /></td>
                                            <td className="p-3 text-center font-bold text-orange-600 bg-orange-50/30">{row.qtd_bloq}</td>
                                            <td className="p-3 text-right font-black text-orange-700 bg-orange-50/30"><FormatNegativeValue val={row.v_bloq} /></td>
                                            <td className="p-3 text-center font-bold text-red-600 bg-red-50/30">{row.qtd_can}</td>
                                            <td className="p-3 text-right font-black text-red-700 bg-red-50/30"><FormatNegativeValue val={row.v_can} /></td>
                                        </tr>
                                    ))}
                                    {matrixData.length === 0 && (
                                        <tr><td colSpan="15" className="p-4 text-center text-slate-400 font-bold">Sem dados para a matriz.</td></tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-slate-200 sticky bottom-0 border-t-2 border-slate-300 shadow-md z-10">
                                    <tr className="text-slate-700 uppercase font-black">
                                        <td colSpan={matrixGroupBy === 'contrato_empenho' ? 2 : 1} className="p-3 text-right">TOTAIS (Top 50):</td>
                                        <td className="p-3 text-center align-middle">
                                            <div className="text-[10px]">{matrixTotals.mediaDias !== '-' ? `${matrixTotals.mediaDias} d (Média)` : '-'}</div>
                                            <div className="text-[7px] text-slate-500 font-bold leading-tight mt-0.5">*Exclui vals. negativos</div>
                                        </td>
                                        <td className="p-3 text-center text-blue-800">{matrixTotals.sumQtdEmp}</td>
                                        <td className="p-3 text-right text-blue-800"><FormatNegativeValue val={matrixTotals.sumVEmp}/></td>
                                        <td className="p-3 text-center text-violet-800">{matrixTotals.sumQtdRec}</td>
                                        <td className="p-3 text-right text-violet-800"><FormatNegativeValue val={matrixTotals.sumVRec}/></td>
                                        <td className="p-3 text-center text-amber-800">{matrixTotals.sumQtdLiq}</td>
                                        <td className="p-3 text-right text-amber-800"><FormatNegativeValue val={matrixTotals.sumVLiq}/></td>
                                        <td className="p-3 text-center text-emerald-800">{matrixTotals.sumQtdPag}</td>
                                        <td className="p-3 text-right text-emerald-800"><FormatNegativeValue val={matrixTotals.sumVPag}/></td>
                                        <td className="p-3 text-center text-orange-800">{matrixTotals.sumQtdBloq}</td>
                                        <td className="p-3 text-right text-orange-800"><FormatNegativeValue val={matrixTotals.sumVBloq}/></td>
                                        <td className="p-3 text-center text-red-800">{matrixTotals.sumQtdCan}</td>
                                        <td className="p-3 text-right text-red-800"><FormatNegativeValue val={matrixTotals.sumVCan}/></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="GRÁFICOS DE EXECUÇÃO DOS DOCUMENTOS" defaultOpen={false}>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-10">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-slate-800 uppercase">MÉTRICAS FINANCEIRAS E QTD (TOP 20)</h3>
                        <div className="flex gap-2 items-center">
                            <select value={top20Sort} onChange={(e) => setTop20Sort(e.target.value)} className="text-[10px] font-bold uppercase border border-slate-300 bg-slate-50 rounded px-2 py-1 outline-none">
                                <option value="emp_desc">MAIOR EMPENHO</option>
                                <option value="rec_desc">MAIOR RECEBIDO</option>
                                <option value="liq_desc">MAIOR LIQUIDADO</option>
                                <option value="pag_desc">MAIOR PAGO</option>
                                <option value="can_desc">MAIOR CANCELADO</option>
                                <option value="bloq_desc">MAIOR BLOQUEADO</option>
                                <option value="qtd_desc">MAIOR QTD</option>
                                <option value="nome_asc">ORDEM A-Z</option>
                            </select>
                            <select value={top20ViewMode} onChange={(e) => setTop20ViewMode(e.target.value)} className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition shadow-sm cursor-pointer outline-none">
                                <option value="favorecido">VER POR FAVORECIDO</option>
                                <option value="contrato">VER POR CONTRATO</option>
                                <option value="ano">VER POR ANO</option>
                                <option value="empenho">VER POR EMPENHO</option>
                                <option value="sec_log">VER POR SEC LOG</option>
                            </select>
                        </div>
                    </div>
                    <div className="h-[400px]">
                        <ChartComponent id="gTop20Contabil" type="bar" data={{
                            labels: top20DataProcessed.map(d => formatLabelMultiLine(d.label)),
                            datasets: [
                                { label: 'Empenhado', data: top20DataProcessed.map(d => d.empenhado), backgroundColor: '#3b82f6', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                { label: 'Recebido', data: top20DataProcessed.map(d => d.recebido), backgroundColor: '#8b5cf6', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                { label: 'Liquidado', data: top20DataProcessed.map(d => d.liquidado), backgroundColor: '#f59e0b', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                { label: 'Pago', data: top20DataProcessed.map(d => d.pago), backgroundColor: '#10b981', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                { label: 'QTD Contratos', data: top20DataProcessed.map(d => d.count), backgroundColor: '#ec4899', borderColor: '#ec4899', yAxisID: 'y1', type: 'line', borderWidth: 2, pointRadius: 4, order: 1, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', rotation: -90, align: 'bottom', anchor: 'start', font: { size: 9, weight: 'bold' } } }
                            ]
                        }} options={{
                            indexAxis: 'x', responsive: true, maintainAspectRatio: false, 
                            interaction: { mode: 'index', intersect: false },
                            plugins: { 
                                tooltip: {
                                    callbacks: {
                                        title: function(context) { return context[0].label; },
                                        beforeBody: function(context) {
                                            const idx = context[0].dataIndex;
                                            const item = top20DataProcessed[idx];
                                            if (top20ViewMode === 'contrato' || top20ViewMode === 'empenho') return `Favorecido: ${item.favorecido}`;
                                            return '';
                                        },
                                        label: function(context) {
                                            let label = context.dataset.label || '';
                                            if (label) label += ': ';
                                            if (context.dataset.yAxisID === 'y1' || label.includes('QTD')) {
                                                label += context.raw.toLocaleString('pt-BR');
                                            } else {
                                                label += formatBRL(context.raw);
                                            }
                                            return label;
                                        }
                                    }
                                },
                                datalabels: { display: false },
                                legend: { position: 'top', labels: { boxWidth: 10, font: { size: 9 } } }
                            },
                            scales: { 
                                x: { ticks: { maxRotation: 90, minRotation: 45, font: { size: 9, weight: 'bold' }, autoSkip: false } }, 
                                y: { position: 'left', ticks: { callback: v => shortenNumber(v) }, title: { display: true, text: 'Valores (R$)', font: { size: 8 } } }, 
                                y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Quantidade', font: { size: 8 } }, grace: '10%', beginAtZero: true } 
                            } 
                        }} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-10">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-slate-800 uppercase">EXECUÇÃO ORÇAMENTÁRIA E QTD EM 100% (TOP 20)</h3>
                        <div className="flex gap-2 items-center">
                            <select value={top20100Sort} onChange={(e) => setTop20100Sort(e.target.value)} className="text-[10px] font-bold uppercase border border-slate-300 bg-slate-50 rounded px-2 py-1 outline-none">
                                <option value="emp_desc">MAIOR EMPENHO</option>
                                <option value="rec_desc">MAIOR RECEBIDO</option>
                                <option value="liq_desc">MAIOR LIQUIDADO</option>
                                <option value="pag_desc">MAIOR PAGO</option>
                                <option value="can_desc">MAIOR CANCELADO</option>
                                <option value="bloq_desc">MAIOR BLOQUEADO</option>
                                <option value="qtd_desc">MAIOR QTD</option>
                                <option value="nome_asc">ORDEM A-Z</option>
                            </select>
                            <select value={top20100ViewMode} onChange={(e) => setTop20100ViewMode(e.target.value)} className="text-[9px] font-black uppercase tracking-widest bg-violet-50 text-violet-600 px-3 py-1.5 rounded border border-violet-200 hover:bg-violet-100 transition shadow-sm cursor-pointer outline-none">
                                <option value="favorecido">VER POR FAVORECIDO</option>
                                <option value="contrato">VER POR CONTRATO</option>
                                <option value="ano">VER POR ANO</option>
                                <option value="empenho">VER POR EMPENHO</option>
                                <option value="sec_log">VER POR SEC LOG</option>
                            </select>
                        </div>
                    </div>
                    <div className="h-[400px]">
                        <ChartComponent id="gTop20100Contabil" type="bar" data={{
                            labels: top20100DataProcessed.map(d => formatLabelMultiLine(d.label)),
                            datasets: [
                                { label: 'Liquidado %', data: top20100DataProcessed.map(d => d.empenhado ? (d.liquidado / d.empenhado) * 100 : 0), backgroundColor: '#f59e0b', xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '1', order: 4, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] >= 4; }, color: '#fff', rotation: -90, align: 'center', anchor: 'center', font: { size: 9, weight: 'bold' }, formatter: (v, ctx) => shortenNumber(top20100DataProcessed[ctx.dataIndex].liquidado) } },
                                { label: 'A Liquidar %', data: top20100DataProcessed.map(d => d.empenhado ? Math.max(0, ((d.empenhado - d.liquidado - d.bloqueado - d.cancelado) / d.empenhado) * 100) : 0), backgroundColor: '#cbd5e1', xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '1', order: 4, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] >= 4; }, color: '#1e293b', rotation: -90, align: 'center', anchor: 'center', font: { size: 9, weight: 'bold' }, formatter: (v, ctx) => shortenNumber(Math.max(0, top20100DataProcessed[ctx.dataIndex].empenhado - top20100DataProcessed[ctx.dataIndex].liquidado - top20100DataProcessed[ctx.dataIndex].bloqueado - top20100DataProcessed[ctx.dataIndex].cancelado)) } },
                                { label: 'Bloqueado %', data: top20100DataProcessed.map(d => d.empenhado ? (d.bloqueado / d.empenhado) * 100 : 0), backgroundColor: '#f97316', xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '1', order: 4, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] >= 4; }, color: '#fff', rotation: -90, align: 'center', anchor: 'center', font: { size: 9, weight: 'bold' }, formatter: (v, ctx) => shortenNumber(top20100DataProcessed[ctx.dataIndex].bloqueado) } },
                                { label: 'Cancelado %', data: top20100DataProcessed.map(d => d.empenhado ? (d.cancelado / d.empenhado) * 100 : 0), backgroundColor: '#ef4444', xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '1', order: 4, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] >= 4; }, color: '#fff', rotation: -90, align: 'center', anchor: 'center', font: { size: 9, weight: 'bold' }, formatter: (v, ctx) => shortenNumber(top20100DataProcessed[ctx.dataIndex].cancelado) } },
                                
                                { label: 'Empenhado (100%)', data: top20100DataProcessed.map(d => 100), backgroundColor: 'transparent', borderColor: '#3b82f6', borderWidth: 2, xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '2', order: 3, datalabels: { display: false } },
                                
                                { label: 'Recebido %', data: top20100DataProcessed.map(d => d.empenhado ? (d.recebido / d.empenhado) * 100 : 0), backgroundColor: 'transparent', borderColor: '#8b5cf6', borderWidth: { top: 4, right: 0, bottom: 0, left: 0 }, xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '3', order: 2, datalabels: { display: false } },
                                { label: 'Pago %', data: top20100DataProcessed.map(d => d.empenhado ? (d.pago / d.empenhado) * 100 : 0), backgroundColor: 'transparent', borderColor: '#10b981', borderWidth: { top: 4, right: 0, bottom: 0, left: 0 }, xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '4', order: 2, datalabels: { display: false } },
                                
                                { label: 'QTD Contratos', data: top20DataProcessed.map(d => d.count), backgroundColor: '#ec4899', borderColor: '#ec4899', type: 'line', borderWidth: 2, pointRadius: 4, xAxisID: 'x', yAxisID: 'y1', order: 1, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', rotation: -90, align: 'bottom', anchor: 'start', font: { size: 9, weight: 'bold' } } }
                            ]
                        }} options={{
                            indexAxis: 'x', responsive: true, maintainAspectRatio: false, 
                            interaction: { mode: 'index', intersect: false },
                            plugins: { 
                                fiftyPercentLinePlugin: { display: true },
                                tooltip: {
                                    callbacks: {
                                        title: function(context) { return context[0].label; },
                                        beforeBody: function(context) {
                                            const idx = context[0].dataIndex;
                                            const item = top20100DataProcessed[idx];
                                            if (top20100ViewMode === 'contrato' || top20100ViewMode === 'empenho') return `Favorecido: ${item.favorecido}`;
                                            return '';
                                        },
                                        label: function(context) {
                                            if (context.dataset.yAxisID === 'y1') return context.dataset.label + ': ' + context.raw;
                                            
                                            const label = context.dataset.label;
                                            const rawVal = context.raw;
                                            const percentStr = rawVal.toFixed(1).replace('.', ',') + '%';
                                            
                                            const idx = context.dataIndex;
                                            const d = top20100DataProcessed[idx];
                                            let absVal = 0;
                                            
                                            if (label.includes('Liquidado')) absVal = d.liquidado;
                                            else if (label.includes('A Liquidar')) absVal = Math.max(0, d.empenhado - d.liquidado - d.bloqueado - d.cancelado);
                                            else if (label.includes('Bloqueado')) absVal = d.bloqueado;
                                            else if (label.includes('Cancelado')) absVal = d.cancelado;
                                            else if (label.includes('Empenhado')) absVal = d.empenhado;
                                            else if (label.includes('Recebido')) absVal = d.recebido;
                                            else if (label.includes('Pago')) absVal = d.pago;
                                            
                                            return `${label.replace(' %', '').replace(' (100%)', '')}: ${percentStr} (${formatBRL(absVal)})`;
                                        }
                                    }
                                }, 
                                datalabels: { display: true },
                                legend: { position: 'top', labels: { boxWidth: 10, font: { size: 9 } } }
                            },
                            scales: { 
                                x: { stacked: true, ticks: { maxRotation: 90, minRotation: 45, font: { size: 9, weight: 'bold' }, autoSkip: false } }, 
                                y: { stacked: true, position: 'left', min: 0, max: 105, ticks: { callback: v => v + '%' }, title: { display: true, text: 'Percentual (%)', font: { size: 8 } } }, 
                                y1: { display: true, position: 'right', grid: { display: false }, title: { display: true, text: 'Quantidade', font: { size: 8 } }, grace: '10%', beginAtZero: true } 
                            } 
                        }} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-10">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <h3 className="text-xs font-black text-slate-800 uppercase">Evolução Acumulada de Lançamentos</h3>
                        <select className="text-[10px] font-bold border border-slate-300 rounded px-2 py-1 outline-none focus:border-blue-500 shadow-sm cursor-pointer text-slate-700 bg-slate-50 uppercase" value={areaAggLevel} onChange={(e) => setAreaAggLevel(e.target.value)}>
                            <option value="dia">Por Dia</option><option value="mes">Por Mês/Ano</option><option value="ano">Por Ano</option>
                        </select>
                    </div>
                    <div className="h-[450px]">
                        <ChartComponent id="chartAreaEvolucao" type="line" data={{ labels: areaChartData.labels, datasets: [{ label: 'EMPENHADO', data: areaChartData.d_emp, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.3)', fill: true, tension: 0, pointRadius: 2 }, { label: 'RECEBIDO', data: areaChartData.d_rec, borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.3)', fill: true, tension: 0, pointRadius: 2 }, { label: 'LIQUIDADO', data: areaChartData.d_liq, borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.3)', fill: true, tension: 0, pointRadius: 2 }, { label: 'PAGO', data: areaChartData.d_pag, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.3)', fill: true, tension: 0, pointRadius: 2 }, { label: 'CANCELADO', data: areaChartData.d_can, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.3)', fill: true, tension: 0, pointRadius: 2 }, { label: 'BLOQUEADO', data: areaChartData.d_blo, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.3)', fill: true, tension: 0, pointRadius: 2 }] }} options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { datalabels: { display: function(context) { const data = context.dataset.data; const index = context.dataIndex; if (index === 0) return data[index] > 0; return data[index] > data[index - 1]; }, color: '#1e293b', align: 'top', anchor: 'end', offset: 2, font: { size: 9, weight: 'bold' }, formatter: (value) => shortenNumber(value), textStrokeColor: '#ffffff', textStrokeWidth: 2 }, tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 11 }, callbacks: { label: function(context) { const val = context.raw.y !== undefined ? context.raw.y : context.raw; let lines = [context.dataset.label + ': ' + formatBRL(val)]; const docsList = areaChartData.tooltips[context.datasetIndex][context.dataIndex] || []; if (docsList.length > 0) { lines.push(...docsList.slice(0, 10).map(d => '  • ' + d)); if (docsList.length > 10) lines.push(`  ... (+ ${docsList.length - 10} docs)`); } return lines; } } } }, scales: { x: { ticks: { font: { size: 10 }, maxRotation: 90, minRotation: 45, autoSkip: true, maxTicksLimit: 30 } }, y: { beginAtZero: true, ticks: { callback: v => shortenNumber(v) } } } }} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-10">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <h3 className="text-xs font-black text-slate-800 uppercase">EVOLUÇÃO NÃO ACUMULADA DE LANÇAMENTOS</h3>
                        <select className="text-[10px] font-bold border border-slate-300 rounded px-2 py-1 outline-none focus:border-blue-500 shadow-sm cursor-pointer text-slate-700 bg-slate-50 uppercase" value={barAggLevel} onChange={(e) => setBarAggLevel(e.target.value)}>
                            <option value="dia">Por Dia</option><option value="mes">Por Mês/Ano</option><option value="ano">Por Ano</option>
                        </select>
                    </div>
                    <div className="h-[450px]">
                        <ChartComponent id="chartBarEvolucao" type="bubble" data={{ labels: barChartData.labels, datasets: [{ label: 'EMPENHADO', data: barChartData.d_emp.map((v, i) => ({ x: barChartData.labels[i], y: v, r: v === 0 ? 0 : Math.max(5, (v / barChartData.max_val) * 25) })), backgroundColor: 'rgba(59, 130, 246, 0.6)', borderColor: '#3b82f6', borderWidth: 1 }, { label: 'RECEBIDO', data: barChartData.d_rec.map((v, i) => ({ x: barChartData.labels[i], y: v, r: v === 0 ? 0 : Math.max(5, (v / barChartData.max_val) * 25) })), backgroundColor: 'rgba(139, 92, 246, 0.6)', borderColor: '#8b5cf6', borderWidth: 1 }, { label: 'LIQUIDADO', data: barChartData.d_liq.map((v, i) => ({ x: barChartData.labels[i], y: v, r: v === 0 ? 0 : Math.max(5, (v / barChartData.max_val) * 25) })), backgroundColor: 'rgba(245, 158, 11, 0.6)', borderColor: '#f59e0b', borderWidth: 1 }, { label: 'PAGO', data: barChartData.d_pag.map((v, i) => ({ x: barChartData.labels[i], y: v, r: v === 0 ? 0 : Math.max(5, (v / barChartData.max_val) * 25) })), backgroundColor: 'rgba(16, 185, 129, 0.6)', borderColor: '#10b981', borderWidth: 1 }, { label: 'CANCELADO', data: barChartData.d_can.map((v, i) => ({ x: barChartData.labels[i], y: v, r: v === 0 ? 0 : Math.max(5, (v / barChartData.max_val) * 25) })), backgroundColor: 'rgba(239, 68, 68, 0.6)', borderColor: '#ef4444', borderWidth: 1 }, { label: 'BLOQUEADO', data: barChartData.d_blo.map((v, i) => ({ x: barChartData.labels[i], y: v, r: v === 0 ? 0 : Math.max(5, (v / barChartData.max_val) * 25) })), backgroundColor: 'rgba(249, 115, 22, 0.6)', borderColor: '#f97316', borderWidth: 1 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { datalabels: { display: false }, tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 11 }, callbacks: { title: function(context) { return context[0].raw.x; }, label: function(context) { const val = context.raw.y !== undefined ? context.raw.y : context.raw; let lines = [context.dataset.label + ': ' + formatBRL(val)]; const docsList = barChartData.tooltips[context.datasetIndex][context.dataIndex] || []; if (docsList.length > 0) { lines.push(...docsList.slice(0, 10).map(d => '  • ' + d)); if (docsList.length > 10) lines.push(`  ... (+ ${docsList.length - 10} docs)`); } return lines; } } } }, scales: { x: { type: 'category', labels: barChartData.labels, offset: true, ticks: { font: { size: 10 }, maxRotation: 90, minRotation: 45, autoSkip: true, maxTicksLimit: 30 } }, y: { beginAtZero: true, ticks: { callback: v => shortenNumber(v) } } } }} />
                    </div>
                </div>
            </CollapsibleSection>

            {/* SEÇÃO 3: TABELAS DE EXECUÇÃO */}
            <CollapsibleSection title="TABELAS DE EXECUÇÃO DOS DOCUMENTOS" defaultOpen={false}>
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden mb-10">
                    <div className="bg-slate-800 px-4 py-3 flex justify-between items-center flex-wrap gap-2">
                        <h3 className="text-white text-xs font-black tracking-widest uppercase">Detalhamento Master ({Math.min(visibleRows, filteredData.length)} de {filteredData.length})</h3>
                        <div className="flex gap-2">
                            <button onClick={() => exportTable.toExcel(filteredData, "Master_Contabil", exportMasterColumns)} className="bg-green-600 hover:bg-green-500 text-white text-[9px] font-black px-2 py-1 rounded shadow transition">EXCEL</button>
                            <button onClick={() => exportTable.toCSV(filteredData, "Master_Contabil", exportMasterColumns)} className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black px-2 py-1 rounded shadow transition">CSV</button>
                            <button onClick={() => exportTable.toPDF(filteredData, "Master_Contabil", exportMasterColumns, "DETALHAMENTO MASTER")} className="bg-red-600 hover:bg-red-500 text-white text-[9px] font-black px-2 py-1 rounded shadow transition">PDF</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="text-left text-[9px] border-collapse relative" style={{ tableLayout: 'fixed', minWidth: '2700px' }}>
                            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                                <tr className="text-slate-600 uppercase font-black tracking-tighter align-top">
                                    <DateFilterHeader widthClass="w-[5%]" label="DIA" field="dia" current={sortConfig} onSort={handleSort} dateFilters={dateFilters} setDateFilters={setDateFilters} />
                                    <TextHeader widthClass="w-[6%]" label="CONTRATO" field="contrato" current={sortConfig} onSort={handleSort} searchVal={searchContratoTabela} onSearchChange={setSearchContratoTabela} />
                                    <TextHeader widthClass="w-[6%]" label="SITUAÇÃO" field="situacao" current={sortConfig} onSort={handleSort} searchVal={searchSituacaoTabela} onSearchChange={setSearchSituacaoTabela} />
                                    <TextHeader widthClass="w-[6%]" label="MOVIMENTO" field="movimentoStr" current={sortConfig} onSort={handleSort} searchVal={searchMovimentoTabela} onSearchChange={setSearchMovimentoTabela} />
                                    <NumericHeader widthClass="w-[5%]" label="DIAS ASS (RO)" field="diasAss" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />
                                    <DateFilterHeader widthClass="w-[5%]" label="VIGÊNCIA" field="data_inic" current={sortConfig} onSort={handleSort} dateFilters={dateFilters} setDateFilters={setDateFilters} align="center" />
                                    <NumericHeader widthClass="w-[6%]" label="% TEMPO" field="perc_tempo" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />
                                    <TextHeader widthClass="w-[5%]" label="EMITENTE" field="ug" current={sortConfig} onSort={handleSort} searchVal={searchEmitenteTabela} onSearchChange={setSearchEmitenteTabela} />
                                    <TextHeader widthClass="w-[10%]" label="FAVORECIDO" field="favorecido" current={sortConfig} onSort={handleSort} searchVal={searchUgNome} onSearchChange={setSearchUgNome} />
                                    <TextHeader widthClass="w-[10%]" label="OBJETO" field="objeto" current={sortConfig} onSort={handleSort} searchVal={searchObjeto} onSearchChange={setSearchObjeto} />
                                    <TextHeader widthClass="w-[7%]" label="GESTOR/FISCAL" field="gestor" current={sortConfig} onSort={handleSort} searchVal={searchGestorTabela} onSearchChange={setSearchGestorTabela} />
                                    <TextHeader widthClass="w-[7%]" label="AQUISIÇÃO" field="modalidade" current={sortConfig} onSort={handleSort} searchVal={searchModalidadeTabela} onSearchChange={setSearchModalidadeTabela} />
                                    <TextHeader widthClass="w-[5%]" label="EXISTÊNCIA" field="existencia" current={sortConfig} onSort={handleSort} searchVal={searchExistenciaTabela} onSearchChange={setSearchExistenciaTabela} />
                                    <TextHeader widthClass="w-[5%]" label="SEC LOG" field="sec_log" current={sortConfig} onSort={handleSort} searchVal={searchSecLogTabela} onSearchChange={setSearchSecLogTabela} />
                                    <TextHeader widthClass="w-[6%]" label="EMPENHO" field="empenho" current={sortConfig} onSort={handleSort} searchVal={searchEmpenho} onSearchChange={setSearchEmpenho} />
                                    <TextHeader widthClass="w-[6%]" label="DOCUMENTO" field="documento" current={sortConfig} onSort={handleSort} searchVal={searchDocumento} onSearchChange={setSearchDocumento} />
                                    <TextHeader widthClass="w-[12%]" label="OBS" field="obs" current={sortConfig} onSort={handleSort} searchVal={searchObs} onSearchChange={setSearchObs} />
                                    <NumericHeader widthClass="w-[5%]" label="EMPENHADO" field="v_empenhado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />
                                    <NumericHeader widthClass="w-[5%]" label="RECEBIDO" field="v_recebido" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />
                                    <NumericHeader widthClass="w-[5%]" label="LIQUIDADO" field="v_liquidado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />
                                    <NumericHeader widthClass="w-[5%]" label="PAGO" field="v_pago" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />
                                    <NumericHeader widthClass="w-[5%]" label="CANCELADO" field="v_cancelado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />
                                    <NumericHeader widthClass="w-[5%]" label="BLOQUEADO" field="v_bloqueado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.slice(0, visibleRows).map((row, i) => (
                                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                                        <td className="p-2 text-slate-500 font-bold whitespace-normal break-words">{row.dia || "-"}</td>
                                        <td className="p-2 text-slate-800 font-black whitespace-normal break-words">{row.contrato}</td>
                                        <td className="p-2 align-middle text-center">
                                            <div className="flex flex-wrap items-center justify-center gap-1">
                                                {row.situacaoFlags && row.situacaoFlags.map((f, idx) => (
                                                    <span key={idx} className={`text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${f.color}`}>{f.label}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-2 align-middle text-center">
                                            <div className="flex flex-wrap items-center justify-center gap-1">
                                                {row.movimentoFlags && row.movimentoFlags.map((f, idx) => (
                                                    <span key={idx} className={`text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${f.color}`}>{f.label}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-2 align-middle text-center font-bold text-slate-600">
                                            {row.diasAss !== null ? (
                                                <span className={`px-1.5 py-0.5 rounded ${row.diasAss >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                    {row.diasAss} d
                                                </span>
                                            ) : "-"}
                                        </td>
                                        <td className="p-2 text-slate-500 font-bold whitespace-normal break-words text-center">
                                            <div className="text-[9px] text-slate-400">Iní: {row.data_inic || "-"}</div>
                                            <div className="text-[9px] mt-1 text-slate-600">Fim: {row.data_fim || "-"}</div>
                                        </td>
                                        <td className="p-2 align-middle">
                                            {row.perc_tempo !== null ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-[8px] font-bold text-slate-500 text-center">{row.dias_passaram} d decorridos</div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-full bg-slate-200 rounded-full h-1.5 flex-1 overflow-hidden">
                                                            <div className={`h-1.5 rounded-full ${row.perc_tempo >= 1 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(Math.max(row.perc_tempo * 100, 0), 100)}%` }}></div>
                                                        </div>
                                                        <span className="text-[8px] font-bold text-slate-600 min-w-[30px] text-right">{formatPercentBR(row.perc_tempo)}</span>
                                                    </div>
                                                    <div className="text-[8px] font-bold text-center mt-0.5"><span className={row.encerrando_dias < 0 ? 'text-red-500' : 'text-emerald-600'}>{row.encerrando_dias} d restantes</span></div>
                                                </div>
                                            ) : "-"}
                                        </td>
                                        <td className="p-2 font-bold text-slate-700 whitespace-normal break-words">{row.ug}</td>
                                        <td className="p-2 text-slate-600 font-bold whitespace-normal break-words leading-tight">{row.favorecido}</td>
                                        <td className="p-2 text-slate-500 whitespace-normal break-words leading-tight">{row.objeto}</td>
                                        <td className="p-2 whitespace-normal break-words">
                                            <div className="font-bold text-slate-700" title="Gestor">G: {row.gestor}</div>
                                            <div className="font-bold text-slate-700 mt-1" title="Fiscal">F: {row.fiscal}</div>
                                        </td>
                                        <td className="p-2 whitespace-normal break-words">
                                            <div className="text-[9px] text-slate-600">Mod: {row.modalidade}</div>
                                            <div className="text-[9px] text-slate-600 mt-1">Cmp: {row.compra}</div>
                                        </td>
                                        <td className="p-2 align-middle text-center">
                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${row.existencia === 'AMBAS' ? 'bg-blue-100 text-blue-700 border border-blue-200' : row.existencia === 'GERAL' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-orange-100 text-orange-800 border border-orange-200'}`}>
                                                {row.existencia}
                                            </span>
                                        </td>
                                        <td className="p-2 text-slate-500 font-bold whitespace-normal break-words">{row.sec_log}</td>
                                        <td className="p-2 text-slate-600 font-bold whitespace-normal break-words">{row.empenho}</td>
                                        <td className="p-2 text-slate-600 font-bold whitespace-normal break-words">{row.documento}</td>
                                        <td className="p-2 text-slate-500 whitespace-normal break-words leading-tight">{row.obs}</td>
                                        <td className="p-2 text-right font-bold text-blue-700 whitespace-normal break-words bg-blue-50/30">
                                            <FormatNegativeValue val={row.v_empenhado} />
                                        </td>
                                        <td className="p-2 text-right font-bold text-violet-600 whitespace-normal break-words">
                                            <FormatNegativeValue val={row.v_recebido} />
                                        </td>
                                        <td className="p-2 text-right font-bold text-amber-600 whitespace-normal break-words bg-amber-50/30">
                                            <FormatNegativeValue val={row.v_liquidado} />
                                        </td>
                                        <td className="p-2 text-right font-black text-emerald-600 whitespace-normal break-words">
                                            <FormatNegativeValue val={row.v_pago} />
                                        </td>
                                        <td className="p-2 text-right font-bold text-red-600 whitespace-normal break-words bg-red-50/30">
                                            <FormatNegativeValue val={row.v_cancelado} />
                                        </td>
                                        <td className="p-2 text-right font-bold text-orange-600 whitespace-normal break-words">
                                            <FormatNegativeValue val={row.v_bloqueado} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-200 sticky bottom-0 border-t-2 border-slate-300 shadow-md z-10">
                                <tr className="text-slate-700 uppercase font-black">
                                    <td colSpan="17" className="p-2 text-right">TOTAIS:</td>
                                    <td className="p-2 text-right text-blue-800"><FormatNegativeValue val={totalsMaster.emp}/></td>
                                    <td className="p-2 text-right text-violet-800"><FormatNegativeValue val={totalsMaster.rec}/></td>
                                    <td className="p-2 text-right text-amber-800"><FormatNegativeValue val={totalsMaster.liq}/></td>
                                    <td className="p-2 text-right text-emerald-800"><FormatNegativeValue val={totalsMaster.pag}/></td>
                                    <td className="p-2 text-right text-red-800"><FormatNegativeValue val={totalsMaster.can}/></td>
                                    <td className="p-2 text-right text-orange-800"><FormatNegativeValue val={totalsMaster.blo}/></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {visibleRows < filteredData.length && (
                        <div className="p-4 bg-slate-50 border-t flex justify-center">
                            <button onClick={() => setVisibleRows(prev => prev + 100)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-6 py-2 rounded transition border border-slate-300 shadow-sm cursor-pointer">
                                Carregar mais registros (+100)
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                    <SubTable title="Detalhamento - Empenhado" data={filteredData} metricField="v_empenhado" metricLabel="EMPENHADO" headerColor="bg-blue-800" textColor="text-blue-700" rowBgColor="bg-blue-50/30" showDiasAss={true} />
                    <SubTable title="Detalhamento - Recebido" data={filteredData} metricField="v_recebido" metricLabel="RECEBIDO" headerColor="bg-violet-800" textColor="text-violet-700" rowBgColor="" />
                    <SubTable title="Detalhamento - Liquidado" data={filteredData} metricField="v_liquidado" metricLabel="LIQUIDADO" headerColor="bg-amber-700" textColor="text-amber-700" rowBgColor="bg-amber-50/30" />
                    <SubTable title="Detalhamento - Pago" data={filteredData} metricField="v_pago" metricLabel="PAGO" headerColor="bg-emerald-800" textColor="text-emerald-700" rowBgColor="" />
                    <SubTable title="Detalhamento - Cancelado" data={filteredData} metricField="v_cancelado" metricLabel="CANCELADO" headerColor="bg-red-800" textColor="text-red-700" rowBgColor="bg-red-50/30" />
                    <SubTable title="Detalhamento - Bloqueado" data={filteredData} metricField="v_bloqueado" metricLabel="BLOQUEADO" headerColor="bg-orange-800" textColor="text-orange-700" rowBgColor="" />
                </div>
            </CollapsibleSection>
        </div>
    );
}

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    render() {
        if (this.state.hasError) return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-8">
                <h2 className="text-2xl font-black text-red-600 mb-4 uppercase tracking-tighter">Erro Detetado no Painel Contábil</h2>
                <p className="text-slate-700 mb-6 font-bold bg-white p-4 rounded shadow-sm border border-red-200">{this.state.error.toString()}</p>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="bg-red-600 text-white px-6 py-3 rounded shadow font-bold hover:bg-red-700 uppercase text-sm tracking-widest transition">Recarregar</button>
            </div>
        );
        return this.props.children; 
    }
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(() => { try { return localStorage.getItem('isAuth_Contabil') === 'true'; } catch(e) { return false; } });
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = (e) => {
        e.preventDefault();
        const users = {};
        users[_decode("01100010 01110010 01101001 01110100 01101111")] = _decode("00110001 00110110 00110110 00111001");
        users[_decode("01100111 01100101 01110011 01110100 01101111 01110010")] = _decode("00110000 00110001 00110000 00110001");
        users[_decode("01100110 01101001 01110011 01100011 01100001 01101100")] = _decode("00110000 00110010 00110000 00110010");
        users[_decode("01100001 01101100 01101101 01100101 01110010 01101001 01100001")] = _decode("00110010 00110000 00110000 00110010");
        users[_decode("01100010 01101111 01110101 01101100 01100101 01110111 01100001 01110010 01100100")] = _decode("00110000 00110001 00110011 00110110");

        const inputUser = username.toLowerCase().trim();
        if (users[inputUser] && users[inputUser] === password) {
            setIsAuthenticated(true);
            try { localStorage.setItem('isAuth_Contabil', 'true'); localStorage.setItem('user_Contabil', inputUser); } catch(e) {}
            setError("");
        } else {
            setError("Credenciais inválidas. Verifique o usuário e a senha.");
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-800 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                <div className="bg-white p-8 rounded-2xl shadow-2xl w-[400px] max-w-[90%] border-t-8 border-blue-600 relative z-10">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Acesso Restrito</h1>
                        <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest">Painel de Documentos Contábeis</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Usuário</label>
                            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-slate-300 px-3 py-3 rounded text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50 transition-all" placeholder="Digite o seu usuário..." />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Senha</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-slate-300 px-3 py-3 rounded text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50 transition-all" placeholder="••••••••" />
                        </div>
                        {error && (<div className="bg-red-50 border-l-4 border-red-500 p-3 rounded"><p className="text-[11px] font-bold text-red-600 text-center">{error}</p></div>)}
                        <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[11px] tracking-widest py-4 rounded transition-colors shadow-lg mt-2">Autenticar Acesso</button>
                    </form>
                </div>
            </div>
        );
    }
    return <ErrorBoundary><Dashboard /></ErrorBoundary>;
}

ReactDOM.render(<App />, document.getElementById('root'));