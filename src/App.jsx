import { useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowRight, BookOpen, Check, ChevronRight, CircleCheck, Download,
  Flame, Heart, Lightbulb, NotebookPen, PencilLine, Plus, Sparkles, Target,
  Truck, UtensilsCrossed, Wrench,
} from 'lucide-react';

const DB_NAME = 'ExecutiveOS_DataCore_v3';
const STORE_NAME = 'v_recipes';
const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Activity },
  { id: 'training', label: 'Training', icon: Wrench },
  { id: 'kitchen', label: 'Kitchen', icon: UtensilsCrossed },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'journal', label: 'Journal', icon: NotebookPen },
];
const DEFAULT_TRAINING = {
  backhoe: { 'Hydraulic lockout': 'Learned', 'Stabilizer setup': 'In progress', 'Safety check': 'Complete' },
  truck: { 'Pre-trip walkaround': 'In progress', 'Load awareness': 'Learned', 'Cabin setup': 'Complete' },
};
const MODULES = {
  backhoe: [
    { title: 'Hydraulic lockout', detail: 'Review isolation points in the operator manual before service work.', icon: Wrench },
    { title: 'Stabilizers', detail: 'Practice identifying firm, level ground and checking the work zone.', icon: Target },
    { title: 'Safety check', detail: 'Walk through a pre-shift inspection with a qualified trainer.', icon: CircleCheck },
  ],
  truck: [
    { title: 'Pre-trip walkaround', detail: 'Review tires, lights, mirrors, and required inspection records.', icon: CircleCheck },
    { title: 'Load awareness', detail: 'Learn how load limits and distribution affect a safe trip.', icon: Target },
    { title: 'Cabin setup', detail: 'Adjust mirrors, seat, and controls before moving the vehicle.', icon: Wrench },
  ],
};
const MODULE_STATES = ['Not started', 'In progress', 'Learned', 'Complete'];
const CREATIVE_TABS = [
  { id: 'journal', label: 'Journal', icon: NotebookPen, prompt: 'What felt like a win today?' },
  { id: 'poetry', label: 'Poetry', icon: BookOpen, prompt: 'Save a line, image, or thought...' },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb, prompt: 'Capture your next bright idea...' },
];

function readLocal(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the current session usable if local storage is unavailable.
  }
}

function openRecipeDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getRecipes(database) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.reverse());
    request.onerror = () => reject(request.error);
  });
}

function addRecipe(database, recipe) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).add(recipe);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}

function getReminderState(now, reminderTime, lastLogged) {
  const [hours, minutes] = reminderTime.split(':').map(Number);
  const scheduledToday = new Date(now);
  scheduledToday.setHours(hours, minutes, 0, 0);
  const loggedToday = lastLogged && new Date(lastLogged).toDateString() === now.toDateString();
  const nextReminder = new Date(scheduledToday);
  if (nextReminder <= now || loggedToday) nextReminder.setDate(nextReminder.getDate() + 1);
  const remaining = Math.max(0, scheduledToday.getTime() - now.getTime());
  const minutesUntil = Math.ceil(remaining / 60000);
  const status = loggedToday ? 'On track' : scheduledToday < now ? 'Reminder time passed' : minutesUntil <= 60 ? 'Dose window closing' : 'On track';
  return { loggedToday, nextReminder, remaining, minutesUntil, status };
}

function IconBadge({ icon: Icon, tone = 'teal', small = false }) {
  return <span className={`icon-badge icon-badge--${tone}${small ? ' icon-badge--small' : ''}`}><Icon aria-hidden="true" /></span>;
}

function SectionHeading({ icon, eyebrow, title, titleId, action }) {
  const Icon = icon;
  return (
    <div className="section-heading">
      <div className="section-heading__title">
        <IconBadge icon={Icon} small />
        <div><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2></div>
      </div>
      {action}
    </div>
  );
}

function ProgressRing({ value, size = 58, stroke = 5, tone = 'teal', label }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100);
  return (
    <div className={`progress-ring progress-ring--${tone}`} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${value}%`}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="progress-ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle className="progress-ring__value" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg><span>{value}%</span>
    </div>
  );
}

function ComplianceCard({ reminderTime, onReminderChange, lastLogged, onLog, now }) {
  const reminder = getReminderState(now, reminderTime, lastLogged);
  const progress = 100 - Math.min(reminder.remaining / 86400000, 100);
  const warning = reminder.status !== 'On track';
  const logged = lastLogged ? new Date(lastLogged) : null;
  return (
    <section className="surface compliance-card" id="home" aria-labelledby="compliance-title">
      <div className="compliance-card__top">
        <SectionHeading icon={Heart} eyebrow="Daily care" title="Opill schedule" titleId="compliance-title" />
        <span className={`status-pill ${warning ? 'status-pill--warning' : ''}`}><span className="status-pill__dot" />{reminder.status}</span>
      </div>
      <div className="compliance-card__content">
        <div className="countdown-block">
          <ProgressRing value={Math.round(progress)} size={100} stroke={7} label="Time until reminder" />
          <div className="countdown-block__copy"><span className="micro-label">Your next reminder</span><strong>{formatTime(reminder.nextReminder)}</strong><span>{reminder.loggedToday ? 'A fresh reminder is set for tomorrow.' : reminder.minutesUntil > 0 && reminder.minutesUntil < 1440 ? `In ${Math.floor(reminder.minutesUntil / 60)}h ${reminder.minutesUntil % 60}m` : reminder.status}</span></div>
        </div>
        <div className="compliance-card__details">
          <div className="detail-cell"><span className="micro-label">Last logged</span><strong>{logged ? `${formatTime(logged)} today` : 'No dose logged yet'}</strong></div>
          <label className="detail-cell reminder-setting"><span className="micro-label">Daily reminder</span><input type="time" value={reminderTime} onChange={(event) => onReminderChange(event.target.value)} aria-label="Daily reminder time" /></label>
        </div>
      </div>
      <div className="compliance-card__footer">
        <button className="button button--primary" onClick={onLog} disabled={reminder.loggedToday}><Check size={18} aria-hidden="true" />{reminder.loggedToday ? "Today's dose logged" : "Log today's dose"}</button>
        <p className="fine-print">A reminder based on your chosen time. Follow your product label or clinician's instructions.</p>
      </div>
    </section>
  );
}

function TrainingCard({ machine, onMachineChange, training, onTrainingChange, challengeDone, onChallengeDone }) {
  const modules = MODULES[machine];
  const progress = Math.round(modules.reduce((sum, item) => sum + ({ 'Not started': 0, 'In progress': 35, Learned: 70, Complete: 100 }[training[machine][item.title]] || 0), 0) / modules.length);
  const cycleStatus = (title) => {
    const current = training[machine][title] || 'Not started';
    const next = MODULE_STATES[(MODULE_STATES.indexOf(current) + 1) % MODULE_STATES.length];
    onTrainingChange(machine, title, next);
  };
  return (
    <section className="surface training-card" id="training" aria-labelledby="training-title">
      <SectionHeading icon={Wrench} eyebrow="Build confidence" title="Equipment skills trainer" titleId="training-title" action={<ProgressRing value={progress} label="Training progress" />} />
      <div className="equipment-hero">
        <img src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=85" alt="Construction crew working on an active job site" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        <div className="equipment-hero__shade" /><div className="equipment-hero__caption"><span className="photo-tag"><Activity size={13} />Field notes</span><strong>Learn the why behind every walkaround.</strong></div>
      </div>
      <div className="segmented-control" role="group" aria-label="Choose equipment">
        <button className={machine === 'backhoe' ? 'is-selected' : ''} onClick={() => onMachineChange('backhoe')} aria-pressed={machine === 'backhoe'}>Backhoe</button>
        <button className={machine === 'truck' ? 'is-selected' : ''} onClick={() => onMachineChange('truck')} aria-pressed={machine === 'truck'}>Triple-axle dump truck</button>
      </div>
      <div className="daily-challenge"><span className="challenge-icon"><Flame size={18} /></span><div className="daily-challenge__copy"><span className="micro-label">Daily challenge</span><strong>{machine === 'backhoe' ? 'Name three pre-shift checks' : 'Complete a mirror and visibility check'}</strong></div><button className={`challenge-button${challengeDone ? ' is-done' : ''}`} onClick={onChallengeDone} aria-label={challengeDone ? 'Mark challenge incomplete' : 'Complete daily challenge'}>{challengeDone ? <Check size={17} /> : <ChevronRight size={18} />}</button></div>
      <div className="module-list">{modules.map(({ title, detail, icon }) => {
        const Icon = icon;
        const status = training[machine][title] || 'Not started';
        return <article className="learning-module" key={title}><IconBadge icon={Icon} tone={status === 'Complete' ? 'green' : 'slate'} small /><div className="learning-module__content"><div className="learning-module__title"><h3>{title}</h3><span className={`module-status module-status--${status.toLowerCase().replace(' ', '-')}`}>{status}</span></div><p>{detail}</p></div><button className="icon-button module-action" onClick={() => cycleStatus(title)} aria-label={`Update ${title} status`} title="Update status"><ArrowRight size={17} /></button></article>;
      })}</div>
      <p className="fine-print training-note">Learning prompts support supervised training. Follow your employer's procedures and the operator manual.</p>
    </section>
  );
}

function RecipeCard({ recipe, index }) {
  const heat = Math.max(1, Math.min(10, Number(recipe.heat) || 1));
  return (
    <article className={`recipe-card recipe-card--${index % 3}`}>
      <div className="recipe-card__art"><span className="recipe-card__emoji" aria-hidden="true">{recipe.icon.split(' ')[0]}</span><span className="recipe-card__cost">${Number(recipe.cost || 0).toFixed(2)} est.</span><span className="recipe-card__art-label">Menu concept</span></div>
      <div className="recipe-card__body"><div className="recipe-card__title"><div><h3>{recipe.dish}</h3><p>{recipe.science}</p></div><span className="heat-mark" aria-label={`Heat level ${heat} out of 10`}>{Array.from({ length: 3 }, (_, item) => <Flame key={item} size={14} fill={item < Math.ceil(heat / 4) ? 'currentColor' : 'none'} />)}</span></div><p className="recipe-card__notes">{recipe.notes || 'A new idea for your menu board.'}</p><div className="recipe-card__meta"><span>Heat {heat}/10</span><span>{recipe.createdAt ? formatDate(new Date(recipe.createdAt)) : recipe.timestamp || 'Saved concept'}</span></div></div>
    </article>
  );
}

function KitchenCard({ recipes, databaseReady, databaseError, onAddRecipe }) {
  const [dish, setDish] = useState('');
  const [icon, setIcon] = useState('🌮 Taco');
  const [heat, setHeat] = useState('4');
  const [science, setScience] = useState('Bright citrus');
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (!dish.trim()) return;
    await onAddRecipe({ dish: dish.trim(), icon, heat: Number(heat), science, notes: notes.trim(), cost: Number(cost) || 0, createdAt: new Date().toISOString() });
    setDish(''); setNotes(''); setCost('');
  };
  return (
    <section className="surface kitchen-card" id="kitchen" aria-labelledby="kitchen-title">
      <SectionHeading icon={UtensilsCrossed} eyebrow="Make it memorable" title="Food truck development studio" titleId="kitchen-title" action={<span className="saved-count">{recipes.length} {recipes.length === 1 ? 'concept' : 'concepts'}</span>} />
      <div className="kitchen-intro"><span className="kitchen-intro__sparkle"><Sparkles size={20} /></span><p>Turn a flavor idea into a menu-ready concept. Your cards stay on this device.</p></div>
      <form className="recipe-form" onSubmit={submit}>
        <div className="form-grid form-grid--top"><label className="field field--wide"><span>Menu item</span><input value={dish} onChange={(event) => setDish(event.target.value)} placeholder="Crispy mushroom tacos" required /></label><label className="field"><span>Style</span><select value={icon} onChange={(event) => setIcon(event.target.value)}><option>🌮 Taco</option><option>🔥 Grill</option><option>🥤 Drink</option><option>🍰 Sweet</option></select></label></div>
        <div className="form-grid form-grid--details"><label className="field"><span>Flavor direction</span><select value={science} onChange={(event) => setScience(event.target.value)}><option>Bright citrus</option><option>Smoky and savory</option><option>Creamy and crisp</option><option>Sweet heat</option></select></label><label className="field"><span>Heat level <b>{heat}/10</b></span><input type="range" min="1" max="10" value={heat} onChange={(event) => setHeat(event.target.value)} /></label><label className="field"><span>Estimated cost</span><div className="input-prefix"><span>$</span><input type="number" min="0" step="0.25" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="8.50" /></div></label></div>
        <label className="field"><span>Flavor notes</span><textarea rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Texture, ingredients, or the story behind it..." /></label>
        <button className="button button--primary recipe-submit" type="submit" disabled={!databaseReady}><Plus size={18} />Create recipe card</button>
        {databaseError && <p className="inline-note" role="status">Recipe storage is unavailable in this browser session.</p>}
      </form>
      <div className="recipe-grid" aria-live="polite">{recipes.length ? recipes.map((recipe, index) => <RecipeCard recipe={recipe} index={index} key={`${recipe.createdAt || recipe.timestamp}-${index}`} />) : <div className="empty-recipes"><div><UtensilsCrossed size={20} /></div><strong>Your menu starts here</strong><span>Save a recipe concept to see it take shape.</span></div>}</div>
    </section>
  );
}

function GoalItem({ icon: Icon, title, current, total, tone, money = false }) {
  const progress = Math.round(current / total * 100);
  return <article className="goal-item"><ProgressRing value={progress} size={62} stroke={5} tone={tone} label={`${title} progress`} /><div className="goal-item__detail"><div className="goal-item__title"><Icon size={16} /><h3>{title}</h3></div><strong>{money ? `$${current.toLocaleString()} / $${total.toLocaleString()}` : `${current} / ${total}`}</strong><div className="goal-track"><span style={{ width: `${progress}%` }} /></div></div><span className="goal-percent">{progress}%</span></article>;
}

function GoalsCard() {
  return <section className="surface goals-card" id="goals" aria-labelledby="goals-title"><SectionHeading icon={Target} eyebrow="Big picture, small steps" title="Business & life goals" titleId="goals-title" /><div className="goals-summary"><span className="goals-summary__icon"><Sparkles size={17} /></span><p>You're building momentum in <strong>3 goals</strong>.</p></div><div className="goal-list"><GoalItem icon={Truck} title="Food truck fund" current={2350} total={20000} tone="teal" money /><GoalItem icon={Heart} title="Wedding fund" current={1100} total={10000} tone="rose" money /><GoalItem icon={BookOpen} title="Books read" current={8} total={24} tone="amber" /></div><button className="text-action" onClick={() => document.getElementById('journal')?.scrollIntoView({ behavior: 'smooth' })}>Reflect on your progress <ArrowRight size={16} /></button></section>;
}

function downloadGraphic(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) return;
  const gradient = context.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#14B8A6'); gradient.addColorStop(.55, '#287c72'); gradient.addColorStop(1, '#141B2D');
  context.fillStyle = gradient; context.fillRect(0, 0, 1080, 1350);
  context.fillStyle = 'rgba(248,250,252,.11)'; context.beginPath(); context.arc(900, 190, 250, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#d1fae5'; context.font = '600 30px Inter, sans-serif'; context.fillText('A NOTE TO KEEP', 86, 150);
  context.fillStyle = '#f8fafc'; context.font = '700 68px Inter, sans-serif';
  let line = ''; let y = 520;
  text.split(/\s+/).forEach((word) => {
    const next = `${line}${word} `;
    if (context.measureText(next).width > 900 && line) { context.fillText(line.trim(), 86, y); line = `${word} `; y += 92; } else line = next;
  });
  if (line) context.fillText(line.trim(), 86, y);
  context.fillStyle = 'rgba(248,250,252,.75)'; context.font = '500 28px Inter, sans-serif'; context.fillText('Creative Command Center · Make room for what matters', 86, 1240);
  const link = document.createElement('a'); link.download = 'creative-command-center-post.png'; link.href = canvas.toDataURL('image/png'); link.click();
}

function CreativeCard({ entries, onEntryChange }) {
  const [activeTab, setActiveTab] = useState('journal');
  const [graphicText, setGraphicText] = useState('');
  const [graphicReady, setGraphicReady] = useState(false);
  const tab = CREATIVE_TABS.find((item) => item.id === activeTab);
  const ActiveIcon = tab.icon;
  const generate = () => { setGraphicText(entries[activeTab].trim() || 'Build a life you are proud to wake up to.'); setGraphicReady(true); };
  return (
    <section className="surface creative-card" id="journal" aria-labelledby="journal-title"><SectionHeading icon={PencilLine} eyebrow="Make space to think" title="Creative studio" titleId="journal-title" />
      <div className="creative-tabs" role="tablist" aria-label="Creative writing space">{CREATIVE_TABS.map(({ id, label, icon: Icon }) => <button role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'is-active' : ''} key={id} onClick={() => setActiveTab(id)}><Icon size={16} />{label}</button>)}</div>
      <div className="writing-area"><div className="writing-area__heading"><span className="writing-icon"><ActiveIcon size={17} /></span><span>{tab.label} space</span><span className="saved-indicator"><span />Saved on this device</span></div><label className="visually-hidden" htmlFor="creative-entry">Your {tab.label.toLowerCase()} entry</label><textarea id="creative-entry" value={entries[activeTab]} onChange={(event) => onEntryChange(activeTab, event.target.value)} placeholder={tab.prompt} rows="5" /></div>
      <div className="graphic-heading"><div><span className="micro-label">A little something to share</span><h3>Social post graphic</h3></div><button className="button button--secondary" onClick={generate}><Sparkles size={16} />Generate graphic</button></div>
      <div className={`social-preview${graphicReady ? ' social-preview--ready' : ''}`}><span className="social-preview__label">Creative Command Center <span>·</span> A thought to carry</span><p>{graphicReady ? graphicText : 'Your words, turned into something worth sharing.'}</p><span className="social-preview__mark"><span />Make room for what matters</span></div>
      {graphicReady && <button className="text-action download-action" onClick={() => downloadGraphic(graphicText)}><Download size={16} />Download social graphic <ArrowRight size={15} /></button>}
    </section>
  );
}

function BottomNavigation({ activeSection, onNavigate }) {
  return <nav className="bottom-nav" aria-label="Main navigation">{NAV_ITEMS.map(({ id, label, icon: Icon }) => <button className={activeSection === id ? 'is-active' : ''} key={id} onClick={() => onNavigate(id)} aria-current={activeSection === id ? 'page' : undefined}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)}</nav>;
}

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [reminderTime, setReminderTime] = useState(() => readLocal('executive-os-reminder', '12:00'));
  const [lastLogged, setLastLogged] = useState(() => readLocal('executive-os-last-dose', ''));
  const [machine, setMachine] = useState(() => readLocal('executive-os-machine', 'backhoe'));
  const [training, setTraining] = useState(() => readLocal('executive-os-training', DEFAULT_TRAINING));
  const [challengeDone, setChallengeDone] = useState(() => readLocal('executive-os-challenge', false));
  const [entries, setEntries] = useState(() => readLocal('executive-os-creative', { journal: '', poetry: '', ideas: '' }));
  const [recipes, setRecipes] = useState([]);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [toast, setToast] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const databaseRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let mounted = true;
    openRecipeDatabase().then(async (database) => {
      databaseRef.current = database;
      const saved = await getRecipes(database);
      if (mounted) { setRecipes(saved); setDatabaseReady(true); }
    }).catch(() => { if (mounted) { setDatabaseError(true); setDatabaseReady(true); } });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    const installHandler = (event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('beforeinstallprompt', installHandler);
    return () => { mounted = false; window.removeEventListener('beforeinstallprompt', installHandler); };
  }, []);
  useEffect(() => {
    const sections = NAV_ITEMS.map(({ id }) => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver((visibleEntries) => {
      const visible = visibleEntries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-20% 0px -55% 0px', threshold: [0, .15, .35] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = (message) => { setToast(message); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 2600); };
  const updateReminder = (value) => { setReminderTime(value); writeLocal('executive-os-reminder', value); };
  const logDose = () => { const time = new Date().toISOString(); setLastLogged(time); writeLocal('executive-os-last-dose', time); showToast("Today's dose was logged."); };
  const updateTraining = (equipment, title, status) => setTraining((current) => { const value = { ...current, [equipment]: { ...current[equipment], [title]: status } }; writeLocal('executive-os-training', value); return value; });
  const updateEntry = (tab, text) => setEntries((current) => { const value = { ...current, [tab]: text }; writeLocal('executive-os-creative', value); return value; });
  const saveRecipe = async (recipe) => {
    if (!databaseRef.current) { showToast('Recipe storage is not available right now.'); return; }
    try { await addRecipe(databaseRef.current, recipe); setRecipes((current) => [recipe, ...current]); showToast('Recipe concept saved.'); }
    catch { showToast('This recipe could not be saved. Try again.'); }
  };
  const navigate = (id) => { setActiveSection(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const installApp = async () => { if (!installPrompt) return; await installPrompt.prompt(); setInstallPrompt(null); };
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return <div className="app-shell"><div className="ambient ambient--top" aria-hidden="true" /><div className="ambient ambient--side" aria-hidden="true" />
    <header className="topbar"><a className="brand" href="#home" onClick={(event) => { event.preventDefault(); navigate('home'); }}><span className="brand__mark"><Activity size={19} /></span><span className="brand__copy"><strong>Creative Command Center</strong><small>Private <i>·</i> Offline <i>·</i> Synced on device</small></span></a><div className="topbar__right"><span className="topbar-date">{formatDate(now)}</span>{installPrompt && <button className="install-button" onClick={installApp}><Download size={15} />Install</button>}<span className="profile-mark" aria-label="Your profile">J</span></div></header>
    <main className="dashboard"><div className="welcome-row"><div><p className="eyebrow">Your personal dashboard</p><h1>{greeting}, Jessie<span>.</span></h1><p className="welcome-subtitle">A little progress adds up.</p></div><div className="day-chip"><span className="day-chip__dot" />Your day, in rhythm</div></div>
      <div className="dashboard-grid"><ComplianceCard reminderTime={reminderTime} onReminderChange={updateReminder} lastLogged={lastLogged} onLog={logDose} now={now} /><TrainingCard machine={machine} onMachineChange={(value) => { setMachine(value); writeLocal('executive-os-machine', value); }} training={training} onTrainingChange={updateTraining} challengeDone={challengeDone} onChallengeDone={() => setChallengeDone((value) => { writeLocal('executive-os-challenge', !value); return !value; })} /><GoalsCard /><KitchenCard recipes={recipes} databaseReady={databaseReady} databaseError={databaseError} onAddRecipe={saveRecipe} /><CreativeCard entries={entries} onEntryChange={updateEntry} /></div>
      <footer className="page-footer"><span className="footer-mark"><Activity size={14} /></span><span>Made for the life you're building.</span></footer>
    </main><BottomNavigation activeSection={activeSection} onNavigate={navigate} /><div className={`toast${toast ? ' toast--visible' : ''}`} role="status" aria-live="polite"><Check size={16} />{toast}</div>
  </div>;
}
