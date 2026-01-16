'use client';

import { useState, useEffect, useRef } from 'react';

// Types
interface LineItem {
  id: string;
  description: string;
  amount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerAddress: string;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  notes: string;
  createdAt: string;
}

// Company details (fixed)
const COMPANY = {
  name: 'GS INTERNATIONAL TRADING',
  address: '74 FIRST STREET\nLINBRO PARK',
  vat: '4060290782',
  bankName: 'FNB',
  accountName: 'GS International Trading',
  accountNumber: '68088879615',
  contact: 'Joash - 0713830981',
  email: 'shaneghirdari2021@outlook.com',
};

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Format currency
const formatCurrency = (amount: number) => {
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format invoice number
const formatInvoiceNumber = (num: number) => {
  return num.toString().padStart(3, '0');
};

export default function InvoicePage() {
  // State
  const [invoiceNumber, setInvoiceNumber] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', amount: 0 }
  ]);
  const [taxRate, setTaxRate] = useState(15);
  const [notes, setNotes] = useState('');
  const [savedInvoices, setSavedInvoices] = useState<Invoice[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const previewRef = useRef<HTMLDivElement>(null);

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  // Load saved data on mount
  useEffect(() => {
    const savedNumber = localStorage.getItem('gs-invoice-number');
    if (savedNumber) {
      setInvoiceNumber(parseInt(savedNumber, 10));
    }
    
    const saved = localStorage.getItem('gs-invoices');
    if (saved) {
      setSavedInvoices(JSON.parse(saved));
    }
  }, []);

  // Add line item
  const addLineItem = () => {
    setLineItems([...lineItems, { id: generateId(), description: '', amount: 0 }]);
  };

  // Remove line item
  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  // Update line item
  const updateLineItem = (id: string, field: 'description' | 'amount', value: string | number) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Save invoice
  const saveInvoice = () => {
    const invoice: Invoice = {
      id: generateId(),
      invoiceNumber: formatInvoiceNumber(invoiceNumber),
      date,
      customerName,
      customerAddress,
      lineItems,
      subtotal,
      taxRate,
      tax,
      total,
      notes,
      createdAt: new Date().toISOString(),
    };

    const newInvoices = [invoice, ...savedInvoices];
    setSavedInvoices(newInvoices);
    localStorage.setItem('gs-invoices', JSON.stringify(newInvoices));
    
    // Increment invoice number for next time
    const nextNumber = invoiceNumber + 1;
    setInvoiceNumber(nextNumber);
    localStorage.setItem('gs-invoice-number', nextNumber.toString());
    
    return invoice;
  };

  // Clear form
  const clearForm = () => {
    setCustomerName('');
    setCustomerAddress('');
    setLineItems([{ id: generateId(), description: '', amount: 0 }]);
    setNotes('');
  };

  // Generate PDF
  const generatePDF = async () => {
    setIsGenerating(true);
    setShowPreview(true);
    
    // Wait for preview to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      const element = previewRef.current;
      if (!element) return;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      // Save the invoice
      const invoice = saveInvoice();
      
      // Download
      pdf.save(`GS_Invoice_${invoice.invoiceNumber}.pdf`);
      
      clearForm();
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGenerating(false);
      setShowPreview(false);
    }
  };

  // Generate DOCX
  const generateDOCX = async () => {
    setIsGenerating(true);
    
    try {
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
              AlignmentType, BorderStyle, WidthType, HeadingLevel } = await import('docx');
      const { saveAs } = await import('file-saver');
      
      const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
      const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
      
      // Create line item rows
      const itemRows = lineItems.filter(item => item.description).map(item => 
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 70, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun(item.description)] })],
            }),
            new TableCell({
              borders,
              width: { size: 30, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ 
                alignment: AlignmentType.RIGHT,
                children: [new TextRun(formatCurrency(item.amount))] 
              })],
            }),
          ],
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Header
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: COMPANY.name, bold: true, size: 36, color: '00b4d8' }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'International Trading', size: 24, color: '666666' })],
            }),
            new Paragraph({ children: [] }), // Spacer
            
            // Invoice title and number
            new Paragraph({
              children: [
                new TextRun({ text: `Invoice ${formatInvoiceNumber(invoiceNumber)}`, bold: true, size: 32 }),
                new TextRun({ text: `    Date: ${new Date(date).toLocaleDateString('en-GB')}`, size: 24 }),
              ],
            }),
            new Paragraph({ children: [] }), // Spacer
            
            // Customer
            new Paragraph({
              children: [new TextRun({ text: 'CUSTOMER', bold: true, size: 20, color: '00b4d8' })],
            }),
            new Paragraph({
              children: [new TextRun({ text: customerName, bold: true, size: 24 })],
            }),
            new Paragraph({
              children: [new TextRun({ text: customerAddress, size: 22 })],
            }),
            new Paragraph({ children: [] }), // Spacer
            
            // Items table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header row
                new TableRow({
                  children: [
                    new TableCell({
                      borders,
                      shading: { fill: '00b4d8' },
                      width: { size: 70, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: 'Details', bold: true, color: 'ffffff' })] 
                      })],
                    }),
                    new TableCell({
                      borders,
                      shading: { fill: '00b4d8' },
                      width: { size: 30, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ 
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: 'Amount', bold: true, color: 'ffffff' })] 
                      })],
                    }),
                  ],
                }),
                ...itemRows,
              ],
            }),
            new Paragraph({ children: [] }), // Spacer
            
            // Totals
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: `Subtotal: ${formatCurrency(subtotal)}`, size: 22 })],
            }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: `VAT (${taxRate}%): ${formatCurrency(tax)}`, size: 22 })],
            }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: `TOTAL: ${formatCurrency(total)}`, bold: true, size: 28, color: '00b4d8' })],
            }),
            new Paragraph({ children: [] }), // Spacer
            new Paragraph({ children: [] }), // Spacer
            
            // Bank details
            new Paragraph({
              children: [new TextRun({ text: 'BANK DETAILS', bold: true, size: 20, color: '00b4d8' })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Account: ${COMPANY.accountName}`, size: 22 })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Bank: ${COMPANY.bankName}`, size: 22 })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Account No: ${COMPANY.accountNumber}`, size: 22 })],
            }),
            new Paragraph({ children: [] }), // Spacer
            
            // Footer
            new Paragraph({
              children: [new TextRun({ text: `VAT: ${COMPANY.vat}`, size: 20, color: '666666' })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Contact: ${COMPANY.contact}`, size: 20, color: '666666' })],
            }),
            new Paragraph({
              children: [new TextRun({ text: COMPANY.email, size: 20, color: '666666' })],
            }),
            new Paragraph({ children: [] }), // Spacer
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'THANK YOU FOR YOUR BUSINESS!', bold: true, size: 24, color: '00b4d8' })],
            }),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const uint8Array = new Uint8Array(buffer);
      const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      // Save the invoice
      const invoice = saveInvoice();
      
      saveAs(blob, `GS_Invoice_${invoice.invoiceNumber}.docx`);
      
      clearForm();
    } catch (error) {
      console.error('DOCX generation error:', error);
      alert('Error generating DOCX. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Export all invoices as JSON backup
  const exportBackup = () => {
    const data = JSON.stringify(savedInvoices, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GS_Invoices_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Delete invoice from history
  const deleteInvoice = (id: string) => {
    if (confirm('Delete this invoice from history?')) {
      const newInvoices = savedInvoices.filter(inv => inv.id !== id);
      setSavedInvoices(newInvoices);
      localStorage.setItem('gs-invoices', JSON.stringify(newInvoices));
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-gs-blue to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-gs-blue/20">
              <span className="text-3xl font-bold text-white">GS</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Invoice Generator</h1>
              <p className="text-gs-silver text-sm">GS International Trading</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History ({savedInvoices.length})
            </button>
            
            {savedInvoices.length > 0 && (
              <button
                onClick={exportBackup}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                title="Export backup"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {/* History Panel */}
        {showHistory && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Invoice History</h2>
            
            {savedInvoices.length === 0 ? (
              <p className="text-slate-400">No invoices yet. Create your first invoice below!</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {savedInvoices.map(inv => (
                  <div key={inv.id} className="bg-slate-900/50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-gs-blue font-mono font-bold">#{inv.invoiceNumber}</span>
                        <span className="text-white font-medium">{inv.customerName}</span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        {new Date(inv.date).toLocaleDateString('en-GB')} • {formatCurrency(inv.total)}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteInvoice(inv.id)}
                      className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invoice Form */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Form */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
            {/* Invoice Number & Date */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <label className="block text-sm text-gs-silver mb-1">Invoice Number</label>
                <div className="text-3xl font-bold text-gs-blue font-mono">
                  #{formatInvoiceNumber(invoiceNumber)}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gs-silver mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gs-blue uppercase tracking-wider mb-3">Customer</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Customer / Company Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500"
                />
                <textarea
                  placeholder="Address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 resize-none"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gs-blue uppercase tracking-wider">Items</h3>
                <button
                  onClick={addLineItem}
                  className="text-gs-blue hover:text-gs-blue-light transition-colors text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Item
                </button>
              </div>
              
              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div key={item.id} className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500"
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={item.amount || ''}
                        onChange={(e) => updateLineItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-32 bg-slate-900 border border-slate-600 rounded-lg pl-7 pr-4 py-3 text-white placeholder-slate-500"
                      />
                    </div>
                    {lineItems.length > 1 && (
                      <button
                        onClick={() => removeLineItem(item.id)}
                        className="p-3 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tax Rate */}
            <div className="mb-6">
              <label className="block text-sm text-gs-silver mb-2">VAT Rate (%)</label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-24 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>

            {/* Totals */}
            <div className="bg-slate-900/50 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-slate-300 mb-2">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-300 mb-2">
                <span>VAT ({taxRate}%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-slate-700">
                <span>Total</span>
                <span className="text-gs-blue">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm text-gs-silver mb-2">Notes (optional)</label>
              <textarea
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={generatePDF}
                disabled={!customerName || lineItems.every(i => !i.description) || isGenerating}
                className="flex-1 py-3 bg-gradient-to-r from-gs-blue to-blue-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed btn-glow flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Download PDF
                  </>
                )}
              </button>
              
              <button
                onClick={generateDOCX}
                disabled={!customerName || lineItems.every(i => !i.description) || isGenerating}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download DOCX
              </button>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Live Preview
            </div>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">GS</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{COMPANY.name}</h2>
                    <p className="text-cyan-400 text-sm">International Trading</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">Invoice #{formatInvoiceNumber(invoiceNumber)}</div>
                    <div className="text-gray-500 text-sm mt-1">Date: {new Date(date).toLocaleDateString('en-GB')}</div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="text-xs text-cyan-600 font-semibold uppercase tracking-wider mb-1">Bill To</div>
                  <div className="text-gray-900 font-medium">{customerName || 'Customer Name'}</div>
                  <div className="text-gray-500 text-sm whitespace-pre-line">{customerAddress || 'Address'}</div>
                </div>
                
                <table className="w-full mb-6">
                  <thead>
                    <tr className="border-b-2 border-cyan-500">
                      <th className="text-left py-2 text-gray-600 text-sm">Description</th>
                      <th className="text-right py-2 text-gray-600 text-sm">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.filter(i => i.description).map(item => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-3 text-gray-800">{item.description}</td>
                        <td className="py-3 text-right text-gray-800">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                    {lineItems.every(i => !i.description) && (
                      <tr className="border-b border-gray-100">
                        <td className="py-3 text-gray-400 italic">No items yet</td>
                        <td className="py-3 text-right text-gray-400">R0.00</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                
                <div className="flex justify-end">
                  <div className="w-48">
                    <div className="flex justify-between py-1 text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-700">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-sm">
                      <span className="text-gray-500">VAT ({taxRate}%)</span>
                      <span className="text-gray-700">{formatCurrency(tax)}</span>
                    </div>
                    <div className="flex justify-between py-2 text-lg font-bold border-t border-gray-200 mt-2">
                      <span className="text-gray-900">Total</span>
                      <span className="text-cyan-600">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-400 mb-2">Bank Details</div>
                  <div className="text-sm text-gray-600">
                    {COMPANY.bankName} • {COMPANY.accountNumber}
                  </div>
                  <div className="text-xs text-gray-400 mt-4">VAT: {COMPANY.vat}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Hidden PDF Preview (for generation) */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div ref={previewRef} className="bg-white w-[210mm] min-h-[297mm] p-8" style={{ fontFamily: 'Inter, Arial, sans-serif' }}>
            {/* PDF Header */}
            <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 -mx-8 -mt-8 px-8 py-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">GS</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{COMPANY.name}</h1>
                  <p className="text-cyan-400">International Trading</p>
                </div>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="flex justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Invoice #{formatInvoiceNumber(invoiceNumber)}</h2>
                <p className="text-gray-500 mt-1">Date: {new Date(date).toLocaleDateString('en-GB')}</p>
              </div>
            </div>

            {/* Customer */}
            <div className="mb-8">
              <div className="text-xs text-cyan-600 font-semibold uppercase tracking-wider mb-2">Customer</div>
              <div className="text-xl font-semibold text-gray-900">{customerName}</div>
              <div className="text-gray-600 whitespace-pre-line">{customerAddress}</div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-8">
              <thead>
                <tr className="bg-cyan-500 text-white">
                  <th className="text-left py-3 px-4 rounded-l-lg">Details</th>
                  <th className="text-right py-3 px-4 rounded-r-lg">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.filter(i => i.description).map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-3 px-4 text-gray-800">{item.description}</td>
                    <td className="py-3 px-4 text-right text-gray-800">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">VAT ({taxRate}%)</span>
                  <span className="text-gray-900">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between py-3 text-xl font-bold">
                  <span className="text-gray-900">TOTAL</span>
                  <span className="text-cyan-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="bg-gray-100 rounded-xl p-6 mb-8">
              <div className="text-sm font-semibold text-cyan-600 uppercase tracking-wider mb-3">Bank Details</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Account Name:</span>
                  <span className="text-gray-900 ml-2">{COMPANY.accountName}</span>
                </div>
                <div>
                  <span className="text-gray-500">Bank:</span>
                  <span className="text-gray-900 ml-2">{COMPANY.bankName}</span>
                </div>
                <div>
                  <span className="text-gray-500">Account No:</span>
                  <span className="text-gray-900 ml-2 font-mono">{COMPANY.accountNumber}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 pt-6 mt-auto">
              <div className="flex justify-between items-center text-sm text-gray-500">
                <div>
                  <div>VAT: {COMPANY.vat}</div>
                  <div>{COMPANY.address.replace('\n', ' • ')}</div>
                </div>
                <div className="text-right">
                  <div>{COMPANY.contact}</div>
                  <div>{COMPANY.email}</div>
                </div>
              </div>
              <div className="text-center mt-6 text-cyan-600 font-semibold">
                THANK YOU FOR YOUR BUSINESS!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
