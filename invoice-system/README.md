# GS International Trading - Invoice System

A professional invoice generation system for GS International Trading.

## Features

- ✅ **Auto-incrementing invoice numbers** (001, 002, 003...)
- ✅ **Live preview** as you type
- ✅ **PDF export** - Professional, print-ready invoices
- ✅ **DOCX export** - Editable Word documents
- ✅ **Dynamic line items** - Add/remove rows
- ✅ **Auto-calculate** - Subtotal, VAT, Total
- ✅ **Invoice history** - Track all generated invoices
- ✅ **JSON backup export** - Download all invoice data
- ✅ **Dark mode UI** - Modern, professional interface
- ✅ **Responsive design** - Works on desktop and tablet

## Quick Start

```bash
# Navigate to the invoice system folder
cd /Users/tredouxwillemse/Desktop/gardian-connect/invoice-system

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:3001
```

## Company Details (Pre-configured)

The following company details are pre-filled and appear on every invoice:

| Field | Value |
|-------|-------|
| Company | GS International Trading |
| Address | 74 First Street, Linbro Park |
| VAT | 4060290782 |
| Bank | FNB |
| Account | 68088879615 |
| Contact | Joash - 0713830981 |
| Email | shaneghirdari2021@outlook.com |

## How to Use

1. **Start the app** - Run `npm run dev` and open http://localhost:3001
2. **Fill in customer details** - Name and address
3. **Add line items** - Description and amount for each job/service
4. **Review the live preview** - See exactly what the invoice will look like
5. **Download** - Click "Download PDF" or "Download DOCX"
6. **Invoice saved automatically** - Stored in browser + available in History

## Data Storage

- **Invoice Number**: Stored in browser localStorage, auto-increments
- **Invoice History**: All invoices saved to localStorage
- **Backup**: Export all invoices as JSON from the History panel

## Customizing Company Details

Edit the `COMPANY` object in `app/page.tsx`:

```typescript
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
```

## Adding Your Logo

1. Place your logo file in the `public/` folder as `logo.jpg` or `logo.png`
2. Update the logo component in `app/page.tsx` to use an `<img>` tag instead of the GS text

## Deployment

### Option 1: Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Option 2: Static Export
```bash
npm run build
# Deploy the .next folder
```

## Tech Stack

- **Next.js 14** - React framework
- **Tailwind CSS** - Styling
- **jsPDF + html2canvas** - PDF generation
- **docx** - Word document generation
- **file-saver** - Download handling

## Troubleshooting

**Invoice number not incrementing?**
- Check browser localStorage: `localStorage.getItem('gs-invoice-number')`
- Reset: `localStorage.setItem('gs-invoice-number', '1')`

**PDF looks different than preview?**
- Ensure you're using a modern browser (Chrome recommended)
- Check console for any errors

**History not showing?**
- Check: `localStorage.getItem('gs-invoices')`
- Clear and retry: `localStorage.removeItem('gs-invoices')`

---

Built with ❤️ for GS International Trading
