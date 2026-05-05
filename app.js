const { useState, useEffect, useMemo, useRef } = React;

if (window.ChartDataLabels) {
    Chart.register(ChartDataLabels);
    Chart.defaults.set('plugins.datalabels', { display: false });
}

// Plugin para linha vertical nos gráficos de barra
const customLinePlugin = {
    id: 'customLinePlugin',
    afterDatasetsDraw: (chart) => {
        const plugins = chart.config.options.plugins;
        const config = plugins && plugins.customLinePlugin;
        if (config && config.x !== undefined) {
            const ctx = chart.ctx;
            const scale = chart.scales[config.scaleID || 'x1'];
            const yAxis = chart.scales.y;
            if (!scale || !yAxis) return;
            const xPixel = scale.getPixelForValue(config.x);
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([5, 5]); 
            ctx.moveTo(xPixel, yAxis.top);
            ctx.lineTo(xPixel, yAxis.bottom);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'; 
            ctx.stroke();
            ctx.restore();
        }
    }
};
Chart.register(customLinePlugin);

// Plugin exclusivo para desenhar as linhas conectando as fatias da Pizza aos valores externos
const pieLinePlugin = {
    id: 'pieLinePlugin',
    afterDraw: (chart) => {
        if (chart.config.type !== 'pie') return;
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;

        ctx.save();
        ctx.strokeStyle = '#cbd5e1'; 
        ctx.lineWidth = 1.2;

        meta.data.forEach((element, index) => {
            const dataset = chart.data.datasets[0];
            const value = dataset.data[index];
            const total = dataset.data.reduce((a, b) => a + b, 0);
            if (!total || value === 0) return; 

            const angle = (element.startAngle + element.endAngle) / 2;
            const outerRadius = element.outerRadius;
            const x = element.x;
            const y = element.y;

            const startX = x + Math.cos(angle) * outerRadius;
            const startY = y + Math.sin(angle) * outerRadius;

            const endX = x + Math.cos(angle) * (outerRadius + 15);
            const endY = y + Math.sin(angle) * (outerRadius + 15);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            
            const sign = Math.cos(angle) >= 0 ? 1 : -1;
            ctx.lineTo(endX + 5 * sign, endY);
            
            ctx.stroke();
        });
        ctx.restore();
    }
};
Chart.register(pieLinePlugin);

// Plugin para os Quadrantes no Gráfico de Dispersão
const scatterQuadrantPlugin = {
    id: 'scatterQuadrantPlugin',
    beforeDraw: (chart) => {
        if (chart.config.options.plugins.scatterQuadrantPlugin?.display) {
            const ctx = chart.ctx;
            const xAxis = chart.scales.x;
            const yAxis = chart.scales.y;
            
            const x50 = xAxis.getPixelForValue(50);
            const y50 = yAxis.getPixelForValue(50);
            
            ctx.save();
            
            // Desenho das Linhas Tracejadas
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#f472b6'; // Rosa
            
            // Vertical 50%
            ctx.moveTo(x50, yAxis.top);
            ctx.lineTo(x50, yAxis.bottom);
            // Horizontal 50%
            ctx.moveTo(xAxis.left, y50);
            ctx.lineTo(xAxis.right, y50);
            ctx.stroke();
            
            // Desenho dos Textos
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 28px Arial';
            
            const xLeftCenter = (xAxis.left + x50) / 2;
            const xRightCenter = (x50 + xAxis.right) / 2;
            const yTopCenter = (yAxis.top + y50) / 2;    // Reflete > 50%
            const yBottomCenter = (y50 + yAxis.bottom) / 2; // Reflete < 50%
            
            // Q2: (x: 0-50, y: 50-100) -> Ruim (Vermelho translúcido)
            ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.fillText('Ruim', xLeftCenter, yTopCenter);
            
            // Q3: (x: 50-100, y: 50-100) -> Normal (Preto translúcido)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillText('Normal', xRightCenter, yTopCenter);
            
            // Q1: (x: 0-50, y: 0-50) -> Normal (Preto translúcido)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillText('Normal', xLeftCenter, yBottomCenter);
            
            // Q4: (x: 50-100, y: 0-50) -> Ótimo (Verde translúcido)
            ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
            ctx.fillText('Ótimo', xRightCenter, yBottomCenter);
            
            ctx.restore();
        }
    }
};
Chart.register(scatterQuadrantPlugin);

// Linha Tracejada Vermelha para os 50% do Gráfico de 100%
const fiftyPercentLinePlugin = {
    id: 'fiftyPercentLinePlugin',
    afterDatasetsDraw: (chart) => {
        if (chart.config.options.plugins.fiftyPercentLinePlugin?.display) {
            const ctx = chart.ctx;
            const yAxis = chart.scales.y;
            const xAxis = chart.scales.x;
            if (!yAxis || !xAxis) return;
            const y50 = yAxis.getPixelForValue(50);
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // Vermelho
            ctx.moveTo(xAxis.left, y50);
            ctx.lineTo(xAxis.right, y50);
            ctx.stroke();
            ctx.restore();
        }
    }
};
Chart.register(fiftyPercentLinePlugin);

// Mapa de cores unificado para TAGS de Situação e Gráfico de Dispersão
const tagColorsMap = {
    'ATIVO INEXEC': { css: 'bg-purple-700 text-white', hex: '#7e22ce' },
    'ATIVO EM EXEC': { css: 'bg-cyan-500 text-slate-900', hex: '#06b6d4' },
    'ATIVO EXEC TOT': { css: 'bg-blue-800 text-white', hex: '#1e40af' },
    'ATIVO EXEC PARC': { css: 'bg-sky-400 text-slate-900', hex: '#38bdf8' },
    'VENC INEXEC TOT': { css: 'bg-rose-900 text-white', hex: '#881337' },
    'VENC EXEC TOT': { css: 'bg-green-600 text-white', hex: '#16a34a' },
    'VENC EXEC PARC': { css: 'bg-yellow-500 text-slate-900', hex: '#eab308' },
    'CAN': { css: 'bg-red-600 text-white', hex: '#dc2626' },
    'BLOQ': { css: 'bg-orange-500 text-white', hex: '#f97316' }
};

// Paleta base para Pizzas
const pieColors = ['#3b82f6', '#eab308', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1', '#0ea5e9'];

const decodeBinary = (binStr) => {
    try {
        if (!binStr) return '';
        return binStr.trim().split(/\s+/).map(bin => {
            const parsed = parseInt(bin, 2);
            return isNaN(parsed) ? '' : String.fromCharCode(parsed);
        }).join('');
    } catch(e) { return ''; }
};

const normalizeStr = (str) => {
    if (!str) return "";
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9%]/g, '');
};

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwwqirbdPVTmqm9KHHYsnr0zsW9DHmnLaQfVMpJtN6xwwAWg7yNv4_Bcu_1cLlcBaqR/exec";

const parseValue = (val) => {
    if (typeof val === 'number') return val;
    if (!val || val === "-" || val === "") return 0;
    let str = val.toString().trim().replace(/[R$\s]/g, '');
    if (str.includes('.') && str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
    else if (str.includes(',')) str = str.replace(',', '.');
    str = str.replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
};

const parsePercentAsFloat = (val) => {
    if (typeof val === 'number') return val;
    if (!val || val === "-" || val === "") return 0;
    let str = val.toString().trim().replace(/[R$\s%]/g, '');
    if (str.includes('.') && str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
    else if (str.includes(',')) str = str.replace(',', '.');
    let num = parseFloat(str) || 0;
    if (num > 1 && num <= 100 && val.toString().includes('%')) num = num / 100;
    return num;
};

const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
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
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
        if ((currentLine + word).length > maxLength) {
            if (currentLine) lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine += word + ' ';
        }
    });
    if (currentLine) lines.push(currentLine.trim());
    if (lines.length > 2) return [lines[0], lines[1].substring(0, maxLength - 3) + '...'];
    return lines;
};

const exportTable = {
    toExcel: (data, filename, columns) => {
        if (!window.XLSX) { alert("Biblioteca Excel não encontrada."); return; }
        const wsData = data.map(row => {
            let obj = {};
            columns.forEach(c => {
                let val = row[c.key];
                if (val === null || val === undefined) val = "-";
                else if (c.isPercent) val = formatPercentBR(val);
                else if (c.isCurrency) val = formatBRL(val);
                obj[c.header] = val;
            });
            return obj;
        });
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados");
        XLSX.writeFile(wb, `${filename}.xlsx`);
    },
    toCSV: (data, filename, columns) => {
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += columns.map(c => c.header).join(";") + "\n";
        data.forEach(row => {
            let r = columns.map(c => {
                let val = row[c.key];
                if (val === null || val === undefined) val = "-";
                else if (c.isPercent) val = formatPercentBR(val);
                else if (typeof val === 'number') return val.toString().replace('.', ',');
                return `"${(val || '').toString().replace(/"/g, '""')}"`;
            });
            csvContent += r.join(";") + "\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    toPDF: (data, filename, columns, title) => {
        if (!window.jspdf || !window.jspdf.jsPDF) { alert("Biblioteca PDF não encontrada."); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'pt', 'a4');
        doc.setFontSize(14);
        doc.text(title, 40, 30);
        const tableHead = [columns.map(c => c.header)];
        const tableBody = data.map(row => {
            return columns.map(c => {
                let val = row[c.key];
                if (val === null || val === undefined) return "-";
                if (c.isCurrency) return formatBRL(val);
                if (c.isPercent) return formatPercentBR(val);
                return val.toString();
            });
        });
        doc.autoTable({
            head: tableHead, body: tableBody, startY: 40,
            styles: { fontSize: 5, cellPadding: 2, overflow: 'linebreak' },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
            margin: { top: 20, left: 10, right: 10 }
        });
        doc.save(`${filename}.pdf`);
    }
};

const exportMasterColumns = [
    { header: "CONTRATO", key: "contrato" }, { header: "SITUAÇÃO", key: "situacao" }, { header: "FORNECEDOR", key: "fornecedor" }, 
    { header: "OBJETO", key: "objeto" }, { header: "GESTOR", key: "gestor" }, { header: "FISCAL", key: "fiscal" }, 
    { header: "COMPRA", key: "compra" }, { header: "MODALIDADE", key: "modalidade" }, { header: "INÍCIO", key: "data_inic" }, 
    { header: "FIM", key: "data_fim" }, { header: "% TEMPO", key: "perc_tempo", isPercent: true }, 
    { header: "PASSARAM", key: "dias_passaram" }, { header: "FALTAM", key: "encerrando_dias" },
    { header: "GLOBAL-EMP", key: "dif_global", isCurrency: true }, { header: "GLOBAL", key: "v_global", isCurrency: true }, 
    { header: "EMPENHADO", key: "v_empenhado", isCurrency: true }, 
    { header: "LIQUIDADO", key: "v_liquidado", isCurrency: true }, { header: "LIQ %", key: "p_liquidado", isPercent: true }, 
    { header: "A LIQUIDAR", key: "v_a_liquidar", isCurrency: true }, { header: "A LIQ %", key: "p_a_liquidar", isPercent: true }, 
    { header: "PAGO", key: "v_pago", isCurrency: true }, { header: "PAGO %", key: "p_pago", isPercent: true }, 
    { header: "A PAGAR", key: "v_a_pagar", isCurrency: true }, { header: "A PAGAR %", key: "p_a_pagar", isPercent: true }, 
    { header: "BLOQUEADO", key: "v_bloqueado", isCurrency: true }, { header: "BLOQ %", key: "p_bloqueado", isPercent: true }, 
    { header: "CANCELADO", key: "v_cancelado", isCurrency: true }, { header: "CANC %", key: "p_cancelado", isPercent: true }, 
    { header: "EXECUTADO", key: "v_executado", isCurrency: true }, { header: "EXEC %", key: "p_executado", isPercent: true }, 
    { header: "EXEC LIQ", key: "v_pago", isCurrency: true }, { header: "EXEC LIQ %", key: "p_pago", isPercent: true }
];

const tooltipCallback = {
    callbacks: {
        label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (label.includes('QTD') || label.includes('Quantidade') || label.includes('Contratos')) {
                label += context.raw.toLocaleString('pt-BR');
            } else {
                label += formatBRL(context.raw);
            }
            return label;
        }
    }
};

const getFullTooltipFornecedor = (dataArray) => ({
    callbacks: {
        title: function(tooltipItems) { return dataArray[tooltipItems[0].dataIndex].label || dataArray[tooltipItems[0].dataIndex].contrato; },
        beforeBody: function(tooltipItems) {
            const item = dataArray[tooltipItems[0].dataIndex];
            if (!item.objetos) return '';
            const mods = Array.from(item.modalidades).join(', ');
            const objs = Array.from(item.objetos).join(' | ');
            return `Modalidade(s): ${mods}\nObjeto(s):\n${formatLabelMultiLine(objs, 60).join('\n')}`;
        },
        label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (label.includes('QTD') || label.includes('Quantidade')) label += context.raw.toLocaleString('pt-BR');
            else label += formatBRL(context.raw);
            return label;
        }
    }
});

const getFullTooltipContrato = (dataArray) => ({
    callbacks: {
        title: function(tooltipItems) {
            const idx = tooltipItems[0].dataIndex;
            return `Contrato: ${dataArray[idx].contrato}`;
        },
        beforeBody: function(tooltipItems) {
            const idx = tooltipItems[0].dataIndex;
            const item = dataArray[idx];
            const objFormatado = formatLabelMultiLine(item.objeto, 60).join('\n');
            return `Fornecedor: ${item.fornecedor}\nObjeto:\n${objFormatado}`;
        },
        label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            const idx = context.dataIndex;
            const item = dataArray[idx];
            
            if (context.dataset.yAxisID === 'y_perc' || label.includes('%')) {
                label += formatPercentBR(context.raw);
                if (context.dataset.label === '% Tempo') {
                    const dias = item.encerrando_dias !== null ? `${item.encerrando_dias} d` : '-';
                    label += ` (Faltam: ${dias})`;
                } else if (context.dataset.label === '% Execução') {
                    label += ` (${formatBRL(item.v_executado)})`;
                } else if (context.dataset.label === '% Liquidado') {
                    label += ` (${formatBRL(item.v_liquidado)})`;
                } else if (context.dataset.label === '% Exec. Líquida') {
                    label += ` (${formatBRL(item.v_pago)})`;
                }
            } else {
                label += formatBRL(context.raw);
                if (context.dataset.label === 'Valor Empenhado') {
                    label += `\nGlobal: ${formatBRL(item.v_global)}`;
                }
            }
            return label;
        }
    }
});

const getBubbleTooltip = (xAxisMetricStr) => ({
    callbacks: {
        title: function(tooltipItems) {
            return `Contrato: ${tooltipItems[0].raw.contrato}`;
        },
        label: function(context) {
            const d = context.raw;
            return [
                `Fornecedor: ${d.fornecedor}`,
                `Situação: ${d.situacao}`,
                `Empenhado: ${formatBRL(d.v_empenhado)}`,
                `${xAxisMetricStr}: ${formatPercentBR(d.x / 100)}`,
                `% Tempo: ${formatPercentBR(d.y / 100)}`
            ];
        }
    }
});

const startResize = (e) => {
    const th = e.target.closest('th');
    const startX = e.pageX;
    const startWidth = th.getBoundingClientRect().width;
    const onMouseMove = (moveEvent) => { th.style.width = `${Math.max(40, startWidth + moveEvent.pageX - startX)}px`; };
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

function AutoFitText({ text, className }) {
    const containerRef = useRef(null);
    const textRef = useRef(null);
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
        resize(); setTimeout(resize, 50); 
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [text]);
    return (
        <div ref={containerRef} className="w-full overflow-hidden flex items-center">
            <div ref={textRef} className={`${className} origin-left whitespace-nowrap inline-block`}>{text}</div>
        </div>
    );
}

const ChartComponent = ({ type, data, options, id }) => {
    const canvasRef = useRef(null);
    const chartInstance = useRef(null);
    useEffect(() => {
        if (!canvasRef.current) return;
        if (chartInstance.current) chartInstance.current.destroy();
        const ctx = canvasRef.current.getContext('2d');
        chartInstance.current = new Chart(ctx, { type, data, options });
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [data, options, type]);
    return <canvas ref={canvasRef}></canvas>;
};

// Componente: Alterna entre Gráfico de Pizza e Barra Vertical Única com Seletor Financeiro
function ToggleableChartCard({ title, data, isFinancial, id, isFornecedor }) {
    const [viewPie, setViewPie] = useState(true);
    const [finMetric, setFinMetric] = useState('total');

    const activeMetric = isFinancial ? finMetric : 'count';

    const cleanData = useMemo(() => {
        let processed = [...data];
        if (isFornecedor) {
            processed = processed.map(d => ({
                ...d,
                label: d.label.replace(/^[\d\.\-\/]+\s*-\s*/, '')
            }));
        }
        
        // Sorting by chosen dynamic metric
        processed.sort((a, b) => b[activeMetric] - a[activeMetric]);

        // Re-group into "OUTROS" dynamic slice
        if (processed.length > 10) {
            const top9 = processed.slice(0, 9);
            const others = processed.slice(9).reduce((acc, curr) => {
                acc.count += curr.count || 0;
                acc.total += curr.total || 0;
                acc.liquidado += curr.liquidado || 0;
                acc.a_liquidar += curr.a_liquidar || 0;
                acc.pago += curr.pago || 0;
                acc.a_pagar += curr.a_pagar || 0;
                acc.bloqueado += curr.bloqueado || 0;
                acc.cancelado += curr.cancelado || 0;
                acc.executado += curr.executado || 0;
                return acc;
            }, { label: "OUTROS", count: 0, total: 0, liquidado: 0, a_liquidar: 0, pago: 0, a_pagar: 0, bloqueado: 0, cancelado: 0, executado: 0 });
            processed = [...top9, others];
        }
        return processed;
    }, [data, isFornecedor, activeMetric]);

    const chartLabels = cleanData.map(d => formatLabelMultiLine(d.label, 15));
    
    const metricNames = {
        'total': 'Empenhado', 'liquidado': 'Liquidado', 'a_liquidar': 'A Liquidar', 
        'pago': 'Pago (Exec Líq)', 'a_pagar': 'A Pagar',
        'bloqueado': 'Bloqueado', 'cancelado': 'Cancelado', 'executado': 'Executado',
        'count': 'QTD Contratos'
    };
    const currentMetricName = metricNames[activeMetric];
    const displayTitle = isFinancial ? title.replace(/Empenhado/i, currentMetricName.split(' ')[0] + (currentMetricName.includes('Liq') ? ' Liq' : '') + (currentMetricName.includes('Pag') ? ' Pag' : '')) : title;

    const pieData = {
        labels: cleanData.map(d => d.label),
        datasets: [{
            label: isFinancial ? currentMetricName : 'QTD Contratos',
            data: cleanData.map(d => d[activeMetric]),
            backgroundColor: cleanData.map((d, i) => d.label.trim() === 'OUTROS' ? '#94a3b8' : pieColors[i % pieColors.length]),
            borderWidth: 1,
            borderColor: '#ffffff'
        }]
    };

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 20, left: 30, right: 30, bottom: 5 } }, 
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        if (label) label += ': ';
                        let value = context.raw;
                        const dataArr = context.chart.data.datasets[0].data;
                        const total = dataArr.reduce((a, b) => a + b, 0);
                        const percentage = total ? (value * 100 / total).toFixed(2).replace('.', ',') + '%' : '0%';
                        if (isFinancial) {
                            label += formatBRL(value) + ' (' + percentage + ')';
                        } else {
                            label += value.toLocaleString('pt-BR') + ' (' + percentage + ')';
                        }
                        return label;
                    }
                }
            },
            legend: { 
                position: 'bottom', 
                align: 'center',
                labels: { 
                    boxWidth: cleanData.length > 6 ? 6 : 10,
                    padding: cleanData.length > 6 ? 8 : 12,
                    font: { size: cleanData.length > 6 ? 8 : 10 },
                    generateLabels: function(chart) {
                        const data = chart.data;
                        if (data.labels.length && data.datasets.length) {
                            return data.labels.map(function(label, i) {
                                const meta = chart.getDatasetMeta(0);
                                const style = meta.controller.getStyle(i);
                                const maxLen = data.labels.length > 6 ? 12 : 18;
                                return {
                                    text: label.length > maxLen ? label.substring(0, maxLen) + '...' : label,
                                    fillStyle: style.backgroundColor,
                                    strokeStyle: style.borderColor,
                                    lineWidth: style.borderWidth,
                                    hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                                    index: i
                                };
                            });
                        }
                        return [];
                    }
                } 
            },
            datalabels: {
                display: true, 
                color: '#334155',
                align: 'end',
                anchor: 'end',
                offset: 20, 
                textAlign: 'center',
                font: (context) => {
                    const dataArr = context.chart.data.datasets[0].data;
                    const val = context.dataset.data[context.dataIndex];
                    const total = dataArr.reduce((a, b) => a + b, 0);
                    const percentage = total ? (val * 100 / total) : 0;
                    return { weight: 'bold', size: percentage < 4 ? 7 : (percentage < 10 ? 8 : 9) };
                },
                formatter: (value, context) => {
                    const dataArr = context.chart.data.datasets[0].data;
                    const total = dataArr.reduce((a, b) => a + b, 0);
                    if (!total || value === 0) return '';
                    const percentage = (value * 100 / total);
                    const valStr = isFinancial ? shortenNumber(value) : value.toLocaleString('pt-BR');
                    return `${percentage.toFixed(1).replace('.', ',')}%\n${valStr}`;
                }
            }
        }
    };

    const barData = {
        labels: chartLabels,
        datasets: [{
            label: isFinancial ? currentMetricName : 'Quantidade',
            data: cleanData.map(d => d[activeMetric]),
            backgroundColor: cleanData.map((d, i) => d.label.trim() === 'OUTROS' ? '#94a3b8' : (isFinancial ? '#3b82f6' : '#f97316')),
            borderRadius: 4
        }]
    };

    const barOptions = {
        indexAxis: 'x',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 30 } },
        plugins: {
            tooltip: tooltipCallback,
            legend: { display: false }, 
            datalabels: {
                display: function(context) { return context.dataset.data[context.dataIndex] > 0; },
                color: '#1e293b',
                align: 'end',
                anchor: 'end',
                rotation: -90,
                offset: 4,
                font: { size: 9, weight: 'bold' },
                formatter: (v) => isFinancial ? shortenNumber(v) : v.toLocaleString('pt-BR')
            }
        },
        scales: {
            x: { 
                ticks: { 
                    maxRotation: 90, 
                    minRotation: 45, 
                    font: { size: 9 },
                    autoSkip: false, 
                    callback: function(value) {
                        const label = this.getLabelForValue(value);
                        if (Array.isArray(label)) { return label.map(l => l.length > 15 ? l.substring(0, 15) + '...' : l); }
                        return label.length > 15 ? label.substring(0, 15) + '...' : label;
                    }
                } 
            },
            y: { 
                beginAtZero: true,
                grace: '10%',
                position: 'left',
                grid: { display: true },
                ticks: { callback: v => isFinancial ? shortenNumber(v) : v },
                title: { display: true, text: isFinancial ? `Valor ${currentMetricName} (R$)` : 'Quantidade', font: { size: 9, weight: 'bold' } }
            }
        }
    };

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full hover:shadow-md transition">
            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-tight flex-1 pr-2">{displayTitle}</h3>
                <div className="flex gap-2 items-center shrink-0">
                    {isFinancial && (
                        <select value={finMetric} onChange={(e) => setFinMetric(e.target.value)} className="text-[9px] font-bold uppercase border border-slate-300 bg-slate-50 rounded px-2 py-1 outline-none">
                            <option value="total">Empenhado</option>
                            <option value="liquidado">Liquidado</option>
                            <option value="a_liquidar">A Liquidar</option>
                            <option value="pago">Pago / Exec Líq</option>
                            <option value="a_pagar">A Pagar</option>
                            <option value="cancelado">Cancelado</option>
                            <option value="bloqueado">Bloqueado</option>
                            <option value="executado">Executado</option>
                        </select>
                    )}
                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded hidden sm:inline-block">
                        {viewPie ? 'Fatias' : 'Barras'}: {cleanData.length}
                    </span>
                    <button onClick={() => setViewPie(!viewPie)} className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 transition shadow-sm cursor-pointer">
                        {viewPie ? '► BARRAS' : '► PIZZA'}
                    </button>
                </div>
            </div>
            <div className="w-full flex-1 flex flex-col min-h-[300px] relative">
                <div className="absolute inset-0">
                    {viewPie ? (
                        <ChartComponent id={`pie-${id}`} type="pie" data={pieData} options={pieOptions} />
                    ) : (
                        <ChartComponent id={`bar-${id}`} type="bar" data={barData} options={barOptions} />
                    )}
                </div>
            </div>
        </div>
    );
}

function KPICard({ title, value, subValue, diffValue, diffLabel, extraText, color, isCurrency }) {
    const colors = { 
        slate: "border-slate-800 text-slate-800", 
        blue: "border-blue-500 text-blue-700", 
        amber: "border-amber-500 text-amber-600", 
        emerald: "border-emerald-500 text-emerald-600",
        violet: "border-violet-500 text-violet-700",
        red: "border-red-500 text-red-600",
        orange: "border-orange-500 text-orange-600",
        teal: "border-teal-500 text-teal-700",
        cyan: "border-cyan-500 text-cyan-700"
    };
    const mainText = isCurrency ? formatBRL(value) : value.toLocaleString('pt-BR');
    
    const renderExtraText = () => {
        if (!extraText) return null;
        const lines = extraText.split('\n');
        return (
            <div className="text-[9.5px] font-bold text-slate-500 mt-2 leading-[1.1] border-t border-slate-100 pt-1">
                {lines.map((line, idx) => <div key={idx}>{line}</div>)}
            </div>
        );
    };

    return (
        <div className={`bg-white p-3 sm:p-5 rounded-2xl border-t-8 shadow-md flex flex-col justify-center overflow-hidden min-w-0 ${colors[color]}`}>
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1 truncate" title={title}>{title}</h3>
            <div className="flex flex-col w-full min-w-0">
                <AutoFitText text={mainText} className="font-black text-2xl tracking-tight" />
                {diffValue !== undefined && (
                    <span className="text-[10px] font-bold text-red-500 mt-1 truncate" title={`${diffLabel}: ${formatBRL(diffValue)}`}>
                        {diffLabel}: {formatBRL(diffValue)}
                    </span>
                )}
                {subValue !== undefined && (
                    <span className="text-[10px] font-bold opacity-70 mt-1">{formatPercentBR(subValue)} do Empenhado</span>
                )}
                {renderExtraText()}
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
            {onSearchChange !== undefined && (
                <input type="text" placeholder="Buscar..." value={searchVal} onChange={(e) => onSearchChange(e.target.value)} onClick={(e) => e.stopPropagation()} className="mt-2 w-full px-1 py-1 text-slate-800 text-[9px] font-normal rounded border border-slate-300 outline-none focus:border-blue-500 shadow-inner" />
            )}
        </th>
    );
}

function NumericHeader({ label, field, current, onSort, numFilters, setNumFilters, align="left", widthClass }) {
    const isSorted = current.key === field;
    const filterMin = numFilters[field] ? numFilters[field].min : '';
    const filterMax = numFilters[field] ? numFilters[field].max : '';
    const handleMin = (e) => { const val = e.target.value; setNumFilters(p => { const n = {...p}; n[field] = {...n[field], min: val}; return n; }); };
    const handleMax = (e) => { const val = e.target.value; setNumFilters(p => { const n = {...p}; n[field] = {...n[field], max: val}; return n; }); };
    return (
        <th className={`p-2 transition text-${align} bg-slate-50 relative group ${widthClass || 'w-auto'}`}>
            <div onMouseDown={startResize} className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize bg-transparent hover:bg-blue-400 z-20"></div>
            <div className={`flex items-center gap-1 cursor-pointer hover:text-blue-500 justify-${align === 'right' ? 'end' : align === 'center' ? 'center' : 'start'}`} onClick={() => onSort(field)}>
                {label} <span className="text-[8px] text-slate-400">{isSorted ? (current.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
            </div>
            <div className="flex flex-col gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                <input type="number" placeholder="< Max" value={filterMax} onChange={handleMax} className="w-full px-1 py-1 text-slate-800 text-[8px] font-normal rounded border border-slate-300 outline-none focus:border-blue-500 shadow-inner" />
                <input type="number" placeholder="> Min" value={filterMin} onChange={handleMin} className="w-full px-1 py-1 text-slate-800 text-[8px] font-normal rounded border border-slate-300 outline-none focus:border-blue-500 shadow-inner" />
            </div>
        </th>
    );
}

function DateFilterHeader({ label, field, current, onSort, dateFilters, setDateFilters, align="left", widthClass }) {
    const isSorted = current.key === field;
    const filterMin = dateFilters[field] ? dateFilters[field].min : '';
    const filterMax = dateFilters[field] ? dateFilters[field].max : '';
    const handleMin = (e) => { const val = e.target.value; setDateFilters(p => ({...p, [field]: {...p[field], min: val}})); };
    const handleMax = (e) => { const val = e.target.value; setDateFilters(p => ({...p, [field]: {...p[field], max: val}})); };
    return (
        <th className={`p-2 transition text-${align} bg-slate-50 relative group ${widthClass || 'w-auto'}`}>
            <div onMouseDown={startResize} className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize bg-transparent hover:bg-blue-400 z-20"></div>
            <div className={`flex items-center gap-1 cursor-pointer hover:text-blue-500 justify-${align === 'right' ? 'end' : align === 'center' ? 'center' : 'start'}`} onClick={() => onSort(field)}>
                {label} <span className="text-[8px] text-slate-400">{isSorted ? (current.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
            </div>
            <div className="flex flex-col gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                <input type="date" title="A partir de (Mínimo)" value={filterMin} onChange={handleMin} className="w-full px-1 py-1 text-slate-800 text-[8px] font-normal rounded border border-slate-300 outline-none focus:border-blue-500 shadow-inner" />
                <input type="date" title="Até (Máximo)" value={filterMax} onChange={handleMax} className="w-full px-1 py-1 text-slate-800 text-[8px] font-normal rounded border border-slate-300 outline-none focus:border-blue-500 shadow-inner" />
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
    const toggleOption = (opt) => { if (selected.includes(opt)) onChange(selected.filter(item => item !== opt)); else onChange([...selected, opt]); };
    const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
    const markAllVisible = () => { onChange(Array.from(new Set([...selected, ...filteredOptions]))); };

    return (
        <div className="relative" ref={ref}>
            <label className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-widest">{label}</label>
            <div className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold text-slate-700 cursor-pointer flex justify-between items-center shadow-sm" onClick={() => setIsOpen(!isOpen)}>
                <span className="truncate">{selected.length === 0 ? "TODOS OS REGISTROS" : `${selected.length} selecionado(s)`}</span>
                <span className="text-[10px]">▼</span>
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

function CollapsibleSection({ title, children, defaultOpen = false, globalTrigger, globalState }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    useEffect(() => { if (globalTrigger > 0) setIsOpen(globalState); }, [globalTrigger, globalState]);
    return (
        <div className="max-w-[1600px] mx-auto mb-8">
            <div className="bg-slate-800 text-white px-6 py-4 rounded-xl cursor-pointer flex justify-between items-center shadow-lg hover:bg-slate-700 transition border border-slate-700" onClick={() => setIsOpen(!isOpen)}>
                <h2 className="text-sm font-black tracking-widest uppercase flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full"></span>{title}</h2>
                <span className="font-bold text-lg text-slate-300">{isOpen ? '▼' : '►'}</span>
            </div>
            {isOpen && <div className="mt-6">{children}</div>}
        </div>
    );
}

function Dashboard() {
    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("A verificar sessão local...");
    const currentUser = sessionStorage.getItem('user_PainelGeral') || 'Usuário';
    const currentPerfil = sessionStorage.getItem('perfil_PainelGeral') || '';

    // Estado de Expansão Global das seções
    const [globalExpandState, setGlobalExpandState] = useState(false);
    const [expandTrigger, setExpandTrigger] = useState(0);

    const toggleAllSections = () => {
        const next = !globalExpandState;
        setGlobalExpandState(next);
        setExpandTrigger(prev => prev + 1);
    };
    
    const [sortConfig, setSortConfig] = useState({ key: 'v_empenhado', direction: 'desc' });
    const [top20Sort, setTop20Sort] = useState('emp_desc');
    const [top20ViewMode, setTop20ViewMode] = useState('fornecedor');
    
    const [top20100Sort, setTop20100Sort] = useState('emp_desc');
    const [top20100ViewMode, setTop20100ViewMode] = useState('fornecedor');

    const [fornecedorSort, setFornecedorSort] = useState('valor_desc');
    const [contratoSort, setContratoSort] = useState('valor_desc');
    const [scatterXAxis, setScatterXAxis] = useState('p_executado');
    const [scatterHiddenTags, setScatterHiddenTags] = useState([]);
    
    // Novos Estados de Filtros
    const [fFiscal, setFFiscal] = useState([]);
    const [fGestor, setFGestor] = useState([]);
    const [fFiscalSub, setFFiscalSub] = useState([]);
    const [fGestorSub, setFGestorSub] = useState([]);
    const [fSecLog, setFSecLog] = useState(["SGLS-CLASSE I", "SGLFE-CLASSE II", "SGLC-CLASSE III", "SGLME-CLASSE V (MUN)"]);
    const [fContrato, setFContrato] = useState([]);
    const [fCompra, setFCompra] = useState([]); 
    const [fModalidade, setFModalidade] = useState([]);
    const [fFornecedor, setFFornecedor] = useState([]);
    
    const [dInicDe, setDInicDe] = useState("");
    const [dInicAte, setDInicAte] = useState("");
    const [dFimDe, setDFimDe] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [dFimAte, setDFimAte] = useState("");

    const [searchContrato, setSearchContrato] = useState("");
    const [searchSituacao, setSearchSituacao] = useState("");
    const [searchFornecedor, setSearchFornecedor] = useState("");
    const [searchObjeto, setSearchObjeto] = useState("");
    const [searchGestorFiscal, setSearchGestorFiscal] = useState("");

    const [showMasterColsMenu, setShowMasterColsMenu] = useState(false);
    const masterColumnLabels = {
        contrato: "CONTRATO", situacao: "SITUAÇÃO", fornecedor: "FORNECEDOR", objeto: "OBJETO", gestorFiscal: "GESTORES/FISCAIS",
        dataInic: "INÍCIO", dataFim: "FIM", percTempo: "% TEMPO", diasPassaram: "PASSARAM", encerrandoDias: "FALTAM",
        difGlobal: "GLOBAL-EMP", vGlobal: "GLOBAL", empenhado: "EMPENHADO", liquidado: "LIQUIDADO", pLiquidado: "LIQ %",
        aLiquidar: "A LIQUIDAR", pALiquidar: "A LIQ %", pago: "PAGO", pPago: "PAGO %", aPagar: "A PAGAR", pAPagar: "A PAGAR %",
        bloqueado: "BLOQUEADO", pBloqueado: "BLOQ %", cancelado: "CANCELADO", pCancelado: "CANC %", executado: "EXECUTADO", pExecutado: "EXEC %",
        execLiq: "EXEC LIQ", pExecLiq: "EXEC LIQ %"
    };
    const [masterVisibleCols, setMasterVisibleCols] = useState({
        contrato: true, situacao: true, fornecedor: true, objeto: true, gestorFiscal: true,
        dataInic: true, dataFim: true, percTempo: true, diasPassaram: true, encerrandoDias: true,
        difGlobal: true, vGlobal: true, empenhado: true, liquidado: true, pLiquidado: true,
        aLiquidar: true, pALiquidar: true, pago: true, pPago: true, aPagar: true, pAPagar: true,
        bloqueado: true, pBloqueado: true, cancelado: true, pCancelado: true, executado: true, pExecutado: true,
        execLiq: true, pExecLiq: true
    });

    const initialNumFilters = {
        perc_tempo: {min:'', max:''}, dias_passaram: {min:'', max:''}, encerrando_dias: {min:'', max:''}, 
        dif_global: {min:'', max:''}, v_global: {min:'', max:''}, v_empenhado: {min:'', max:''}, 
        v_liquidado: {min:'', max:''}, p_liquidado: {min:'', max:''}, 
        v_a_liquidar: {min:'', max:''}, p_a_liquidar: {min:'', max:''}, 
        v_pago: {min:'', max:''}, p_pago: {min:'', max:''}, 
        v_a_pagar: {min:'', max:''}, p_a_pagar: {min:'', max:''}, 
        v_bloqueado: {min:'', max:''}, p_bloqueado: {min:'', max:''},
        v_cancelado: {min:'', max:''}, p_cancelado: {min:'', max:''}, 
        v_executado: {min:'', max:''}, p_executado: {min:'', max:''}
    };
    const [numFilters, setNumFilters] = useState(initialNumFilters);
    const initialDateFilters = { data_inic: {min:'', max:''}, data_fim: {min:'', max:''} };
    const [dateFilters, setDateFilters] = useState(initialDateFilters);

    // TAGs System para Ações Rápidas
    const [fSituacaoTags, setFSituacaoTags] = useState([]);
    const toggleSituacaoTag = (lbl) => {
        setFSituacaoTags(prev => prev.includes(lbl) ? prev.filter(x => x !== lbl) : [...prev, lbl]);
    };
    
    const toggleScatterTag = (tag) => {
        setScatterHiddenTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
    };

    const clearAllFilters = () => {
        setFFiscal([]); setFGestor([]); setFFiscalSub([]); setFGestorSub([]); setFSecLog([]); setFContrato([]); setFCompra([]); setFModalidade([]); setFFornecedor([]);
        setDInicDe(""); setDInicAte(""); setDFimDe(""); setDFimAte("");
        setSearchContrato(""); setSearchSituacao(""); setSearchFornecedor(""); setSearchObjeto(""); setSearchGestorFiscal("");
        setFSituacaoTags([]);
        setNumFilters(initialNumFilters); setDateFilters(initialDateFilters);
    };

    const getOffsetDateStr = (offsetDays) => {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayStr = getOffsetDateStr(0);
    const sevenDaysAgoStr = getOffsetDateStr(-7);
    const thirtyDaysAgoStr = getOffsetDateStr(-30);
    const sevenDaysAheadStr = getOffsetDateStr(7);
    const thirtyDaysAheadStr = getOffsetDateStr(30);
    const isHojeActive = dFimDe === todayStr && !dFimAte;
    const isVencendo7Active = dFimDe === todayStr && dFimAte === sevenDaysAheadStr;
    const isVencendo30Active = dFimDe === todayStr && dFimAte === thirtyDaysAheadStr;
    const isSevenActive = dFimDe === sevenDaysAgoStr && !dFimAte;
    const isThirtyActive = dFimDe === thirtyDaysAgoStr && !dFimAte;
    const toggleHoje = () => {
        if (isHojeActive) { setDFimDe(""); setDFimAte(""); }
        else { setDFimDe(todayStr); setDFimAte(""); }
    };
    const toggleVencendo7 = () => {
        if (isVencendo7Active) { setDFimDe(""); setDFimAte(""); }
        else { setDFimDe(todayStr); setDFimAte(sevenDaysAheadStr); }
    };
    const toggleVencendo30 = () => {
        if (isVencendo30Active) { setDFimDe(""); setDFimAte(""); }
        else { setDFimDe(todayStr); setDFimAte(thirtyDaysAheadStr); }
    };
    const toggleSevenDays = () => {
        if (isSevenActive) { setDFimDe(""); setDFimAte(""); }
        else { setDFimDe(sevenDaysAgoStr); setDFimAte(""); }
    };
    const toggleThirtyDays = () => {
        if (isThirtyActive) { setDFimDe(""); setDFimAte(""); }
        else { setDFimDe(thirtyDaysAgoStr); setDFimAte(""); }
    };

    const cSupItems = ["SGLS-CLASSE I", "SGLFE-CLASSE II", "SGLC-CLASSE III", "SGLME-CLASSE V (MUN)"];
    const isCSupActive = fSecLog.length === 4 && cSupItems.every(i => fSecLog.includes(i));
    const toggleCSup = () => { if (isCSupActive) setFSecLog([]); else setFSecLog(cSupItems); };

    const logout = () => {
        try {
            sessionStorage.removeItem('token_PainelGeral');
            sessionStorage.removeItem('user_PainelGeral');
            sessionStorage.removeItem('perfil_PainelGeral');
            sessionStorage.removeItem('ativo_PainelGeral');
            sessionStorage.removeItem('validade_PainelGeral');
            localStorage.removeItem('dashData_PainelGeral');
        } catch(e) {}
        window.location.reload();
    };

    const processData = (rowsArray, fromCache = false) => {
        if (!rowsArray || rowsArray.length < 2) { setStatus("Planilha vazia ou aba não encontrada."); setLoading(false); return; }
        setStatus("A estruturar matriz de dados...");
        const headers = rowsArray[0];
        const hoje = new Date(); hoje.setHours(0,0,0,0);

        const mappedRaw = rowsArray.slice(1).map(row => {
            const getVal = (exactNames, fallbackKeywords = []) => {
                let nameArr = Array.isArray(exactNames) ? exactNames : [exactNames];
                for (let name of nameArr) {
                    const normName = normalizeStr(name);
                    const idx = headers.findIndex(h => normalizeStr(h) === normName);
                    if (idx !== -1 && row[idx] !== undefined && row[idx] !== null) return row[idx].toString().trim();
                }
                for (let kw of fallbackKeywords) {
                    const normKw = normalizeStr(kw);
                    const idx = headers.findIndex(h => normalizeStr(h).includes(normKw));
                    if (idx !== -1 && row[idx] !== undefined && row[idx] !== null) return row[idx].toString().trim();
                }
                return "";
            };

            const dtInicParsed = parseDateBR(getVal(["Vig. Início", "Vigencia Inicio"]));
            const dtFimParsed = parseDateBR(getVal(["Vig. Fim", "Vigencia Fim"]));

            let diasRestantes = null, diasPassaram = null, percTempo = null;
            if (dtFimParsed) diasRestantes = Math.ceil((dtFimParsed - hoje) / 86400000);
            if (dtInicParsed) diasPassaram = Math.ceil((hoje - dtInicParsed) / 86400000);
            if (dtInicParsed && dtFimParsed) {
                const totalDias = Math.ceil((dtFimParsed - dtInicParsed) / 86400000);
                percTempo = totalDias > 0 ? diasPassaram / totalDias : 0;
            }

            const v_empenhado = parseValue(getVal(["TOTAL EMPENHADO"]));
            const v_liquidado = parseValue(getVal(["TOTAL LIQUIDADO"]));
            const v_pago = parseValue(getVal(["TOTAL PAGO"]));
            const v_cancelado = parseValue(getVal(["TOTAL CANCELADO"]));
            const v_bloqueado = parseValue(getVal(["TOTAL BLOQUEADO"]));

            const v_a_liquidar = v_empenhado - v_liquidado - v_cancelado - v_bloqueado;
            const v_a_pagar = v_empenhado - v_pago - v_cancelado - v_bloqueado;
            const p_a_liquidar = v_empenhado ? v_a_liquidar / v_empenhado : 0;
            const p_a_pagar = v_empenhado ? v_a_pagar / v_empenhado : 0;

            return {
                contrato: (getVal(["Número Contrato", "numero_contrato"]) || "-").toUpperCase(),
                fornecedor: (getVal(["Fornecedor"]) || "-").toUpperCase(),
                objeto: (getVal(["Objeto"]) || "-").toUpperCase(),
                fiscal: (getVal(["FISCAL_TITULAR", "Fiscal Titular"]) || "N/I").toUpperCase(),
                gestor: (getVal(["GESTOR_TITULAR", "Gestor Titular"]) || "N/I").toUpperCase(),
                fiscal_sub: (getVal(["FISCAL_SUBSTITUTO", "Fiscal Substituto"]) || "N/I").toUpperCase(),
                gestor_sub: (getVal(["GESTOR_SUBSTITUTO", "Gestor Substituto"]) || "N/I").toUpperCase(),
                sec_log: (getVal(["SEC_LOG"]) || "N/I").toUpperCase(),
                modalidade: (getVal(["Modalidade da Compra", "Modalidade"]) || "N/I").toUpperCase(),
                compra: (getVal(["Número da Compra", "Numero da Compra", "Número Compra", "Numero Compra"]) || "N/I").toUpperCase(),
                
                data_inic: getVal(["Vig. Início", "Vigencia Inicio"]), data_fim: getVal(["Vig. Fim", "Vigencia Fim"]),
                dtInicVal: dtInicParsed ? dtInicParsed.getTime() : 0, dtFimVal: dtFimParsed ? dtFimParsed.getTime() : 0,
                ano_vig_ini: dtInicParsed ? dtInicParsed.getFullYear().toString() : "N/I",
                dias_passaram: diasPassaram, perc_tempo: percTempo, encerrando_dias: diasRestantes,
                
                v_global: parseValue(getVal(["Valor Global"])), 
                v_empenhado, v_liquidado, v_pago, v_bloqueado, v_cancelado,
                v_recebido: parseValue(getVal(["TOTAL RECEBIDO", "VALOR RECEBIDO", "RECEBIDO"], ["recebido"])),
                v_executado: parseValue(getVal(["TOTAL EXECUTADO"])), 
                
                v_a_liquidar, p_a_liquidar, v_a_pagar, p_a_pagar,

                p_liquidado: parsePercentAsFloat(getVal(["TOTAL LIQUIDADO %"])),
                p_pago: parsePercentAsFloat(getVal(["TOTAL PAGO %"])), 
                p_bloqueado: parsePercentAsFloat(getVal(["TOTAL BLOQUEADO %"])),
                p_cancelado: parsePercentAsFloat(getVal(["TOTAL CANCELADO %"])), 
                p_executado: parsePercentAsFloat(getVal(["TOTAL EXECUTADO %"]))
            };
        }).filter(r => r.contrato !== "-" && r.fornecedor !== "-");

        // Agregação para definição das Situações Globais Exatas
        const cTotals = {};
        mappedRaw.forEach(r => {
            if (!cTotals[r.contrato]) cTotals[r.contrato] = { v_empenhado: 0, v_recebido: 0, v_liquidado: 0, v_pago: 0, v_executado: 0, v_bloqueado: 0, v_cancelado: 0, v_a_liquidar: 0, v_a_pagar: 0, encerrando_dias: r.encerrando_dias };
            cTotals[r.contrato].v_empenhado += r.v_empenhado || 0;
            cTotals[r.contrato].v_recebido += r.v_recebido || 0;
            cTotals[r.contrato].v_liquidado += r.v_liquidado || 0;
            cTotals[r.contrato].v_pago += r.v_pago || 0;
            cTotals[r.contrato].v_executado += r.v_executado || 0;
            cTotals[r.contrato].v_bloqueado += r.v_bloqueado || 0;
            cTotals[r.contrato].v_cancelado += r.v_cancelado || 0;
            cTotals[r.contrato].v_a_liquidar += r.v_a_liquidar || 0;
            cTotals[r.contrato].v_a_pagar += r.v_a_pagar || 0;
            if (r.encerrando_dias !== null) {
                cTotals[r.contrato].encerrando_dias = r.encerrando_dias;
            }
        });

        // Árvore de Decisão de TAGS
        mappedRaw.forEach(r => {
            const c = cTotals[r.contrato];
            r.contrato_empenhado_total = c.v_empenhado;
            r.dif_global = r.v_global - r.v_empenhado; 
            
            let flags = [];
            let sitText = "";
            
            if (c.v_cancelado > 0) { flags.push({ label: 'CAN', color: tagColorsMap['CAN'].css, hex: tagColorsMap['CAN'].hex }); sitText += "CAN "; }
            if (c.v_bloqueado > 0) { flags.push({ label: 'BLOQ', color: tagColorsMap['BLOQ'].css, hex: tagColorsMap['BLOQ'].hex }); sitText += "BLOQ "; }
            
            if (c.encerrando_dias !== null) {
                const isAtivo = c.encerrando_dias >= 0;
                const isLiquidadoZero = c.v_liquidado <= 0.01;
                const isPagoZero = c.v_pago <= 0.01;
                const isPagoIgualEmpenhado = c.v_pago >= (c.v_empenhado - 0.01) && c.v_empenhado > 0;
                const isExecutadoIgualEmpenhado = c.v_executado >= (c.v_empenhado - 0.01) && c.v_empenhado > 0;
                const isPagoMenorEmpenhado = c.v_pago < (c.v_empenhado - 0.01);
                const isExecutadoMenorEmpenhado = c.v_executado < (c.v_empenhado - 0.01);

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
                
                if(tagKey) {
                    flags.push({ label: tagKey, color: tagColorsMap[tagKey].css, hex: tagColorsMap[tagKey].hex });
                    sitText += `${tagKey} `;
                }
            }
            r.situacaoFlags = flags;
            r.situacao = sitText.trim() || 'N/I';
        });
        
        setRawData(mappedRaw);
        if (!fromCache) {
            try { localStorage.setItem('dashData_PainelGeral', JSON.stringify(mappedRaw)); } catch(e) {}
        }
        setLoading(false);
    };

    const loadData = async (forceSync = false, manualFileContent = null) => {
        setLoading(true);
        if (manualFileContent) {
            Papa.parse(manualFileContent, { header: false, skipEmptyLines: true, complete: (res) => { processData(res.data, true); setStatus("Offline - CSV Local"); } });
            return;
        }
        if (!forceSync) {
            try {
                const cachedData = localStorage.getItem('dashData_PainelGeral');
                if (cachedData) { setRawData(JSON.parse(cachedData)); setStatus("Online - Dados carregados via Apps Script"); setLoading(false); return; }
            } catch(e) {}
        }
        try {
            setStatus("A transferir dados via Apps Script...");
            const token = sessionStorage.getItem('token_PainelGeral');
            if (!token) throw new Error("Token de acesso não encontrado. Faça login novamente.");
            const response = await fetch(`${APPS_SCRIPT_URL}?acao=dados&token=${encodeURIComponent(token)}`);
            if (!response.ok) throw new Error("Falha na comunicação com o Apps Script.");
            const json = await response.json();
            if (!json.ok) throw new Error(json.mensagem || "Falha ao obter dados pelo Apps Script.");
            const rows = json.geral || json.values;
            if (!rows || rows.length < 2) throw new Error("Apps Script não retornou dados da planilha geral.");
            processData(rows, false);
            const extra = json.acesso && json.acesso.limitado ? ` | Acessos restantes: ${json.acesso.restantes}` : '';
            setStatus("Online - Dados carregados via Apps Script");
        } catch (error) { 
            console.error(error);
            setStatus(error.message || "Falha de Acesso à API. Utilize Carga Manual."); setLoading(false); 
        }
    };

    useEffect(() => { loadData(false, null); }, []);

    const filteredData = useMemo(() => {
        let filtered = rawData.filter(item => {
            const mFisc = fFiscal.length === 0 || fFiscal.includes(item.fiscal);
            const mGest = fGestor.length === 0 || fGestor.includes(item.gestor);
            const mFiscSub = fFiscalSub.length === 0 || fFiscalSub.includes(item.fiscal_sub);
            const mGestSub = fGestorSub.length === 0 || fGestorSub.includes(item.gestor_sub);
            const mSec = fSecLog.length === 0 || fSecLog.includes(item.sec_log);
            const mCont = fContrato.length === 0 || fContrato.includes(item.contrato);
            const mForn = fFornecedor.length === 0 || fFornecedor.includes(item.fornecedor);
            const mCompra = fCompra.length === 0 || fCompra.includes(item.compra);
            const mMod = fModalidade.length === 0 || fModalidade.includes(item.modalidade);
            
            const mDDe = !dInicDe || (item.dtInicVal && item.dtInicVal >= new Date(dInicDe+"T00:00:00").getTime());
            const mDAte = !dInicAte || (item.dtInicVal && item.dtInicVal <= new Date(dInicAte+"T23:59:59").getTime());
            const mFDe = !dFimDe || (item.dtFimVal && item.dtFimVal >= new Date(dFimDe+"T00:00:00").getTime());
            const mFAte = !dFimAte || (item.dtFimVal && item.dtFimVal <= new Date(dFimAte+"T23:59:59").getTime());

            let mDateTbl = true;
            if (dateFilters.data_inic.min && item.dtInicVal < new Date(dateFilters.data_inic.min + "T00:00:00").getTime()) mDateTbl = false;
            if (dateFilters.data_inic.max && item.dtInicVal > new Date(dateFilters.data_inic.max + "T23:59:59").getTime()) mDateTbl = false;
            if (dateFilters.data_fim.min && item.dtFimVal < new Date(dateFilters.data_fim.min + "T00:00:00").getTime()) mDateTbl = false;
            if (dateFilters.data_fim.max && item.dtFimVal > new Date(dateFilters.data_fim.max + "T23:59:59").getTime()) mDateTbl = false;

            const sCont = !searchContrato || item.contrato.includes(searchContrato.toUpperCase()) || item.compra.includes(searchContrato.toUpperCase()) || item.modalidade.includes(searchContrato.toUpperCase());
            const sSit = !searchSituacao || item.situacao.includes(searchSituacao.toUpperCase());
            const sForn = !searchFornecedor || item.fornecedor.includes(searchFornecedor.toUpperCase());
            const sObj = !searchObjeto || item.objeto.includes(searchObjeto.toUpperCase());
            const sGest = !searchGestorFiscal || item.gestor.includes(searchGestorFiscal.toUpperCase()) || item.fiscal.includes(searchGestorFiscal.toUpperCase());

            const mSitTag = fSituacaoTags.length === 0 || item.situacaoFlags.some(f => fSituacaoTags.includes(f.label));

            let mNum = true;
            for (const key in numFilters) {
                if (numFilters[key].min !== '' && (key.startsWith('p_') ? item[key]*100 : item[key]) < parseFloat(numFilters[key].min)) { mNum = false; break; }
                if (numFilters[key].max !== '' && (key.startsWith('p_') ? item[key]*100 : item[key]) > parseFloat(numFilters[key].max)) { mNum = false; break; }
            }
            return mFisc && mGest && mFiscSub && mGestSub && mSec && mCont && mForn && mCompra && mMod && mDDe && mDAte && mFDe && mFAte && mDateTbl && sCont && sSit && sForn && sObj && sGest && mSitTag && mNum;
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let valA = a[sortConfig.key], valB = b[sortConfig.key];
                if (sortConfig.key === 'data_inic') { valA = a.dtInicVal; valB = b.dtInicVal; }
                else if (sortConfig.key === 'data_fim') { valA = a.dtFimVal; valB = b.dtFimVal; }
                else if (['encerrando_dias', 'dias_passaram', 'perc_tempo'].includes(sortConfig.key)) {
                    valA = valA !== null ? valA : -999999; valB = valB !== null ? valB : -999999;
                }
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [rawData, fFiscal, fGestor, fFiscalSub, fGestorSub, fSecLog, fContrato, fFornecedor, fCompra, fModalidade, dInicDe, dInicAte, dFimDe, dFimAte, dateFilters, searchContrato, searchSituacao, searchFornecedor, searchObjeto, searchGestorFiscal, numFilters, sortConfig, fSituacaoTags]);

    const totalsMaster = useMemo(() => {
        let global = 0, dif = 0, emp = 0, liq = 0, pag = 0, blo = 0, can = 0, exe = 0, a_liq = 0, a_pag = 0;
        filteredData.forEach(r => { 
            global += r.v_global; dif += r.dif_global; emp += r.v_empenhado; liq += r.v_liquidado; pag += r.v_pago; 
            blo += r.v_bloqueado; can += r.v_cancelado; exe += r.v_executado; 
            a_liq += r.v_a_liquidar; a_pag += r.v_a_pagar; 
        });
        return { global, dif, emp, liq, pag, blo, can, exe, a_liq, a_pag };
    }, [filteredData]);

    const kpis = useMemo(() => {
        let emp = 0, liq = 0, pag = 0, blo = 0, can = 0, exe = 0;
        const processedContracts = new Set();
        let qtdAtivos = 0, qtdAtivosInexec = 0, qtdAtivosEmExec = 0, qtdAtivosExecTot = 0, qtdAtivosExecParc = 0;
        let qtdVencidos = 0, qtdVencInexecTot = 0, qtdVencidosTot = 0, qtdVencidosParc = 0;
        let qtdBloqueados = 0, qtdCancelados = 0;

        filteredData.forEach(r => { 
            emp += r.v_empenhado; liq += r.v_liquidado; pag += r.v_pago; blo += r.v_bloqueado; can += r.v_cancelado; exe += r.v_executado; 
            if (!processedContracts.has(r.contrato)) {
                processedContracts.add(r.contrato);
                if (r.situacaoFlags.some(f => f.label === 'CAN')) qtdCancelados++;
                if (r.situacaoFlags.some(f => f.label === 'BLOQ')) qtdBloqueados++;
                
                if (r.situacaoFlags.some(f => f.label.startsWith('ATIVO'))) {
                    qtdAtivos++;
                    if (r.situacaoFlags.some(f => f.label === 'ATIVO INEXEC')) qtdAtivosInexec++;
                    else if (r.situacaoFlags.some(f => f.label === 'ATIVO EM EXEC')) qtdAtivosEmExec++;
                    else if (r.situacaoFlags.some(f => f.label === 'ATIVO EXEC TOT')) qtdAtivosExecTot++;
                    else if (r.situacaoFlags.some(f => f.label === 'ATIVO EXEC PARC')) qtdAtivosExecParc++;
                } else if (r.situacaoFlags.some(f => f.label.startsWith('VENC'))) {
                    qtdVencidos++;
                    if (r.situacaoFlags.some(f => f.label === 'VENC INEXEC TOT')) qtdVencInexecTot++;
                    else if (r.situacaoFlags.some(f => f.label === 'VENC EXEC TOT')) qtdVencidosTot++;
                    else if (r.situacaoFlags.some(f => f.label === 'VENC EXEC PARC')) qtdVencidosParc++;
                }
            }
        });

        const validName = (v) => v && v !== '-' && v !== 'N/I';
        const gestoresTitulares = new Set(filteredData.map(d => d.gestor).filter(validName));
        const gestoresSubstitutos = new Set(filteredData.map(d => d.gestor_sub).filter(validName));
        const gestoresTodos = new Set([...gestoresTitulares, ...gestoresSubstitutos]);
        const fiscaisTitulares = new Set(filteredData.map(d => d.fiscal).filter(validName));
        const fiscaisSubstitutos = new Set(filteredData.map(d => d.fiscal_sub).filter(validName));
        const fiscaisTodos = new Set([...fiscaisTitulares, ...fiscaisSubstitutos]);

        return {
            qtdContratos: processedContracts.size,
            qtdGestores: gestoresTodos.size,
            qtdGestoresTit: gestoresTitulares.size,
            qtdGestoresSub: gestoresSubstitutos.size,
            qtdFiscais: fiscaisTodos.size,
            qtdFiscaisTit: fiscaisTitulares.size,
            qtdFiscaisSub: fiscaisSubstitutos.size,
            qtdFornecedores: new Set(filteredData.map(d => d.fornecedor).filter(validName)).size,
            qtdAtivos, qtdAtivosInexec, qtdAtivosEmExec, qtdAtivosExecTot, qtdAtivosExecParc,
            qtdVencidos, qtdVencInexecTot, qtdVencidosTot, qtdVencidosParc, qtdBloqueados, qtdCancelados,
            emp, liq, pag, blo, can, exe,
            pLiq: emp ? liq / emp : 0, pPag: emp ? pag / emp : 0, pBlo: emp ? blo / emp : 0, pCan: emp ? can / emp : 0, pExe: emp ? exe / emp : 0
        };
    }, [filteredData]);

    const getPersonData = (roleType) => {
        const map = {};
        filteredData.forEach(item => {
            const tit = item[roleType]; 
            const sub = item[roleType + '_sub']; 
            const emp = item.v_empenhado || 0;

            if (tit && tit !== '-' && tit !== 'N/I') {
                if (!map[tit]) map[tit] = { label: tit, emp_tit: 0, emp_sub: 0, qtd_tit: 0, qtd_sub: 0, total: 0 };
                map[tit].emp_tit += emp;
                map[tit].qtd_tit += 1;
                map[tit].total += emp;
            }
            if (sub && sub !== '-' && sub !== 'N/I') {
                if (!map[sub]) map[sub] = { label: sub, emp_tit: 0, emp_sub: 0, qtd_tit: 0, qtd_sub: 0, total: 0 };
                map[sub].emp_sub += emp;
                map[sub].qtd_sub += 1;
                map[sub].total += emp;
            }
        });
        return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
    };

    const gestorDataProcessed = getPersonData('gestor');
    const fiscalDataProcessed = getPersonData('fiscal');

    const getPieDataFull = (key, filterCustom = null) => {
        const map = {};
        const dataToProcess = filterCustom ? filteredData.filter(filterCustom) : filteredData;
        dataToProcess.forEach(item => {
            let val = item[key] && item[key] !== "-" ? item[key] : "N/I";
            if (key === 'situacao') {
                const mainTag = item.situacaoFlags.find(f => !['CAN','BLOQ'].includes(f.label));
                val = mainTag ? mainTag.label : val;
            }
            if (!map[val]) map[val] = { label: val, count: 0, total: 0, liquidado: 0, a_liquidar: 0, pago: 0, a_pagar: 0, bloqueado: 0, cancelado: 0, executado: 0 };
            map[val].count += 1; 
            map[val].total += item.v_empenhado;
            map[val].liquidado += item.v_liquidado;
            map[val].a_liquidar += item.v_a_liquidar;
            map[val].pago += item.v_pago;
            map[val].a_pagar += item.v_a_pagar;
            map[val].bloqueado += item.v_bloqueado;
            map[val].cancelado += item.v_cancelado;
            map[val].executado += item.v_executado;
        });
        return Object.values(map);
    };

    const modData = getPieDataFull('modalidade');
    const secData = getPieDataFull('sec_log');
    const compraData = getPieDataFull('compra');
    const fornData = getPieDataFull('fornecedor');
    const anoVigIniData = getPieDataFull('ano_vig_ini');
    
    // Gráficos Situação restritos a apenas as 7 TAGS
    const allowedSitTags = ['ATIVO INEXEC', 'ATIVO EM EXEC', 'ATIVO EXEC TOT', 'ATIVO EXEC PARC', 'VENC INEXEC TOT', 'VENC EXEC TOT', 'VENC EXEC PARC'];
    const sitFilter = (item) => item.situacaoFlags.some(f => allowedSitTags.includes(f.label));
    const situacaoData = getPieDataFull('situacao', sitFilter);

    const getTop20Key = (item, mode) => {
        if (mode === 'contrato') return item.contrato;
        if (mode === 'ano') return item.ano_vig_ini;
        if (mode === 'modalidade') return item.modalidade;
        if (mode === 'sec_log') return item.sec_log;
        return item.fornecedor;
    };

    const sortTop20Array = (arr, sortKey) => {
        const metricMap = {
            valor_desc: 'total', emp_desc: 'total', rec_desc: 'recebido', liq_desc: 'liquidado', pag_desc: 'pago',
            can_desc: 'cancelado', bloq_desc: 'bloqueado', aliq_desc: 'a_liquidar', apag_desc: 'a_pagar', qtd_desc: 'count'
        };
        if (sortKey === 'nome_asc') return arr.sort((a, b) => a.label.localeCompare(b.label));
        if (sortKey === 'nome_desc') return arr.sort((a, b) => b.label.localeCompare(a.label));
        const metric = metricMap[sortKey] || 'total';
        return arr.sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
    };

    const renderTop20SortOptions = () => (
        <>
            <option value="emp_desc">MAIOR EMPENHO</option>
            <option value="rec_desc">MAIOR RECEBIDO</option>
            <option value="liq_desc">MAIOR LIQUIDADO</option>
            <option value="pag_desc">MAIOR PAGO</option>
            <option value="can_desc">MAIOR CANCELADO</option>
            <option value="bloq_desc">MAIOR BLOQUEADO</option>
            <option value="aliq_desc">MAIOR A LIQUIDAR</option>
            <option value="apag_desc">MAIOR A PAGAR</option>
            <option value="qtd_desc">MAIOR QTD</option>
            <option value="nome_asc">ORDEM A-Z</option>
        </>
    );

    const top20DataProcessed = useMemo(() => {
        const map = {};
        filteredData.forEach(item => {
            const key = getTop20Key(item, top20ViewMode);
            if (!map[key]) map[key] = { label: key, count: 0, total: 0, recebido: 0, liquidado: 0, a_liquidar: 0, pago: 0, a_pagar: 0, bloqueado: 0, cancelado: 0, executado: 0, fornecedor: item.fornecedor };
            map[key].count += 1; 
            map[key].total += item.v_empenhado;
            map[key].recebido += item.v_recebido || 0;
            map[key].liquidado += item.v_liquidado;
            map[key].a_liquidar += item.v_a_liquidar;
            map[key].pago += item.v_pago;
            map[key].a_pagar += item.v_a_pagar;
            map[key].bloqueado += item.v_bloqueado;
            map[key].cancelado += item.v_cancelado;
            map[key].executado += item.v_executado;
        });
        let arr = Object.values(map);
        sortTop20Array(arr, top20Sort);
        return arr.slice(0, 20); 
    }, [filteredData, top20Sort, top20ViewMode]);
    
    // Novo Processamento para o Gráfico 100%
    const top20100DataProcessed = useMemo(() => {
        const map = {};
        filteredData.forEach(item => {
            const key = getTop20Key(item, top20100ViewMode);
            if (!map[key]) map[key] = { label: key, count: 0, total: 0, recebido: 0, liquidado: 0, a_liquidar: 0, pago: 0, a_pagar: 0, bloqueado: 0, cancelado: 0, executado: 0, fornecedor: item.fornecedor };
            map[key].count += 1; 
            map[key].total += item.v_empenhado;
            map[key].recebido += item.v_recebido || 0;
            map[key].liquidado += item.v_liquidado;
            map[key].a_liquidar += item.v_a_liquidar;
            map[key].pago += item.v_pago;
            map[key].a_pagar += item.v_a_pagar;
            map[key].bloqueado += item.v_bloqueado;
            map[key].cancelado += item.v_cancelado;
            map[key].executado += item.v_executado;
        });
        let arr = Object.values(map);
        sortTop20Array(arr, top20100Sort);
        return arr.slice(0, 20); 
    }, [filteredData, top20100Sort, top20100ViewMode]);

    const contratoChartData = useMemo(() => {
        let arr = [...filteredData];
        if (contratoSort === 'valor_desc') arr.sort((a, b) => b.v_empenhado - a.v_empenhado);
        else if (contratoSort === 'exec_desc') arr.sort((a, b) => b.p_executado - a.p_executado);
        else if (contratoSort === 'tempo_desc') arr.sort((a, b) => b.perc_tempo - a.perc_tempo);
        else if (contratoSort === 'dias_asc') arr.sort((a, b) => {
            let vA = a.encerrando_dias !== null ? a.encerrando_dias : 999999;
            let vB = b.encerrando_dias !== null ? b.encerrando_dias : 999999;
            return vA - vB;
        });
        else if (contratoSort === 'nome_asc') arr.sort((a, b) => a.contrato.localeCompare(b.contrato));
        return arr.slice(0, 20); 
    }, [filteredData, contratoSort]);

    const dataByAno = useMemo(() => {
        let minYear = 9999;
        let maxYear = 0;
        filteredData.forEach(d => {
            const yI = d.dtInicVal ? new Date(d.dtInicVal).getFullYear() : null;
            const yF = d.dtFimVal ? new Date(d.dtFimVal).getFullYear() : null;
            if (yI && yI < minYear) minYear = yI;
            if (yF && yF > maxYear) maxYear = yF;
        });
        const anos = [];
        if (minYear <= maxYear) { for(let y = minYear; y <= maxYear; y++) anos.push(y); }
        
        return anos.map(ano => {
            let inic = 0, enc = 0, dur = 0, emp = 0;
            filteredData.forEach(d => {
                const yI = d.dtInicVal ? new Date(d.dtInicVal).getFullYear() : null;
                const yF = d.dtFimVal ? new Date(d.dtFimVal).getFullYear() : null;
                if (yI === ano) { inic++; emp += d.v_empenhado; }
                if (yF === ano) enc++;
                if (yI !== null && yF !== null && yI < ano && yF > ano) dur++;
            });
            return { label: ano, iniciados: inic, encerrados: enc, durante: dur, empenhado: emp };
        });
    }, [filteredData]);

    const bubbleData = useMemo(() => {
        let maxEmp = 0;
        filteredData.forEach(d => { if (d.v_empenhado > maxEmp) maxEmp = d.v_empenhado; });
        return filteredData.filter(d => {
            const mainTag = d.situacaoFlags.find(f => !['CAN','BLOQ'].includes(f.label)) || d.situacaoFlags[0];
            const tagLabel = mainTag ? mainTag.label : 'OUTROS';
            return !scatterHiddenTags.includes(tagLabel);
        }).map(d => {
            const mainTag = d.situacaoFlags.find(f => !['CAN','BLOQ'].includes(f.label)) || d.situacaoFlags[0];
            const hexColor = mainTag ? mainTag.hex : '#94a3b8';
            return {
                x: Math.min(Math.max((d[scatterXAxis] || 0) * 100, -10), 110),
                y: Math.min(Math.max((d.perc_tempo || 0) * 100, -10), 110),
                r: maxEmp > 0 ? Math.max(4, (d.v_empenhado / maxEmp) * 25) : 4,
                contrato: d.contrato,
                fornecedor: d.fornecedor,
                v_empenhado: d.v_empenhado,
                situacao: d.situacao,
                color: hexColor
            };
        });
    }, [filteredData, scatterXAxis, scatterHiddenTags]);

    // Resumo de Contadores por Quadrante do Bubble Chart
    const q1Normal = bubbleData.filter(d => d.x <= 50 && d.y <= 50).length;
    const q2Ruim = bubbleData.filter(d => d.x <= 50 && d.y > 50).length;
    const q3Normal = bubbleData.filter(d => d.x > 50 && d.y > 50).length;
    const q4Otimo = bubbleData.filter(d => d.x > 50 && d.y <= 50).length;
    const totalBubbles = bubbleData.length;
    const pQ1 = totalBubbles ? ((q1Normal / totalBubbles) * 100).toFixed(1).replace('.', ',') + '%' : '0%';
    const pQ2 = totalBubbles ? ((q2Ruim / totalBubbles) * 100).toFixed(1).replace('.', ',') + '%' : '0%';
    const pQ3 = totalBubbles ? ((q3Normal / totalBubbles) * 100).toFixed(1).replace('.', ',') + '%' : '0%';
    const pQ4 = totalBubbles ? ((q4Otimo / totalBubbles) * 100).toFixed(1).replace('.', ',') + '%' : '0%';

    const masterNonMetricColCount = [
        'contrato', 'situacao', 'fornecedor', 'objeto', 'gestorFiscal', 'dataInic', 'dataFim', 'percTempo', 'diasPassaram', 'encerrandoDias'
    ].filter(k => masterVisibleCols[k]).length;

    const getMasterExportCols = () => {
        let cols = [];
        if (masterVisibleCols.contrato) cols.push({ header: "CONTRATO", key: "contrato" });
        if (masterVisibleCols.situacao) cols.push({ header: "SITUAÇÃO", key: "situacao" });
        if (masterVisibleCols.fornecedor) cols.push({ header: "FORNECEDOR", key: "fornecedor" });
        if (masterVisibleCols.objeto) cols.push({ header: "OBJETO", key: "objeto" });
        if (masterVisibleCols.gestorFiscal) cols.push({ header: "GESTOR/FISCAL", key: "gestor", format: (r) => `GT: ${r.gestor} | GS: ${r.gestor_sub} | FT: ${r.fiscal} | FS: ${r.fiscal_sub}` });
        if (masterVisibleCols.dataInic) cols.push({ header: "INÍCIO", key: "data_inic" });
        if (masterVisibleCols.dataFim) cols.push({ header: "FIM", key: "data_fim" });
        if (masterVisibleCols.percTempo) cols.push({ header: "% TEMPO", key: "perc_tempo", isPercent: true });
        if (masterVisibleCols.diasPassaram) cols.push({ header: "PASSARAM", key: "dias_passaram" });
        if (masterVisibleCols.encerrandoDias) cols.push({ header: "FALTAM", key: "encerrando_dias" });
        if (masterVisibleCols.difGlobal) cols.push({ header: "GLOBAL-EMP", key: "dif_global", isCurrency: true });
        if (masterVisibleCols.vGlobal) cols.push({ header: "GLOBAL", key: "v_global", isCurrency: true });
        if (masterVisibleCols.empenhado) cols.push({ header: "EMPENHADO", key: "v_empenhado", isCurrency: true });
        if (masterVisibleCols.liquidado) cols.push({ header: "LIQUIDADO", key: "v_liquidado", isCurrency: true });
        if (masterVisibleCols.pLiquidado) cols.push({ header: "LIQ %", key: "p_liquidado", isPercent: true });
        if (masterVisibleCols.aLiquidar) cols.push({ header: "A LIQUIDAR", key: "v_a_liquidar", isCurrency: true });
        if (masterVisibleCols.pALiquidar) cols.push({ header: "A LIQ %", key: "p_a_liquidar", isPercent: true });
        if (masterVisibleCols.pago) cols.push({ header: "PAGO", key: "v_pago", isCurrency: true });
        if (masterVisibleCols.pPago) cols.push({ header: "PAGO %", key: "p_pago", isPercent: true });
        if (masterVisibleCols.aPagar) cols.push({ header: "A PAGAR", key: "v_a_pagar", isCurrency: true });
        if (masterVisibleCols.pAPagar) cols.push({ header: "A PAGAR %", key: "p_a_pagar", isPercent: true });
        if (masterVisibleCols.bloqueado) cols.push({ header: "BLOQUEADO", key: "v_bloqueado", isCurrency: true });
        if (masterVisibleCols.pBloqueado) cols.push({ header: "BLOQ %", key: "p_bloqueado", isPercent: true });
        if (masterVisibleCols.cancelado) cols.push({ header: "CANCELADO", key: "v_cancelado", isCurrency: true });
        if (masterVisibleCols.pCancelado) cols.push({ header: "CANC %", key: "p_cancelado", isPercent: true });
        if (masterVisibleCols.executado) cols.push({ header: "EXECUTADO", key: "v_executado", isCurrency: true });
        if (masterVisibleCols.pExecutado) cols.push({ header: "EXEC %", key: "p_executado", isPercent: true });
        if (masterVisibleCols.execLiq) cols.push({ header: "EXEC LIQ", key: "v_pago", isCurrency: true });
        if (masterVisibleCols.pExecLiq) cols.push({ header: "EXEC LIQ %", key: "p_pago", isPercent: true });
        return cols;
    };

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center font-black text-slate-400 gap-4">
            <div className="w-12 h-12 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
            <p>A PROCESSAR LIGAÇÃO...</p>
        </div>
    );

    return (
        <div className="p-4 md:p-8 relative">
            <header className="max-w-[1600px] mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800">PAINEL GERAL DE CONTRATOS</h1>
                    <p className={`text-[11px] font-bold mt-1 ${status.includes("Erro") || status.includes("falhou") || status.includes("Falha") ? "text-red-600" : "text-emerald-600"}`}>● {status}</p>
                    <p className="text-[11px] italic text-blue-600 mt-0.5">Produzido por Cel Brito.</p>
                </div>
                <div className="flex flex-nowrap gap-3 items-center bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm overflow-x-auto max-w-full">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight whitespace-nowrap">CARGA MANUAL:</span>
                    <input type="file" accept=".csv" onChange={(e) => { const r = new FileReader(); r.onload = (ev) => loadData(false, ev.target.result); r.readAsText(e.target.files[0]); }} className="text-[10px] cursor-pointer text-blue-600 font-bold w-[190px] shrink-0" />
                    <div className="w-[1px] h-8 bg-slate-300 mx-1 hidden md:block shrink-0"></div>
                    <button onClick={() => loadData(true, null)} className="text-[11px] font-black text-white bg-blue-600 px-4 py-3 rounded-lg shadow hover:bg-blue-700 transition uppercase tracking-wider whitespace-nowrap shrink-0">SINCRONIZAR APIs</button>
                    <span className="text-[11px] font-black text-slate-500 uppercase whitespace-nowrap ml-1 shrink-0">
                        LOGADO COMO: <span className="text-blue-600">{String(currentUser || 'Usuário').toUpperCase()}</span>{currentPerfil && <span className="text-slate-400"> ({String(currentPerfil).toUpperCase()})</span>}
                    </span>
                    <button onClick={logout} className="text-[11px] font-black text-white bg-red-600 px-4 py-3 rounded-lg shadow hover:bg-red-700 transition uppercase tracking-wider whitespace-nowrap shrink-0">SAIR</button>
                </div>
            </header>

            <div className="max-w-[1600px] mx-auto mb-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xs font-black uppercase tracking-widest text-[#99bbd4] mb-4">Filtros Dinâmicos</h2>
                <div className="mb-4 pb-4 border-b border-slate-100 flex flex-col gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações Rápidas (Tempo e Status):</span>
                    <div className="flex flex-wrap gap-2 items-center">
                        <button onClick={toggleCSup} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isCSupActive ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>C SUP</button>
                        <button onClick={toggleHoje} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isHojeActive ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>CONTRATOS VIGENTES</button>
                        <button onClick={toggleVencendo7} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isVencendo7Active ? 'bg-lime-600 text-white border-lime-600 ring-2 ring-lime-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>CONTR VENCENDO EM 7 DIAS</button>
                        <button onClick={toggleVencendo30} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isVencendo30Active ? 'bg-teal-600 text-white border-teal-600 ring-2 ring-teal-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>CONTR VENCENDO EM 30 DIAS</button>
                        <button onClick={toggleSevenDays} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isSevenActive ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>CONTR 7 DIAS ATRÁS</button>
                        <button onClick={toggleThirtyDays} className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isThirtyActive ? 'bg-orange-600 text-white border-orange-600 ring-2 ring-orange-400 ring-offset-1' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>CONTR 30 DIAS ATRÁS</button>
                        <button onClick={clearAllFilters} className="text-[9px] font-bold uppercase bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700 transition shadow-md border border-slate-800">Limpar Filtros</button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        {Object.entries(tagColorsMap).map(([label, config]) => {
                            const isActive = fSituacaoTags.includes(label);
                            return (
                                <button key={label} onClick={() => toggleSituacaoTag(label)}
                                    className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded transition shadow-sm border ${isActive ? config.css + ' border-transparent shadow-inner ring-2 ring-blue-400 ring-offset-1' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
                    <MultiSelect label="FISCAL" options={[...new Set(rawData.map(r => r.fiscal))].sort()} selected={fFiscal} onChange={setFFiscal} />
                    <MultiSelect label="GESTOR" options={[...new Set(rawData.map(r => r.gestor))].sort()} selected={fGestor} onChange={setFGestor} />
                    <MultiSelect label="F. SUBSTITUTO" options={[...new Set(rawData.map(r => r.fiscal_sub))].sort()} selected={fFiscalSub} onChange={setFFiscalSub} />
                    <MultiSelect label="G. SUBSTITUTO" options={[...new Set(rawData.map(r => r.gestor_sub))].sort()} selected={fGestorSub} onChange={setFGestorSub} />
                    <MultiSelect label="SEC LOG" options={[...new Set(rawData.map(r => r.sec_log))].sort()} selected={fSecLog} onChange={setFSecLog} />
                    <MultiSelect label="CONTRATO" options={[...new Set(rawData.map(r => r.contrato))].sort()} selected={fContrato} onChange={setFContrato} />
                    <MultiSelect label="Nº COMPRA" options={[...new Set(rawData.map(r => r.compra))].sort()} selected={fCompra} onChange={setFCompra} />
                    <MultiSelect label="MODALIDADE" options={[...new Set(rawData.map(r => r.modalidade))].sort()} selected={fModalidade} onChange={setFModalidade} />
                    <MultiSelect label="FORNECEDOR" options={[...new Set(rawData.map(r => r.fornecedor))].sort()} selected={fFornecedor} onChange={setFFornecedor} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <DateInput label="INÍCIO (DE)" value={dInicDe} onChange={setDInicDe} />
                    <DateInput label="INÍCIO (ATÉ)" value={dInicAte} onChange={setDInicAte} />
                    <DateInput label="FIM (DE)" value={dFimDe} onChange={setDFimDe} />
                    <DateInput label="FIM (ATÉ)" value={dFimAte} onChange={setDFimAte} />
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto flex justify-end mb-3">
                <button onClick={toggleAllSections} className="text-[11px] font-black text-white bg-slate-800 px-5 py-3 rounded-xl shadow-lg hover:bg-slate-700 transition uppercase tracking-wider">
                    {globalExpandState ? '▼ RECOLHER TODAS AS SEÇÕES' : '► EXPANDIR TODAS AS SEÇÕES'}
                </button>
            </div>

            <CollapsibleSection title="INDICADORES DE DESEMPENHO (KPIs)" defaultOpen={false} globalTrigger={expandTrigger} globalState={globalExpandState}>
            <div className="max-w-[1600px] mx-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-4">
                <KPICard title="QTD Contratos" value={kpis.qtdContratos} color="slate" isCurrency={false} />
                <KPICard title="QTD Ativos" value={kpis.qtdAtivos} extraText={`Inexec: ${kpis.qtdAtivosInexec}\nEm Exec: ${kpis.qtdAtivosEmExec}\nExec Tot: ${kpis.qtdAtivosExecTot}\nExec Parc: ${kpis.qtdAtivosExecParc}`} color="blue" isCurrency={false} />
                <KPICard title="QTD Vencidos" value={kpis.qtdVencidos} extraText={`Inexec Tot: ${kpis.qtdVencInexecTot}\nExec Tot: ${kpis.qtdVencidosTot}\nExec Parc: ${kpis.qtdVencidosParc}`} color="slate" isCurrency={false} />
                <KPICard title="QTD Bloqueados" value={kpis.qtdBloqueados} color="orange" isCurrency={false} />
                <KPICard title="QTD Cancelados" value={kpis.qtdCancelados} color="red" isCurrency={false} />
                <KPICard title="QTD Gestores" value={kpis.qtdGestores} extraText={`Titular: ${kpis.qtdGestoresTit}
Substituto: ${kpis.qtdGestoresSub}`} color="amber" isCurrency={false} />
                <KPICard title="QTD Fiscais" value={kpis.qtdFiscais} extraText={`Titular: ${kpis.qtdFiscaisTit}
Substituto: ${kpis.qtdFiscaisSub}`} color="emerald" isCurrency={false} />
                <KPICard title="QTD Fornecedores" value={kpis.qtdFornecedores} color="violet" isCurrency={false} />
            </div>
            <div className="max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
                <KPICard title="Empenhado" value={kpis.emp} color="blue" isCurrency={true} />
                <KPICard title="Liquidado" value={kpis.liq} subValue={kpis.pLiq} diffLabel="Dif (Emp-Liq)" diffValue={kpis.emp - kpis.liq} color="amber" isCurrency={true} />
                <KPICard title="Pago" value={kpis.pag} subValue={kpis.pPag} diffLabel="Dif (Liq-Pag)" diffValue={kpis.liq - kpis.pag} color="emerald" isCurrency={true} />
                <KPICard title="Bloqueado" value={kpis.blo} subValue={kpis.pBlo} color="orange" isCurrency={true} />
                <KPICard title="Cancelado" value={kpis.can} subValue={kpis.pCan} color="red" isCurrency={true} />
                <KPICard title="Executado" value={kpis.exe} subValue={kpis.pExe} color="blue" isCurrency={true} />
                <KPICard title="Executado Líquido" value={kpis.pag} subValue={kpis.pPag} color="violet" isCurrency={true} />
            </div>
            </CollapsibleSection>

            <CollapsibleSection title="ESTATÍSTICAS" defaultOpen={false} globalTrigger={expandTrigger} globalState={globalExpandState}>
            <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-800 mb-4 uppercase">Valor Empenhado e QTD por Gestor</h3>
                    <ChartComponent id="gGestor" type="bar" data={{
                        labels: gestorDataProcessed.map(d => formatLabelMultiLine(d.label)),
                        datasets: [
                            { label: 'QTD Titular', data: gestorDataProcessed.map(d => d.qtd_tit), backgroundColor: '#eab308', xAxisID: 'x1', stack: 'StackQtd', datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', anchor: 'center', align: 'center', rotation: 0, font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                            { label: 'QTD Substituto', data: gestorDataProcessed.map(d => d.qtd_sub), backgroundColor: '#fde047', xAxisID: 'x1', stack: 'StackQtd', datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', anchor: 'center', align: 'center', rotation: 0, font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                            { label: 'Emp. Titular', data: gestorDataProcessed.map(d => d.emp_tit), backgroundColor: '#3b82f6', xAxisID: 'x', stack: 'StackEmp', datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', anchor: 'center', align: 'center', rotation: 0, font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                            { label: 'Emp. Substituto', data: gestorDataProcessed.map(d => d.emp_sub), backgroundColor: '#93c5fd', xAxisID: 'x', stack: 'StackEmp', datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', anchor: 'center', align: 'center', rotation: 0, font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } }
                        ]
                    }} options={{ indexAxis: 'y', responsive: true, plugins: { tooltip: tooltipCallback, customLinePlugin: { x: 20, scaleID: 'x1' }, datalabels: { display: true }, legend: { labels: { font: { size: 9 }, boxWidth: 10 } } }, scales: { x: { stacked: true, ticks: { callback: v => shortenNumber(v) } }, x1: { stacked: true, position: 'top', grid: { display: false } }, y: { stacked: true } } }} />
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-800 mb-4 uppercase">Valor Empenhado e QTD por Fiscal</h3>
                    <ChartComponent id="gFiscal" type="bar" data={{
                        labels: fiscalDataProcessed.map(d => formatLabelMultiLine(d.label)),
                        datasets: [
                            { label: 'QTD Titular', data: fiscalDataProcessed.map(d => d.qtd_tit), backgroundColor: '#f97316', xAxisID: 'x1', stack: 'StackQtd', datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', anchor: 'center', align: 'center', rotation: 0, font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                            { label: 'QTD Substituto', data: fiscalDataProcessed.map(d => d.qtd_sub), backgroundColor: '#fcd34d', xAxisID: 'x1', stack: 'StackQtd', datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', anchor: 'center', align: 'center', rotation: 0, font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                            { label: 'Emp. Titular', data: fiscalDataProcessed.map(d => d.emp_tit), backgroundColor: '#22c55e', xAxisID: 'x', stack: 'StackEmp', datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', anchor: 'center', align: 'center', rotation: 0, font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                            { label: 'Emp. Substituto', data: fiscalDataProcessed.map(d => d.emp_sub), backgroundColor: '#86efac', xAxisID: 'x', stack: 'StackEmp', datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', anchor: 'center', align: 'center', rotation: 0, font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } }
                        ]
                    }} options={{ indexAxis: 'y', responsive: true, plugins: { tooltip: tooltipCallback, customLinePlugin: { x: 10, scaleID: 'x1' }, datalabels: { display: true }, legend: { labels: { font: { size: 9 }, boxWidth: 10 } } }, scales: { x: { stacked: true, ticks: { callback: v => shortenNumber(v) } }, x1: { stacked: true, position: 'top', grid: { display: false } }, y: { stacked: true } } }} />
                </div>
            </div>

            {/* GRÁFICOS INTERATIVOS DE PIZZA / BARRAS VERTICAIS (LINHA 1) */}
            <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                <ToggleableChartCard id="pModV" title="Empenhado (Mod)" data={modData} isFinancial={true} />
                <ToggleableChartCard id="pModQ" title="QTD Contratos (Mod)" data={modData} isFinancial={false} />
                <ToggleableChartCard id="pSecV" title="Empenhado (SEC)" data={secData} isFinancial={true} />
                <ToggleableChartCard id="pSecQ" title="QTD Contratos (SEC)" data={secData} isFinancial={false} />
            </div>

            {/* GRÁFICOS INTERATIVOS DE PIZZA / BARRAS VERTICAIS (LINHA 2) */}
            <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                <ToggleableChartCard id="pCompV" title="Empenhado (Nr Compra)" data={compraData} isFinancial={true} />
                <ToggleableChartCard id="pCompQ" title="QTD Contratos (Nr Compra)" data={compraData} isFinancial={false} />
                <ToggleableChartCard id="pFornV" title="Empenhado (Fornecedor)" data={fornData} isFinancial={true} isFornecedor={true} />
                <ToggleableChartCard id="pFornQ" title="QTD Contratos (Fornecedor)" data={fornData} isFinancial={false} isFornecedor={true} />
            </div>

            {/* GRÁFICOS INTERATIVOS DE PIZZA / BARRAS VERTICAIS (LINHA 3) */}
            <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
                <ToggleableChartCard id="pAnoVigV" title="Empenhado (Ano Vig Ini)" data={anoVigIniData} isFinancial={true} />
                <ToggleableChartCard id="pAnoVigQ" title="QTD Contratos (Ano Vig Ini)" data={anoVigIniData} isFinancial={false} />
                <ToggleableChartCard id="pSitV" title="Empenhado (Situação)" data={situacaoData} isFinancial={true} />
                <ToggleableChartCard id="pSitQ" title="QTD Contratos (Situação)" data={situacaoData} isFinancial={false} />
            </div>

            </CollapsibleSection>

            <CollapsibleSection title="GRÁFICOS DE EXECUÇÃO" defaultOpen={false} globalTrigger={expandTrigger} globalState={globalExpandState}>
            {/* TOP 20: EXECUÇÃO ORÇAMENTÁRIA */}
            <div className="max-w-[1600px] mx-auto mb-10">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-slate-800 uppercase">EXECUÇÃO ORÇAMENTÁRIA E QTD (TOP 20)</h3>
                        <div className="flex gap-2 items-center">
                            <select value={top20Sort} onChange={(e) => setTop20Sort(e.target.value)} className="text-[10px] font-bold uppercase border border-slate-300 bg-slate-50 rounded px-2 py-1 outline-none">
                                {renderTop20SortOptions()}
                            </select>
                            <select value={top20ViewMode} onChange={(e) => setTop20ViewMode(e.target.value)} className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition shadow-sm cursor-pointer outline-none">
                                <option value="fornecedor">VER POR FORNECEDOR</option>
                                <option value="contrato">VER POR CONTRATO</option>
                                <option value="ano">VER POR ANO</option>
                                <option value="modalidade">VER POR MODALIDADE</option>
                                <option value="sec_log">VER POR SEC LOG</option>
                            </select>
                        </div>
                    </div>
                    <div className="h-[400px]">
                        <ChartComponent id="gTop20" type="bar" data={{
                            labels: top20DataProcessed.map(d => formatLabelMultiLine(top20ViewMode === 'fornecedor' ? d.label.replace(/^[\d\.\-\/]+\s*-\s*/, '') : d.label)),
                            datasets: [
                                { label: 'Empenhado', data: top20DataProcessed.map(d => d.total), backgroundColor: '#3b82f6', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                { label: 'Liquidado', data: top20DataProcessed.map(d => d.liquidado), backgroundColor: '#f59e0b', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                { label: 'Pago', data: top20DataProcessed.map(d => d.pago), backgroundColor: '#10b981', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                { label: 'A Liquidar', data: top20DataProcessed.map(d => Math.max(0, d.total - d.liquidado - d.cancelado - d.bloqueado)), backgroundColor: '#cbd5e1', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                { label: 'Bloqueado', data: top20DataProcessed.map(d => d.bloqueado), backgroundColor: '#f97316', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                { label: 'Cancelado', data: top20DataProcessed.map(d => d.cancelado), backgroundColor: '#ef4444', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                { label: 'A Pagar', data: top20DataProcessed.map(d => Math.max(0, d.total - d.pago - d.cancelado - d.bloqueado)), backgroundColor: '#94a3b8', yAxisID: 'y', borderRadius: 4, order: 2, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', rotation: -90, align: 'start', anchor: 'end', font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) } },
                                ...(top20ViewMode === 'fornecedor' || top20ViewMode === 'contrato' ? [{ label: 'QTD Contratos', data: top20DataProcessed.map(d => d.count), backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', yAxisID: 'y1', type: 'line', borderWidth: 2, pointRadius: 4, order: 1, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', rotation: -90, align: 'bottom', anchor: 'start', font: { size: 9, weight: 'bold' } } }] : [{ label: 'QTD Contratos', data: top20DataProcessed.map(d => d.count), backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', yAxisID: 'y1', type: 'line', borderWidth: 2, pointRadius: 4, order: 1, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', rotation: -90, align: 'bottom', anchor: 'start', font: { size: 9, weight: 'bold' } } }])
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
                                            if (top20ViewMode === 'contrato') return `Fornecedor: ${item.fornecedor}`;
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
                                y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Quantidade', font: { size: 8 } } } 
                            } 
                        }} />
                    </div>
                </div>
            </div>

            {/* TOP 20: EXECUÇÃO ORÇAMENTÁRIA EM 100% */}
            <div className="max-w-[1600px] mx-auto mb-10">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-slate-800 uppercase">EXECUÇÃO ORÇAMENTÁRIA E QTD EM 100 % (TOP 20)</h3>
                        <div className="flex gap-2 items-center">
                            <select value={top20100Sort} onChange={(e) => setTop20100Sort(e.target.value)} className="text-[10px] font-bold uppercase border border-slate-300 bg-slate-50 rounded px-2 py-1 outline-none">
                                {renderTop20SortOptions()}
                            </select>
                            <select value={top20100ViewMode} onChange={(e) => setTop20100ViewMode(e.target.value)} className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition shadow-sm cursor-pointer outline-none">
                                <option value="fornecedor">VER POR FORNECEDOR</option>
                                <option value="contrato">VER POR CONTRATO</option>
                                <option value="ano">VER POR ANO</option>
                                <option value="modalidade">VER POR MODALIDADE</option>
                                <option value="sec_log">VER POR SEC LOG</option>
                            </select>
                        </div>
                    </div>
                    <div className="h-[400px]">
                        <ChartComponent id="gTop20100" type="bar" data={{
                            labels: top20100DataProcessed.map(d => formatLabelMultiLine(top20100ViewMode === 'fornecedor' ? d.label.replace(/^[\d\.\-\/]+\s*-\s*/, '') : d.label)),
                            datasets: [
                                // Fundo / Stack de Componentes da Despesa (Somam 100% do Empenho) - Agrupados juntos e com Z-index mais baixo
                                { label: 'Liquidado %', data: top20100DataProcessed.map(d => d.total ? (d.liquidado / d.total) * 100 : 0), backgroundColor: '#f59e0b', xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '1', order: 4, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] >= 4; }, color: '#fff', rotation: -90, align: 'center', anchor: 'center', font: { size: 9, weight: 'bold' }, formatter: (v) => `${v.toFixed(1).replace('.', ',')}%` } },
                                { label: 'A Liquidar %', data: top20100DataProcessed.map(d => d.total ? Math.max(0, ((d.total - d.liquidado - d.bloqueado - d.cancelado) / d.total) * 100) : 0), backgroundColor: '#cbd5e1', xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '1', order: 4, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] >= 4; }, color: '#1e293b', rotation: -90, align: 'center', anchor: 'center', font: { size: 9, weight: 'bold' }, formatter: (v) => `${v.toFixed(1).replace('.', ',')}%` } },
                                { label: 'Bloqueado %', data: top20100DataProcessed.map(d => d.total ? (d.bloqueado / d.total) * 100 : 0), backgroundColor: '#f97316', xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '1', order: 4, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] >= 4; }, color: '#fff', rotation: -90, align: 'center', anchor: 'center', font: { size: 9, weight: 'bold' }, formatter: (v) => `${v.toFixed(1).replace('.', ',')}%` } },
                                { label: 'Cancelado %', data: top20100DataProcessed.map(d => d.total ? (d.cancelado / d.total) * 100 : 0), backgroundColor: '#ef4444', xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '1', order: 4, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] >= 4; }, color: '#fff', rotation: -90, align: 'center', anchor: 'center', font: { size: 9, weight: 'bold' }, formatter: (v) => `${v.toFixed(1).replace('.', ',')}%` } },
                                
                                // Empenhado Base (Borda Azul sobrepondo Tudo)
                                { label: 'Empenhado (100%)', data: top20100DataProcessed.map(d => 100), backgroundColor: 'transparent', borderColor: '#3b82f6', borderWidth: 2, xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '2', order: 3, datalabels: { display: false } },
                                
                                // Pago Acumulado (Linha Superior Verde sobrepondo Tudo)
                                { label: 'Pago %', data: top20100DataProcessed.map(d => d.total ? (d.pago / d.total) * 100 : 0), backgroundColor: 'transparent', borderColor: '#10b981', borderWidth: { top: 4, right: 0, bottom: 0, left: 0 }, xAxisID: 'x', yAxisID: 'y', grouped: false, stack: '3', order: 2, datalabels: { display: false } },
                                
                                // Linha de Quantidade Contratos (Sempre no Topo Z-Index)
                                { label: 'QTD Contratos', data: top20100DataProcessed.map(d => d.count), backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', type: 'line', borderWidth: 2, pointRadius: 4, xAxisID: 'x', yAxisID: 'y1', order: 1, datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', rotation: -90, align: 'bottom', anchor: 'start', font: { size: 9, weight: 'bold' } } }
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
                                            if (top20100ViewMode === 'contrato') return `Fornecedor: ${item.fornecedor}`;
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
                                            else if (label.includes('A Liquidar')) absVal = Math.max(0, d.total - d.liquidado - d.bloqueado - d.cancelado);
                                            else if (label.includes('Bloqueado')) absVal = d.bloqueado;
                                            else if (label.includes('Cancelado')) absVal = d.cancelado;
                                            else if (label.includes('Empenhado')) absVal = d.total;
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
                                y1: { display: top20100ViewMode === 'fornecedor', position: 'right', grid: { display: false }, title: { display: true, text: 'Quantidade', font: { size: 8 } }, grace: '10%', beginAtZero: true } 
                            } 
                        }} />
                    </div>
                </div>
            </div>
            
            <div className="max-w-[1600px] mx-auto mb-10">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-800 uppercase mb-6">Evolução por Ano (Iniciados, Encerrados, Durante e Empenhado)</h3>
                    <div className="h-[400px]">
                        <ChartComponent id="gAno" type="bar" data={{
                            labels: dataByAno.map(d => d.label),
                            datasets: [
                                {
                                    label: 'Contratos Iniciados', data: dataByAno.map(d => d.iniciados), backgroundColor: '#22c55e', yAxisID: 'y_qtd', borderRadius: 4, order: 2,
                                    datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', anchor: 'end', align: 'start', rotation: -90, font: { size: 10, weight: 'bold' }, formatter: v => v }
                                },
                                {
                                    label: 'Contratos Encerrados', data: dataByAno.map(d => d.encerrados), backgroundColor: '#ef4444', yAxisID: 'y_qtd', borderRadius: 4, order: 2,
                                    datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', anchor: 'end', align: 'start', rotation: -90, font: { size: 10, weight: 'bold' }, formatter: v => v }
                                },
                                {
                                    label: 'Contratos Durante', data: dataByAno.map(d => d.durante), backgroundColor: '#8b5cf6', yAxisID: 'y_qtd', borderRadius: 4, order: 2,
                                    datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#1e293b', anchor: 'end', align: 'start', rotation: -90, font: { size: 10, weight: 'bold' }, formatter: v => v }
                                },
                                { 
                                    label: 'Valor Empenhado (Iniciados)', data: dataByAno.map(d => d.empenhado), backgroundColor: '#3b82f6', borderColor: '#3b82f6', yAxisID: 'y_val', type: 'line', borderWidth: 3, tension: 0.3, pointRadius: 5, order: 1,
                                    datalabels: { display: true, color: '#1e3a8a', anchor: 'end', align: 'bottom', rotation: -90, font: { size: 10, weight: 'bold' }, formatter: v => shortenNumber(v) }
                                }
                            ]
                        }} options={{ 
                            indexAxis: 'x', responsive: true, maintainAspectRatio: false,
                            plugins: { 
                                tooltip: { callbacks: { label: function(context) { let val = context.raw; if (context.dataset.yAxisID === 'y_val') return context.dataset.label + ': ' + formatBRL(val); return context.dataset.label + ': ' + val.toLocaleString('pt-BR'); } } },
                                datalabels: { display: false },
                                legend: { position: 'top', labels: { boxWidth: 10, font: { size: 9 } } }
                            },
                            scales: { 
                                x: { ticks: { maxRotation: 90, minRotation: 0, font: { size: 10, weight: 'bold' }, autoSkip: false } },
                                y_qtd: { type: 'linear', position: 'left', title: { display: true, text: 'Quantidade', font: { weight: 'bold' } }, grace: '10%', beginAtZero: true }, 
                                y_val: { type: 'linear', position: 'right', grid: { display: false }, ticks: { callback: v => shortenNumber(v) }, title: { display: true, text: 'Valor Empenhado (R$)', font: { weight: 'bold' } }, grace: '10%', beginAtZero: true } 
                            }
                        }} />
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto mb-10">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-slate-800 uppercase">Desempenho e Empenho por Contrato (Top 20)</h3>
                        <select value={contratoSort} onChange={(e) => setContratoSort(e.target.value)} className="text-[10px] font-bold uppercase border border-slate-300 bg-slate-50 rounded px-2 py-1 outline-none">
                            <option value="valor_desc">Maior Valor</option><option value="exec_desc">Maior Execução</option>
                            <option value="tempo_desc">Maior Tempo</option><option value="dias_asc">Menos Dias Restantes</option>
                            <option value="nome_asc">Ordem Alfabética</option>
                        </select>
                    </div>
                    <div className="h-[400px]">
                        <ChartComponent id="gContrato" type="bar" data={{
                            labels: contratoChartData.map(d => formatLabelMultiLine(d.contrato)),
                            datasets: [
                                {
                                    label: '% Tempo', data: contratoChartData.map(d => d.perc_tempo), borderColor: '#ec4899', backgroundColor: '#ec4899', yAxisID: 'y_perc', type: 'line', borderWidth: 2, tension: 0.3, pointRadius: 4, order: 1,
                                    datalabels: { display: true, color: '#be185d', anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, formatter: v => formatPercentBR(v) }
                                },
                                { 
                                    label: '% Execução', data: contratoChartData.map(d => d.p_executado), 
                                    backgroundColor: '#22c55e', 
                                    yAxisID: 'y_perc', borderRadius: 4, type: 'bar', order: 2,
                                    datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', anchor: 'end', align: 'start', rotation: 90, font: { size: 9, weight: 'bold' }, formatter: v => formatPercentBR(v) }
                                },
                                { 
                                    label: '% Liquidado', data: contratoChartData.map(d => d.p_liquidado), 
                                    backgroundColor: '#f59e0b', 
                                    yAxisID: 'y_perc', borderRadius: 4, type: 'bar', order: 2,
                                    datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', anchor: 'end', align: 'start', rotation: 90, font: { size: 9, weight: 'bold' }, formatter: v => formatPercentBR(v) }
                                },
                                { 
                                    label: '% Exec. Líquida', data: contratoChartData.map(d => d.p_pago), 
                                    backgroundColor: '#8b5cf6', 
                                    yAxisID: 'y_perc', borderRadius: 4, type: 'bar', order: 2,
                                    datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', anchor: 'end', align: 'start', rotation: 90, font: { size: 9, weight: 'bold' }, formatter: v => formatPercentBR(v) }
                                },
                                { 
                                    label: 'Valor Empenhado', data: contratoChartData.map(d => d.v_empenhado), backgroundColor: '#06b6d4', yAxisID: 'y_val', borderRadius: 4, type: 'bar', order: 2,
                                    datalabels: { display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; }, color: '#fff', anchor: 'end', align: 'start', rotation: 90, font: { size: 9, weight: 'bold' }, formatter: v => shortenNumber(v) }
                                }
                            ]
                        }} options={{ 
                            indexAxis: 'x', responsive: true, maintainAspectRatio: false, plugins: { tooltip: getFullTooltipContrato(contratoChartData), datalabels: { display: false }, legend: { position: 'top', labels: { boxWidth: 10, font: { size: 9 } } } },
                            scales: { 
                                x: { ticks: { maxRotation: 90, minRotation: 45, font: { size: 9, weight: 'bold' }, autoSkip: false } },
                                y_perc: { type: 'linear', position: 'left', ticks: { callback: v => (v * 100).toFixed(0) + '%' }, grace: '10%', beginAtZero: true }, 
                                y_val: { type: 'linear', position: 'right', grid: { display: false }, ticks: { callback: v => shortenNumber(v) }, grace: '10%', beginAtZero: true } 
                            }
                        }} />
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto mb-10">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-xs font-black text-slate-800 uppercase">
                                Correlação: {scatterXAxis === 'p_executado' ? '% Executado' : scatterXAxis === 'p_liquidado' ? '% Liquidado' : '% Pago'} vs % Tempo (Tamanho da bolha: Empenhado)
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[9px] font-bold border border-slate-200">NORMAL (Q1): {q1Normal} ({pQ1})</span>
                                <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-[9px] font-bold border border-red-200">RUIM (Q2): {q2Ruim} ({pQ2})</span>
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[9px] font-bold border border-slate-200">NORMAL (Q3): {q3Normal} ({pQ3})</span>
                                <span className="bg-green-50 text-green-600 px-2 py-1 rounded text-[9px] font-bold border border-green-200">ÓTIMO (Q4): {q4Otimo} ({pQ4})</span>
                            </div>
                        </div>
                        <select value={scatterXAxis} onChange={(e) => setScatterXAxis(e.target.value)} className="text-[10px] font-bold uppercase border border-slate-300 bg-slate-50 rounded px-3 py-1.5 outline-none mt-1 shrink-0">
                            <option value="p_executado">% Executado</option>
                            <option value="p_liquidado">% Liquidado</option>
                            <option value="p_pago">% Pago</option>
                        </select>
                    </div>
                    <div className="h-[450px]">
                        <ChartComponent id="gScatter" type="bubble" data={{
                            datasets: [{
                                label: 'Contratos',
                                data: bubbleData,
                                backgroundColor: context => context.raw ? context.raw.color : 'rgba(14, 165, 233, 0.6)', 
                                borderColor: '#ffffff',
                                borderWidth: 1
                            }]
                        }} options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: { 
                                tooltip: getBubbleTooltip(scatterXAxis === 'p_executado' ? '% Executado' : scatterXAxis === 'p_liquidado' ? '% Liquidado' : '% Pago'), 
                                datalabels: { display: false }, 
                                legend: { display: false },
                                scatterQuadrantPlugin: { display: true }
                            },
                            scales: {
                                x: { 
                                    title: { display: true, text: scatterXAxis === 'p_executado' ? '% Executado' : scatterXAxis === 'p_liquidado' ? '% Liquidado' : '% Pago', font: { weight: 'bold' } }, 
                                    min: -10, 
                                    max: 110,
                                    ticks: {
                                        callback: function(value) {
                                            if (value >= 0 && value <= 100) return value + '%';
                                            return null;
                                        }
                                    }
                                },
                                y: { 
                                    title: { display: true, text: '% Tempo', font: { weight: 'bold' } }, 
                                    min: -10, 
                                    max: 110,
                                    ticks: {
                                        callback: function(value) {
                                            if (value >= 0 && value <= 100) return value + '%';
                                            return null;
                                        }
                                    }
                                }
                            }
                        }} />
                    </div>
                    {/* Legenda Customizada do Scatter Plot (Interativa) */}
                    <div className="mt-4 flex flex-wrap gap-3 justify-center border-t border-slate-100 pt-4">
                        {Object.keys(tagColorsMap).map(k => {
                            const isHidden = scatterHiddenTags.includes(k);
                            return (
                                <div key={k} onClick={() => toggleScatterTag(k)} className={`flex items-center gap-1 cursor-pointer transition ${isHidden ? 'opacity-30 grayscale' : 'hover:opacity-80'}`}>
                                    <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: tagColorsMap[k].hex }}></div>
                                    <span className={`text-[9px] font-bold ${isHidden ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{k}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            </CollapsibleSection>

            <CollapsibleSection title="TABELAS DE EXECUÇÃO" defaultOpen={false} globalTrigger={expandTrigger} globalState={globalExpandState}>
            <div className="max-w-[1600px] mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden mb-10">
                <div className="bg-slate-800 px-4 py-3 flex justify-between items-center flex-wrap gap-2">
                    <h3 className="text-white text-xs font-black tracking-widest uppercase">
                        Detalhamento Financeiro ({kpis.qtdContratos} Contratos Únicos | Mostrando {Math.min(100, filteredData.length)} Lançamentos)
                    </h3>
                    <div className="flex gap-2 items-center">
                        <div className="relative">
                            <button onClick={() => setShowMasterColsMenu(!showMasterColsMenu)} className="text-[10px] font-black bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded border border-white/20 shadow transition">
                                COLUNAS ▼
                            </button>
                            {showMasterColsMenu && (
                                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 p-3 max-h-[420px] overflow-y-auto custom-scrollbar">
                                    {Object.keys(masterColumnLabels).map(k => (
                                        <label key={k} className="flex items-center gap-3 text-[11px] font-black text-slate-700 cursor-pointer hover:bg-slate-50 p-2 rounded uppercase">
                                            <input type="checkbox" checked={masterVisibleCols[k]} onChange={() => setMasterVisibleCols(p => ({...p, [k]: !p[k]}))} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                                            {masterColumnLabels[k]}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="w-[1px] h-5 bg-slate-500 mx-1 hidden sm:block"></div>
                        <button onClick={() => exportTable.toExcel(filteredData, "Detalhamento_Master", getMasterExportCols())} className="text-[10px] font-bold bg-green-600 text-white px-3 py-1 rounded">EXCEL</button>
                        <button onClick={() => exportTable.toCSV(filteredData, "Detalhamento_Master", getMasterExportCols())} className="text-[10px] font-bold bg-blue-600 text-white px-3 py-1 rounded">CSV</button>
                        <button onClick={() => exportTable.toPDF(filteredData, "Detalhamento_Master", getMasterExportCols(), "DETALHAMENTO FINANCEIRO MASTER")} className="text-[10px] font-bold bg-red-600 text-white px-3 py-1 rounded">PDF</button>
                    </div>
                </div>
                <div className="overflow-x-auto h-[600px]">
                    <table className="w-full text-left text-[10px] border-collapse relative" style={{ tableLayout: 'fixed', minWidth: '2400px' }}>
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                            <tr className="text-slate-600 uppercase font-black tracking-tighter align-top">
                                {masterVisibleCols.contrato && <TextHeader widthClass="w-[7%]" label="Contrato" field="contrato" current={sortConfig} onSort={handleSort} searchVal={searchContrato} onSearchChange={setSearchContrato} />}
                                {masterVisibleCols.situacao && <TextHeader widthClass="w-[6%]" label="Situação" field="situacao" current={sortConfig} onSort={handleSort} searchVal={searchSituacao} onSearchChange={setSearchSituacao} />}
                                {masterVisibleCols.fornecedor && <TextHeader widthClass="w-[10%]" label="Fornecedor" field="fornecedor" current={sortConfig} onSort={handleSort} searchVal={searchFornecedor} onSearchChange={setSearchFornecedor} />}
                                {masterVisibleCols.objeto && <TextHeader widthClass="w-[10%]" label="Objeto" field="objeto" current={sortConfig} onSort={handleSort} searchVal={searchObjeto} onSearchChange={setSearchObjeto} />}
                                {masterVisibleCols.gestorFiscal && <TextHeader widthClass="w-[7%]" label="Gestores/Fiscais" field="gestor" current={sortConfig} onSort={handleSort} searchVal={searchGestorFiscal} onSearchChange={setSearchGestorFiscal} />}
                                {masterVisibleCols.dataInic && <DateFilterHeader widthClass="w-[5%]" label="Início" field="data_inic" current={sortConfig} onSort={handleSort} dateFilters={dateFilters} setDateFilters={setDateFilters} align="center" />}
                                {masterVisibleCols.dataFim && <DateFilterHeader widthClass="w-[5%]" label="Fim" field="data_fim" current={sortConfig} onSort={handleSort} dateFilters={dateFilters} setDateFilters={setDateFilters} align="center" />}
                                {masterVisibleCols.percTempo && <NumericHeader widthClass="w-[6%]" label="% Tempo" field="perc_tempo" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                                {masterVisibleCols.diasPassaram && <NumericHeader widthClass="w-[5%]" label="Passaram" field="dias_passaram" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                                {masterVisibleCols.encerrandoDias && <NumericHeader widthClass="w-[5%]" label="Faltam" field="encerrando_dias" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                                {masterVisibleCols.difGlobal && <NumericHeader widthClass="w-[6%]" label="GLOBAL-EMP" field="dif_global" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.vGlobal && <NumericHeader widthClass="w-[6%]" label="Global" field="v_global" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.empenhado && <NumericHeader widthClass="w-[6%]" label="Empenhado" field="v_empenhado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.liquidado && <NumericHeader widthClass="w-[6%]" label="Liquidado" field="v_liquidado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.pLiquidado && <NumericHeader widthClass="w-[4%]" label="Liq %" field="p_liquidado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                                {masterVisibleCols.aLiquidar && <NumericHeader widthClass="w-[6%]" label="A Liquidar" field="v_a_liquidar" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.pALiquidar && <NumericHeader widthClass="w-[4%]" label="A Liq %" field="p_a_liquidar" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                                {masterVisibleCols.pago && <NumericHeader widthClass="w-[6%]" label="Pago" field="v_pago" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.pPago && <NumericHeader widthClass="w-[4%]" label="Pago %" field="p_pago" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                                {masterVisibleCols.aPagar && <NumericHeader widthClass="w-[6%]" label="A Pagar" field="v_a_pagar" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.pAPagar && <NumericHeader widthClass="w-[4%]" label="A Pagar %" field="p_a_pagar" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                                {masterVisibleCols.bloqueado && <NumericHeader widthClass="w-[6%]" label="Bloqueado" field="v_bloqueado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.pBloqueado && <NumericHeader widthClass="w-[4%]" label="Bloq %" field="p_bloqueado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                                {masterVisibleCols.cancelado && <NumericHeader widthClass="w-[6%]" label="Cancelado" field="v_cancelado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.pCancelado && <NumericHeader widthClass="w-[4%]" label="Canc %" field="p_cancelado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                                {masterVisibleCols.executado && <NumericHeader widthClass="w-[6%]" label="Executado" field="v_executado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.pExecutado && <NumericHeader widthClass="w-[4%]" label="Exec %" field="p_executado" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                                {masterVisibleCols.execLiq && <NumericHeader widthClass="w-[6%]" label="EXEC LIQ" field="v_pago" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="right" />}
                                {masterVisibleCols.pExecLiq && <NumericHeader widthClass="w-[4%]" label="EXEC LIQ %" field="p_pago" current={sortConfig} onSort={handleSort} numFilters={numFilters} setNumFilters={setNumFilters} align="center" />}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.slice(0, 100).map((row, i) => (
                                <tr key={i} className="hover:bg-blue-50 transition-colors">
                                    {masterVisibleCols.contrato && <td className="p-3 font-black text-slate-800 break-words">
                                        {row.contrato}
                                        <div className="text-[8px] font-normal text-slate-500 mt-1 leading-tight">Compra: {row.compra}<br/>Mod: {row.modalidade}</div>
                                    </td>}
                                    {masterVisibleCols.situacao && <td className="p-3 align-top">
                                        <div className="flex flex-wrap gap-1">
                                            {row.situacaoFlags.map((f, idx) => (
                                                <span key={idx} className={`text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${f.color}`}>{f.label}</span>
                                            ))}
                                        </div>
                                    </td>}
                                    {masterVisibleCols.fornecedor && <td className="p-3 text-slate-600 font-bold break-words">{row.fornecedor}</td>}
                                    {masterVisibleCols.objeto && <td className="p-3 text-slate-500 break-words">{row.objeto}</td>}
                                    {masterVisibleCols.gestorFiscal && <td className="p-3 break-words">
                                        <div className="font-bold text-slate-700" title="Gestor Titular">GT: {row.gestor}</div>
                                        {row.gestor_sub !== 'N/I' && <div className="text-[9px] text-slate-500" title="Gestor Substituto">GS: {row.gestor_sub}</div>}
                                        <div className="font-bold text-slate-700 mt-1" title="Fiscal Titular">FT: {row.fiscal}</div>
                                        {row.fiscal_sub !== 'N/I' && <div className="text-[9px] text-slate-500" title="Fiscal Substituto">FS: {row.fiscal_sub}</div>}
                                    </td>}
                                    {masterVisibleCols.dataInic && <td className="p-3 text-slate-500 font-bold break-words text-center">{row.data_inic || "-"}</td>}
                                    {masterVisibleCols.dataFim && <td className="p-3 text-slate-500 font-bold break-words text-center">{row.data_fim || "-"}</td>}
                                    {masterVisibleCols.percTempo && <td className="p-3 align-middle">{row.perc_tempo !== null ? (<div className="flex items-center gap-1"><div className="w-full bg-slate-200 rounded-full h-1.5 flex-1 overflow-hidden"><div className={`h-1.5 rounded-full ${row.perc_tempo >= 1 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(Math.max(row.perc_tempo * 100, 0), 100)}%` }}></div></div><span className="text-[8px] font-bold text-slate-600 min-w-[30px] text-right">{formatPercentBR(row.perc_tempo)}</span></div>) : "-"}</td>}
                                    {masterVisibleCols.diasPassaram && <td className="p-3 text-center font-bold text-slate-600">{row.dias_passaram !== null ? `${row.dias_passaram} d` : "-"}</td>}
                                    {masterVisibleCols.encerrandoDias && <td className={`p-3 text-center font-bold ${row.encerrando_dias < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{row.encerrando_dias !== null ? `${row.encerrando_dias} d` : "-"}</td>}
                                    {masterVisibleCols.difGlobal && <td className={`p-3 text-right font-bold ${row.dif_global < 0 ? 'text-red-500' : (row.dif_global > 0 ? 'text-emerald-600' : 'text-slate-500')} bg-slate-50/30`}>{formatBRL(row.dif_global)}</td>}
                                    {masterVisibleCols.vGlobal && <td className="p-3 text-right font-bold text-slate-700 bg-slate-50/30">{formatBRL(row.v_global)}</td>}
                                    {masterVisibleCols.empenhado && <td className="p-3 text-right font-bold text-blue-700">{formatBRL(row.v_empenhado)}</td>}
                                    {masterVisibleCols.liquidado && <td className="p-3 text-right font-bold text-amber-600">{formatBRL(row.v_liquidado)}</td>}
                                    {masterVisibleCols.pLiquidado && <td className="p-3 text-center font-bold opacity-70 bg-slate-50/50">{formatPercentBR(row.p_liquidado)}</td>}
                                    {masterVisibleCols.aLiquidar && <td className="p-3 text-right font-bold text-amber-500">{formatBRL(row.v_a_liquidar)}</td>}
                                    {masterVisibleCols.pALiquidar && <td className="p-3 text-center font-bold opacity-70 bg-slate-50/50">{formatPercentBR(row.p_a_liquidar)}</td>}
                                    {masterVisibleCols.pago && <td className="p-3 text-right font-black text-emerald-600">{formatBRL(row.v_pago)}</td>}
                                    {masterVisibleCols.pPago && <td className="p-3 text-center font-bold opacity-70 bg-slate-50/50">{formatPercentBR(row.p_pago)}</td>}
                                    {masterVisibleCols.aPagar && <td className="p-3 text-right font-bold text-emerald-500">{formatBRL(row.v_a_pagar)}</td>}
                                    {masterVisibleCols.pAPagar && <td className="p-3 text-center font-bold opacity-70 bg-slate-50/50">{formatPercentBR(row.p_a_pagar)}</td>}
                                    {masterVisibleCols.bloqueado && <td className="p-3 text-right font-bold text-rose-600">{formatBRL(row.v_bloqueado)}</td>}
                                    {masterVisibleCols.pBloqueado && <td className="p-3 text-center font-bold opacity-70 bg-slate-50/50">{formatPercentBR(row.p_bloqueado)}</td>}
                                    {masterVisibleCols.cancelado && <td className="p-3 text-right font-bold text-red-600">{formatBRL(row.v_cancelado)}</td>}
                                    {masterVisibleCols.pCancelado && <td className="p-3 text-center font-bold opacity-70 bg-slate-50/50">{formatPercentBR(row.p_cancelado)}</td>}
                                    {masterVisibleCols.executado && <td className="p-3 text-right font-black text-blue-600">{formatBRL(row.v_executado)}</td>}
                                    {masterVisibleCols.pExecutado && <td className="p-3 text-center font-black text-blue-800 bg-slate-50/50">{formatPercentBR(row.p_executado)}</td>}
                                    {masterVisibleCols.execLiq && <td className="p-3 text-right font-black text-violet-600">{formatBRL(row.v_pago)}</td>}
                                    {masterVisibleCols.pExecLiq && <td className="p-3 text-center font-black text-violet-800 bg-violet-50/30">{formatPercentBR(row.p_pago)}</td>}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-200 sticky bottom-0 border-t-2 border-slate-400 shadow-md z-10">
                            <tr className="text-slate-800 uppercase font-black">
                                {masterNonMetricColCount > 0 && <td colSpan={masterNonMetricColCount} className="p-3 text-right">TOTAIS (Filtro Atual):</td>}
                                {masterVisibleCols.difGlobal && <td className="p-3 text-right text-slate-700">{formatBRL(totalsMaster.dif)}</td>}
                                {masterVisibleCols.vGlobal && <td className="p-3 text-right text-slate-700">{formatBRL(totalsMaster.global)}</td>}
                                {masterVisibleCols.empenhado && <td className="p-3 text-right text-blue-800">{formatBRL(totalsMaster.emp)}</td>}
                                {masterVisibleCols.liquidado && <td className="p-3 text-right text-amber-800">{formatBRL(totalsMaster.liq)}</td>}
                                {masterVisibleCols.pLiquidado && <td className="p-3 text-center">-</td>}
                                {masterVisibleCols.aLiquidar && <td className="p-3 text-right text-amber-600">{formatBRL(totalsMaster.a_liq)}</td>}
                                {masterVisibleCols.pALiquidar && <td className="p-3 text-center">-</td>}
                                {masterVisibleCols.pago && <td className="p-3 text-right text-emerald-800">{formatBRL(totalsMaster.pag)}</td>}
                                {masterVisibleCols.pPago && <td className="p-3 text-center">-</td>}
                                {masterVisibleCols.aPagar && <td className="p-3 text-right text-emerald-600">{formatBRL(totalsMaster.a_pag)}</td>}
                                {masterVisibleCols.pAPagar && <td className="p-3 text-center">-</td>}
                                {masterVisibleCols.bloqueado && <td className="p-3 text-right text-orange-800">{formatBRL(totalsMaster.blo)}</td>}
                                {masterVisibleCols.pBloqueado && <td className="p-3 text-center">-</td>}
                                {masterVisibleCols.cancelado && <td className="p-3 text-right text-red-800">{formatBRL(totalsMaster.can)}</td>}
                                {masterVisibleCols.pCancelado && <td className="p-3 text-center">-</td>}
                                {masterVisibleCols.executado && <td className="p-3 text-right text-blue-800">{formatBRL(totalsMaster.exe)}</td>}
                                {masterVisibleCols.pExecutado && <td className="p-3 text-center">-</td>}
                                {masterVisibleCols.execLiq && <td className="p-3 text-right text-violet-800">{formatBRL(totalsMaster.pag)}</td>}
                                {masterVisibleCols.pExecLiq && <td className="p-3 text-center">-</td>}
                            </tr>
                        </tfoot>
                    </table>
                </div>
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
                <h2 className="text-2xl font-black text-red-600 mb-4 uppercase">Erro Detetado no Painel</h2>
                <p className="text-slate-700 mb-6 font-bold">{this.state.error.toString()}</p>
                <button onClick={() => { sessionStorage.clear(); localStorage.removeItem('dashData_PainelGeral'); window.location.reload(); }} className="bg-red-600 text-white px-6 py-3 rounded shadow font-bold hover:bg-red-700">Limpar Sessão e Recarregar</button>
            </div>
        );
        return this.props.children; 
    }
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        try { return !!sessionStorage.getItem('token_PainelGeral'); } 
        catch(e) { return false; }
    });
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLogging, setIsLogging] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setIsLogging(true);

        try {
            const body = new URLSearchParams();
            body.append("acao", "login");
            body.append("usuario", username);
            body.append("senha", password);

            const resp = await fetch(APPS_SCRIPT_URL, { method: "POST", body });
            const json = await resp.json();

            if (!json.ok) {
                setError(json.mensagem || "Credenciais inválidas.");
                setIsLogging(false);
                return;
            }

            sessionStorage.setItem('token_PainelGeral', json.token);
            sessionStorage.setItem('user_PainelGeral', json.usuario?.nome || username);
            sessionStorage.setItem('perfil_PainelGeral', json.usuario?.perfil || '');
            sessionStorage.setItem('ativo_PainelGeral', json.usuario?.ativo || '');
            sessionStorage.setItem('validade_PainelGeral', json.usuario?.validade || '');
            try { localStorage.removeItem('dashData_PainelGeral'); } catch(e) {}

            setIsAuthenticated(true);
            setIsLogging(false);
        } catch (erro) {
            console.error(erro);
            setError("Falha ao tentar fazer login pelo Apps Script.");
            setIsLogging(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-800 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                <div className="bg-white p-8 rounded-2xl shadow-2xl w-[400px] max-w-[90%] border-t-8 border-blue-600 relative z-10">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Acesso Restrito</h1>
                        <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest">Painel Geral de Contratos</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Usuário</label>
                            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-slate-300 px-3 py-3 rounded text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-slate-50" placeholder="Digite o usuário..." autoComplete="username" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Senha</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-slate-300 px-3 py-3 rounded text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-slate-50" placeholder="••••••••" autoComplete="current-password" />
                        </div>
                        {error && (<div className="bg-red-50 border-l-4 border-red-500 p-3 rounded"><p className="text-[11px] font-bold text-red-600 text-center">{error}</p></div>)}
                        <button type="submit" disabled={isLogging} className={`w-full text-white font-black uppercase text-[11px] tracking-widest py-4 rounded transition-colors shadow-lg mt-2 ${isLogging ? 'bg-slate-400 cursor-wait' : 'bg-slate-800 hover:bg-slate-900'}`}>
                            {isLogging ? 'Autenticando...' : 'Autenticar Acesso'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }
    return <ErrorBoundary><Dashboard /></ErrorBoundary>;
}

ReactDOM.render(<App />, document.getElementById('root'));