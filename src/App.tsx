import { useEffect, useReducer, useRef, useState } from 'react';
import type { Dispatch, CSSProperties } from 'react';
import { Icon, Logo } from './components/Icon';
import { LIMITS, operatorLabels, describeScenario } from './domain/model';
import type { CalculatorState, CardGroup, Operator, Scenario } from './domain/model';
import { parseInteger } from './domain/validation';
import { reducer } from './state/reducer';
import type { Action } from './state/reducer';
import { decodeState, encodeState, loadState, parseState, STORAGE_KEY } from './state/persistence';
import { useProbabilities } from './hooks/useProbabilities';
import type { WorkerResult } from './hooks/useProbabilities';
import styles from './styles/App.module.css';

const REPOSITORY = 'https://github.com/matpag/YuGiOhProbabilityCalculator';
const colors = ['#e46544', '#96a6e5', '#c895cc', '#7fc4c9', '#e4c17c', '#99c7a2'];
type Dispatcher = Dispatch<Action>;

export function App() {
  const [initial] = useState(loadState);
  const [state, dispatch] = useReducer(reducer, initial.state);
  const [notice, setNotice] = useState(initial.notice);
  const [saved, setSaved] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareValue, setShareValue] = useState('');
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const calculations = useProbabilities(state);
  const active = state.scenarios.find(scenario => scenario.id === state.activeScenarioId)!;
  const fixedGroups = state.groups.filter(group => group.kind === 'fixed');
  const scenarioErrors = calculations.scenarioErrors[active.id] ?? [];
  const result = calculations.results[active.id];
  const hasContent = state.groups.length > 0 || state.scenarios.some(scenario => scenario.alternatives.some(option => option.requirements.length));

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setSaved(true); }
    catch { setSaved(false); }
    // A shared hash is an entry point. Remove it after loading so reload restores edits.
    if (window.location.hash.startsWith('#v1=')) history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [state]);

  useEffect(() => {
    const handleHash = () => {
      if (!window.location.hash.startsWith('#v1=')) return;
      const shared = decodeState(window.location.hash);
      if (shared) { dispatch({ type: 'replace', state: shared }); setNotice('Shared calculation loaded.'); }
      else setNotice('This shared link is invalid. Your current calculation has been kept.');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  async function share() {
    const link = window.location.origin + window.location.pathname + encodeState(state);
    try { await navigator.clipboard.writeText(link); setNotice('Link copied. It includes your deck and all scenarios.'); }
    catch { setShareValue(link); }
  }

  function exportCalculation() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'opening-hand.json'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Calculation exported.');
  }

  async function importCalculation(file?: File) {
    if (!file) return;
    if (file.size > 100_000) { setNotice('That file is too large. Choose an Opening Hand calculation JSON file.'); return; }
    try {
      const imported = parseState(await file.text());
      if (!imported) { setNotice('Could not read that calculation. Choose a valid Opening Hand JSON file.'); return; }
      dispatch({ type: 'replace', state: imported });
      setNotice('Calculation imported.');
    } catch { setNotice('Could not read that file. Try another calculation.'); }
  }

  function loadExample(example: 'basic' | 'flexible') {
    dispatch({ type: 'reset', example }); setExamplesOpen(false);
    setNotice(`${example === 'basic' ? 'Starter + extender' : 'Flexible card'} example loaded. Edit any value to make it yours.`);
  }

  return <div className={styles.app}>
    <a href="#calculator" className={styles.skipLink}>Skip to calculator</a>
    <header className={styles.header}>
      <a className={styles.brand} href={import.meta.env.BASE_URL} aria-label="Opening Hand home"><Logo /><span>Opening Hand<small>YU-GI-OH! PROBABILITY CALCULATOR</small></span></a>
      <div className={styles.headerActions}>
        <button className={styles.textButton} onClick={() => setHelpOpen(true)} aria-label="How it works"><Icon name="info" /><span>How it works</span></button>
        <a className={styles.iconButton} href={REPOSITORY} target="_blank" rel="noreferrer" aria-label="GitHub repository"><Icon name="github" size={21} /></a>
      </div>
    </header>

    <main id="calculator" className={styles.main}>
      <div className={styles.intro}>
        <div><div className={styles.eyebrow}><span /> LESS GUESSWORK. BETTER DECKS.</div><h1>Know your opening odds.</h1><p>Tell us what’s in your deck and what you want to draw.<br className={styles.desktopBreak} /> Get exact probabilities as you go.</p></div>
        <div className={styles.introActions}>
          <div className={styles.exampleWrapper}>
            <button className={styles.secondaryButton} onClick={() => setExamplesOpen(!examplesOpen)} aria-expanded={examplesOpen}><Icon name="sparkle" /> Load an example</button>
            {examplesOpen && <div className={styles.exampleMenu}>
              <p>Loading an example replaces this calculation.</p>
              <button onClick={() => loadExample('basic')}>Starter + extender<small>A simple two-group opening</small></button>
              <button onClick={() => loadExample('flexible')}>Cards with flexible roles<small>One card, more than one possibility</small></button>
              <button className={styles.menuCancel} onClick={() => setExamplesOpen(false)}>Cancel</button>
            </div>}
          </div>
          <button className={styles.primaryButton} onClick={share}><Icon name="link" /> Share calculation</button>
        </div>
      </div>

      {notice && <div className={styles.notice} role="status"><Icon name="info" /><span>{notice}</span><button className={styles.iconButton} onClick={() => setNotice('')} aria-label="Dismiss message"><Icon name="close" size={16} /></button></div>}

      <div className={styles.workspace}>
        <section className={styles.panel} aria-labelledby="deck-title">
          <div className={styles.panelHeading}><div className={styles.step}>01</div><div><h2 id="deck-title">Your deck</h2><p>Add individual cards or groups of cards.</p></div></div>
          <div className={styles.settings}>
            <NumberField label="Deck size" value={state.deckSize} onChange={value => dispatch({ type: 'setting', key: 'deckSize', value })} min={1} max={100} />
            <NumberField label="Cards drawn" value={state.handSize} onChange={value => dispatch({ type: 'setting', key: 'handSize', value })} min={1} max={20} />
          </div>
          <div className={styles.drawPresets} aria-label="Draw size presets"><span>Quick set</span>
            <button aria-pressed={state.handSize === '5'} onClick={() => dispatch({ type: 'setting', key: 'handSize', value: '5' })}>5 cards</button>
            <button aria-pressed={state.handSize === '6'} onClick={() => dispatch({ type: 'setting', key: 'handSize', value: '6' })}>6 · after first draw</button>
          </div>
          <div className={styles.divider} />
          {state.groups.length > 0 ? <>
            <div className={styles.groupLabels}><span>CARD OR GROUP</span><span>COPIES</span><span /></div>
            <div className={styles.groupList}>{state.groups.map((group, index) => <GroupRow key={group.id} group={group} index={index} fixedGroups={fixedGroups} dispatch={dispatch} />)}</div>
            <DeckRemainder state={state} />
          </> : <div className={styles.emptyDeck}><div className={styles.emptyIcon}><Logo /></div><h3>Start with the cards that matter.</h3><p>Add “Starters”, “Hand traps”, or a specific card.<br />We’ll count the rest of your deck automatically.</p></div>}
          <div className={styles.addGroupButtons}>
            <button className={styles.dashedButton} onClick={() => dispatch({ type: 'group:add', kind: 'fixed' })} disabled={state.groups.length >= LIMITS.groups}><Icon name="plus" size={17} /> Add card or group</button>
            {fixedGroups.length > 0 && <button className={styles.textButton} onClick={() => dispatch({ type: 'group:add', kind: 'flexible' })} disabled={state.groups.length >= LIMITS.groups}><Icon name="sparkle" size={16} /> Add flexible cards</button>}
          </div>
          {state.groups.some(group => group.kind === 'flexible') && <div className={styles.flexibleSettings}>
            <label htmlFor="flexible-mode">How flexible cards count</label>
            <select id="flexible-mode" value={state.roleMode} onChange={event => dispatch({ type: 'roleMode', value: event.target.value as CalculatorState['roleMode'] })}>
              <option value="allocate">Each copy fills one chosen role</option><option value="membership">Each copy counts toward every selected role</option>
            </select>
            <p>{state.roleMode === 'allocate' ? 'A drawn copy fills one selected role. Two requirements need two cards unless a fixed group already meets one.' : 'A drawn copy counts toward every selected role at once, including upper limits.'} Effects with activation conditions are assumed available.</p>
          </div>}
          <ErrorList errors={calculations.deck.errors} id="deck-errors" />
          <div className={styles.deckFootnote}><Icon name="info" size={15} /><span>Count each physical card once. Flexible copies are separate from the groups they can fill.</span></div>
        </section>

        <section className={`${styles.panel} ${styles.requirementsPanel}`} aria-labelledby="goal-title">
          <div className={styles.panelHeading}><div className={styles.step}>02</div><div><h2 id="goal-title">What do you want to draw?</h2><p>Build the opening hand you’re looking for.</p></div></div>
          <div className={styles.scenarioNav} aria-label="Scenarios">{state.scenarios.map(scenario => <button key={scenario.id} className={styles.scenarioTab} aria-pressed={scenario.id === active.id} onClick={() => dispatch({ type: 'scenario:select', id: scenario.id })}>{scenario.name.trim() || 'Untitled scenario'}</button>)}
            <button className={styles.iconButton} aria-label="Add scenario" title="Add scenario" onClick={() => dispatch({ type: 'scenario:add' })} disabled={state.scenarios.length >= LIMITS.scenarios}><Icon name="plus" size={17} /></button>
          </div>
          <div className={styles.scenarioName}><label className={styles.srOnly} htmlFor="scenario-name">Scenario name</label><input id="scenario-name" maxLength={80} value={active.name} onChange={event => dispatch({ type: 'scenario:name', value: event.target.value })} placeholder="Name this scenario" />
            <button className={styles.iconButton} onClick={() => dispatch({ type: 'scenario:add', duplicate: true })} disabled={state.scenarios.length >= LIMITS.scenarios} aria-label="Duplicate scenario" title="Duplicate scenario"><Icon name="copy" size={16} /></button>
            {state.scenarios.length > 1 && <button className={styles.iconButton} onClick={() => dispatch({ type: 'scenario:remove' })} aria-label="Remove scenario" title="Remove scenario"><Icon name="trash" size={16} /></button>}
          </div>
          <Requirements scenario={active} groups={fixedGroups} dispatch={dispatch} />
          {active.alternatives.length < LIMITS.alternatives && active.alternatives[0].requirements.length > 0 && <button className={styles.alternativeButton} onClick={() => dispatch({ type: 'alternative:add' })}><Icon name="plus" size={15} /> Add an alternative opening <span>OR</span></button>}
          <Result state={state} scenario={active} result={result} errors={calculations.deck.errors.length ? ['Check your deck details to calculate.'] : scenarioErrors} pending={calculations.pending} />
        </section>
      </div>

      {state.scenarios.length > 1 && <section className={`${styles.panel} ${styles.comparison}`} aria-labelledby="comparison-title"><div><h2 id="comparison-title">Compare your scenarios</h2><p>Same deck. Different opening hands. Each result is calculated independently.</p></div><div className={styles.comparisonList}>
        {state.scenarios.map(scenario => <button key={scenario.id} className={styles.comparisonRow} onClick={() => dispatch({ type: 'scenario:select', id: scenario.id })} aria-pressed={scenario.id === active.id}>
          <span><strong>{scenario.name.trim() || 'Untitled scenario'}</strong><small>{describeScenario(scenario, state.groups) || 'Add requirements to this scenario'}</small></span>
          <span className={styles.comparisonProbability}>{calculations.results[scenario.id]?.result ? formatProbability(calculations.results[scenario.id].result!.probability) : calculations.deck.errors.length || calculations.scenarioErrors[scenario.id]?.length || calculations.results[scenario.id]?.error ? '—' : '…'}<Icon name="arrow" size={17} /></span>
        </button>)}
      </div></section>}

      <div className={styles.bottomBar}><span className={styles.saveStatus}><span className={saved ? styles.savedDot : styles.unsavedDot} />{saved ? 'Saved in this browser' : 'Browser storage unavailable — export to keep your work'}</span><div>
        <input type="file" accept="application/json,.json" ref={importRef} hidden onChange={event => { void importCalculation(event.target.files?.[0]); event.target.value = ''; }} />
        <button className={styles.textButton} onClick={() => importRef.current?.click()}><Icon name="upload" size={15} /> Import</button>
        <button className={styles.textButton} onClick={exportCalculation}><Icon name="download" size={15} /> Export</button>
        <button className={styles.textButton} disabled={!hasContent} onClick={() => setResetOpen(true)}><Icon name="reset" size={15} /> Clear</button>
      </div></div>
      <footer className={styles.footer}><span>Built for the hands you actually want to play.</span><span>Independent fan project. Not affiliated with Konami. <a href={REPOSITORY} target="_blank" rel="noreferrer">View source <Icon name="arrow" size={13} /></a></span></footer>
    </main>

    {helpOpen && <Modal title="How the calculator works" onClose={() => setHelpOpen(false)}>
      <div className={styles.helpContent}><p>We count every possible way to draw your chosen number of cards from a shuffled deck, without replacement. The result is the share of hands that meet your requirements.</p>
        <h3>1. Describe your deck</h3><p>Add the cards or groups you care about. Remaining cards become “Other cards” automatically. Each physical copy belongs to one row.</p>
        <h3>2. Describe your opening</h3><p>All requirements inside an option must hold together (AND). Alternative options use OR: a hand meeting either option succeeds, and is counted only once.</p>
        <h3>3. Give flexible cards their roles</h3><p>By default, each flexible copy fills exactly one selected role. The calculator checks whether any valid assignment satisfies the opening. You can explicitly switch to counting each copy toward every role. Upper limits apply to the resulting role counts.</p>
        <h3>What the result assumes</h3><p>Cards are drawn uniformly from a shuffled deck. Roles and conditional effects are assumed available. This measures draw consistency; it does not simulate card effects, searches, sequencing, or opponent actions. The 6-card preset measures cards seen after the first draw.</p>
        <h3>Your calculations stay with you</h3><p>Edits are saved in this browser. Sharing copies your deck and scenarios into a link. Export creates a JSON backup that you can import later. No account is needed.</p>
        <p className={styles.helpFootnote}>Exact combinatorial counts are used. Large scenarios have a calculation limit to keep the app responsive; an explicit message appears instead of an estimate.</p></div>
    </Modal>}
    {shareValue && <Modal title="Share your calculation" onClose={() => setShareValue('')}><p>Copy this link to share your deck and all scenarios.</p><label className={styles.srOnly} htmlFor="share-link">Calculation link</label><textarea id="share-link" readOnly value={shareValue} onFocus={event => event.target.select()} rows={4} /><button className={styles.primaryButton} onClick={() => setShareValue('')}>Done</button></Modal>}
    {resetOpen && <Modal title="Start a new calculation?" onClose={() => setResetOpen(false)}><p>This clears your current deck and scenarios. Export first if you want to keep a copy.</p><div className={styles.modalActions}><button className={styles.secondaryButton} onClick={() => setResetOpen(false)}>Keep calculation</button><button className={styles.primaryButton} onClick={() => { dispatch({ type: 'reset' }); setResetOpen(false); setNotice('Ready for a new calculation.'); }}>Clear calculation</button></div></Modal>}
  </div>;
}

function NumberField({ label, value, onChange, min = 0, max = 100, compact = false }: { label: string; value: string; onChange: (value: string) => void; min?: number; max?: number; compact?: boolean }) {
  const parsed = parseInteger(value);
  const invalid = parsed === null || parsed < min || parsed > max;
  return <label className={compact ? styles.compactNumber : styles.numberField}>{!compact && <span>{label}</span>}<input type="number" inputMode="numeric" step={1} min={min} max={max} aria-label={label} aria-invalid={invalid} value={value} onChange={event => onChange(event.target.value)} /></label>;
}

function GroupRow({ group, index, fixedGroups, dispatch }: { group: CardGroup; index: number; fixedGroups: CardGroup[]; dispatch: Dispatcher }) {
  return <div className={styles.groupRowWrapper}><div className={styles.groupRow}>
    <div className={styles.groupName}><span className={styles.groupDot} style={{ background: colors[index % colors.length] }} /><input aria-label={`Name of group ${index + 1}`} placeholder={group.kind === 'flexible' ? 'e.g. Flexible searchers' : 'e.g. Starters'} maxLength={80} value={group.name} onChange={event => dispatch({ type: 'group:update', id: group.id, patch: { name: event.target.value } })} /></div>
    <NumberField compact label={`Copies of ${group.name || `group ${index + 1}`}`} value={group.copies} onChange={value => dispatch({ type: 'group:update', id: group.id, patch: { copies: value } })} />
    <button className={styles.iconButton} onClick={() => dispatch({ type: 'group:remove', id: group.id })} aria-label={`Remove ${group.name || `group ${index + 1}`}`} title="Remove group"><Icon name="close" size={16} /></button>
  </div>{group.kind === 'flexible' && <fieldset className={styles.rolePicker}><legend><Icon name="sparkle" size={13} /> Can fill these roles</legend>{fixedGroups.map(role => <label key={role.id}><input type="checkbox" checked={group.roles.includes(role.id)} onChange={event => dispatch({ type: 'group:update', id: group.id, patch: { roles: event.target.checked ? [...group.roles, role.id] : group.roles.filter(id => id !== role.id) } })} />{role.name.trim() || 'Unnamed group'}</label>)}</fieldset>}</div>;
}

function DeckRemainder({ state }: { state: CalculatorState }) {
  const size = parseInteger(state.deckSize);
  const counts = state.groups.map(group => parseInteger(group.copies));
  const assigned = counts.reduce<number>((sum, count) => sum + (count ?? 0), 0);
  const valid = size !== null && counts.every(count => count !== null) && assigned <= size;
  return <div className={styles.remainder}><div><span className={styles.otherDot} /><span>Other cards</span><span>{valid ? size! - assigned : '—'}</span></div><div className={styles.deckTrack} aria-hidden="true">{state.groups.map((group, index) => <span key={group.id} style={{ width: `${size && size > 0 ? Math.min(100, Number(group.copies) / size * 100) : 0}%`, background: colors[index % colors.length] }} />)}</div><small>{valid ? `${assigned} specified · ${size! - assigned} other · ${size} total` : 'Check the copies and deck size above.'}</small></div>;
}

function Requirements({ scenario, groups, dispatch }: { scenario: Scenario; groups: CardGroup[]; dispatch: Dispatcher }) {
  return <div className={styles.options}>{scenario.alternatives.map((option, optionIndex) => <div key={option.id}>
    {optionIndex > 0 && <div className={styles.orDivider}><span /> OR <span /></div>}
    <div className={styles.option}>
      {scenario.alternatives.length > 1 && <div className={styles.optionHeading}><span>OPTION {optionIndex + 1}</span><button className={styles.iconButton} onClick={() => dispatch({ type: 'alternative:remove', id: option.id })} aria-label={`Remove option ${optionIndex + 1}`}><Icon name="close" size={14} /></button></div>}
      {option.requirements.map((requirement, index) => <div key={requirement.id}>
        {index > 0 && <span className={styles.andLabel}>AND</span>}
        <div className={styles.requirementRow}>
          <select aria-label={`Condition ${optionIndex + 1}.${index + 1}`} value={requirement.operator} onChange={event => dispatch({ type: 'requirement:update', id: requirement.id, patch: { operator: event.target.value as Operator } })}>{Object.entries(operatorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <NumberField compact label={`Quantity ${optionIndex + 1}.${index + 1}`} value={requirement.value} max={20} onChange={value => dispatch({ type: 'requirement:update', id: requirement.id, patch: { value } })} />
          {requirement.operator === 'between' && <><span className={styles.toLabel}>and</span><NumberField compact label={`Upper quantity ${optionIndex + 1}.${index + 1}`} value={requirement.upper} max={20} onChange={upper => dispatch({ type: 'requirement:update', id: requirement.id, patch: { upper } })} /></>}
          <select className={styles.requirementGroup} aria-label={`Card group ${optionIndex + 1}.${index + 1}`} value={requirement.groupId} onChange={event => dispatch({ type: 'requirement:update', id: requirement.id, patch: { groupId: event.target.value } })}><option value="" disabled>Choose a group</option>{groups.map(group => <option value={group.id} key={group.id}>{group.name.trim() || 'Unnamed group'}</option>)}</select>
          <button className={styles.iconButton} onClick={() => dispatch({ type: 'requirement:remove', id: requirement.id })} aria-label={`Remove requirement ${optionIndex + 1}.${index + 1}`}><Icon name="close" size={16} /></button>
        </div>
      </div>)}
      {!option.requirements.length && <p className={styles.emptyRequirements}>{groups.length ? 'Choose a group and how many copies you want to draw.' : 'Add a card or group to your deck, then choose what you want to draw.'}</p>}
      <button className={styles.addRequirement} onClick={() => dispatch({ type: 'requirement:add', alternativeId: option.id })} disabled={!groups.length || option.requirements.length >= LIMITS.requirements}><Icon name="plus" size={16} /> Add requirement</button>
    </div>
  </div>)}</div>;
}

export function formatProbability(probability: number) {
  if (probability > 0 && probability < 0.0001) return '<0.01%';
  if (probability < 1 && probability > 0.9999) return '>99.99%';
  return `${(probability * 100).toFixed(2)}%`;
}

function Result({ state, scenario, result, errors, pending }: { state: CalculatorState; scenario: Scenario; result?: WorkerResult; errors: string[]; pending: boolean }) {
  const probability = result?.result?.probability;
  const ready = !errors.length && probability !== undefined;
  const empty = !state.groups.length || scenario.alternatives.every(option => option.requirements.length === 0);
  const message = errors[0] || result?.error;
  return <div className={styles.result} aria-busy={pending && !errors.length}>
    <div className={styles.resultEyebrow}><span className={styles.resultDot} /> YOUR CHANCE TO DRAW THIS HAND <span className={styles.exactBadge}>Exact</span></div>
    <div className={styles.resultValue} aria-live="polite" aria-atomic="true">{ready ? <span>{formatProbability(probability)}</span> : pending && !errors.length ? <span className={styles.pendingText}>Calculating…</span> : '—'}{ready && <small>{probability === 0 ? 'No hands meet these requirements.' : probability === 1 ? 'Every hand meets these requirements.' : probability < 0.01 ? 'Fewer than 1 in 100 hands.' : probability > 0.99 ? 'More than 99 in 100 hands.' : `About ${Math.round(probability * 100)} in 100 hands.`}</small>}</div>
    {ready ? <>
      <div className={styles.resultTrack} aria-hidden="true"><span style={{ '--probability': `${probability * 100}%` } as CSSProperties} /></div>
      <p className={styles.resultDescription}>Draw {describeScenario(scenario, state.groups)}.</p>
      <div className={styles.resultMeta}><span>Drawing <strong>{state.handSize}</strong> from <strong>{state.deckSize}</strong></span><span>{formatProbability(1 - probability)} miss</span></div>
      <details className={styles.breakdown}><summary>See the calculation</summary><p><strong>{BigInt(result!.result!.successfulHands).toLocaleString()}</strong> successful hands out of <strong>{BigInt(result!.result!.totalHands).toLocaleString()}</strong> possible hands. Copies are counted as distinct physical cards. {state.groups.some(group => group.kind === 'flexible') ? state.roleMode === 'allocate' ? 'Each flexible copy fills one chosen role.' : 'Each flexible copy counts toward all its selected roles.' : 'Groups are separate.'} Alternative options are counted as a union.</p></details>
    </> : <div className={styles.resultPlaceholder}>{empty ? <><h3>Your next opening starts here.</h3><p>{message || 'Add your cards and a requirement to see your odds.'}</p></> : message ? <ErrorList errors={[...errors, ...(result?.error ? [result.error] : [])]} id="scenario-errors" /> : <p>Counting the hands that meet your requirements…</p>}</div>}
  </div>;
}

function ErrorList({ errors, id }: { errors: string[]; id: string }) {
  if (!errors.length) return null;
  return <div className={styles.errors} id={id} role="status">{errors.map(error => <p key={error}><Icon name="info" size={15} /><span>{error}</span></p>)}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog className={styles.modal} ref={ref} onCancel={onClose} onClick={event => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-labelledby="modal-title"><div className={styles.modalHeading}><h2 id="modal-title">{title}</h2><button className={styles.iconButton} onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>{children}</dialog>;
}
