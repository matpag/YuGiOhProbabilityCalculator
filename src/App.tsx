import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
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
import { LanguageSelector, useI18n } from './i18n/LanguageContext';
import { formatProbability, workerErrorMessages } from './i18n/messages';
import type { UiMessage } from './i18n/messages';
import { withUiLanguage } from './i18n/language';
export { formatProbability } from './i18n/messages';

const REPOSITORY = 'https://github.com/matpag/YuGiOhProbabilityCalculator';
const colors = ['#e46544', '#96a6e5', '#c895cc', '#7fc4c9', '#e4c17c', '#99c7a2'];
type Dispatcher = Dispatch<Action>;

export function App() {
  const { language, t } = useI18n();
  const [initial] = useState(loadState);
  const [state, dispatch] = useReducer(reducer, initial.state);
  const [notice, setNotice] = useState<UiMessage | null>(initial.notice);
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
  const activeErrors = calculations.deck.errors.length ? [t('error.checkDeck')] : scenarioErrors;
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
      if (shared) { dispatch({ type: 'replace', state: shared }); setNotice({ key: 'notice.sharedLoaded' }); }
      else setNotice({ key: 'notice.invalidShared' });
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  async function share() {
    const linkUrl = new URL(withUiLanguage(window.location.href, language));
    linkUrl.hash = encodeState(state);
    const link = linkUrl.href;
    try { await navigator.clipboard.writeText(link); setNotice({ key: 'notice.linkCopied' }); }
    catch { setShareValue(link); }
  }

  function exportCalculation() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'opening-hand.json'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ key: 'notice.exported' });
  }

  async function importCalculation(file?: File) {
    if (!file) return;
    if (file.size > 100_000) { setNotice({ key: 'notice.tooLarge' }); return; }
    try {
      const imported = parseState(await file.text());
      if (!imported) { setNotice({ key: 'notice.invalidFile' }); return; }
      dispatch({ type: 'replace', state: imported });
      setNotice({ key: 'notice.imported' });
    } catch { setNotice({ key: 'notice.readFailed' }); }
  }

  function loadExample(example: 'basic' | 'flexible') {
    dispatch({ type: 'reset', example }); setExamplesOpen(false);
    setNotice({ key: example === 'basic' ? 'notice.basicExample' : 'notice.flexibleExample' });
  }

  return <div className={styles.app}>
    <a href="#calculator" className={styles.skipLink}>{t('skip')}</a>
    <header className={`${styles.header} rf-suite-header`}>
      <a className="rf-brand" href={withUiLanguage("https://retroformats.com/", language)} aria-label={t('suite.homeLabel')}><img className="rf-brand__mark" src={`${import.meta.env.BASE_URL}retroformats/retroformats-mark.svg`} alt="" /><span>retroformats<span className="rf-brand__dot">.</span><small className="rf-brand__product">{t('suite.probability')}</small></span></a>
      <div className={styles.headerActions}>
        <LanguageSelector />
        <details className="rf-suite-switcher"><summary>{t('suite.tools')}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary><nav className="rf-suite-nav" aria-label={t('suite.navigation')}>
          <a href={withUiLanguage("https://retroformats.com/", language)}>{t('suite.homeLabel')}</a>
          <a href={withUiLanguage("https://retroformats.com/probability/", language)} aria-current="page">{t('suite.probability')}</a>
          <a href={withUiLanguage("https://retroformats.com/proxy/", language)}>{t('suite.proxy')}</a>
          <a href={withUiLanguage("https://retroformats.com/decklist/", language)}>{t('suite.decklist')}</a>
          <a href={withUiLanguage("https://retroformats.com/breakdown/", language)}>{t('suite.breakdown')}</a>
        </nav></details>
        <button className={styles.textButton} onClick={() => setHelpOpen(true)} aria-label={t('help.open')}><Icon name="info" /><span>{t('help.open')}</span></button>
      </div>
    </header>

    <main id="calculator" className={styles.main}>
      <div className={styles.intro}>
        <div><div className={styles.eyebrow}><span />{t('intro.eyebrow')}</div><h1>{t('intro.title')}</h1><p>{t('intro.first')}<br className={styles.desktopBreak} />{' '}{t('intro.second')}</p></div>
        <div className={styles.introActions}>
          <div className={styles.exampleWrapper}>
            <button className={styles.secondaryButton} onClick={() => setExamplesOpen(!examplesOpen)} aria-expanded={examplesOpen}><Icon name="sparkle" />{t('example.open')}</button>
            {examplesOpen && <div className={styles.exampleMenu}>
              <p>{t('example.warning')}</p>
              <button onClick={() => loadExample('basic')}>{t('example.basic')}<small>{t('example.basicDetail')}</small></button>
              <button onClick={() => loadExample('flexible')}>{t('example.flexible')}<small>{t('example.flexibleDetail')}</small></button>
              <button className={styles.menuCancel} onClick={() => setExamplesOpen(false)}>{t('actions.cancel')}</button>
            </div>}
          </div>
          <button className={`${styles.primaryButton} rf-action-primary`} onClick={share}><Icon name="link" />{t('share.open')}</button>
        </div>
      </div>

      {notice && <div className={styles.notice} role="status"><Icon name="info" /><span>{t(notice.key, notice.params)}</span><button className={styles.iconButton} onClick={() => setNotice(null)} aria-label={t('notice.dismiss')}><Icon name="close" size={16} /></button></div>}

      {hasContent && <MobileResultSummary scenario={active} result={result} errors={activeErrors} pending={calculations.pending} deckInvalid={!!calculations.deck.errors.length} />}

      <div className={styles.workspace}>
        <section className={styles.panel} aria-labelledby="deck-title">
          <div className={styles.panelHeading}><div className={styles.step}>01</div><div><h2 id="deck-title">{t('deck.title')}</h2><p>{t('deck.description')}</p></div></div>
          <div className={styles.settings}>
            <NumberField label={t('deck.size')} value={state.deckSize} onChange={value => dispatch({ type: 'setting', key: 'deckSize', value })} min={1} max={100} />
            <NumberField label={t('deck.drawn')} value={state.handSize} onChange={value => dispatch({ type: 'setting', key: 'handSize', value })} min={1} max={20} />
          </div>
          <div className={styles.drawPresets} aria-label={t('deck.presets')}><span>{t('deck.quick')}</span>
            <button aria-pressed={state.handSize === '5'} onClick={() => dispatch({ type: 'setting', key: 'handSize', value: '5' })}>{t('deck.five')}</button>
            <button aria-pressed={state.handSize === '6'} onClick={() => dispatch({ type: 'setting', key: 'handSize', value: '6' })}>{t('deck.six')}</button>
          </div>
          <div className={styles.divider} />
          {state.groups.length > 0 ? <>
            <div className={styles.groupLabels}><span>{t('deck.groupLabel')}</span><span>{t('deck.copiesLabel')}</span><span /></div>
            <div className={styles.groupList}>{state.groups.map((group, index) => <GroupRow key={group.id} group={group} index={index} fixedGroups={fixedGroups} dispatch={dispatch} />)}</div>
            <DeckRemainder state={state} />
          </> : <div className={styles.emptyDeck}><div className={styles.emptyIcon}><Logo /></div><h3>{t('deck.emptyTitle')}</h3><p>{t('deck.emptyFirst')}<br />{t('deck.emptySecond')}</p></div>}
          <div className={styles.addGroupButtons}>
            <button className={styles.dashedButton} onClick={() => dispatch({ type: 'group:add', kind: 'fixed' })} disabled={state.groups.length >= LIMITS.groups}><Icon name="plus" size={17} />{t('deck.addGroup')}</button>
            {fixedGroups.length > 0 && <button className={styles.textButton} onClick={() => dispatch({ type: 'group:add', kind: 'flexible' })} disabled={state.groups.length >= LIMITS.groups}><Icon name="sparkle" size={16} />{t('deck.addFlexible')}</button>}
          </div>
          {state.groups.some(group => group.kind === 'flexible') && <div className={styles.flexibleSettings}>
            <label htmlFor="flexible-mode">{t('deck.flexMode')}</label>
            <select id="flexible-mode" value={state.roleMode} onChange={event => dispatch({ type: 'roleMode', value: event.target.value as CalculatorState['roleMode'] })}>
              <option value="allocate">{t('deck.allocate')}</option><option value="membership">{t('deck.membership')}</option>
            </select>
            <p>{state.roleMode === 'allocate' ? t('deck.allocateHelp') : t('deck.membershipHelp')}{' '}{t('deck.effectsAvailable')}</p>
          </div>}
          <ErrorList errors={calculations.deck.errors} id="deck-errors" />
          <div className={styles.deckFootnote}><Icon name="info" size={15} /><span>{t('deck.footnote')}</span></div>
        </section>

        <section className={`${styles.panel} ${styles.requirementsPanel}`} aria-labelledby="goal-title">
          <div className={styles.panelHeading}><div className={styles.step}>02</div><div><h2 id="goal-title">{t('scenario.title')}</h2><p>{t('scenario.description')}</p></div></div>
          <div className={styles.scenarioNav} aria-label={t('scenario.navigation')}>{state.scenarios.map(scenario => <button key={scenario.id} className={styles.scenarioTab} aria-pressed={scenario.id === active.id} onClick={() => dispatch({ type: 'scenario:select', id: scenario.id })}>{scenario.name.trim() || t('scenario.untitled')}</button>)}
            <button className={styles.iconButton} aria-label={t('scenario.add')} title={t('scenario.add')} onClick={() => dispatch({ type: 'scenario:add' })} disabled={state.scenarios.length >= LIMITS.scenarios}><Icon name="plus" size={17} /></button>
          </div>
          <div className={styles.scenarioName}><label className={styles.srOnly} htmlFor="scenario-name">{t('scenario.name')}</label><input id="scenario-name" maxLength={80} value={active.name} onChange={event => dispatch({ type: 'scenario:name', value: event.target.value })} placeholder={t('scenario.placeholder')} />
            <button className={styles.iconButton} onClick={() => dispatch({ type: 'scenario:add', duplicate: true })} disabled={state.scenarios.length >= LIMITS.scenarios} aria-label={t('scenario.duplicate')} title={t('scenario.duplicate')}><Icon name="copy" size={16} /></button>
            {state.scenarios.length > 1 && <button className={styles.iconButton} onClick={() => dispatch({ type: 'scenario:remove' })} aria-label={t('scenario.remove')} title={t('scenario.remove')}><Icon name="trash" size={16} /></button>}
          </div>
          <Requirements scenario={active} groups={fixedGroups} dispatch={dispatch} />
          {active.alternatives.length < LIMITS.alternatives && active.alternatives[0].requirements.length > 0 && <button className={styles.alternativeButton} onClick={() => dispatch({ type: 'alternative:add' })}><Icon name="plus" size={15} />{t('scenario.addAlternative')}<span>{t('logic.or')}</span></button>}
          <Result state={state} scenario={active} result={result} errors={activeErrors} pending={calculations.pending} />
        </section>
      </div>

      {state.scenarios.length > 1 && <section className={`${styles.panel} ${styles.comparison}`} aria-labelledby="comparison-title"><div><h2 id="comparison-title">{t('comparison.title')}</h2><p>{t('comparison.description')}</p></div><div className={styles.comparisonList}>
        {state.scenarios.map(scenario => <button key={scenario.id} className={styles.comparisonRow} onClick={() => dispatch({ type: 'scenario:select', id: scenario.id })} aria-pressed={scenario.id === active.id}>
          <span><strong>{scenario.name.trim() || t('scenario.untitled')}</strong><small>{describeScenario(scenario, state.groups, t) || t('comparison.addRequirements')}</small></span>
          <span className={styles.comparisonProbability}>{calculations.results[scenario.id]?.result ? formatProbability(calculations.results[scenario.id].result!.probability, language) : calculations.deck.errors.length || calculations.scenarioErrors[scenario.id]?.length || calculations.results[scenario.id]?.error ? '—' : '…'}<Icon name="arrow" size={17} /></span>
        </button>)}
      </div></section>}

      <div className={styles.bottomBar}><span className={styles.saveStatus}><span className={saved ? styles.savedDot : styles.unsavedDot} />{saved ? t('storage.saved') : t('storage.unavailable')}</span><div>
        <input type="file" accept="application/json,.json" ref={importRef} hidden onChange={event => { void importCalculation(event.target.files?.[0]); event.target.value = ''; }} />
        <button className={styles.textButton} onClick={() => importRef.current?.click()}><Icon name="upload" size={15} />{t('actions.import')}</button>
        <button className={styles.textButton} onClick={exportCalculation}><Icon name="download" size={15} />{t('actions.export')}</button>
        <button className={styles.textButton} disabled={!hasContent} onClick={() => setResetOpen(true)}><Icon name="reset" size={15} />{t('actions.clear')}</button>
      </div></div>
      <footer className={styles.footer}><span>{t('footer.tagline')}</span><span>{t('footer.disclaimer')}{' '}<a href={REPOSITORY} target="_blank" rel="noreferrer">{t('footer.source')}{' '}<Icon name="arrow" size={13} /></a></span></footer>
    </main>

    {helpOpen && <Modal title={t('help.title')} onClose={() => setHelpOpen(false)}>
      <div className={styles.helpContent}><p>{t('help.intro')}</p>
        <h3>{t('help.deckTitle')}</h3><p>{t('help.deckBody')}</p>
        <h3>{t('help.openingTitle')}</h3><p>{t('help.openingBody')}</p>
        <h3>{t('help.flexibleTitle')}</h3><p>{t('help.flexibleBody')}</p>
        <h3>{t('help.assumptionsTitle')}</h3><p>{t('help.assumptionsBody')}</p>
        <h3>{t('help.storageTitle')}</h3><p>{t('help.storageBody')}</p>
        <p className={styles.helpFootnote}>{t('help.footnote')}</p></div>
    </Modal>}
    {shareValue && <Modal title={t('share.title')} onClose={() => setShareValue('')}><p>{t('share.body')}</p><label className={styles.srOnly} htmlFor="share-link">{t('share.link')}</label><textarea id="share-link" readOnly value={shareValue} onFocus={event => event.target.select()} rows={4} /><button className={styles.primaryButton} onClick={() => setShareValue('')}>{t('actions.done')}</button></Modal>}
    {resetOpen && <Modal title={t('reset.title')} onClose={() => setResetOpen(false)}><p>{t('reset.body')}</p><div className={styles.modalActions}><button className={styles.secondaryButton} onClick={() => setResetOpen(false)}>{t('reset.keep')}</button><button className={styles.primaryButton} onClick={() => { dispatch({ type: 'reset' }); setResetOpen(false); setNotice({ key: 'notice.reset' }); }}>{t('reset.clear')}</button></div></Modal>}
  </div>;
}

function NumberField({ label, value, onChange, min = 0, max = 100, compact = false }: { label: string; value: string; onChange: (value: string) => void; min?: number; max?: number; compact?: boolean }) {
  const parsed = parseInteger(value);
  const invalid = parsed === null || parsed < min || parsed > max;
  return <label className={compact ? styles.compactNumber : styles.numberField}>{!compact && <span>{label}</span>}<input type="number" inputMode="numeric" step={1} min={min} max={max} aria-label={label} aria-invalid={invalid} value={value} onChange={event => onChange(event.target.value)} /></label>;
}

function GroupRow({ group, index, fixedGroups, dispatch }: { group: CardGroup; index: number; fixedGroups: CardGroup[]; dispatch: Dispatcher }) {
  const { t } = useI18n();
  return <div className={styles.groupRowWrapper}><div className={styles.groupRow}>
    <div className={styles.groupName}><span className={styles.groupDot} style={{ background: colors[index % colors.length] }} /><input aria-label={t('group.name', { index: index + 1 })} placeholder={t(group.kind === 'flexible' ? 'group.placeholderFlexible' : 'group.placeholderFixed')} maxLength={80} value={group.name} onChange={event => dispatch({ type: 'group:update', id: group.id, patch: { name: event.target.value } })} /></div>
    <NumberField compact label={t('group.copies', { name: group.name || t('group.fallback', { index: index + 1 }) })} value={group.copies} onChange={value => dispatch({ type: 'group:update', id: group.id, patch: { copies: value } })} />
    <button className={styles.iconButton} onClick={() => dispatch({ type: 'group:remove', id: group.id })} aria-label={t('group.remove', { name: group.name || t('group.fallback', { index: index + 1 }) })} title={t('group.removeTitle')}><Icon name="close" size={16} /></button>
  </div>{group.kind === 'flexible' && <fieldset className={styles.rolePicker}><legend><Icon name="sparkle" size={13} />{t('group.roles')}</legend>{fixedGroups.map(role => <label key={role.id}><input type="checkbox" checked={group.roles.includes(role.id)} onChange={event => dispatch({ type: 'group:update', id: group.id, patch: { roles: event.target.checked ? [...group.roles, role.id] : group.roles.filter(id => id !== role.id) } })} />{role.name.trim() || t('group.unnamed')}</label>)}</fieldset>}</div>;
}

function DeckRemainder({ state }: { state: CalculatorState }) {
  const { t } = useI18n();
  const size = parseInteger(state.deckSize);
  const counts = state.groups.map(group => parseInteger(group.copies));
  const assigned = counts.reduce<number>((sum, count) => sum + (count ?? 0), 0);
  const valid = size !== null && counts.every(count => count !== null) && assigned <= size;
  return <div className={styles.remainder}><div><span className={styles.otherDot} /><span>{t('deck.other')}</span><span>{valid ? size! - assigned : '—'}</span></div><div className={styles.deckTrack} aria-hidden="true">{state.groups.map((group, index) => <span key={group.id} style={{ width: `${size && size > 0 ? Math.min(100, Number(group.copies) / size * 100) : 0}%`, background: colors[index % colors.length] }} />)}</div><small>{valid ? t('deck.remainder', { assigned, other: size! - assigned, total: size! }) : t('deck.remainderInvalid')}</small></div>;
}

function Requirements({ scenario, groups, dispatch }: { scenario: Scenario; groups: CardGroup[]; dispatch: Dispatcher }) {
  const { t } = useI18n();
  return <div className={styles.options}>{scenario.alternatives.map((option, optionIndex) => <div key={option.id}>
    {optionIndex > 0 && <div className={styles.orDivider}><span />{t('logic.or')}<span /></div>}
    <div className={styles.option}>
      {scenario.alternatives.length > 1 && <div className={styles.optionHeading}><span>{t('requirement.option', { index: optionIndex + 1 })}</span><button className={styles.iconButton} onClick={() => dispatch({ type: 'alternative:remove', id: option.id })} aria-label={t('requirement.removeOption', { index: optionIndex + 1 })}><Icon name="close" size={14} /></button></div>}
      {option.requirements.map((requirement, index) => <div key={requirement.id}>
        {index > 0 && <span className={styles.andLabel}>{t('logic.and')}</span>}
        <div className={styles.requirementRow}>
          <select aria-label={t('requirement.condition', { position: `${optionIndex + 1}.${index + 1}` })} value={requirement.operator} onChange={event => dispatch({ type: 'requirement:update', id: requirement.id, patch: { operator: event.target.value as Operator } })}>{Object.keys(operatorLabels).map(value => <option key={value} value={value}>{t(`operator.${value as Operator}`)}</option>)}</select>
          <NumberField compact label={t('requirement.quantity', { position: `${optionIndex + 1}.${index + 1}` })} value={requirement.value} max={20} onChange={value => dispatch({ type: 'requirement:update', id: requirement.id, patch: { value } })} />
          {requirement.operator === 'between' && <><span className={styles.toLabel}>{t('requirement.and')}</span><NumberField compact label={t('requirement.upper', { position: `${optionIndex + 1}.${index + 1}` })} value={requirement.upper} max={20} onChange={upper => dispatch({ type: 'requirement:update', id: requirement.id, patch: { upper } })} /></>}
          <select className={styles.requirementGroup} aria-label={t('requirement.group', { position: `${optionIndex + 1}.${index + 1}` })} value={requirement.groupId} onChange={event => dispatch({ type: 'requirement:update', id: requirement.id, patch: { groupId: event.target.value } })}><option value="" disabled>{t('requirement.chooseGroup')}</option>{groups.map(group => <option value={group.id} key={group.id}>{group.name.trim() || t('group.unnamed')}</option>)}</select>
          <button className={styles.iconButton} onClick={() => dispatch({ type: 'requirement:remove', id: requirement.id })} aria-label={t('requirement.remove', { position: `${optionIndex + 1}.${index + 1}` })}><Icon name="close" size={16} /></button>
        </div>
      </div>)}
      {!option.requirements.length && <p className={styles.emptyRequirements}>{groups.length ? t('requirement.empty') : t('requirement.emptyDeck')}</p>}
      <button className={styles.addRequirement} onClick={() => dispatch({ type: 'requirement:add', alternativeId: option.id })} disabled={!groups.length || option.requirements.length >= LIMITS.requirements}><Icon name="plus" size={16} />{t('requirement.add')}</button>
    </div>
  </div>)}</div>;
}


function Result({ state, scenario, result, errors, pending }: { state: CalculatorState; scenario: Scenario; result?: WorkerResult; errors: string[]; pending: boolean }) {
  const { language, t } = useI18n();
  const probability = result?.result?.probability;
  const ready = !errors.length && probability !== undefined;
  const empty = !state.groups.length || scenario.alternatives.every(option => option.requirements.length === 0);
  const workerError = result?.error ? t(workerErrorMessages[result.error]) : undefined;
  const message = errors[0] || workerError;
  return <div id="opening-result" className={styles.result} tabIndex={-1} aria-busy={pending && !errors.length}>
    <div className={styles.resultEyebrow}><span className={styles.resultDot} /> {t('result.eyebrow')} <span className={styles.exactBadge}>{t('result.exact')}</span></div>
    <div className={styles.resultValue} aria-live="polite" aria-atomic="true">{ready ? <span>{formatProbability(probability, language)}</span> : pending && !errors.length ? <span className={styles.pendingText}>{t('result.calculating')}</span> : '—'}{ready && <small>{probability === 0 ? t('result.noHands') : probability === 1 ? t('result.everyHand') : probability < 0.01 ? t('result.lessOne') : probability > 0.99 ? t('result.more99') : t('result.about', { count: Math.round(probability * 100) })}</small>}</div>
    {ready ? <>
      <div className={styles.resultTrack} aria-hidden="true"><span style={{ '--probability': `${probability * 100}%` } as CSSProperties} /></div>
      <p className={styles.resultDescription}>{t('result.draw', { description: describeScenario(scenario, state.groups, t) })}</p>
      <div className={styles.resultMeta}><span>{t('result.drawing')} <strong>{state.handSize}</strong> {t('result.from')} <strong>{state.deckSize}</strong></span><span>{t('result.miss', { probability: formatProbability(1 - probability, language) })}</span></div>
      <details className={styles.breakdown}><summary>{t('result.seeCalculation')}</summary><p><strong>{BigInt(result!.result!.successfulHands).toLocaleString(language)}</strong> {t('result.successfulOutOf')} <strong>{BigInt(result!.result!.totalHands).toLocaleString(language)}</strong> {t('result.possibleHands')} {state.groups.some(group => group.kind === 'flexible') ? state.roleMode === 'allocate' ? t('result.allocate') : t('result.membership') : t('result.groups')}{' '}{t('result.union')}</p></details>
    </> : <div className={styles.resultPlaceholder}>{empty ? <><h3>{t('result.placeholderTitle')}</h3><p>{message || t('result.placeholderBody')}</p></> : message ? <ErrorList errors={[...errors, ...(workerError ? [workerError] : [])]} id="scenario-errors" /> : <p>{t('result.counting')}</p>}</div>}
  </div>;
}

function MobileResultSummary({ scenario, result, errors, pending, deckInvalid }: { scenario: Scenario; result?: WorkerResult; errors: string[]; pending: boolean; deckInvalid: boolean }) {
  const { language, t } = useI18n();
  const probability = result?.result?.probability;
  const ready = !errors.length && probability !== undefined;
  const empty = scenario.alternatives.every(option => option.requirements.length === 0);
  const status = ready ? t('mobile.chance') : deckInvalid ? t('mobile.checkDeck') : empty ? t('mobile.addRequirement') : result?.error ? t('mobile.unavailable') : errors.length ? t('mobile.checkRequirements') : pending ? t('result.calculating') : t('mobile.addRequirement');
  return <aside className={styles.mobileSummary} aria-label={t('mobile.label')}>
    <div><span className={styles.mobileScenario} title={scenario.name.trim() || t('scenario.untitled')}>{scenario.name.trim() || t('scenario.untitled')}</span><span className={styles.mobileStatus}>{status}</span></div>
    <strong>{ready ? formatProbability(probability, language) : '—'}</strong>
    <a href="#opening-result">{t('mobile.view')}<Icon name="arrow" size={14} /></a>
  </aside>;
}

function ErrorList({ errors, id }: { errors: string[]; id: string }) {
  if (!errors.length) return null;
  return <div className={styles.errors} id={id} role="status">{errors.map(error => <p key={error}><Icon name="info" size={15} /><span>{error}</span></p>)}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return <dialog className={styles.modal} ref={ref} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-labelledby="modal-title"><div className={styles.modalHeading}><h2 id="modal-title">{title}</h2><button className={styles.iconButton} onClick={onClose} aria-label={t('modal.close')}><Icon name="close" /></button></div>{children}</dialog>;
}
