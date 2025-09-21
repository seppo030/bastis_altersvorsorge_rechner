import React, { useMemo, useRef } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function toEUR(v, fd=0){
  if (!isFinite(v)) return '–'
  return v.toLocaleString('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:fd,minimumFractionDigits:fd})
}
const pctToMonthly = (p)=> (p/100)/12
const pow = Math.pow

// PV of growing annuity (monthly), first payment at period end
// PV = P / (r - g) * (1 - ((1+g)/(1+r))^N)
// Handles r≈g edge-case
function pvGrowingAnnuity(P, r, g, N){
  if (N<=0) return 0
  if (Math.abs(r-g) < 1e-9){
    // when r ~ g, PV ≈ P * N / (1+r)  (linear approx)
    return P * N / (1+r)
  }
  const ratio = (1+g)/(1+r)
  return P * (1 - pow(ratio, N)) / (r - g)
}

// PV of level annuity as special case
function pvAnnuity(P, r, N){
  if (N<=0) return 0
  if (r===0) return P * N
  return P * (1 - pow(1+r, -N)) / r
}

// FV of growing annuity (monthly contributions increasing by g; first payment end of month)
// FV = R * ( ((1+r)^N - (1+g)^N) / (r - g) )
function fvGrowingAnnuity(R, r, g, N){
  if (N<=0) return 0
  if (Math.abs(r-g) < 1e-9){
    // when r ≈ g, FV ≈ R * N * (1+r)^(N-1)
    return R * N * pow(1+r, N-1)
  }
  return R * ( (pow(1+r, N) - pow(1+g, N)) / (r - g) )
}

// Solve for first-month contribution R given FV target (after accounting for upfront funds)
function solveRForTargetFV(targetFV, r, g, N){
  if (N<=0) return 0
  if (Math.abs(r-g) < 1e-9){
    return targetFV / (N * pow(1+r, N-1))
  }
  const denom = (pow(1+r, N) - pow(1+g, N)) / (r - g)
  return targetFV / denom
}

export default function App(){
  const [state, setState] = React.useState({
    // Step 1: Retirement phase need
    gapMonthly: 1300,
    yearsInRetirement: 25,
    retireAnnualRealReturn: 1.0,   // real p.a.
    withdrawalGrowthAnnual: 0.0,   // real p.a. (inflationsangepasst -> 0 real)

    // Step 2: Accumulation
    yearsToRetirement: 30,
    accumAnnualRealReturn: 5.0,    // real p.a.
    initialCapital: 0,
    oneOffToday: 0,
    contribAnnualIncrease: 0.0,    // reale jährliche Erhöhung der Sparrate
  })

  const Nret = useMemo(()=> Math.max(1, Math.round(state.yearsInRetirement*12)), [state.yearsInRetirement])
  const rRet = useMemo(()=> pctToMonthly(state.retireAnnualRealReturn), [state.retireAnnualRealReturn])
  const gWdr = useMemo(()=> pctToMonthly(state.withdrawalGrowthAnnual), [state.withdrawalGrowthAnnual])

  // Required capital
  const requiredCapital = useMemo(()=>{
    const P = state.gapMonthly
    if (Math.abs(gWdr) < 1e-9){
      return pvAnnuity(P, rRet, Nret)
    }
    return pvGrowingAnnuity(P, rRet, gWdr, Nret)
  }, [state.gapMonthly, rRet, gWdr, Nret])

  const Nacc = useMemo(()=> Math.max(1, Math.round(state.yearsToRetirement*12)), [state.yearsToRetirement])
  const rAcc = useMemo(()=> pctToMonthly(state.accumAnnualRealReturn), [state.accumAnnualRealReturn])
  const gInc = useMemo(()=> pctToMonthly(state.contribAnnualIncrease), [state.contribAnnualIncrease])

  // First, the portion already covered by upfront funds (invested today)
  const futureFromUpfront = useMemo(()=> (state.initialCapital + state.oneOffToday) * pow(1+rAcc, Nacc), [state.initialCapital, state.oneOffToday, rAcc, Nacc])
  const targetFV = useMemo(()=> max0(requiredCapital) * pow(1+rAcc, 0), [requiredCapital]) // real to real: no growth factor needed

  // Required first-month contribution R0 such that FV_contribs + FV_upfront = targetFV
  const R0 = useMemo(()=>{
    const residualFV = targetFV - futureFromUpfront
    if (residualFV <= 0) return 0
    return solveRForTargetFV(residualFV, rAcc, gInc, Nacc)
  }, [targetFV, futureFromUpfront, rAcc, gInc, Nacc])

  const monthlyNow = R0 // first month
  const monthlyInYear5 = monthlyNow * pow(1+gInc, 5) // after 5 years (approx, monthly growth compounded)

  const onChange = (key)=>(e)=>{
    const v = Number(e.target.value)
    setState(s=>({...s, [key]: isNaN(v)? s[key] : v}))
  }

  const reportRef = useRef(null)

  const exportPDF = async ()=>{
    const el = reportRef.current
    if (!el) return
    const canvas = await html2canvas(el, {scale:2, backgroundColor:'#0b0f19'})
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({orientation:'p', unit:'pt', format:'a4'})
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth - 40
    const imgHeight = canvas.height * (imgWidth / canvas.width)
    let y = 20
    if (imgHeight < pageHeight - 40){
      pdf.addImage(imgData, 'PNG', 20, y, imgWidth, imgHeight)
    } else {
      // paginate
      let sY = 0
      const pageImgHeight = pageHeight - 40
      while (sY < canvas.height){
        const pageCanvas = document.createElement('canvas')
        const scale = imgWidth / canvas.width
        pageCanvas.width = imgWidth
        pageCanvas.height = pageImgHeight
        const ctx = pageCanvas.getContext('2d')
        ctx.fillStyle = '#0b0f19'
        ctx.fillRect(0,0,pageCanvas.width,pageCanvas.height)
        ctx.drawImage(canvas, 0, -sY, imgWidth, canvas.height * scale)
        const chunk = pageCanvas.toDataURL('image/png')
        if (y>20) pdf.addPage()
        pdf.addImage(chunk, 'PNG', 20, 20, imgWidth, pageImgHeight)
        sY += pageImgHeight/scale
      }
    }
    pdf.save('Rentenluecke-ETF-Rechner.pdf')
  }

  return (
    <div className="container">
      <header>
        <h1>🧮 Rentenlücke & ETF‑Sparplan Rechner <span className="badge">Vite + React</span></h1>
        <p>Rechne in <strong>heutigen Preisen</strong> mit <strong>realen Renditen</strong>. Features: wachsender Sparplan, wachsender Entnahmeplan, PDF‑Export.</p>
      </header>

      <main className="grid">
        <section className="card" ref={reportRef}>
          <h2>1) Rentenlücke → Kapitalbedarf (Entnahmeplan)</h2>
          <div className="field">
            <label>Monatliche Rentenlücke (heute, €)</label>
            <input type="number" value={state.gapMonthly} min="0" step="10" onChange={onChange('gapMonthly')} />
          </div>
          <div className="row">
            <div className="field">
              <label>Rentenphase (Jahre)</label>
              <input type="number" value={state.yearsInRetirement} min="1" max="50" step="1" onChange={onChange('yearsInRetirement')} />
            </div>
            <div className="field">
              <label>Reale Rendite Rentenphase (p.a.)</label>
              <input type="number" value={state.retireAnnualRealReturn} step="0.1" onChange={onChange('retireAnnualRealReturn')} />
              <small>Tipp: 0–1,5 % real konservativ</small>
            </div>
          </div>
          <div className="field">
            <label>Wachstum der monatlichen Entnahme (real, p.a.)</label>
            <input type="number" value={state.withdrawalGrowthAnnual} step="0.1" onChange={onChange('withdrawalGrowthAnnual')} />
            <small>Standard: <kbd>0%</kbd> (voll inflationsbereinigt). Positiv = reale Steigerung deines Standards.</small>
          </div>

          <div className="result">
            <div>Benötigtes Kapital heute: <strong>{toEUR(requiredCapital)}</strong></div>
            <small>Berechnung: Barwert einer <em>wachsenden</em> monatlichen Rente (growing annuity).</small>
          </div>

          <hr />

          <h2>2) Kapitalziel → Sparplan</h2>
          <div className="row">
            <div className="field">
              <label>Jahre bis zur Rente</label>
              <input type="number" value={state.yearsToRetirement} min="1" max="60" step="1" onChange={onChange('yearsToRetirement')} />
            </div>
            <div className="field">
              <label>Reale Rendite Ansparphase (p.a.)</label>
              <input type="number" value={state.accumAnnualRealReturn} step="0.1" onChange={onChange('accumAnnualRealReturn')} />
              <small>Richtwert: 3–5 % real</small>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Startkapital (heute, €)</label>
              <input type="number" value={state.initialCapital} min="0" step="500" onChange={onChange('initialCapital')} />
            </div>
            <div className="field">
              <label>Einmalige Zuzahlung heute (€, optional)</label>
              <input type="number" value={state.oneOffToday} min="0" step="500" onChange={onChange('oneOffToday')} />
            </div>
          </div>
          <div className="field">
            <label>Jährliche Erhöhung der Sparrate (real, p.a.)</label>
            <input type="number" value={state.contribAnnualIncrease} step="0.1" onChange={onChange('contribAnnualIncrease')} />
            <small>Standard: <kbd>0%</kbd>. Beispiel: <kbd>1%</kbd> → echte Kaufkraftsteigerung deiner Sparrate.</small>
          </div>

          <div className="result">
            <div>Benötigte Sparrate im ersten Monat: <strong>{toEUR(monthlyNow)}</strong></div>
            <small>Mit realer Steigerung von {state.contribAnnualIncrease || 0}%/Jahr entspräche das in 5 Jahren etwa {toEUR(monthlyInYear5)} pro Monat.</small>
          </div>
        </section>

        <section className="card">
          <h2>Quick‑HowTo & Annahmen</h2>
          <ul className="notes">
            <li>Wir rechnen in <strong>heutigen Preisen</strong> (real). Nutze reale Renditen: Nominal − Inflation.</li>
            <li><strong>Entnahme-Wachstum</strong> steuert, ob du im Alter real „mehr“ pro Monat willst (0% = Konstanz).</li>
            <li><strong>Sparraten‑Wachstum</strong> erlaubt eine jährliche, reale Erhöhung deiner Einzahlungen.</li>
          </ul>
          <div className="btns">
            <button onClick={exportPDF}>📄 PDF exportieren</button>
            <a href="https://vercel.com" target="_blank" rel="noreferrer"><button>▲ Auf Vercel deployen</button></a>
          </div>
          <hr/>
          <p className="footer">Keine Finanz-/Steuerberatung. Modellrechnungen, ohne Garantie. © {new Date().getFullYear()}</p>
        </section>
      </main>
    </div>
  )
}

function max0(x){ return Math.max(0, x) }
